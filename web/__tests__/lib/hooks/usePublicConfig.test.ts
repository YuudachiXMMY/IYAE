import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { usePublicConfig } from "@/lib/hooks/usePublicConfig";
import { __resetPublicConfigCache } from "@/lib/public-config";
import { publicConfig } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  publicConfig: { get: vi.fn() },
}));

const mockGet = vi.mocked(publicConfig.get);
const OFF = { checkoutEnabled: false, requireEmailVerification: true };
const ON = { checkoutEnabled: true, requireEmailVerification: true };

describe("usePublicConfig", () => {
  beforeEach(() => {
    __resetPublicConfigCache();
    mockGet.mockReset();
  });

  afterEach(() => {
    __resetPublicConfigCache();
  });

  it("reports checkout disabled once the flag resolves", async () => {
    mockGet.mockResolvedValue(OFF);

    const { result } = renderHook(() => usePublicConfig());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config?.checkoutEnabled).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it("reports an error rather than silently claiming checkout is off", async () => {
    // The two failure modes are not interchangeable: hiding a working checkout costs a sale.
    // A failed read must stay distinguishable from a resolved `false`.
    mockGet.mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => usePublicConfig());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.config).toBeNull();
  });

  it("reload retries after a failure and commits the new value", async () => {
    mockGet.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => usePublicConfig());
    await waitFor(() => expect(result.current.error).toBe(true));

    mockGet.mockResolvedValueOnce(ON);
    result.current.reload();

    await waitFor(() => expect(result.current.config?.checkoutEnabled).toBe(true));
    expect(result.current.error).toBe(false);
  });

  it("serves the shared cache without a second request", async () => {
    mockGet.mockResolvedValue(ON);
    const first = renderHook(() => usePublicConfig());
    await waitFor(() => expect(first.result.current.config).not.toBeNull());
    expect(mockGet).toHaveBeenCalledTimes(1);

    const second = renderHook(() => usePublicConfig());

    expect(second.result.current.config?.checkoutEnabled).toBe(true);
    expect(second.result.current.loading).toBe(false);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("does not commit a superseded response after unmount", async () => {
    let resolveFn: ((v: typeof ON) => void) | undefined;
    mockGet.mockReturnValue(
      new Promise<typeof ON>((resolve) => {
        resolveFn = resolve;
      }),
    );

    const { result, unmount } = renderHook(() => usePublicConfig());
    unmount();
    resolveFn?.(ON);

    await Promise.resolve();
    // The unmounted hook's state is frozen at its last committed value.
    expect(result.current.config).toBeNull();
  });

  it("two concurrent mounts share one request", async () => {
    mockGet.mockResolvedValue(ON);

    const a = renderHook(() => usePublicConfig());
    const b = renderHook(() => usePublicConfig());

    await waitFor(() => expect(a.result.current.config).not.toBeNull());
    await waitFor(() => expect(b.result.current.config).not.toBeNull());
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
