package com.iyae.controller;

import com.iyae.service.CheckoutService;
import com.iyae.testsupport.WebMvcSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PublicConfigController.class)
@Import(WebMvcSecurityConfig.class)
class PublicConfigControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired PublicConfigController controller;
    @MockBean CheckoutService checkoutService;

    @Test
    void config_isPublic_andReportsCheckoutDisabled() throws Exception {
        when(checkoutService.isCheckoutEnabled()).thenReturn(false);
        mockMvc.perform(get("/api/public/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checkoutEnabled").value(false));
    }

    @Test
    void config_reportsCheckoutEnabledWhenPaymentIsWired() throws Exception {
        when(checkoutService.isCheckoutEnabled()).thenReturn(true);
        mockMvc.perform(get("/api/public/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checkoutEnabled").value(true));
    }

    @Test
    void config_reportsRequireEmailVerification() throws Exception {
        // The second field was never asserted, and it is the one that replaced the removed
        // NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION build flag — the whole point of reading the gate
        // at runtime is that there is a single source for it, so the response has to carry it.
        // The test profile leaves app.auth.require-email-verification at its `true` default.
        when(checkoutService.isCheckoutEnabled()).thenReturn(false);
        mockMvc.perform(get("/api/public/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requireEmailVerification").value(true));
    }

    @Test
    void config_reflectsRequireEmailVerificationWhenTurnedOff() throws Exception {
        // dev sets this to false. A response that always said `true` would send every dev signup
        // to the verify-email page with no mail server behind it.
        ReflectionTestUtils.setField(controller, "requireEmailVerification", false);
        when(checkoutService.isCheckoutEnabled()).thenReturn(false);
        mockMvc.perform(get("/api/public/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requireEmailVerification").value(false));
    }
}
