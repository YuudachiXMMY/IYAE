package com.iyae.controller;

import com.iyae.dto.FollowCountsResponse;
import com.iyae.dto.PagedResponse;
import com.iyae.dto.PublicUserSummary;
import com.iyae.entity.enums.Role;
import com.iyae.service.FollowService;
import com.iyae.testsupport.WebMvcSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(FollowController.class)
@Import(WebMvcSecurityConfig.class)
class FollowControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    FollowService followService;

    private PublicUserSummary sampleUser() {
        return new PublicUserSummary(2L, "otheruser", "Other User", Role.BUYER, null, null, null);
    }

    private PagedResponse<PublicUserSummary> pagedUsers() {
        return new PagedResponse<>(List.of(sampleUser()), 0, 20, 1L, 1, true);
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void toggleFollow_authenticated_returns204() throws Exception {
        doNothing().when(followService).follow(eq("test@example.com"), eq(2L));

        mockMvc.perform(post("/api/follows/2")
                        .with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    void toggleFollow_unauthenticated_returns403() throws Exception {
        mockMvc.perform(post("/api/follows/2")
                        .with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getFollowers_authenticated_returns200() throws Exception {
        when(followService.getFollowers(eq(2L), eq(0), eq(20))).thenReturn(pagedUsers());

        mockMvc.perform(get("/api/follows/2/followers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getFollowing_authenticated_returns200() throws Exception {
        when(followService.getFollowing(eq(2L), eq(0), eq(20))).thenReturn(pagedUsers());

        mockMvc.perform(get("/api/follows/2/following"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    void getFollowers_unauthenticated_returns403() throws Exception {
        mockMvc.perform(get("/api/follows/2/followers"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getCounts_authenticated_returns200() throws Exception {
        when(followService.getCounts(eq(2L))).thenReturn(new FollowCountsResponse(3L, 5L));

        mockMvc.perform(get("/api/follows/2/counts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.followers").value(3))
                .andExpect(jsonPath("$.following").value(5));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getStatus_authenticated_returnsFollowingFlag() throws Exception {
        when(followService.isFollowing(eq("test@example.com"), eq(2L))).thenReturn(true);

        mockMvc.perform(get("/api/follows/2/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.following").value(true));
    }
}
