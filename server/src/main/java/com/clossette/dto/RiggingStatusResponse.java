package com.clossette.dto;

public record RiggingStatusResponse(
        String status,
        String riggedGlbUrl,
        String errorMessage,
        String failureCode,
        int attemptCount
) {}
