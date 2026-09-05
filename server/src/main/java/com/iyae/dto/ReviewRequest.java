package com.iyae.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ReviewRequest(
        @NotNull(message = "rating is required")
        @Min(value = 1, message = "rating must be at least 1")
        @Max(value = 5, message = "rating must not exceed 5")
        Integer rating,

        @Size(max = 2000, message = "comment must not exceed 2000 characters")
        String comment
) {}
