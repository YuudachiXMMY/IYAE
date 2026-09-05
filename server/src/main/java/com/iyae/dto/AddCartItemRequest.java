package com.iyae.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AddCartItemRequest(
        @NotNull(message = "productId is required")
        Long productId,

        @NotNull(message = "quantity is required")
        @Min(value = 1, message = "quantity must be at least 1")
        @Max(value = 100, message = "quantity must not exceed 100")
        Integer quantity,

        @NotBlank(message = "selectedSize is required")
        @Size(max = 32, message = "selectedSize must not exceed 32 characters")
        String selectedSize
) {}
