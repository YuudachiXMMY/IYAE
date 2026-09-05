package com.iyae.dto;

import com.iyae.entity.SavedLook;

import java.time.Instant;
import java.util.List;

public record SavedLookResponse(
        Long id,
        Long recommendationId,
        String note,
        List<String> items,
        Instant createdAt
) {
    public static SavedLookResponse from(SavedLook savedLook, List<String> items) {
        return new SavedLookResponse(
                savedLook.getId(),
                savedLook.getRecommendation().getId(),
                savedLook.getNote(),
                items,
                savedLook.getCreatedAt()
        );
    }
}
