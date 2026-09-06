package com.iyae.dto;

import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Collections;
import java.util.List;

/**
 * Redacted public view of a user for follower/following lists. Deliberately omits email and all
 * demographic fields (genderIdentity/ageRange/budgetRange/visibility) that {@code UserResponse}
 * carries — those must never be enumerable across the whole user base via the follows graph.
 */
public record PublicUserSummary(
    Long id,
    String username,
    String name,
    Role role,
    List<String> styleAesthetics,
    String avatarMode,
    String avatarPreset
) {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    public static PublicUserSummary from(User user) {
        return new PublicUserSummary(
            user.getId(),
            user.getUsername(),
            user.getName(),
            user.getRole(),
            parseJsonList(user.getStyleAesthetics()),
            user.getAvatarMode(),
            user.getAvatarPreset()
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
