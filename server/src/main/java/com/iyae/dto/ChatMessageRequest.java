package com.iyae.dto;

import jakarta.validation.constraints.NotBlank;

public record ChatMessageRequest(
    @NotBlank(message = "Message content must not be blank")
    String content
) {}
