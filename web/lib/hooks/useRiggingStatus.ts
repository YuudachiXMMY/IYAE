"use client";
import { useState, useEffect, useCallback } from "react";
import { rigging, RiggingStatusResponse, ApiError } from "../api";

export function useRiggingStatus(productId: number | null) {
  const [status, setStatus] = useState<RiggingStatusResponse | null>(null);
  // Starts true exactly when the mount fetch below will actually run, so that
  // first fetch needs no setIsLoading of its own.
  const [isLoading, setIsLoading] = useState(() => Boolean(productId));
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // The request starts inside the promise chain so that a synchronous throw lands
  // in `.catch` too, as it did in the `async`/`try` version this replaced.
  const loadStatus = useCallback(() => {
    if (!productId) return Promise.resolve();
    const controller = new AbortController();
    return Promise.resolve()
      .then(() => rigging.getStatus(productId, controller.signal))
      .then((data) => setStatus(data))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setStatus(null);
      });
  }, [productId]);

  const fetchStatus = useCallback(
    (silent = false) => {
      if (!productId) return Promise.resolve();
      if (!silent) setIsLoading(true);
      return loadStatus().finally(() => {
        if (!silent) setIsLoading(false);
      });
    },
    [productId, loadStatus]
  );

  useEffect(() => {
    loadStatus().finally(() => setIsLoading(false));
  }, [loadStatus]);

  useEffect(() => {
    if (status?.status === "PENDING" || status?.status === "RUNNING") {
      const interval = setInterval(() => fetchStatus(true), 3000);
      return () => clearInterval(interval);
    }
  }, [fetchStatus, status?.status]);

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
    refetch: () => fetchStatus(false),
  };
}
