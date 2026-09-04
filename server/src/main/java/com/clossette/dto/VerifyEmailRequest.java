package com.clossette.dto;

import jakarta.validation.constraints.NotNull;

public record VerifyEmailRequest(
    @NotNull String token
) {}
