package com.iyae.dto;

import com.iyae.entity.enums.SlotType;

import java.time.Instant;

/**
 * Partial-update payload for {@code PUT /api/promotions/{id}}. The promotion's product is immutable
 * once created, so (unlike {@link PromotionRequest}) this carries no {@code productId} and no
 * required fields — every field is optional and only non-null values are applied.
 */
public record UpdatePromotionRequest(
        SlotType slotType,
        Integer weight,
        Instant startAt,
        Instant endAt
) {}
