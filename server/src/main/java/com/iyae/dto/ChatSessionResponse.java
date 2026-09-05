package com.iyae.dto;

import com.iyae.entity.ChatSession;
import com.iyae.entity.enums.SessionStatus;

import java.time.Instant;

public record ChatSessionResponse(
    Long id,
    SessionStatus status,
    Instant createdAt
) {
    public static ChatSessionResponse from(ChatSession session) {
        return new ChatSessionResponse(
            session.getId(),
            session.getStatus(),
            session.getCreatedAt()
        );
    }
}
