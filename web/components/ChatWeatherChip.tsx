"use client";

import { type Weather } from "@/lib/api";

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
 * Compact, presentational header chip showing live Toronto weather. The weather
 * value is fetched once by the parent (see {@link useWeather}) and passed in, so
 * the chip can appear in more than one header slot without duplicating the network
 * request. Renders nothing when weather is unavailable so the header degrades
 * gracefully.
 */
export function ChatWeatherChip({ weather }: { weather: Weather | null }) {
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
