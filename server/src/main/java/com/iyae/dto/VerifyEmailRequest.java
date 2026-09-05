package com.iyae.dto;

import jakarta.validation.constraints.NotNull;

public record VerifyEmailRequest(
    @NotNull String token
) {}
