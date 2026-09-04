package com.clossette.entity;

import com.clossette.entity.enums.Role;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "name")
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private Role role;

    @Column(name = "email_verified", nullable = false)
    @Builder.Default
    private Boolean emailVerified = false;

    @Column(name = "verification_token", length = 64)
    private String verificationToken;

    @Column(name = "verification_token_expires_at")
    private Instant verificationTokenExpiresAt;

    @Column(name = "username", unique = true, length = 50)
    private String username;

    @Column(name = "age_range", length = 50)
    private String ageRange;

    @Column(name = "gender_identity", length = 100)
    private String genderIdentity;

    @Builder.Default
    @Column(name = "profile_visibility", length = 20, nullable = false)
    private String profileVisibility = "PUBLIC";

    @Builder.Default
    @Column(name = "body_profile_visibility", length = 20, nullable = false)
    private String bodyProfileVisibility = "PRIVATE";

    @Column(name = "style_aesthetics", columnDefinition = "json")
    private String styleAesthetics;

    @Column(name = "fit_preferences", columnDefinition = "json")
    private String fitPreferences;

    @Column(name = "favorite_colors", columnDefinition = "json")
    private String favoriteColors;

    @Column(name = "avoided_colors", columnDefinition = "json")
    private String avoidedColors;

    @Column(name = "budget_range", length = 50)
    private String budgetRange;

    @Column(name = "favorite_brands", columnDefinition = "json")
    private String favoriteBrands;

    @Column(name = "sustainable_fashion_interest")
    private Boolean sustainableFashionInterest;

    @Column(name = "price_preference", length = 50)
    private String pricePreference;

    @Column(name = "outfit_goals", columnDefinition = "json")
    private String outfitGoals;

    @Column(name = "avatar_mode", length = 20)
    private String avatarMode;

    @Column(name = "avatar_preset", length = 100)
    private String avatarPreset;

    @Column(name = "avatar_glb_url", length = 500)
    private String avatarGlbUrl;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
