package com.iyae.controller;

import com.iyae.dto.*;
import com.iyae.entity.enums.Role;
import com.iyae.service.AuthService;
import com.iyae.testsupport.WebMvcSecurityConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import(WebMvcSecurityConfig.class)
class AuthControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    AuthService authService;

    private UserResponse sampleUser() {
        return new UserResponse(1L, "test@example.com", "Test User", Role.BUYER,
                true, null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null);
    }

    @Test
    void register_validRequest_returns200() throws Exception {
        AuthResponse response = new AuthResponse("jwt-token", sampleUser());
        when(authService.register(any())).thenReturn(response);

        String body = objectMapper.writeValueAsString(
                new RegisterRequest("test@example.com", "password123", "Test User", Role.BUYER,
                        null, null, null, null, null, null, null, null, null,
                        null, null, null, null, null, null, null,
                        null, null, null, null, null, null, null, null, null, null, null, null));

        mockMvc.perform(post("/api/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-token"));
    }

    @Test
    void register_missingEmail_returns400() throws Exception {
        String body = """
                {"password":"password123","role":"BUYER"}
                """;

        mockMvc.perform(post("/api/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void login_validCredentials_returns200() throws Exception {
        AuthResponse response = new AuthResponse("jwt-token", sampleUser());
        when(authService.login(any())).thenReturn(response);

        String body = objectMapper.writeValueAsString(new LoginRequest("test@example.com", "password123"));

        mockMvc.perform(post("/api/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("jwt-token"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void me_authenticated_returnsCurrentUser() throws Exception {
        when(authService.getCurrentUser("test@example.com")).thenReturn(sampleUser());

        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("test@example.com"));
    }

    @Test
    void me_unauthenticated_returns403() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isForbidden());
    }

    @Test
    void verifyEmail_validToken_returns200() throws Exception {
        when(authService.verifyEmail(anyString()))
                .thenReturn(new MessageResponse("Email verified successfully"));

        String body = objectMapper.writeValueAsString(new VerifyEmailRequest("valid-token-123"));

        mockMvc.perform(post("/api/auth/verify-email")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Email verified successfully"));
    }

    @Test
    void resendVerification_validEmail_returns200() throws Exception {
        when(authService.resendVerification(anyString()))
                .thenReturn(new MessageResponse("If an account exists and is unverified, we've sent a new verification link"));

        String body = objectMapper.writeValueAsString(new ResendVerificationRequest("test@example.com"));

        mockMvc.perform(post("/api/auth/resend-verification")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("If an account exists and is unverified, we've sent a new verification link"));
    }

    @Test
    void forgotPassword_validEmail_returns200() throws Exception {
        when(authService.forgotPassword(anyString()))
                .thenReturn(new MessageResponse("If that email exists, a reset link has been sent"));

        String body = objectMapper.writeValueAsString(new ForgotPasswordRequest("test@example.com"));

        mockMvc.perform(post("/api/auth/forgot-password")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());
    }

    @Test
    void resetPassword_validToken_returns200() throws Exception {
        when(authService.resetPassword(anyString(), anyString()))
                .thenReturn(new MessageResponse("Password reset successfully"));

        String body = objectMapper.writeValueAsString(new ResetPasswordRequest("valid-token", "newPassword123"));

        mockMvc.perform(post("/api/auth/reset-password")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password reset successfully"));
    }

    @Test
    void getPublicProfile_existingUsername_returns200() throws Exception {
        PublicProfileResponse profile = new PublicProfileResponse(
                "testuser", "Test User", false, null, null, null, null);
        when(authService.getPublicProfile("testuser")).thenReturn(profile);

        mockMvc.perform(get("/api/auth/users/profile/testuser"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("testuser"));
    }

    @Test
    void getPublicProfile_nonExistentUsername_returns404() throws Exception {
        when(authService.getPublicProfile("nobody")).thenReturn(null);

        mockMvc.perform(get("/api/auth/users/profile/nobody"))
                .andExpect(status().isNotFound());
    }
}
