package com.iyae.dto;

public record RiggingStatusResponse(
        String status,
        String riggedGlbUrl,
        String errorMessage,
        String failureCode,
        int attemptCount
) {}
