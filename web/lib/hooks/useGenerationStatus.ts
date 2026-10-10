"use client";
import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "../api";

interface GenerationStatus {
  status: "PENDING" | "RUNNING" | "READY" | "FAILED" | null;
  glbUrl: string | null;
  usdzUrl: string | null;
  errorMessage: string | null;
  retryCount: number;
}

export function useGenerationStatus(productId: number | null, enabled: boolean = true) {
  const [status, setStatus] = useState<GenerationStatus | null>(null);
  // Starts true exactly when the mount fetch below will actually run, so that
  // first fetch needs no setLoading of its own.
  const [loading, setLoading] = useState(() => Boolean(productId) && enabled);
  const [actionError, setActionError] = useState<string | null>(null);

  // The request starts inside the promise chain so that a synchronous throw lands
  // in `.catch` too, as it did in the `async`/`try` version this replaced.
  const loadStatus = useCallback(() => {
    if (!productId || !enabled) return Promise.resolve();
    return Promise.resolve()
      .then(() =>
        api.get<GenerationStatus>(`/api/designer/products/${productId}/generation-status`)
      )
      .then((data) => setStatus(data))
      .catch(() => setStatus(null));
  }, [productId, enabled]);

  const fetchStatus = useCallback(() => {
    if (!productId || !enabled) return Promise.resolve();
    setLoading(true);
    return loadStatus().finally(() => setLoading(false));
  }, [productId, enabled, loadStatus]);

  useEffect(() => {
    loadStatus().finally(() => setLoading(false));
    // Poll every 5 seconds if status is PENDING or RUNNING
    if (status?.status === "PENDING" || status?.status === "RUNNING") {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [loadStatus, fetchStatus, status?.status]);

  const retry = useCallback(async () => {
    if (!productId) return;
    setActionError(null);
    try {
      await api.post(`/api/designer/products/${productId}/generation-status/retry`);
      fetchStatus();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Retry failed. Please try again.";
      setActionError(message);
    }
  }, [productId, fetchStatus]);

  const regenerate = useCallback(async () => {
    if (!productId) return;
    setActionError(null);
    try {
      await api.post(`/api/designer/products/${productId}/regenerate`);
      fetchStatus();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Regeneration failed. Please try again.";
      setActionError(message);
    }
  }, [productId, fetchStatus]);

  const clearActionError = useCallback(() => setActionError(null), []);

  return { status, loading, actionError, clearActionError, retry, regenerate, refetch: fetchStatus };
}
