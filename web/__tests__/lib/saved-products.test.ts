import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getSavedProductIds,
  isProductSaved,
  toggleSavedProduct,
  clearSavedProducts,
  syncSavedProducts,
  resetSavedProductsSync,
  SAVED_PRODUCTS_STORAGE_KEY,
} from "@/lib/saved-products";
import { AUTH_TOKEN_KEY, savedProducts as savedProductsApi } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    savedProducts: {
      list: vi.fn(),
      save: vi.fn(),
      remove: vi.fn(),
    },
  };
});

const listMock = vi.mocked(savedProductsApi.list);
const saveMock = vi.mocked(savedProductsApi.save);
const removeMock = vi.mocked(savedProductsApi.remove);

function signIn() {
  localStorage.setItem(AUTH_TOKEN_KEY, "a.jwt.token");
}

function entry(productId: number) {
  return { id: productId * 10, productId, product: {}, createdAt: "" };
}

describe("saved-products (signed out — localStorage only)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetSavedProductsSync();
    vi.clearAllMocks();
  });

  it("starts empty", () => {
    expect(getSavedProductIds()).toEqual([]);
    expect(isProductSaved(1)).toBe(false);
  });

  it("toggleSavedProduct saves, then unsaves, returning the new state", async () => {
    await expect(toggleSavedProduct(7)).resolves.toBe(true);
    expect(isProductSaved(7)).toBe(true);
    expect(getSavedProductIds()).toEqual([7]);

    await expect(toggleSavedProduct(7)).resolves.toBe(false);
    expect(isProductSaved(7)).toBe(false);
    expect(getSavedProductIds()).toEqual([]);
  });

  it("updates the store before awaiting, so the heart flips immediately", () => {
    // Not awaited on purpose: the shop grid's handler is synchronous.
    void toggleSavedProduct(7);
    expect(isProductSaved(7)).toBe(true);
  });

  it("does not call the server when there is no token", async () => {
    await toggleSavedProduct(7);
    expect(saveMock).not.toHaveBeenCalled();
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("keeps the most recently saved product first", async () => {
    await toggleSavedProduct(1);
    await toggleSavedProduct(2);
    await toggleSavedProduct(3);
    expect(getSavedProductIds()).toEqual([3, 2, 1]);
  });

  it("persists across reads and never duplicates an id", async () => {
    await toggleSavedProduct(4);
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify([4, 4, 4]));
    expect(getSavedProductIds()).toEqual([4]);
    await expect(toggleSavedProduct(4)).resolves.toBe(false);
    expect(getSavedProductIds()).toEqual([]);
  });

  it("survives corrupt storage without throwing", async () => {
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, "{not json");
    expect(getSavedProductIds()).toEqual([]);
    await expect(toggleSavedProduct(9)).resolves.toBe(true);
    expect(getSavedProductIds()).toEqual([9]);
  });

  it("ignores non-numeric entries written by other versions", () => {
    localStorage.setItem(
      SAVED_PRODUCTS_STORAGE_KEY,
      JSON.stringify([1, "2", null, 3.5, 4]),
    );
    expect(getSavedProductIds()).toEqual([1, 4]);
  });

  it("clearSavedProducts empties the store", async () => {
    await toggleSavedProduct(1);
    await toggleSavedProduct(2);
    clearSavedProducts();
    expect(getSavedProductIds()).toEqual([]);
  });

  it("notifies subscribers on write and on clear", async () => {
    const seen: string[] = [];
    const handler = () => seen.push("changed");
    window.addEventListener("clossette:saved-products-changed", handler);

    await toggleSavedProduct(1);
    await toggleSavedProduct(1);
    clearSavedProducts();

    window.removeEventListener("clossette:saved-products-changed", handler);
    expect(seen).toHaveLength(3);
  });

  it("syncSavedProducts is a no-op without a token", async () => {
    await syncSavedProducts();
    expect(listMock).not.toHaveBeenCalled();
  });
});

