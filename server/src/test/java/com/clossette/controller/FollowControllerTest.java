package com.clossette.controller;

import com.clossette.dto.PagedResponse;
import com.clossette.dto.UserResponse;
import com.clossette.entity.enums.Role;
import com.clossette.service.FollowService;
import com.clossette.testsupport.WebMvcSecurityConfig;
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

    private UserResponse sampleUser() {
        return new UserResponse(2L, "other@example.com", "Other User", Role.BUYER,
                true, "otheruser", null, null, null, null, null, null,
                null, null, null, null, null, null, null, null, null, null);
    }

    private PagedResponse<UserResponse> pagedUsers() {
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
}
