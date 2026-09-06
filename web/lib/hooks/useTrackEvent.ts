"use client";

import { useCallback } from "react";
import { analytics, type TrackEventPayload } from "@/lib/api";

/**
 * Returns a stable, fire-and-forget `track` function for emitting first-party analytics
 * events. Never throws or blocks — server-side emission remains authoritative for the
 * conversion funnel; client events are advisory (e.g. product views, add-to-cart).
 */
export function useTrackEvent(): (payload: TrackEventPayload) => void {
  return useCallback((payload: TrackEventPayload) => {
    analytics.track(payload);
  }, []);
}
