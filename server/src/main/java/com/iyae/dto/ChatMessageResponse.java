package com.iyae.dto;

import com.iyae.entity.ChatMessage;
import com.iyae.entity.enums.MessageRole;

import java.time.Instant;
import java.util.List;

public record ChatMessageResponse(
    Long id,
    MessageRole role,
    String content,
    OutfitResponse outfit,
    Long outfitRecommendationId,
    List<String> suggestions,
    Instant createdAt
) {
    public static ChatMessageResponse from(ChatMessage message, OutfitResponse outfit, List<String> suggestions) {
        Long outfitRecId = message.getOutfitRecommendation() != null
            ? message.getOutfitRecommendation().getId()
            : null;
        return new ChatMessageResponse(
            message.getId(),
            message.getRole(),
            message.getContent(),
            outfit,
            outfitRecId,
            suggestions,
            message.getCreatedAt()
        );
    }

    public static ChatMessageResponse from(ChatMessage message, OutfitResponse outfit) {
        return from(message, outfit, List.of());
    }

    public static ChatMessageResponse from(ChatMessage message) {
        return from(message, null, List.of());
    }
}
