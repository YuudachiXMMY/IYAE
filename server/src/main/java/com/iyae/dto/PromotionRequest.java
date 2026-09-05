package com.iyae.dto;

import com.iyae.entity.enums.SlotType;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record PromotionRequest(
        @NotNull(message = "productId is required")
        Long productId,

        @NotNull(message = "slotType is required")
        SlotType slotType,

        Integer weight,

        @NotNull(message = "startAt is required")
        Instant startAt,

        @NotNull(message = "endAt is required")
        Instant endAt
) {}
