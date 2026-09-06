"use client";

import { useEffect, useState } from "react";
import { weather as weatherApi, type Weather } from "@/lib/api";

/**
 * Fetches current Toronto weather once on mount (not polled — stays within the
 * /api/chat rate-limit bucket) and returns it. Lifting the fetch here lets a page
 * render the weather in several places (e.g. mobile + desktop header chips) from a
 * single request instead of one per mounted chip. Resolves to null on any failure
 * so callers degrade gracefully.
 */
export function useWeather(): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    weatherApi
      .get(controller.signal)
      .then(setWeather)
      .catch(() => setWeather(null));
    return () => controller.abort();
  }, []);

  return weather;
}
