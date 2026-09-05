package com.iyae.dto;

public record GenerationStatusResponse(
        String status,
        String glbUrl,
        String usdzUrl,
        String errorMessage,
        int retryCount
) {}