describe("saved-products (signed in — server-backed)", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    resetSavedProductsSync();
    vi.clearAllMocks();
    signIn();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  // ── writes ──────────────────────────────────────────────────────────────

  it("saves through to the server", async () => {
    saveMock.mockResolvedValue(entry(7) as never);

    await expect(toggleSavedProduct(7)).resolves.toBe(true);

    expect(saveMock).toHaveBeenCalledWith(7);
    expect(getSavedProductIds()).toEqual([7]);
  });

  it("unsaves through to the server", async () => {
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify([7]));
    removeMock.mockResolvedValue(undefined);

    await expect(toggleSavedProduct(7)).resolves.toBe(false);

    expect(removeMock).toHaveBeenCalledWith(7);
    expect(getSavedProductIds()).toEqual([]);
  });

  it("rolls the optimistic save back when the server rejects it", async () => {
    saveMock.mockRejectedValue(new Error("500"));

    // Resolves to the settled state, not the optimistic one, and never rejects:
    // a call site that ignores the promise must not get an unhandled rejection.
    await expect(toggleSavedProduct(7)).resolves.toBe(false);

    expect(getSavedProductIds()).toEqual([]);
    expect(consoleError).toHaveBeenCalled();
  });

  it("rolls the optimistic unsave back when the server rejects it", async () => {
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify([7]));
    removeMock.mockRejectedValue(new Error("500"));

    await expect(toggleSavedProduct(7)).resolves.toBe(true);

    expect(getSavedProductIds()).toEqual([7]);
  });

  it("rolls back to the prior set, not the inverse of the optimistic value", async () => {
    // Another tab added 9 while the request was in flight. Inverting the
    // optimistic change would have clobbered it.
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify([1]));
    saveMock.mockRejectedValue(new Error("500"));

    await toggleSavedProduct(7);

    expect(getSavedProductIds()).toEqual([1]);
  });

  // ── hydration + merge ───────────────────────────────────────────────────

  it("pulls the server's set into the cache", async () => {
    listMock.mockResolvedValue([entry(3), entry(1)] as never);

    await syncSavedProducts();

    expect(getSavedProductIds()).toEqual([3, 1]);
  });

  it("replays products saved while signed out, newest first", async () => {
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify([99]));
    listMock.mockResolvedValue([entry(3)] as never);
    saveMock.mockResolvedValue(entry(99) as never);

    await syncSavedProducts();

    expect(saveMock).toHaveBeenCalledWith(99);
    expect(getSavedProductIds()).toEqual([99, 3]);
  });

  it("does not re-save an id the server already has", async () => {
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify([3]));
    listMock.mockResolvedValue([entry(3)] as never);

    await syncSavedProducts();

    expect(saveMock).not.toHaveBeenCalled();
  });

  it("never removes server entries that are missing locally", async () => {
    // A save made on another device must not be deleted just because this
    // browser has not heard of it.
    listMock.mockResolvedValue([entry(5)] as never);

    await syncSavedProducts();

    expect(removeMock).not.toHaveBeenCalled();
    expect(getSavedProductIds()).toContain(5);
  });

  it("keeps a failed replay in the cache so the next sync retries it", async () => {
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify([99]));
    listMock.mockResolvedValue([] as never);
    saveMock.mockRejectedValue(new Error("500"));

    await syncSavedProducts();

    expect(getSavedProductIds()).toEqual([99]);
    expect(consoleError).toHaveBeenCalled();
  });

  it("leaves the cache intact when the server read fails", async () => {
    localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, JSON.stringify([42]));
    listMock.mockRejectedValue(new Error("offline"));

    await syncSavedProducts();

    expect(getSavedProductIds()).toEqual([42]);
    expect(consoleError).toHaveBeenCalled();
  });

  it("retries on the next call after a failed read", async () => {
    listMock.mockRejectedValueOnce(new Error("offline"));
    await syncSavedProducts();

    listMock.mockResolvedValue([entry(8)] as never);
    await syncSavedProducts();

    expect(getSavedProductIds()).toEqual([8]);
  });

  it("hydrates at most once per page load", async () => {
    listMock.mockResolvedValue([] as never);

    await Promise.all([syncSavedProducts(), syncSavedProducts(), syncSavedProducts()]);

    expect(listMock).toHaveBeenCalledTimes(1);
  });
});
