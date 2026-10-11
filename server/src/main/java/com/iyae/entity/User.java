package com.iyae.entity;

import com.iyae.entity.enums.Role;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "users")
// A deleted account is a tombstone row (see deletedAt) and must be invisible to every query
// for this entity — login, registration's duplicate check, the JWT filter, profile lookups,
// follower lists. Applying it here rather than at each call site is the point: there are too
// many lookups for "remember to filter" to hold, and a missed one leaves a deleted account
// partly alive. By-id association loads are unaffected, so an Order still resolves its user.
@org.hibernate.annotations.SQLRestriction("deleted_at is null")
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

    /**
     * Incremented on password reset (and any future credential change) to revoke previously-issued
     * JWTs: a token carries the version it was minted with, and {@code JwtAuthenticationFilter}
     * rejects any token whose version is below the user's current value.
     */
    @Column(name = "token_version", nullable = false)
    @Builder.Default
    private Integer tokenVersion = 0;

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

    // Phase 6: backs the city-scoped community feed (e.g. Toronto)
    @Column(name = "city", length = 120)
    private String city;

    /**
     * Set when the account is deleted. The row survives because {@code orders} holds a non-null
     * FK to it and an order is a financial record, so deletion scrubs the identifying fields
     * instead.
     *
     * <p>A tombstone is invisible to every JPA query for this entity — see the
     * {@code @SQLRestriction} on the class. That is deliberate rather than filtering at each
     * call site: {@code findByEmail} alone has nine callers (login, registration, the JWT
     * filter, profile reads, password reset, …) and one missed site would leave a deleted
     * account partly alive. Loading the association from an {@code Order} still resolves,
     * because Hibernate fetches a to-one association by id and the restriction does not apply
     * to a by-id load — so order history survives the deletion, as intended.
     */
    @Column(name = "deleted_at")
    private Instant deletedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /**
     * The handle shown to other people.
     *
     * <p>Falls back to a derived {@code user{id}} rather than to the email address. Community
     * posts, comments and reports previously used the email when no username had been set —
     * and username is optional at registration, so a buyer who signed up and posted once had
     * their address published next to their post for every visitor and every scraper.
     *
     * <p>Not {@code name} either: that is a display name a user may have entered as their real
     * name without intending it as a public handle.
     */
    public String publicDisplayName() {
        return username != null && !username.isBlank() ? username : "user" + id;
    }
}
