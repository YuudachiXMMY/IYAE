package com.iyae.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;

public record ResendVerificationRequest(
    @NotNull @Email String email
) {}
