package com.clossette.dto;

import com.clossette.entity.User;
import com.clossette.entity.enums.Role;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Collections;
import java.util.List;

public record UserResponse(
    Long id,
    String email,
    String name,
    Role role,
    boolean emailVerified,
    String username,
    String ageRange,
    String genderIdentity,
    String profileVisibility,
    String bodyProfileVisibility,
    List<String> styleAesthetics,
    List<String> fitPreferences,
    List<String> favoriteColors,
    List<String> avoidedColors,
    String budgetRange,
    List<String> favoriteBrands,
    Boolean sustainableFashionInterest,
    String pricePreference,
    List<String> outfitGoals,
    String avatarMode,
    String avatarPreset,
    String createdAt
) {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static UserResponse from(User user) {
        return new UserResponse(
            user.getId(),
            user.getEmail(),
            user.getName(),
            user.getRole(),
            Boolean.TRUE.equals(user.getEmailVerified()),
            user.getUsername(),
            user.getAgeRange(),
            user.getGenderIdentity(),
            user.getProfileVisibility(),
            user.getBodyProfileVisibility(),
            parseJsonList(user.getStyleAesthetics()),
            parseJsonList(user.getFitPreferences()),
            parseJsonList(user.getFavoriteColors()),
            parseJsonList(user.getAvoidedColors()),
            user.getBudgetRange(),
            parseJsonList(user.getFavoriteBrands()),
            user.getSustainableFashionInterest(),
            user.getPricePreference(),
            parseJsonList(user.getOutfitGoals()),
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
            return MAPPER.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
