package com.clossette.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record UpdateCartItemRequest(
        @NotNull(message = "quantity is required")
        @Min(value = 0, message = "quantity must be 0 or greater")
        @Max(value = 100, message = "quantity must not exceed 100")
        Integer quantity
) {}
