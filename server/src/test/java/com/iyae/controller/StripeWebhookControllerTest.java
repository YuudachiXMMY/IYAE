package com.iyae.controller;

import com.iyae.service.CheckoutService;
import com.iyae.testsupport.WebMvcSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(StripeWebhookController.class)
@Import(WebMvcSecurityConfig.class)
class StripeWebhookControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    CheckoutService checkoutService;

    @Test
    void stripeWebhook_validSignature_returns200() throws Exception {
        doNothing().when(checkoutService).handleWebhook(anyString(), anyString());

        mockMvc.perform(post("/api/webhooks/stripe")
                        .with(csrf())
                        .contentType(MediaType.TEXT_PLAIN)
                        .header("Stripe-Signature", "t=123,v1=abc")
                        .content("{\"type\":\"checkout.session.completed\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void stripeWebhook_invalidSignature_returns500() throws Exception {
        doThrow(new RuntimeException("Webhook signature verification failed"))
                .when(checkoutService).handleWebhook(anyString(), anyString());

        mockMvc.perform(post("/api/webhooks/stripe")
                        .with(csrf())
                        .contentType(MediaType.TEXT_PLAIN)
                        .header("Stripe-Signature", "invalid-sig")
                        .content("{\"type\":\"checkout.session.completed\"}"))
                .andExpect(status().isInternalServerError());
    }

    @Test
    void stripeWebhook_missingSignatureHeader_returns400() throws Exception {
        mockMvc.perform(post("/api/webhooks/stripe")
                        .with(csrf())
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("{\"type\":\"checkout.session.completed\"}"))
                .andExpect(status().isBadRequest());
    }
}
