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

  const load = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(false);

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

  useEffect(() => {
    if (getCachedPublicConfig() !== null) return;
    load();
    return () => controllerRef.current?.abort();
  }, [load]);

  return { config, loading, error, reload: load };
}
