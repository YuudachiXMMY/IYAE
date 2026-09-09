package com.iyae.dto;

import com.iyae.entity.Promotion;
import com.iyae.entity.enums.SlotType;

import java.time.Instant;

public record PromotionResponse(
        Long id,
        Long productId,
        String productName,
        SlotType slotType,
        Integer weight,
        Instant startAt,
        Instant endAt,
        boolean active
) {
    public static PromotionResponse from(Promotion promotion) {
        Instant now = Instant.now();
        boolean active = promotion.getStartAt() != null && promotion.getEndAt() != null
                && !now.isBefore(promotion.getStartAt())
                && !now.isAfter(promotion.getEndAt());
        return new PromotionResponse(
                promotion.getId(),
                promotion.getProduct().getId(),
                promotion.getProduct().getName(),
                promotion.getSlotType(),
                promotion.getWeight(),
                promotion.getStartAt(),
                promotion.getEndAt(),
                active
        );
    }
}
