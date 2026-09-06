package com.iyae.dto;

/**
 * API response for {@code GET /api/chat/weather}, backing the chat header weather chip.
 * When weather is unavailable (disabled or upstream failure), {@code available} is false
 * and the numeric fields are null.
 */
public record WeatherResponse(
    Double temperatureC,
    Double feelsLikeC,
    String condition,
    boolean available
) {}
