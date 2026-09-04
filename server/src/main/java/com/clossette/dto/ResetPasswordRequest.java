package com.clossette.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
    @NotNull String token,
    @NotNull @Size(min = 8, max = 100) String newPassword
) {}
