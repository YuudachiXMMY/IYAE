package com.iyae.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Client-emitted analytics event. {@code type} must match an {@code EventType} name;
 * unknown/blank types are rejected. All other fields are optional context.
 */
public record TrackEventRequest(
    @NotBlank String type,
    Long productId,
    String sizeBracket,
    String metadata
) {}
