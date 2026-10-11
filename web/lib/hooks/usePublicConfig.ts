"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type PublicConfig } from "@/lib/api";
import { getCachedPublicConfig, getPublicConfig } from "@/lib/public-config";

/**
 * Reads the server's runtime feature flags.
 *
 * Three states on purpose, because the two failure modes are not interchangeable: hiding a
 * working checkout costs a sale, and showing a dead one costs a support ticket. So a failed
 * read reports `error` and leaves `config` null, and callers render an explicit
 * "can't tell right now" state rather than silently picking either answer. The audit's
 * recurring defect was exactly this collapse — a failed fetch rendering as "zero results".
 */
export function usePublicConfig() {
  const [config, setConfig] = useState<PublicConfig | null>(getCachedPublicConfig());
  const [loading, setLoading] = useState(getCachedPublicConfig() === null);
  const [error, setError] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // State is only written from the promise callbacks, never synchronously in the effect body —
  // `loading` already starts true whenever the cache is empty, so the effect has nothing to set
  // on the way in. (A synchronous setState in an effect is both a cascading render and a lint
  // error this repo keeps at zero.)
  const fetchInto = useCallback((controller: AbortController) => {
    getPublicConfig(controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        setConfig(value);
        setLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setError(true);
        setLoading(false);
      });
  }, []);

  /** User-triggered retry. Safe to set state synchronously here — it is an event handler. */
  const reload = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(false);
    fetchInto(controller);
  }, [fetchInto]);

  useEffect(() => {
    if (getCachedPublicConfig() !== null) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    fetchInto(controller);
    return () => controller.abort();
  }, [fetchInto]);

  return { config, loading, error, reload };
}
