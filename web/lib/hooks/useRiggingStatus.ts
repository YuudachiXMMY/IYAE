"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { rigging, RiggingStatusResponse, ApiError } from "../api";

export function useRiggingStatus(productId: number | null) {
  const [status, setStatus] = useState<RiggingStatusResponse | null>(null);
  // Starts true exactly when the mount fetch below will actually run, so that
  // first fetch needs no setIsLoading of its own.
  const [isLoading, setIsLoading] = useState(() => Boolean(productId));
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // The caller passes the signal of whatever started the load — an effect, or
  // the manual `refetch` — so the response is only committed while that thing is
  // still the current one. Without it a status request outlived the render that
  // asked for it: `productId` changes on the same route (PDP → PDP), so the
  // component is never unmounted, and a late reply for the product the user had
  // already left overwrote the one on screen.
  //
  // The request starts inside the promise chain so that a synchronous throw lands
  // in `.catch` too, as it did in the `async`/`try` version this replaced.
  const loadStatus = useCallback(
    (signal: AbortSignal) => {
      if (!productId) return Promise.resolve();
      return Promise.resolve()
        .then(() => rigging.getStatus(productId, signal))
        .then((data) => {
          if (!signal.aborted) setStatus(data);
        })
        .catch((err: unknown) => {
          if (signal.aborted) return;
          if (err instanceof Error && err.name === "AbortError") return;
          setStatus(null);
        });
    },
    [productId]
  );

  // `refetch` is user-initiated, so it is not owned by an effect — this ref lets
  // the unmount effect below cancel it, and a second click supersede the first.
  const manualLoad = useRef<AbortController | null>(null);

  const fetchStatus = useCallback(() => {
    if (!productId) return Promise.resolve();
    manualLoad.current?.abort();
    const controller = new AbortController();
    manualLoad.current = controller;
    setIsLoading(true);
    return loadStatus(controller.signal).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
  }, [productId, loadStatus]);

  useEffect(() => () => manualLoad.current?.abort(), []);

  // Cancelling the previous product's request is not enough on its own: `status`
  // would still hold its value while the new product's request is in flight, and
  // `RiggingStatusCard` renders `status ?? "NONE"` without waiting on
  // `isLoading` — so the old product's READY panel and its actions flash against
  // the new one. Dropped during render rather than from an effect, so no commit
  // ever shows the mismatch.
  const [statusFor, setStatusFor] = useState(productId);
  if (statusFor !== productId) {
    setStatusFor(productId);
    setStatus(null);
    setIsLoading(Boolean(productId));
  }

  useEffect(() => {
    const controller = new AbortController();
    loadStatus(controller.signal).finally(() => {
      if (!controller.signal.aborted) setIsLoading(false);
    });
    return () => controller.abort();
  }, [loadStatus]);

  useEffect(() => {
    if (status?.status !== "PENDING" && status?.status !== "RUNNING") return;
    // One controller per tick, with the previous one aborted as the next fires,
    // so the newest reply always wins. A single controller for the whole run
    // would *mostly* work — this effect is keyed on `status?.status`, so a tick
    // that changes the status tears it down and cancels everything else in
    // flight — but two ticks reporting the same status with a different
    // `attemptCount` or `errorMessage` never re-run it, and then the older reply
    // lands last and the count walks backwards.
    //
    // The poll is silent, so it drives `loadStatus` directly rather than going
    // through `fetchStatus` and its `isLoading`.
    let inFlight: AbortController | null = null;
    const interval = setInterval(() => {
      inFlight?.abort();
      inFlight = new AbortController();
      void loadStatus(inFlight.signal);
    }, 3000);
    return () => {
      clearInterval(interval);
      inFlight?.abort();
    };
  }, [loadStatus, status?.status]);

  const triggerRigging = useCallback(async () => {
    if (!productId) return;
    setActionError(null);
    setIsActionLoading(true);
    try {
      const data = await rigging.trigger(productId);
      setStatus(data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to trigger rigging. Please try again.";
      setActionError(message);
    } finally {
      setIsActionLoading(false);
    }
  }, [productId]);

  const retryRigging = useCallback(async () => {
    if (!productId) return;
    setActionError(null);
    setIsActionLoading(true);
    try {
      const data = await rigging.retry(productId);
      setStatus(data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Retry failed. Please try again.";
      setActionError(message);
    } finally {
      setIsActionLoading(false);
    }
  }, [productId]);

  const clearActionError = useCallback(() => setActionError(null), []);

  return {
    status: status?.status ?? null,
    riggedGlbUrl: status?.riggedGlbUrl ?? null,
    errorMessage: status?.errorMessage ?? null,
    failureCode: status?.failureCode ?? null,
    attemptCount: status?.attemptCount ?? 0,
    isLoading,
    isActionLoading,
    actionError,
    clearActionError,
    triggerRigging,
    retryRigging,
    refetch: fetchStatus,
  };
}
