"use client";

import { useEffect, useState } from "react";
import { chat, type Weather } from "@/lib/api";

function weatherEmoji(condition: string | null): string {
  if (!condition) return "🌡️";
  const c = condition.toLowerCase();
  if (c.includes("snow")) return "❄️";
  if (c.includes("thunder")) return "⛈️";
  if (c.includes("rain") || c.includes("drizzle")) return "🌧️";
  if (c.includes("fog")) return "🌫️";
  if (c.includes("cloud")) return "⛅";
  if (c.includes("clear")) return "☀️";
  return "🌡️";
}

/**
 * Compact header chip showing live Toronto weather. Fetched once on mount
 * (not polled — stays within the /api/chat rate-limit bucket). Renders nothing
 * when weather is unavailable so the header degrades gracefully.
 */
export function ChatWeatherChip() {
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    chat
      .getWeather(controller.signal)
      .then(setWeather)
      .catch(() => setWeather(null));
    return () => controller.abort();
  }, []);

  if (!weather || !weather.available) return null;

  const temp = weather.temperatureC != null ? `${Math.round(weather.temperatureC)}°C` : "";
  const label = `Toronto${temp ? ` ${temp}` : ""}${weather.condition ? ` · ${weather.condition}` : ""}`;

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
      role="status"
      aria-label={`Current weather: ${label}`}
    >
      <span aria-hidden="true">{weatherEmoji(weather.condition)}</span>
      <span>{label}</span>
    </div>
  );
}
