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
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!productId || !enabled) return;
    setLoading(true);
    try {
      const data = await api.get<GenerationStatus>(`/api/designer/products/${productId}/generation-status`);
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [productId, enabled]);

  useEffect(() => {
    fetchStatus();
    // Poll every 5 seconds if status is PENDING or RUNNING
    if (status?.status === "PENDING" || status?.status === "RUNNING") {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchStatus, status?.status]);

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
