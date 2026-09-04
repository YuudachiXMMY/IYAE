package com.clossette.service;

import com.clossette.dto.*;
import com.clossette.entity.BodyProfile;
import com.clossette.entity.DesignerProfile;
import com.clossette.entity.PasswordResetToken;
import com.clossette.entity.User;
import com.clossette.entity.enums.Role;
import com.clossette.repository.BodyProfileRepository;
import com.clossette.repository.DesignerProfileRepository;
import com.clossette.repository.PasswordResetTokenRepository;
import com.clossette.repository.UserRepository;
import com.clossette.security.JwtTokenProvider;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final SecureTokenService secureTokenService;
    private final AuthMailService authMailService;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final BodyProfileRepository bodyProfileRepository;
    private final DesignerProfileRepository designerProfileRepository;

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Value("${app.auth.verification-token-ttl}")
    private Duration verificationTokenTtl;

    @Value("${app.auth.password-reset-ttl}")
    private Duration passwordResetTtl;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new IllegalArgumentException("Email already registered");
        }

        if (request.username() != null && !request.username().isBlank()
                && userRepository.existsByUsernameIgnoreCase(request.username())) {
            throw new IllegalArgumentException("Username already taken");
        }

        String rawToken = secureTokenService.generateRawToken();
        String tokenHash = secureTokenService.hashToken(rawToken);

        String displayName = (request.name() != null && !request.name().isBlank())
                ? request.name()
                : request.email().split("@")[0];

        User user = new User();
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setName(displayName);
        user.setRole(request.role());
        user.setEmailVerified(false);
        user.setVerificationToken(tokenHash);
        user.setVerificationTokenExpiresAt(Instant.now().plus(verificationTokenTtl));

        if (request.username() != null) user.setUsername(request.username());
        if (request.ageRange() != null) user.setAgeRange(request.ageRange());
        if (request.genderIdentity() != null) user.setGenderIdentity(request.genderIdentity());
        if (request.profileVisibility() != null) user.setProfileVisibility(request.profileVisibility());
        if (request.bodyProfileVisibility() != null) user.setBodyProfileVisibility(request.bodyProfileVisibility());
        user.setStyleAesthetics(serializeList(request.styleAesthetics()));
        user.setFitPreferences(serializeList(request.fitPreferences()));
        user.setFavoriteColors(serializeList(request.favoriteColors()));
        user.setAvoidedColors(serializeList(request.avoidedColors()));
        if (request.budgetRange() != null) user.setBudgetRange(request.budgetRange());
        user.setFavoriteBrands(serializeList(request.favoriteBrands()));
        if (request.sustainableFashionInterest() != null) user.setSustainableFashionInterest(request.sustainableFashionInterest());
        if (request.pricePreference() != null) user.setPricePreference(request.pricePreference());
        user.setOutfitGoals(serializeList(request.outfitGoals()));
        if (request.avatarMode() != null) user.setAvatarMode(request.avatarMode());
        if (request.avatarPreset() != null) user.setAvatarPreset(request.avatarPreset());

        user = userRepository.save(user);

        if (hasBodyProfileData(request)) {
            BodyProfile profile = BodyProfile.builder().user(user).build();
            if (request.heightCm() != null) profile.setHeightCm(request.heightCm());
            if (request.weightKg() != null) profile.setWeightKg(request.weightKg());
            if (request.chestCm() != null) profile.setChestCm(request.chestCm());
            if (request.waistCm() != null) profile.setWaistCm(request.waistCm());
            if (request.hipsCm() != null) profile.setHipsCm(request.hipsCm());
            if (request.shoulderWidthCm() != null) profile.setShoulderWidthCm(request.shoulderWidthCm());
            if (request.inseamCm() != null) profile.setInseamCm(request.inseamCm());
            if (request.shoeSize() != null) profile.setShoeSize(request.shoeSize());
            if (request.topSize() != null) profile.setTopSize(request.topSize());
            if (request.bottomSize() != null) profile.setBottomSize(request.bottomSize());
            if (request.dressSize() != null) profile.setDressSize(request.dressSize());
            if (request.jacketSize() != null) profile.setJacketSize(request.jacketSize());
            bodyProfileRepository.save(profile);
        }

        if (request.role() == Role.DESIGNER) {
            DesignerProfile designerProfile = DesignerProfile.builder()
                    .user(user)
                    .displayName(displayName)
                    .build();
            designerProfileRepository.save(designerProfile);
        }

        try {
            authMailService.sendVerificationEmail(user.getEmail(), user.getName(), rawToken);
        } catch (AuthMailService.EmailDeliveryException e) {
            // Registration succeeds even if verification email fails — user can request resend later
            log.warn("Failed to send verification email for user {}", user.getId(), e);
        }

        String jwt = jwtTokenProvider.generateToken(user.getEmail());
        return new AuthResponse(jwt, UserResponse.from(user));
    }

    public AuthResponse login(LoginRequest request) {
        // Constant-time: always hash-check even if user doesn't exist
        User user = userRepository.findByEmail(request.email()).orElse(null);
        String storedHash = user != null ? user.getPasswordHash() : "$2a$10$dummyhashfortimingattak";

        boolean matches = passwordEncoder.matches(request.password(), storedHash);
        if (user == null || !matches) {
            throw new IllegalArgumentException("Invalid email or password");
        }

        String token = jwtTokenProvider.generateToken(user.getEmail());
        return new AuthResponse(token, UserResponse.from(user));
    }

    public UserResponse getCurrentUser(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return UserResponse.from(user);
    }

    @Transactional
    public UserResponse updateUserProfile(String email, UpdateUserProfileRequest req) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (req.username() != null && !req.username().isBlank()) {
            String newUsername = req.username();
            if (!newUsername.equalsIgnoreCase(user.getUsername())
                    && userRepository.existsByUsernameIgnoreCase(newUsername)) {
                throw new IllegalArgumentException("Username already taken");
            }
            user.setUsername(newUsername);
        }
        if (req.name() != null) user.setName(req.name());
        if (req.ageRange() != null) user.setAgeRange(req.ageRange());
        if (req.genderIdentity() != null) user.setGenderIdentity(req.genderIdentity());
        if (req.profileVisibility() != null) user.setProfileVisibility(req.profileVisibility());
        if (req.bodyProfileVisibility() != null) user.setBodyProfileVisibility(req.bodyProfileVisibility());
        if (req.styleAesthetics() != null) user.setStyleAesthetics(serializeList(req.styleAesthetics()));
        if (req.fitPreferences() != null) user.setFitPreferences(serializeList(req.fitPreferences()));
        if (req.favoriteColors() != null) user.setFavoriteColors(serializeList(req.favoriteColors()));
        if (req.avoidedColors() != null) user.setAvoidedColors(serializeList(req.avoidedColors()));
        if (req.budgetRange() != null) user.setBudgetRange(req.budgetRange());
        if (req.favoriteBrands() != null) user.setFavoriteBrands(serializeList(req.favoriteBrands()));
        if (req.sustainableFashionInterest() != null) user.setSustainableFashionInterest(req.sustainableFashionInterest());
        if (req.pricePreference() != null) user.setPricePreference(req.pricePreference());
        if (req.outfitGoals() != null) user.setOutfitGoals(serializeList(req.outfitGoals()));
        if (req.avatarMode() != null) user.setAvatarMode(req.avatarMode());
        if (req.avatarPreset() != null) user.setAvatarPreset(req.avatarPreset());

        user = userRepository.save(user);
        return UserResponse.from(user);
    }

    @Transactional
    public MessageResponse verifyEmail(String rawToken) {
        String hash = secureTokenService.hashToken(rawToken);
        User user = userRepository.findByVerificationToken(hash)
                .orElseThrow(() -> new IllegalArgumentException("Invalid verification token"));

        if (user.getVerificationTokenExpiresAt() == null
                || Instant.now().isAfter(user.getVerificationTokenExpiresAt())) {
            throw new IllegalArgumentException("Verification link has expired");
        }

        user.setEmailVerified(true);
        user.setVerificationToken(null);
        user.setVerificationTokenExpiresAt(null);
        userRepository.save(user);

        return new MessageResponse("Email verified successfully");
    }

    @Transactional
    public MessageResponse forgotPassword(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            // Invalidate all existing unused reset tokens for this user
            passwordResetTokenRepository.findByUserAndUsedAtIsNull(user)
                    .forEach(oldToken -> {
                        oldToken.setUsedAt(Instant.now());
                        passwordResetTokenRepository.save(oldToken);
                    });

            String rawToken = secureTokenService.generateRawToken();
            String tokenHash = secureTokenService.hashToken(rawToken);

            PasswordResetToken resetToken = PasswordResetToken.builder()
                    .user(user)
                    .tokenHash(tokenHash)
                    .expiresAt(Instant.now().plus(passwordResetTtl))
                    .build();
            passwordResetTokenRepository.save(resetToken);

            try {
                authMailService.sendPasswordResetEmail(user.getEmail(), user.getName(), rawToken);
            } catch (AuthMailService.EmailDeliveryException e) {
                // Swallow to prevent account enumeration via 503 vs 200 side-channel
                log.error("Failed to send password reset email for user {}", user.getId(), e);
            }
        });

        return new MessageResponse("If an account exists with that email, we've sent a password reset link");
    }

    @Transactional
    public MessageResponse resetPassword(String rawToken, String newPassword) {
        String hash = secureTokenService.hashToken(rawToken);
        PasswordResetToken resetToken = passwordResetTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new IllegalArgumentException("Reset link is invalid or has expired"));

        if (resetToken.getUsedAt() != null || Instant.now().isAfter(resetToken.getExpiresAt())) {
            throw new IllegalArgumentException("Reset link is invalid or has expired");
        }

        // Atomically mark token as used to prevent concurrent consumption
        int updated = passwordResetTokenRepository.consumeToken(hash);
        if (updated == 0) {
            throw new IllegalArgumentException("Reset link is invalid or has expired");
        }

        User user = resetToken.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // Invalidate all other unused tokens for this user
        passwordResetTokenRepository.findByUserAndUsedAtIsNull(user)
                .forEach(oldToken -> {
                    oldToken.setUsedAt(Instant.now());
                    passwordResetTokenRepository.save(oldToken);
                });

        return new MessageResponse("Password has been reset successfully");
    }

    public PublicProfileResponse getPublicProfile(String username) {
        if (username == null || username.isBlank() || username.length() > 50) {
            return null;
        }
        User user = userRepository.findByUsernameIgnoreCase(username)
                .orElse(null);
        if (user == null) {
            return null;
        }
        // Whitelist: only null (legacy) or "PUBLIC" exposes the profile.
        // New visibility values default to hidden until explicitly allowed here.
        String visibility = user.getProfileVisibility();
        if (visibility != null && !"PUBLIC".equalsIgnoreCase(visibility)) {
            return null;
        }
        return PublicProfileResponse.from(user);
    }

    private String serializeList(List<String> list) {
        if (list == null) {
            return null;
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Failed to serialize list to JSON", e);
        }
    }

    private boolean hasBodyProfileData(RegisterRequest request) {
        return request.heightCm() != null || request.weightKg() != null
                || request.chestCm() != null || request.waistCm() != null
                || request.hipsCm() != null || request.shoulderWidthCm() != null
                || request.inseamCm() != null || request.shoeSize() != null
                || request.topSize() != null || request.bottomSize() != null
                || request.dressSize() != null || request.jacketSize() != null;
    }
}
