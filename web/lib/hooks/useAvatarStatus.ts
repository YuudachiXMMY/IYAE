"use client";
import { useState, useEffect, useCallback } from "react";
import { api, ApiError } from "../api";

export interface AvatarStatus {
  status: "NONE" | "PENDING" | "RUNNING" | "READY" | "FAILED";
  glbUrl: string | null;
  errorMessage: string | null;
  retryCount: number;
}

export function useAvatarStatus() {
  const [status, setStatus] = useState<AvatarStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.get<AvatarStatus>("/api/avatar/status");
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll every 5 seconds while avatar generation is in progress (silent to avoid UI flicker)
  useEffect(() => {
    if (status?.status === "PENDING" || status?.status === "RUNNING") {
      const interval = setInterval(() => fetchStatus(true), 5000);
      return () => clearInterval(interval);
    }
  }, [fetchStatus, status?.status]);

  const generate = useCallback(async () => {
    setActionError(null);
    try {
      await api.post("/api/avatar/generate");
      fetchStatus();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Avatar generation failed. Please try again.";
      setActionError(message);
    }
  }, [fetchStatus]);

  const regenerate = useCallback(async () => {
    setActionError(null);
    try {
      await api.post("/api/avatar/generate");
      fetchStatus();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Regeneration failed. Please try again.";
      setActionError(message);
    }
  }, [fetchStatus]);

  const clearActionError = useCallback(() => setActionError(null), []);

  return { status, loading, actionError, generate, regenerate, clearActionError, refresh: fetchStatus };
}
