package com.clossette.controller;

import com.clossette.dto.BodyProfileRequest;
import com.clossette.dto.BodyProfileResponse;
import com.clossette.service.BodyProfileService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(BodyProfileController.class)
@Import(WebMvcSecurityConfig.class)
class BodyProfileControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    BodyProfileService bodyProfileService;

    private BodyProfileResponse sampleProfile() {
        return new BodyProfileResponse(170.0, 65.0, 90.0, 72.0, 95.0, 40.0, 80.0,
                "7", "M", "30", "8", "M");
    }

    @Test
    @WithMockUser(username = "user@example.com")
    void getProfile_authenticated_returns200() throws Exception {
        when(bodyProfileService.getProfile("user@example.com")).thenReturn(sampleProfile());

        mockMvc.perform(get("/api/body-profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.heightCm").value(170.0));
    }

    @Test
    void getProfile_unauthenticated_returns403() throws Exception {
        mockMvc.perform(get("/api/body-profile"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "user@example.com")
    void upsertProfile_authenticated_returns200() throws Exception {
        when(bodyProfileService.upsertProfile(anyString(), any())).thenReturn(sampleProfile());

        BodyProfileRequest request = new BodyProfileRequest(
                170.0, 65.0, 90.0, 72.0, 95.0, 40.0, 80.0, "7", "M", "30", "8", "M");
        String body = objectMapper.writeValueAsString(request);

        mockMvc.perform(post("/api/body-profile")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.heightCm").value(170.0));
    }

    @Test
    void upsertProfile_unauthenticated_returns403() throws Exception {
        BodyProfileRequest request = new BodyProfileRequest(
                170.0, 65.0, 90.0, 72.0, 95.0, 40.0, 80.0, "7", "M", "30", "8", "M");
        String body = objectMapper.writeValueAsString(request);

        mockMvc.perform(post("/api/body-profile")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }
}
