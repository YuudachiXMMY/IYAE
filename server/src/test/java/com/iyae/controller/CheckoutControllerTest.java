package com.iyae.controller;

import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import com.iyae.repository.UserRepository;
import com.iyae.service.CheckoutService;
import com.iyae.testsupport.WebMvcSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CheckoutController.class)
@Import(WebMvcSecurityConfig.class)
class CheckoutControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    CheckoutService checkoutService;

    @MockBean
    UserRepository userRepository;

    private User verifiedBuyer(String email) {
        User user = new User();
        user.setEmail(email);
        user.setRole(Role.BUYER);
        user.setEmailVerified(true);
        return user;
    }

    private User unverifiedBuyer(String email) {
        User user = new User();
        user.setEmail(email);
        user.setRole(Role.BUYER);
        user.setEmailVerified(false);
        return user;
    }

    @Test
    @WithMockUser(username = "buyer@example.com")
    void checkout_verifiedUser_returns200() throws Exception {
        when(userRepository.findByEmail("buyer@example.com"))
                .thenReturn(Optional.of(verifiedBuyer("buyer@example.com")));
        when(checkoutService.initiateCheckout("buyer@example.com"))
                .thenReturn(Map.of("sessionId", "cs_test_123", "url", "https://checkout.stripe.com/test"));

        mockMvc.perform(post("/api/checkout").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value("cs_test_123"));
    }

    @Test
    void checkout_unauthenticated_returns403() throws Exception {
        mockMvc.perform(post("/api/checkout").with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "unverified@example.com")
    void checkout_unverifiedEmail_returns403() throws Exception {
        when(userRepository.findByEmail("unverified@example.com"))
                .thenReturn(Optional.of(unverifiedBuyer("unverified@example.com")));

        mockMvc.perform(post("/api/checkout").with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "buyer@example.com")
    void checkout_serviceThrowsIllegalArgument_returns400() throws Exception {
        when(userRepository.findByEmail("buyer@example.com"))
                .thenReturn(Optional.of(verifiedBuyer("buyer@example.com")));
        when(checkoutService.initiateCheckout(anyString()))
                .thenThrow(new IllegalArgumentException("Cart is empty"));

        mockMvc.perform(post("/api/checkout").with(csrf()))
                .andExpect(status().isBadRequest());
    }
}
