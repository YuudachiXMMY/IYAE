package com.clossette.service;

import com.clossette.dto.AuthResponse;
import com.clossette.dto.LoginRequest;
import com.clossette.dto.MessageResponse;
import com.clossette.dto.RegisterRequest;
import com.clossette.dto.UpdateUserProfileRequest;
import com.clossette.dto.UserResponse;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    UserRepository userRepository;

    @Mock
    PasswordEncoder passwordEncoder;

    @Mock
    JwtTokenProvider jwtTokenProvider;

    @Mock
    SecureTokenService secureTokenService;

    @Mock
    AuthMailService authMailService;

    @Mock
    PasswordResetTokenRepository passwordResetTokenRepository;

    @Mock
    BodyProfileRepository bodyProfileRepository;

    @Mock
    DesignerProfileRepository designerProfileRepository;

    @InjectMocks
    AuthService authService;

    private User testUser;

    private static RegisterRequest minimalRequest(String email, String password, String name, Role role) {
        return new RegisterRequest(email, password, name, role,
                null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null);
    }

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authService, "verificationTokenTtl", Duration.ofHours(24));
        ReflectionTestUtils.setField(authService, "passwordResetTtl", Duration.ofHours(1));

        testUser = User.builder()
                .id(1L)
                .email("test@example.com")
                .passwordHash("$2a$10$hashedpassword")
                .name("Test User")
                .role(Role.BUYER)
                .build();
    }

    @Test
    void register_success() {
        RegisterRequest request = minimalRequest("new@example.com", "password123", "New User", Role.BUYER);
        User savedUser = User.builder()
                .id(2L)
                .email("new@example.com")
                .passwordHash("$2a$10$encoded")
                .name("New User")
                .role(Role.BUYER)
                .build();

        when(userRepository.findByEmail("new@example.com")).thenReturn(Optional.empty());
        when(secureTokenService.generateRawToken()).thenReturn("rawtoken");
        when(secureTokenService.hashToken("rawtoken")).thenReturn("hashedtoken");
        when(passwordEncoder.encode("password123")).thenReturn("$2a$10$encoded");
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtTokenProvider.generateToken("new@example.com")).thenReturn("test.jwt.token");

        AuthResponse response = authService.register(request);

        assertThat(response.token()).isEqualTo("test.jwt.token");
        assertThat(response.user().email()).isEqualTo("new@example.com");
    }

    @Test
    void register_duplicateEmail_throwsIllegalArgumentException() {
        RegisterRequest request = minimalRequest("test@example.com", "password123", "Test User", Role.BUYER);
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Email already registered");
    }

    @Test
    void login_success() {
        LoginRequest request = new LoginRequest("test@example.com", "password123");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches("password123", "$2a$10$hashedpassword")).thenReturn(true);
        when(jwtTokenProvider.generateToken("test@example.com")).thenReturn("test.jwt.token");

        AuthResponse response = authService.login(request);

        assertThat(response.token()).isEqualTo("test.jwt.token");
        assertThat(response.user().email()).isEqualTo("test@example.com");
    }

    @Test
    void login_wrongPassword_throwsIllegalArgumentException() {
        LoginRequest request = new LoginRequest("test@example.com", "wrongpassword");

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    void login_nonexistentUser_throwsIllegalArgumentException() {
        LoginRequest request = new LoginRequest("nobody@example.com", "password123");

        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid email or password");
    }

    @Test
    void register_withMeasurements_createsBodyProfile() {
        RegisterRequest request = new RegisterRequest(
                "newuser@example.com", "password123", "New User", Role.BUYER,
                null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null,
                165.0, 60.0, 90.0, 70.0, 95.0, 38.5, 76.25, "US 8", "M", "32", null, null);

        User savedUser = User.builder()
                .id(3L)
                .email("newuser@example.com")
                .passwordHash("$2a$10$encoded")
                .name("New User")
                .role(Role.BUYER)
                .build();

        when(userRepository.findByEmail("newuser@example.com")).thenReturn(Optional.empty());
        when(secureTokenService.generateRawToken()).thenReturn("rawtoken");
        when(secureTokenService.hashToken("rawtoken")).thenReturn("hashedtoken");
        when(passwordEncoder.encode("password123")).thenReturn("$2a$10$encoded");
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtTokenProvider.generateToken("newuser@example.com")).thenReturn("test.jwt.token");

        authService.register(request);

        ArgumentCaptor<BodyProfile> captor = ArgumentCaptor.forClass(BodyProfile.class);
        verify(bodyProfileRepository).save(captor.capture());
        BodyProfile savedProfile = captor.getValue();
        assertThat(savedProfile.getShoulderWidthCm()).isEqualTo(38.5);
        assertThat(savedProfile.getInseamCm()).isEqualTo(76.25);
    }

    @Test
    void register_designerRole_createsDesignerProfile() {
        RegisterRequest request = minimalRequest("designer@example.com", "password123", "New Designer", Role.DESIGNER);
        User savedUser = User.builder()
                .id(4L)
                .email("designer@example.com")
                .passwordHash("$2a$10$encoded")
                .name("New Designer")
                .role(Role.DESIGNER)
                .build();

        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.empty());
        when(secureTokenService.generateRawToken()).thenReturn("rawtoken");
        when(secureTokenService.hashToken("rawtoken")).thenReturn("hashedtoken");
        when(passwordEncoder.encode("password123")).thenReturn("$2a$10$encoded");
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(designerProfileRepository.save(any(DesignerProfile.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(jwtTokenProvider.generateToken("designer@example.com")).thenReturn("test.jwt.token");

        AuthResponse response = authService.register(request);

        assertThat(response.token()).isEqualTo("test.jwt.token");
        ArgumentCaptor<DesignerProfile> captor = ArgumentCaptor.forClass(DesignerProfile.class);
        verify(designerProfileRepository).save(captor.capture());
        DesignerProfile savedProfile = captor.getValue();
        assertThat(savedProfile.getUser()).isEqualTo(savedUser);
        assertThat(savedProfile.getDisplayName()).isEqualTo("New Designer");
    }

    @Test
    void register_buyerRole_doesNotCreateDesignerProfile() {
        RegisterRequest request = minimalRequest("buyer@example.com", "password123", "New Buyer", Role.BUYER);
        User savedUser = User.builder()
                .id(5L)
                .email("buyer@example.com")
                .passwordHash("$2a$10$encoded")
                .name("New Buyer")
                .role(Role.BUYER)
                .build();

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.empty());
        when(secureTokenService.generateRawToken()).thenReturn("rawtoken");
        when(secureTokenService.hashToken("rawtoken")).thenReturn("hashedtoken");
        when(passwordEncoder.encode("password123")).thenReturn("$2a$10$encoded");
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtTokenProvider.generateToken("buyer@example.com")).thenReturn("test.jwt.token");

        authService.register(request);

        verify(designerProfileRepository, never()).save(any());
    }

    @Test
    void register_duplicateUsername_throwsException() {
        RegisterRequest request = new RegisterRequest(
                "another@example.com", "password123", "Another User", Role.BUYER,
                "takenUsername", null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null, null);

        when(userRepository.findByEmail("another@example.com")).thenReturn(Optional.empty());
        when(userRepository.existsByUsernameIgnoreCase("takenUsername")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Username already taken");
    }

    @Test
    void updateUserProfile_success() {
        UpdateUserProfileRequest req = new UpdateUserProfileRequest(
                "Updated Name", null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null);

        User savedUser = User.builder()
                .id(1L)
                .email("test@example.com")
                .passwordHash("$2a$10$hashedpassword")
                .name("Updated Name")
                .role(Role.BUYER)
                .build();

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(userRepository.save(any(User.class))).thenReturn(savedUser);

        UserResponse response = authService.updateUserProfile("test@example.com", req);

        assertThat(response.name()).isEqualTo("Updated Name");
        verify(userRepository).save(any(User.class));
    }

    @Test
    void updateUserProfile_duplicateUsername_throwsException() {
        UpdateUserProfileRequest req = new UpdateUserProfileRequest(
                null, "takenUsername", null, null, null, null,
                null, null, null, null, null, null, null, null, null, null, null);

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(userRepository.existsByUsernameIgnoreCase("takenUsername")).thenReturn(true);

        assertThatThrownBy(() -> authService.updateUserProfile("test@example.com", req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Username already taken");
    }

    // -------------------------------------------------------------------------
    // verifyEmail tests
    // -------------------------------------------------------------------------

    @Test
    void verifyEmail_success() {
        String rawToken = "valid-raw-token";
        String hash = "hashed-token";
        testUser.setVerificationToken(hash);
        testUser.setVerificationTokenExpiresAt(Instant.now().plusSeconds(3600));
        testUser.setEmailVerified(false);

        when(secureTokenService.hashToken(rawToken)).thenReturn(hash);
        when(userRepository.findByVerificationToken(hash)).thenReturn(Optional.of(testUser));
        when(userRepository.save(any(User.class))).thenReturn(testUser);

        MessageResponse response = authService.verifyEmail(rawToken);

        assertThat(response.message()).isEqualTo("Email verified successfully");
        assertThat(testUser.getEmailVerified()).isTrue();
        assertThat(testUser.getVerificationToken()).isNull();
        assertThat(testUser.getVerificationTokenExpiresAt()).isNull();
        verify(userRepository).save(testUser);
    }

    @Test
    void verifyEmail_invalidToken_throws() {
        String rawToken = "nonexistent-token";
        String hash = "nonexistent-hash";

        when(secureTokenService.hashToken(rawToken)).thenReturn(hash);
        when(userRepository.findByVerificationToken(hash)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.verifyEmail(rawToken))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Invalid verification token");
    }

    @Test
    void verifyEmail_expiredToken_throws() {
        String rawToken = "expired-raw-token";
        String hash = "expired-hash";
        testUser.setVerificationToken(hash);
        testUser.setVerificationTokenExpiresAt(Instant.now().minusSeconds(3600));

        when(secureTokenService.hashToken(rawToken)).thenReturn(hash);
        when(userRepository.findByVerificationToken(hash)).thenReturn(Optional.of(testUser));

        assertThatThrownBy(() -> authService.verifyEmail(rawToken))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Verification link has expired");
    }

    // -------------------------------------------------------------------------
    // forgotPassword tests
    // -------------------------------------------------------------------------

    @Test
    void forgotPassword_existingUser_createsTokenAndSendsEmail() {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(testUser));
        when(passwordResetTokenRepository.findByUserAndUsedAtIsNull(testUser))
                .thenReturn(Collections.emptyList());
        when(secureTokenService.generateRawToken()).thenReturn("raw-reset-token");
        when(secureTokenService.hashToken("raw-reset-token")).thenReturn("hashed-reset-token");
        when(passwordResetTokenRepository.save(any(PasswordResetToken.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        MessageResponse response = authService.forgotPassword("test@example.com");

        assertThat(response.message()).contains("If an account exists");
        verify(passwordResetTokenRepository).save(any(PasswordResetToken.class));
        verify(authMailService).sendPasswordResetEmail(
                eq("test@example.com"), eq("Test User"), eq("raw-reset-token"));
    }

    @Test
    void forgotPassword_nonExistentUser_returnsGenericMessage() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        MessageResponse response = authService.forgotPassword("nobody@example.com");

        assertThat(response.message()).contains("If an account exists");
        verify(passwordResetTokenRepository, never()).save(any());
        verify(authMailService, never()).sendPasswordResetEmail(anyString(), anyString(), anyString());
    }

    // -------------------------------------------------------------------------
    // resetPassword tests
    // -------------------------------------------------------------------------

    @Test
    void resetPassword_success() {
        String rawToken = "valid-reset-token";
        String hash = "valid-reset-hash";
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .user(testUser)
                .tokenHash(hash)
                .expiresAt(Instant.now().plusSeconds(3600))
                .usedAt(null)
                .build();

        when(secureTokenService.hashToken(rawToken)).thenReturn(hash);
        when(passwordResetTokenRepository.findByTokenHash(hash)).thenReturn(Optional.of(resetToken));
        when(passwordResetTokenRepository.consumeToken(hash)).thenReturn(1);
        when(passwordEncoder.encode("newPassword123")).thenReturn("$2a$10$newencoded");
        when(userRepository.save(any(User.class))).thenReturn(testUser);
        when(passwordResetTokenRepository.findByUserAndUsedAtIsNull(testUser))
                .thenReturn(Collections.emptyList());

        MessageResponse response = authService.resetPassword(rawToken, "newPassword123");

        assertThat(response.message()).isEqualTo("Password has been reset successfully");
        verify(passwordEncoder).encode("newPassword123");
        verify(userRepository).save(testUser);
    }

    @Test
    void resetPassword_expiredToken_throws() {
        String rawToken = "expired-reset-token";
        String hash = "expired-reset-hash";
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .user(testUser)
                .tokenHash(hash)
                .expiresAt(Instant.now().minusSeconds(3600))
                .usedAt(null)
                .build();

        when(secureTokenService.hashToken(rawToken)).thenReturn(hash);
        when(passwordResetTokenRepository.findByTokenHash(hash)).thenReturn(Optional.of(resetToken));

        assertThatThrownBy(() -> authService.resetPassword(rawToken, "newPassword123"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Reset link is invalid or has expired");
    }

    @Test
    void resetPassword_alreadyUsedToken_throws() {
        String rawToken = "used-reset-token";
        String hash = "used-reset-hash";
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .user(testUser)
                .tokenHash(hash)
                .expiresAt(Instant.now().plusSeconds(3600))
                .usedAt(Instant.now().minusSeconds(60))
                .build();

        when(secureTokenService.hashToken(rawToken)).thenReturn(hash);
        when(passwordResetTokenRepository.findByTokenHash(hash)).thenReturn(Optional.of(resetToken));

        assertThatThrownBy(() -> authService.resetPassword(rawToken, "newPassword123"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Reset link is invalid or has expired");
    }
}
