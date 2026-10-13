import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `request()` narrows the hard-redirect-to-/login condition from "any 401" to "401 only when a
// token was actually sent" — otherwise an anonymous visitor on a public page that happens to
// probe a protected endpoint gets yanked to /login. Neither side of that branch had a test:
// api.test.ts contains no 401 case at all, so a later edit dropping the `&& token` guard (or
// dropping the whole branch, stranding a user on a dead token) would pass CI.
//
// Each case re-imports the module because `isRedirecting` is module-level state — it exists so
// the first expiring request wins the redirect and concurrent ones do not fight it, which also
// means one test's redirect would suppress the next test's.

const TOKEN_KEY = "clossette_token";

describe("api session-expiry redirect", () => {
  const mockFetch = vi.fn();
  let originalLocation: Location;

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", mockFetch);
    localStorage.clear();
    originalLocation = window.location;
    // jsdom refuses real navigation, so href has to be an ordinary writable property.
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { href: "/products" },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function unauthorized() {
    const body = { message: "Unauthorized" };
    return {
      ok: false,
      status: 401,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response;
  }

  it("clears the token and redirects when a 401 answers a request that carried one", async () => {
    localStorage.setItem(TOKEN_KEY, "expired.jwt.value");
    mockFetch.mockResolvedValue(unauthorized());
    const { api } = await import("@/lib/api");

    await expect(api.get("/api/auth/me")).rejects.toMatchObject({ status: 401 });

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(window.location.href).toBe("/login");
  });

  it("does neither when the 401 answers a request that carried no token", async () => {
    mockFetch.mockResolvedValue(unauthorized());
    const { api } = await import("@/lib/api");

    // Still an error for the caller to handle — it just is not session death.
    await expect(api.get("/api/products/1/recommended-size")).rejects.toMatchObject({
      status: 401,
    });

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(window.location.href).toBe("/products");
  });

  it("redirects once when several in-flight requests expire together", async () => {
    localStorage.setItem(TOKEN_KEY, "expired.jwt.value");
    mockFetch.mockResolvedValue(unauthorized());
    const { api } = await import("@/lib/api");

    await Promise.allSettled([
      api.get("/api/auth/me"),
      api.get("/api/cart"),
      api.get("/api/orders"),
    ]);

    expect(window.location.href).toBe("/login");
  });

  it("leaves the token alone on a 403, which is a permission answer rather than a dead session", async () => {
    localStorage.setItem(TOKEN_KEY, "valid.jwt.value");
    const body = { message: "Access denied" };
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response);
    const { api } = await import("@/lib/api");

    await expect(api.get("/api/admin/posts")).rejects.toMatchObject({ status: 403 });

    expect(localStorage.getItem(TOKEN_KEY)).toBe("valid.jwt.value");
    expect(window.location.href).toBe("/products");
  });
});
