"use client";
import { useState, useEffect, useCallback } from "react";
import { api, avatar, ApiError } from "../api";
import type { AvatarStatus } from "../api";

// Re-exported so existing `import { AvatarStatus } from ".../useAvatarStatus"`
// call sites keep working; the canonical definition lives in `lib/api.ts`.
export type { AvatarStatus };

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function useAvatarStatus() {
  const [status, setStatus] = useState<AvatarStatus | null>(null);
  // The mount fetch below always runs, so `loading` starts true instead of being
  // flipped by the effect.
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // The request starts inside the promise chain so that a synchronous throw lands
  // in `.catch` too, as it did in the `async`/`try` version this replaced.
  const loadStatus = useCallback(
    (signal?: AbortSignal) =>
      Promise.resolve()
        .then(() => avatar.getStatus(signal))
        .then((data) => setStatus(data))
        .catch((err: unknown) => {
          // A resolve-after-unmount abort must not clobber state (or flip to null).
          if (isAbortError(err)) return;
          setStatus(null);
        }),
    []
  );

  const fetchStatus = useCallback(
    (opts: { silent?: boolean; signal?: AbortSignal } = {}) => {
      const { silent = false, signal } = opts;
      if (!silent) setLoading(true);
      return loadStatus(signal).finally(() => {
        if (!silent) setLoading(false);
      });
    },
    [loadStatus]
  );

  // Initial fetch on mount — aborted on unmount so a late resolve can't setState
  // on an unmounted component (M6: refresh is now public API).
  useEffect(() => {
    const controller = new AbortController();
    loadStatus(controller.signal).finally(() => setLoading(false));
    return () => controller.abort();
  }, [loadStatus]);

  // Poll every 5 seconds while avatar generation is in progress (silent to avoid
  // UI flicker). Its own controller so it aborts independently of the mount fetch.
  useEffect(() => {
    if (status?.status === "PENDING" || status?.status === "RUNNING") {
      const controller = new AbortController();
      const interval = setInterval(
        () => fetchStatus({ silent: true, signal: controller.signal }),
        5000
      );
      return () => {
        clearInterval(interval);
        controller.abort();
      };
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
