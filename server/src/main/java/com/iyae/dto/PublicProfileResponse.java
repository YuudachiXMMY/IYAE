package com.iyae.dto;

import com.iyae.entity.User;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Collections;
import java.util.List;

public record PublicProfileResponse(
    String username,
    String name,
    boolean isDesigner,
    List<String> styleAesthetics,
    String avatarMode,
    String avatarPreset,
    String createdAt
) {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public static PublicProfileResponse from(User user) {
        return new PublicProfileResponse(
            user.getUsername(),
            user.getName(),
            user.getRole() != null && "DESIGNER".equals(user.getRole().name()),
            parseJsonList(user.getStyleAesthetics()),
            user.getAvatarMode(),
            user.getAvatarPreset(),
            user.getCreatedAt() != null ? user.getCreatedAt().toString() : null
        );
    }

    private static List<String> parseJsonList(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return OBJECT_MAPPER.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
