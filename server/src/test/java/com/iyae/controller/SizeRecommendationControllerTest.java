package com.iyae.controller;

import com.iyae.dto.SizeRecommendationResponse;
import com.iyae.service.SizeRecommendationService;
import com.iyae.testsupport.WebMvcSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SizeRecommendationController.class)
@Import(WebMvcSecurityConfig.class)
class SizeRecommendationControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    SizeRecommendationService sizeRecommendationService;

    @Test
    @WithMockUser(username = "buyer@example.com")
    void getRecommendedSize_authenticated_returns200WithShape() throws Exception {
        when(sizeRecommendationService.recommend(anyLong(), anyString()))
                .thenReturn(new SizeRecommendationResponse(
                        "M", "MEASUREMENT_CHART", 0.87, List.of("S", "M", "L")));

        mockMvc.perform(get("/api/products/1/recommended-size"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendedSize").value("M"))
                .andExpect(jsonPath("$.basis").value("MEASUREMENT_CHART"))
                .andExpect(jsonPath("$.confidence").value(0.87))
                .andExpect(jsonPath("$.availableSizes[0]").value("S"))
                .andExpect(jsonPath("$.availableSizes[2]").value("L"));
    }

    @Test
    void getRecommendedSize_unauthenticated_isDenied() throws Exception {
        // /api/products/*/recommended-size is guarded by an explicit authenticated() matcher
        // placed before the public /api/products/** rule; anonymous access is rejected.
        mockMvc.perform(get("/api/products/1/recommended-size"))
                .andExpect(status().isUnauthorized());
    }
}
