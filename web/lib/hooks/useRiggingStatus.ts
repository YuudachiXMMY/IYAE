"use client";
import { useState, useEffect, useCallback } from "react";
import { rigging, RiggingStatusResponse, ApiError } from "../api";

export function useRiggingStatus(productId: number | null) {
  const [status, setStatus] = useState<RiggingStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchStatus = useCallback(
    async (silent = false) => {
      if (!productId) return;
      if (!silent) setIsLoading(true);
      const controller = new AbortController();
      try {
        const data = await rigging.getStatus(productId, controller.signal);
        setStatus(data);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setStatus(null);
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [productId]
  );

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

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
