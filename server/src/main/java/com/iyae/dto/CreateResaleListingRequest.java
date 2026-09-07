package com.iyae.dto;

import com.iyae.entity.enums.ResaleCondition;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public record CreateResaleListingRequest(
        @NotNull(message = "productId is required")
        Long productId,

        @NotBlank(message = "sizeLabel is required")
        @Size(max = 32, message = "sizeLabel must not exceed 32 characters")
        String sizeLabel,

        @NotNull(message = "condition is required")
        ResaleCondition condition,

        @NotNull(message = "askingPrice is required")
        @DecimalMin(value = "0.01", message = "askingPrice must be at least 0.01")
        BigDecimal askingPrice,

        @Size(max = 2000, message = "sellerNote must not exceed 2000 characters")
        String sellerNote,

        List<String> media
) {}
