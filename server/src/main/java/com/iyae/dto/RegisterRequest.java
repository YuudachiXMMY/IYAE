package com.iyae.dto;

import com.iyae.entity.enums.Role;
import jakarta.validation.constraints.*;

import java.util.List;

public record RegisterRequest(
    @NotNull @Email String email,
    @NotNull @Size(min = 8, max = 100) String password,
    @Size(max = 100) String name,
    @NotNull Role role,
    // Profile fields (all optional)
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
    @Size(max = 100) String avatarPreset,
    // Body profile fields (all optional, with range validation)
    @DecimalMin("50.0") @DecimalMax("300.0") Double heightCm,
    @DecimalMin("20.0") @DecimalMax("500.0") Double weightKg,
    @DecimalMin("30.0") @DecimalMax("200.0") Double chestCm,
    @DecimalMin("30.0") @DecimalMax("200.0") Double waistCm,
    @DecimalMin("30.0") @DecimalMax("200.0") Double hipsCm,
    @DecimalMin("20.0") @DecimalMax("80.0") Double shoulderWidthCm,
    @DecimalMin("40.0") @DecimalMax("120.0") Double inseamCm,
    @Size(max = 20) String shoeSize,
    @Size(max = 20) String topSize,
    @Size(max = 20) String bottomSize,
    @Size(max = 20) String dressSize,
    @Size(max = 20) String jacketSize
) {}
