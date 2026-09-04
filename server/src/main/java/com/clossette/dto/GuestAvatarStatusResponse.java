package com.clossette.dto;

public record GuestAvatarStatusResponse(
        Long taskId,
        String status,
        String glbUrl,
        String errorMessage
) {}
