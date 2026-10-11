package com.iyae.controller;

import com.iyae.config.AnalyticsProperties;
import com.iyae.dto.DrapeDecisionResponse;
import com.iyae.dto.KpiSummaryResponse;
import com.iyae.dto.TrackEventRequest;
import com.iyae.entity.User;
import com.iyae.entity.enums.EventType;
import com.iyae.entity.enums.Role;
import com.iyae.repository.UserRepository;
import com.iyae.service.AnalyticsService;
import com.iyae.testsupport.WebMvcSecurityConfig;
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
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AnalyticsController.class)
@Import(WebMvcSecurityConfig.class)
class AnalyticsControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    AnalyticsService analyticsService;

    @MockBean
    UserRepository userRepository;

    @MockBean
    AnalyticsProperties analyticsProperties;

    private static DrapeDecisionResponse sampleDecision() {
        return new DrapeDecisionResponse(Instant.parse("2026-09-10T00:00:00Z"),
                new DrapeDecisionResponse.FunnelWindow(1000, 100, 0.10),
                new DrapeDecisionResponse.FunnelWindow(1000, 200, 0.20),
                0.10, 1.0, 3.5, 0.0004, true, "INVEST");
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void track_validEvent_returns202() throws Exception {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(
                User.builder().id(1L).email("test@example.com").role(Role.BUYER).build()));

        String body = objectMapper.writeValueAsString(
                new TrackEventRequest("view", 5L, null, null));

        mockMvc.perform(post("/api/events")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isAccepted());

        verify(analyticsService).record(eq(1L), any(), eq(5L), isNull(), isNull(), isNull());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void track_tryonStarted_returns202() throws Exception {
        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(
                User.builder().id(1L).email("test@example.com").role(Role.BUYER).build()));

        String body = objectMapper.writeValueAsString(
                new TrackEventRequest("TRYON_STARTED", 5L, null, "{\"surface\":\"pdp\"}"));

        mockMvc.perform(post("/api/events")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isAccepted());

        verify(analyticsService).record(eq(1L), eq(EventType.TRYON_STARTED), eq(5L),
                isNull(), isNull(), eq("{\"surface\":\"pdp\"}"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void track_unknownType_returns400() throws Exception {
        String body = objectMapper.writeValueAsString(
                new TrackEventRequest("NOT_A_REAL_EVENT", null, null, null));

        mockMvc.perform(post("/api/events")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void track_unauthenticated_returns401() throws Exception {
        String body = objectMapper.writeValueAsString(new TrackEventRequest("view", null, null, null));

        mockMvc.perform(post("/api/events")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = "ADMIN")
    void kpis_asAdmin_returns200() throws Exception {
        when(analyticsService.kpisByCohort())
                .thenReturn(new KpiSummaryResponse(List.of(), List.of()));

        mockMvc.perform(get("/api/admin/kpis"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void kpis_asDesigner_returns403() throws Exception {
        mockMvc.perform(get("/api/admin/kpis"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "buyer@example.com", roles = "BUYER")
    void kpis_asBuyer_returns403() throws Exception {
        mockMvc.perform(get("/api/admin/kpis"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = "ADMIN")
    void drapeDecision_asAdmin_usesConfiguredCutoff_returns200() throws Exception {
        when(analyticsProperties.drapeDeployCutoff()).thenReturn("2026-09-10T00:00:00Z");
        when(analyticsService.drapeDecision(any(Instant.class))).thenReturn(sampleDecision());

        mockMvc.perform(get("/api/admin/kpis/drape-decision"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendation").value("INVEST"))
                .andExpect(jsonPath("$.significant").value(true));

        verify(analyticsService).drapeDecision(Instant.parse("2026-09-10T00:00:00Z"));
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = "ADMIN")
    void drapeDecision_withQueryCutoff_overridesConfig_returns200() throws Exception {
        when(analyticsService.drapeDecision(any(Instant.class))).thenReturn(sampleDecision());

        mockMvc.perform(get("/api/admin/kpis/drape-decision").param("cutoff", "2026-09-01T00:00:00Z"))
                .andExpect(status().isOk());

        verify(analyticsService).drapeDecision(Instant.parse("2026-09-01T00:00:00Z"));
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = "ADMIN")
    void drapeDecision_missingCutoff_returns400() throws Exception {
        when(analyticsProperties.drapeDeployCutoff()).thenReturn("");

        mockMvc.perform(get("/api/admin/kpis/drape-decision"))
                .andExpect(status().isBadRequest());
        verify(analyticsService, never()).drapeDecision(any());
    }

    @Test
    @WithMockUser(username = "admin@example.com", roles = "ADMIN")
    void drapeDecision_invalidCutoff_returns400() throws Exception {
        mockMvc.perform(get("/api/admin/kpis/drape-decision").param("cutoff", "not-a-date"))
                .andExpect(status().isBadRequest());
        verify(analyticsService, never()).drapeDecision(any());
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void drapeDecision_asDesigner_returns403() throws Exception {
        mockMvc.perform(get("/api/admin/kpis/drape-decision"))
                .andExpect(status().isForbidden());
    }
}
