package com.iyae.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

/**
 * Fetches current Toronto weather from Open-Meteo (keyless, free) and formats it
 * for the AI stylist prompt.
 * <p>
 * The blocking HTTP fetch is kept OFF the chat hot path: {@link #refresh()} runs on
 * a schedule (see {@code SchedulerConfig}) to warm an in-memory cache, and
 * {@link #getCurrentToronto()} is a fast, non-blocking read of that cache. This
 * guarantees a slow or unreachable Open-Meteo can never add latency to a user's
 * stylist turn. Both methods are designed to NEVER throw — a weather outage returns
 * the last good (possibly stale) snapshot, or {@link Optional#empty()}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class WeatherService {

    private final RestTemplate restTemplate;

    @Value("${app.weather.enabled:true}")
    private boolean enabled;

    @Value("${app.weather.api-url:https://api.open-meteo.com/v1/forecast}")
    private String apiUrl;

    @Value("${app.weather.latitude:43.6532}")
    private double latitude;

    @Value("${app.weather.longitude:-79.3832}")
    private double longitude;

    @Value("${app.weather.timezone:America/Toronto}")
    private String timezone;

    @Value("${app.weather.cache-ttl-seconds:1800}")
    private long cacheTtlSeconds;

    private volatile WeatherSnapshot cached;

    /** Immutable current-weather snapshot. */
    public record WeatherSnapshot(double temperatureC, double feelsLikeC, String condition, Instant fetchedAt) {}

    /**
     * Returns the current Toronto weather from the in-memory cache — a fast,
     * non-blocking read safe to call on the chat hot path. The cache is warmed
     * off-path by {@link #refresh()} (scheduled), so this method never performs a
     * blocking HTTP call. Returns empty when {@code app.weather.enabled=false} or
     * before the cache has been warmed for the first time.
     */
    public Optional<WeatherSnapshot> getCurrentToronto() {
        if (!enabled) {
            return Optional.empty();
        }
        return Optional.ofNullable(cached);
    }

    /**
     * Refreshes the cached weather snapshot from Open-Meteo. Intended to run on a
     * schedule, OFF the request path (see {@code SchedulerConfig}), so that
     * {@link #getCurrentToronto()} stays a non-blocking cache read. Skips the network
     * call while the cached snapshot is still within its TTL, and NEVER throws — a
     * fetch failure leaves the previous (stale) snapshot in place. No-op when
     * {@code app.weather.enabled=false}.
     */
    public void refresh() {
        if (!enabled) {
            return;
        }
        WeatherSnapshot snapshot = cached;
        if (snapshot != null && !isStale(snapshot)) {
            return;
        }
        try {
            WeatherSnapshot fresh = fetch();
            if (fresh != null) {
                cached = fresh;
            }
        } catch (Exception e) {
            log.warn("Weather refresh failed, keeping cached snapshot. Reason: {}", e.getClass().getSimpleName());
        }
    }

    private boolean isStale(WeatherSnapshot snapshot) {
        return Duration.between(snapshot.fetchedAt(), Instant.now()).getSeconds() >= cacheTtlSeconds;
    }

    private WeatherSnapshot fetch() {
        String url = UriComponentsBuilder.fromUriString(apiUrl)
            .queryParam("latitude", latitude)
            .queryParam("longitude", longitude)
            .queryParam("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m")
            .queryParam("timezone", timezone)
            .queryParam("temperature_unit", "celsius")
            .toUriString();

        @SuppressWarnings("unchecked")
        Map<String, Object> body = restTemplate.getForObject(url, Map.class);
        if (body == null) {
            return null;
        }
        // Open-Meteo returns `current` (an object), NOT the legacy `current_weather`.
        Object currentObj = body.get("current");
        if (!(currentObj instanceof Map)) {
            log.warn("Weather response missing 'current' object");
            return null;
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> current = (Map<String, Object>) currentObj;

        Double temperature = asDouble(current.get("temperature_2m"));
        Double feelsLike = asDouble(current.get("apparent_temperature"));
        Integer code = asInt(current.get("weather_code"));
        if (temperature == null || code == null) {
            log.warn("Weather response missing temperature/weather_code");
            return null;
        }
        double feels = feelsLike != null ? feelsLike : temperature;
        return new WeatherSnapshot(temperature, feels, mapWeatherCode(code), Instant.now());
    }

    private Double asDouble(Object value) {
        return value instanceof Number n ? n.doubleValue() : null;
    }

    private Integer asInt(Object value) {
        return value instanceof Number n ? n.intValue() : null;
    }

    /** Maps a WMO weather interpretation code to a human-readable condition label. */
    String mapWeatherCode(int code) {
        return switch (code) {
            case 0 -> "clear";
            case 1, 2, 3 -> "partly cloudy";
            case 45, 48 -> "fog";
            case 51, 53, 55, 56, 57 -> "drizzle";
            case 61, 63, 65, 66, 67 -> "rain";
            case 71, 73, 75, 77 -> "snow";
            case 80, 81, 82 -> "rain showers";
            case 85, 86 -> "snow showers";
            case 95, 96, 99 -> "thunderstorm";
            default -> "mixed conditions";
        };
    }

    /** Formats a snapshot into a one-line context string injected into the stylist system prompt. */
    public String toPromptContext(WeatherSnapshot w) {
        return String.format(
            "Current Toronto weather: %.0f°C (feels like %.0f°C), %s. "
                + "Factor this into your recommendations — prioritize warmth and layering when cold, "
                + "breathable pieces when hot, and weather-appropriate outerwear when wet.",
            w.temperatureC(), w.feelsLikeC(), w.condition()
        );
    }
}
