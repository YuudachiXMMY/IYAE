import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const mockApiGet = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
}));

import { useOutfitRiggingStatus } from "@/lib/hooks/useOutfitRiggingStatus";
import type { OutfitItem } from "@/lib/api";

function makeItem(overrides: Partial<OutfitItem> = {}): OutfitItem {
  return {
    slot: "top",
    productId: 1,
    productName: "Test Top",
    productPrice: 50,
    category: "tops",
    media: [],
    riggedGlbUrl: undefined,
    ...overrides,
  };
}

function makeRiggingReady(url = "/models/rigged.glb") {
  return {
    status: "READY" as const,
    riggedGlbUrl: url,
    errorMessage: null,
    failureCode: null,
    attemptCount: 1,
  };
}

function makeRiggingPending() {
  return {
    status: "RUNNING" as const,
    riggedGlbUrl: null,
    errorMessage: null,
    failureCode: null,
    attemptCount: 0,
  };
}

describe("useOutfitRiggingStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockApiGet.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("returns empty items and pendingCount=0 for empty array", () => {
    const { result } = renderHook(() => useOutfitRiggingStatus([]));
    expect(result.current.items).toEqual([]);
    expect(result.current.pendingCount).toBe(0);
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("does not poll when all items already have riggedGlbUrl", () => {
    const items = [makeItem({ riggedGlbUrl: "/rigged.glb" })];
    renderHook(() => useOutfitRiggingStatus(items));
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it("returns pendingCount=1 for item without riggedGlbUrl", async () => {
    mockApiGet.mockResolvedValue(makeRiggingPending());
    const items = [makeItem({ productId: 5 })];
    const { result } = renderHook(() => useOutfitRiggingStatus(items));

    // pendingCount reflects server-confirmed PENDING/RUNNING items — let the first poll resolve.
    await act(async () => {});
    expect(result.current.pendingCount).toBe(1);
  });

  it("polls the rigging-status endpoint for pending items", async () => {
    mockApiGet.mockResolvedValue(makeRiggingPending());
    const items = [makeItem({ productId: 7 })];
    renderHook(() => useOutfitRiggingStatus(items));

    await act(async () => {});

    expect(mockApiGet).toHaveBeenCalledWith(
      "/api/designer/products/7/rigging-status",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("updates item riggedGlbUrl when API returns READY", async () => {
    mockApiGet.mockResolvedValue(makeRiggingReady("/models/top-rigged.glb"));
    const items = [makeItem({ productId: 10 })];
    const { result } = renderHook(() => useOutfitRiggingStatus(items));

    await act(async () => {});

    expect(result.current.items[0].riggedGlbUrl).toBe("/models/top-rigged.glb");
  });

  it("decrements pendingCount to 0 after item becomes READY", async () => {
    mockApiGet.mockResolvedValue(makeRiggingReady());
    const items = [makeItem({ productId: 11 })];
    const { result } = renderHook(() => useOutfitRiggingStatus(items));

    await act(async () => {});

    expect(result.current.pendingCount).toBe(0);
  });

  it("does not update items that were not returned as READY", async () => {
    mockApiGet.mockResolvedValue(makeRiggingPending());
    const items = [makeItem({ productId: 12 })];
    const { result } = renderHook(() => useOutfitRiggingStatus(items));

    await act(async () => {});

    expect(result.current.items[0].riggedGlbUrl).toBeUndefined();
  });

  it("polls on interval after initial call", async () => {
    mockApiGet.mockResolvedValue(makeRiggingPending());
    const items = [makeItem({ productId: 20 })];
    renderHook(() => useOutfitRiggingStatus(items));

    await act(async () => {});
    const callsAfterMount = mockApiGet.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    await act(async () => {});

    expect(mockApiGet.mock.calls.length).toBeGreaterThan(callsAfterMount);
  });

  it("stops polling after all items become READY", async () => {
    mockApiGet.mockResolvedValue(makeRiggingReady());
    const items = [makeItem({ productId: 30 })];
    renderHook(() => useOutfitRiggingStatus(items));

    // First poll resolves READY
    await act(async () => {});
    const callsAfterReady = mockApiGet.mock.calls.length;

    // Advance timer — no more polls expected since pendingCount is now 0
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    await act(async () => {});

    expect(mockApiGet.mock.calls.length).toBe(callsAfterReady);
  });

  it("gracefully handles 403 without throwing", async () => {
    const { ApiError } = await import("@/lib/api");
    // (status, message) — the `as any` this replaces was hiding the arguments
    // being the other way round, so the rejection carried status "Forbidden".
    mockApiGet.mockRejectedValue(new ApiError(403, "Forbidden"));
    const items = [makeItem({ productId: 40 })];

    expect(() => {
      renderHook(() => useOutfitRiggingStatus(items));
    }).not.toThrow();

    await act(async () => {});
    // Item remains unchanged (no riggedGlbUrl)
  });

  it("aborts in-flight requests on unmount", async () => {
    let capturedSignal: AbortSignal | undefined;
    mockApiGet.mockImplementation((_path: string, opts: { signal?: AbortSignal }) => {
      capturedSignal = opts?.signal;
      return new Promise(() => {}); // never resolves
    });

    const items = [makeItem({ productId: 50 })];
    const { unmount } = renderHook(() => useOutfitRiggingStatus(items));

    await act(async () => {});

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  it("uses immutable update — original item objects are not mutated", async () => {
    mockApiGet.mockResolvedValue(makeRiggingReady("/new.glb"));
    const original = makeItem({ productId: 60 });
    const items = [original];

    const { result } = renderHook(() => useOutfitRiggingStatus(items));
    await act(async () => {});

    // The original object passed in should remain unchanged
    expect(original.riggedGlbUrl).toBeUndefined();
    // The hook's returned item should have the updated URL
    expect(result.current.items[0].riggedGlbUrl).toBe("/new.glb");
  });

  it("syncs items when initialItems reference changes", async () => {
    mockApiGet.mockResolvedValue(makeRiggingPending());
    const items1 = [makeItem({ productId: 70 })];
    const items2 = [makeItem({ productId: 70, riggedGlbUrl: "/updated.glb" })];

    const { result, rerender } = renderHook(
      ({ items }) => useOutfitRiggingStatus(items),
      { initialProps: { items: items1 } }
    );

    await act(async () => {});
    expect(result.current.pendingCount).toBe(1);

    rerender({ items: items2 });
    await act(async () => {});

    expect(result.current.items[0].riggedGlbUrl).toBe("/updated.glb");
  });

  it("does not loop or re-poll when the caller passes a fresh array of identical content each render", async () => {
    // Regression: callers legitimately pass an unstable array — e.g. the outfit
    // viewer's `useOutfitRiggingStatus(outfit?.items ?? [])`, a new [] (or a new
    // [item] with identical content) on every render. Keying the sync effect on
    // the array *reference* infinitely looped (setItems → render → new array →
    // effect → setItems …) and hung. The sync effect is keyed on content instead.
    mockApiGet.mockResolvedValue(makeRiggingPending());
    const { result, rerender } = renderHook(() =>
      // fresh array + fresh item object on every render, same content
      useOutfitRiggingStatus([makeItem({ productId: 5 })])
    );

    await act(async () => {});
    const callsAfterMount = mockApiGet.mock.calls.length;

    rerender();
    rerender();
    await act(async () => {});

    // Unchanged content across renders → the sync effect must NOT re-fire the poll.
    expect(mockApiGet.mock.calls.length).toBe(callsAfterMount);
    expect(result.current.pendingCount).toBe(1);
  });
});
