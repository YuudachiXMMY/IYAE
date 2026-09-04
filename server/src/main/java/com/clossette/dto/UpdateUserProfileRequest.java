package com.clossette.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record UpdateUserProfileRequest(
    @Size(max = 100) String name,
    @Size(min = 1, max = 50) @Pattern(regexp = "^[a-zA-Z0-9_.-]+$", message = "Username may only contain letters, digits, underscores, dots, and hyphens") String username,
    @Size(max = 50) String ageRange,
    @Size(max = 100) String genderIdentity,
    @Pattern(regexp = "^(PUBLIC|PRIVATE)$", message = "Must be PUBLIC or PRIVATE") String profileVisibility,
    @Pattern(regexp = "^(PUBLIC|PRIVATE)$", message = "Must be PUBLIC or PRIVATE") String bodyProfileVisibility,
    @Size(max = 20) List<@Size(max = 50) String> styleAesthetics,
    @Size(max = 20) List<@Size(max = 50) String> fitPreferences,
    @Size(max = 20) List<@Size(max = 50) String> favoriteColors,
    @Size(max = 20) List<@Size(max = 50) String> avoidedColors,
    @Size(max = 50) String budgetRange,
    @Size(max = 20) List<@Size(max = 100) String> favoriteBrands,
    Boolean sustainableFashionInterest,
    @Size(max = 50) String pricePreference,
    @Size(max = 20) List<@Size(max = 50) String> outfitGoals,
    @Pattern(regexp = "^(AI_AVATAR|PROFILE_PHOTO)$", message = "Must be AI_AVATAR or PROFILE_PHOTO") String avatarMode,
    @Size(max = 100) String avatarPreset
) {}
