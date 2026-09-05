package com.iyae.dto;

public record AvatarStatusResponse(
    String status,
    String glbUrl,
    String errorMessage,
    int retryCount
) {}
