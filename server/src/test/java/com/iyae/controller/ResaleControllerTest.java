package com.iyae.controller;

import com.iyae.dto.CreateResaleListingRequest;
import com.iyae.dto.PagedResponse;
import com.iyae.dto.ResaleListingResponse;
import com.iyae.entity.enums.ResaleCondition;
import com.iyae.entity.enums.ResaleStatus;
import com.iyae.service.CheckoutService;
import com.iyae.service.ResaleService;
import com.iyae.testsupport.WebMvcSecurityConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ResaleController.class)
@Import(WebMvcSecurityConfig.class)
class ResaleControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @MockBean ResaleService resaleService;
    @MockBean CheckoutService checkoutService;

    private ResaleListingResponse sample() {
        return new ResaleListingResponse(
                1L, 100L, "Test Dress", List.of("/p.jpg"), "emma", "M",
                ResaleCondition.EXCELLENT, new BigDecimal("32.00"), "CAD", ResaleStatus.LISTED,
                null, List.of(), Instant.now());
    }

    @Test
    void browse_isPublic_returns200() throws Exception {
        when(resaleService.browse(anyInt(), anyInt(), any(), any()))
                .thenReturn(PagedResponse.from(Page.<ResaleListingResponse>empty()));

        mockMvc.perform(get("/api/resale/listings"))
                .andExpect(status().isOk());
    }

    @Test
    void getListing_isPublic_returns200() throws Exception {
        when(resaleService.getListing(1L)).thenReturn(sample());

        mockMvc.perform(get("/api/resale/listings/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.productName").value("Test Dress"))
                .andExpect(jsonPath("$.status").value("LISTED"));
    }

    @Test
    void eligibleItems_unauthenticated_isDenied() throws Exception {
        mockMvc.perform(get("/api/resale/eligible-items"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @WithMockUser(username = "buyer@example.com", roles = "BUYER")
    void createListing_buyer_returns201() throws Exception {
        when(resaleService.createListing(eq("buyer@example.com"), any())).thenReturn(sample());

        CreateResaleListingRequest req = new CreateResaleListingRequest(
                100L, "M", ResaleCondition.EXCELLENT, new BigDecimal("32.00"), null, null);

        mockMvc.perform(post("/api/resale/listings")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    @WithMockUser(username = "buyer@example.com", roles = "BUYER")
    void checkout_buyer_returns200() throws Exception {
        when(checkoutService.initiateResaleCheckout("buyer@example.com", 1L))
                .thenReturn(Map.of("sessionId", "cs_test_x", "url", "/checkout/success?session_id=cs_test_x"));

        mockMvc.perform(post("/api/resale/listings/1/checkout").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("/checkout/success?session_id=cs_test_x"));
    }
}
