import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * Every `rigging.getStatus` call is parked here instead of resolving, so a test
 * can decide the order responses come back in — which is the whole point: the
 * defects in this hook only appear when a response outlives the render that
 * asked for it.
 */
interface Pending {
  productId: number;
  signal?: AbortSignal;
  resolve: (data: unknown) => void;
  reject: (err: unknown) => void;
}

const { pending, mockGetStatus, mockTrigger, mockRetry } = vi.hoisted(() => {
  const pending: Pending[] = [];
  return {
    pending,
    mockGetStatus: vi.fn(
      (productId: number, signal?: AbortSignal) =>
        new Promise((resolve, reject) => {
          pending.push({ productId, signal, resolve, reject });
        })
    ),
    mockTrigger: vi.fn(),
    mockRetry: vi.fn(),
  };
});

vi.mock("@/lib/api", () => ({
  rigging: {
    getStatus: (productId: number, signal?: AbortSignal) =>
      mockGetStatus(productId, signal),
    trigger: (productId: number) => mockTrigger(productId),
    retry: (productId: number) => mockRetry(productId),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

import { useRiggingStatus } from "@/lib/hooks/useRiggingStatus";

function makeStatus(overrides: Record<string, unknown> = {}) {
  return {
    status: "READY" as const,
    riggedGlbUrl: null,
    errorMessage: null,
    failureCode: null,
    attemptCount: 0,
    ...overrides,
  };
}

/** Flush microtasks so the hook's promise chains commit. */
async function settle() {
  await act(async () => {});
}

describe("useRiggingStatus", () => {
  beforeEach(() => {
    pending.length = 0;
    mockGetStatus.mockClear();
    mockTrigger.mockReset();
    mockRetry.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not fetch when there is no product", async () => {
    renderHook(() => useRiggingStatus(null));
    await settle();
    expect(mockGetStatus).not.toHaveBeenCalled();
  });

  it("loads the status on mount", async () => {
    const { result } = renderHook(() => useRiggingStatus(42));
    await settle();

    expect(result.current.isLoading).toBe(true);
    expect(mockGetStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending[0].resolve(makeStatus({ riggedGlbUrl: "/assets/42.glb" }));
    });

    expect(result.current.status).toBe("READY");
    expect(result.current.riggedGlbUrl).toBe("/assets/42.glb");
    expect(result.current.isLoading).toBe(false);
  });

  it("clears the status when the load fails", async () => {
    const { result } = renderHook(() => useRiggingStatus(42));
    await settle();

    await act(async () => {
      pending[0].reject(new Error("Network error"));
    });

    expect(result.current.status).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  // ── Regressions: a request has to die with the render that started it ────────

  it("aborts the in-flight status request when the product changes", async () => {
    const { rerender } = renderHook(
      ({ productId }) => useRiggingStatus(productId),
      { initialProps: { productId: 1 } }
    );
    await settle();

    expect(pending).toHaveLength(1);
    rerender({ productId: 2 });
    await settle();

    expect(pending[0].signal?.aborted).toBe(true);
  });

  it("does not show one product's status on another product's page", async () => {
    // Same route, different param: the component is *not* unmounted, so a late
    // response from the product the user has left can overwrite the one on screen.
    const { result, rerender } = renderHook(
      ({ productId }) => useRiggingStatus(productId),
      { initialProps: { productId: 1 } }
    );
    await settle();

    rerender({ productId: 2 });
    await settle();

    // Product 2 answers first, then product 1's stale request comes back.
    await act(async () => {
      pending[1].resolve(makeStatus({ status: "NONE" }));
    });
    await act(async () => {
      pending[0].resolve(makeStatus({ status: "READY", riggedGlbUrl: "/assets/1.glb" }));
    });

    expect(result.current.status).toBe("NONE");
    expect(result.current.riggedGlbUrl).toBeNull();
  });

  it("aborts the in-flight status request on unmount", async () => {
    const { unmount } = renderHook(() => useRiggingStatus(42));
    await settle();

    expect(pending).toHaveLength(1);
    unmount();

    expect(pending[0].signal?.aborted).toBe(true);
  });

  it("stops polling and aborts the poll once unmounted", async () => {
    const { unmount } = renderHook(() => useRiggingStatus(42));
    await settle();

    await act(async () => {
      pending[0].resolve(makeStatus({ status: "RUNNING" }));
    });

    // One poll tick, left in flight.
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(mockGetStatus).toHaveBeenCalledTimes(2);

    unmount();
    expect(pending[1].signal?.aborted).toBe(true);

    // And no further ticks are scheduled.
    await act(async () => {
      vi.advanceTimersByTime(9000);
    });
    expect(mockGetStatus).toHaveBeenCalledTimes(2);
  });

  it("polls while the task is still running", async () => {
    renderHook(() => useRiggingStatus(42));
    await settle();

    await act(async () => {
      pending[0].resolve(makeStatus({ status: "PENDING" }));
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockGetStatus).toHaveBeenCalledTimes(2);
    expect(pending[1].productId).toBe(42);
  });

  it("clears the status while the new product's own request is in flight", async () => {
    // Without this, `status` still holds product 1's value during product 2's
    // load, and RiggingStatusCard renders `status ?? "NONE"` without waiting on
    // `isLoading` — so product 1's READY panel and its actions flash against
    // product 2.
    const { result, rerender } = renderHook(
      ({ productId }) => useRiggingStatus(productId),
      { initialProps: { productId: 1 } }
    );
    await settle();
    await act(async () => {
      pending[0].resolve(makeStatus({ status: "READY", riggedGlbUrl: "/assets/1.glb" }));
    });
    expect(result.current.status).toBe("READY");

    await act(async () => {
      rerender({ productId: 2 });
    });

    expect(result.current.status).toBeNull();
    expect(result.current.riggedGlbUrl).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it("lets the newest poll tick win when two are in flight", async () => {
    // At a 3s cadence against a slow endpoint two ticks can overlap. The
    // overlapping-tick window is narrower than it looks, because the polling
    // effect is keyed on `status?.status`: a tick that *changes* the status tears
    // the effect down and aborts whatever else was in flight. What that does not
    // cover is two ticks reporting the same status with different everything
    // else — the effect never re-runs, so the older reply lands last and
    // `attemptCount` walks backwards.
    const { result } = renderHook(() => useRiggingStatus(42));
    await settle();
    await act(async () => {
      pending[0].resolve(makeStatus({ status: "RUNNING", attemptCount: 1 }));
    });

    await act(async () => {
      vi.advanceTimersByTime(3000); // tick 1, left in flight
    });
    await act(async () => {
      vi.advanceTimersByTime(3000); // tick 2
    });
    expect(mockGetStatus).toHaveBeenCalledTimes(3);

    // Tick 2 answers, then the older tick 1 comes back with the earlier count.
    await act(async () => {
      pending[2].resolve(makeStatus({ status: "RUNNING", attemptCount: 3 }));
    });
    await act(async () => {
      pending[1].resolve(makeStatus({ status: "RUNNING", attemptCount: 2 }));
    });

    expect(result.current.attemptCount).toBe(3);
  });

  it("surfaces a trigger failure through actionError", async () => {
    const { ApiError } = await import("@/lib/api");
    mockTrigger.mockRejectedValue(new ApiError(503, "Rigging queue is full"));

    const { result } = renderHook(() => useRiggingStatus(42));
    await settle();
    await act(async () => {
      pending[0].resolve(makeStatus({ status: "NONE" }));
    });

    await act(async () => {
      await result.current.triggerRigging();
    });

    expect(result.current.actionError).toBe("Rigging queue is full");

    act(() => result.current.clearActionError());
    expect(result.current.actionError).toBeNull();
  });
});
