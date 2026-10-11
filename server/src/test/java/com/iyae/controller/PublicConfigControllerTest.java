package com.iyae.controller;

import com.iyae.service.CheckoutService;
import com.iyae.testsupport.WebMvcSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PublicConfigController.class)
@Import(WebMvcSecurityConfig.class)
class PublicConfigControllerTest {

    @Autowired MockMvc mockMvc;
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
}
