package com.iyae.dto;

import com.iyae.entity.enums.ProductStatus;
import jakarta.validation.constraints.NotNull;

/** Admin request to force a product's moderation status (privileged, no ownership check). */
public record ProductStatusUpdateRequest(
        @NotNull(message = "Status is required") ProductStatus status
) {}
