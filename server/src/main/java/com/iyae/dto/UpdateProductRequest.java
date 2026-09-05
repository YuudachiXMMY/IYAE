package com.iyae.dto;

import com.iyae.entity.enums.ProductStatus;
import jakarta.validation.constraints.DecimalMin;

import java.math.BigDecimal;
import java.util.List;

public record UpdateProductRequest(
        String name,

        String description,

        @DecimalMin(value = "0.01", message = "Price must be at least 0.01")
        BigDecimal price,

        String currency,

        String category,

        List<String> styleTags,

        List<String> colorTags,

        List<String> sizes,

        List<String> media,

        String glbUrl,

        ProductStatus status
) {}
