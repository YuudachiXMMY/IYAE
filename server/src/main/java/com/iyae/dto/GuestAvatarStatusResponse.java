package com.iyae.dto;

public record GuestAvatarStatusResponse(
        Long taskId,
        String status,
        String glbUrl,
        String errorMessage
) {}
