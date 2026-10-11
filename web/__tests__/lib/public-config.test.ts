import { describe, it, expect, vi, beforeEach } from "vitest";

import { getPublicConfig, __resetPublicConfigCache } from "@/lib/public-config";
import { publicConfig } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  publicConfig: { get: vi.fn() },
}));

const mockGet = vi.mocked(publicConfig.get);
const CONFIG = { checkoutEnabled: true, requireEmailVerification: true };

describe("getPublicConfig", () => {
  beforeEach(() => {
    __resetPublicConfigCache();
    mockGet.mockReset();
  });

  it("does not pass any caller's AbortSignal to the shared request", async () => {
    // This is the whole defect. The cached in-flight promise is handed to every concurrent
    // caller, but only the first caller's signal reached the fetch — so when that caller
    // unmounted and aborted, the rejection propagated to callers that had cancelled nothing,
    // and their own `signal.aborted` guards were false, so they committed an error state.
    mockGet.mockResolvedValue(CONFIG);

    await getPublicConfig();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith();
  });

  it("serves concurrent callers from one request", async () => {
    mockGet.mockResolvedValue(CONFIG);

    const [a, b, c] = await Promise.all([
      getPublicConfig(),
      getPublicConfig(),
      getPublicConfig(),
    ]);

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("serves later callers from the cache", async () => {
    mockGet.mockResolvedValue(CONFIG);

    await getPublicConfig();
    await getPublicConfig();

    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failure", async () => {
    // A transient network failure must not pin the app to a wrong permanent answer.
    mockGet.mockRejectedValueOnce(new Error("network"));
    await expect(getPublicConfig()).rejects.toThrow("network");

    mockGet.mockResolvedValueOnce(CONFIG);
    await expect(getPublicConfig()).resolves.toEqual(CONFIG);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("rejects every concurrent caller when the shared request fails", async () => {
    // They share one request, so they share its outcome — that is correct. What was wrong was
    // one caller's *cancellation* becoming everyone's failure.
    mockGet.mockRejectedValue(new Error("network"));

    const results = await Promise.allSettled([getPublicConfig(), getPublicConfig()]);

    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
