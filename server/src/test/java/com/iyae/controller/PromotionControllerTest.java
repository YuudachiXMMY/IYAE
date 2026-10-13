package com.iyae.controller;

import com.iyae.dto.PromotionRequest;
import com.iyae.dto.PromotionResponse;
import com.iyae.entity.enums.SlotType;
import com.iyae.service.PromotionService;
import com.iyae.testsupport.WebMvcSecurityConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PromotionController.class)
@Import(WebMvcSecurityConfig.class)
class PromotionControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    PromotionService promotionService;

    private PromotionResponse samplePromotion() {
        return new PromotionResponse(1L, 10L, "Sample Product", SlotType.FEATURED, 50,
                Instant.parse("2026-01-01T00:00:00Z"), Instant.parse("2026-12-31T23:59:59Z"), true);
    }

    private String promotionRequestJson() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        PromotionRequest req = new PromotionRequest(
                10L, SlotType.FEATURED, 50,
                Instant.parse("2026-01-01T00:00:00Z"),
                Instant.parse("2026-12-31T23:59:59Z"));
        return mapper.writeValueAsString(req);
    }

    @Test
    void getFeatured_public_returns200() throws Exception {
        when(promotionService.getFeatured()).thenReturn(List.of(samplePromotion()));

        mockMvc.perform(get("/api/promotions/featured"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].slotType").value("FEATURED"));
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void createPromotion_designer_returns201() throws Exception {
        when(promotionService.createPromotion(eq("designer@example.com"), any())).thenReturn(samplePromotion());

        mockMvc.perform(post("/api/promotions")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(promotionRequestJson()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    @WithMockUser(username = "buyer@example.com", roles = "BUYER")
    void createPromotion_nonDesigner_returns403() throws Exception {
        mockMvc.perform(post("/api/promotions")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(promotionRequestJson()))
                .andExpect(status().isForbidden());
    }

    @Test
    void createPromotion_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/api/promotions")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(promotionRequestJson()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void updatePromotion_designer_returns200() throws Exception {
        when(promotionService.updatePromotion(eq("designer@example.com"), eq(1L), any()))
                .thenReturn(samplePromotion());

        mockMvc.perform(put("/api/promotions/1")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(promotionRequestJson()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void deletePromotion_designer_returns204() throws Exception {
        doNothing().when(promotionService).deletePromotion(eq("designer@example.com"), eq(1L));

        mockMvc.perform(delete("/api/promotions/1")
                        .with(csrf()))
                .andExpect(status().isNoContent());
    }
}
