package com.clossette.dto;

import com.clossette.entity.Promotion;
import com.clossette.entity.enums.SlotType;

import java.time.Instant;

public record PromotionResponse(
        Long id,
        Long productId,
        SlotType slotType,
        Integer weight,
        Instant startAt,
        Instant endAt
) {
    public static PromotionResponse from(Promotion promotion) {
        return new PromotionResponse(
                promotion.getId(),
                promotion.getProduct().getId(),
                promotion.getSlotType(),
                promotion.getWeight(),
                promotion.getStartAt(),
                promotion.getEndAt()
        );
    }
}
