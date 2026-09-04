package com.clossette.dto;

import com.clossette.entity.ChatSession;
import com.clossette.entity.enums.SessionStatus;

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
