package com.clossette.controller;

import com.clossette.dto.PagedResponse;
import com.clossette.dto.ReviewRequest;
import com.clossette.dto.ReviewResponse;
import com.clossette.dto.ReviewSummaryResponse;
import com.clossette.repository.UserRepository;
import com.clossette.service.ReviewService;
import com.clossette.testsupport.WebMvcSecurityConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ReviewController.class)
@Import(WebMvcSecurityConfig.class)
class ReviewControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    ReviewService reviewService;

    @MockBean
    UserRepository userRepository;

    private ReviewResponse sampleReview() {
        return new ReviewResponse(1L, 10L, "Emma", 4, "Great quality!", Instant.now());
    }

    @Test
    void getReviews_noAuth_returns200() throws Exception {
        PagedResponse<ReviewResponse> page = new PagedResponse<>(List.of(sampleReview()), 0, 20, 1, 1, true);
        when(reviewService.getReviews(eq(1L), anyInt(), anyInt())).thenReturn(page);

        mockMvc.perform(get("/api/products/1/reviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].rating").value(4))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void getReviewSummary_noAuth_returns200() throws Exception {
        when(reviewService.getReviewSummary(1L)).thenReturn(new ReviewSummaryResponse(4.2, 10));

        mockMvc.perform(get("/api/products/1/reviews/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.averageRating").value(4.2))
                .andExpect(jsonPath("$.reviewCount").value(10));
    }

    @Test
    @WithMockUser(username = "buyer@example.com")
    void createReview_authenticated_returns200() throws Exception {
        when(reviewService.createReview(eq("buyer@example.com"), eq(1L), any())).thenReturn(sampleReview());

        String body = objectMapper.writeValueAsString(new ReviewRequest(4, "Great quality!"));

        mockMvc.perform(post("/api/products/1/reviews")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rating").value(4))
                .andExpect(jsonPath("$.userName").value("Emma"));
    }

    @Test
    void createReview_unauthenticated_returns403() throws Exception {
        String body = objectMapper.writeValueAsString(new ReviewRequest(4, "Great quality!"));

        mockMvc.perform(post("/api/products/1/reviews")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "buyer@example.com")
    void deleteReview_authenticated_returns204() throws Exception {
        doNothing().when(reviewService).deleteReview(eq("buyer@example.com"), eq(1L));

        mockMvc.perform(delete("/api/products/1/reviews")
                        .with(csrf()))
                .andExpect(status().isNoContent());
    }
}
