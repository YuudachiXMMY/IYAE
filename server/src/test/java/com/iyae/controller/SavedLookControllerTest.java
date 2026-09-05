package com.iyae.controller;

import com.iyae.dto.SavedLookRequest;
import com.iyae.dto.SavedLookResponse;
import com.iyae.service.SavedLookService;
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

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SavedLookController.class)
@Import(WebMvcSecurityConfig.class)
class SavedLookControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    SavedLookService savedLookService;

    private SavedLookResponse sampleLook() {
        return new SavedLookResponse(1L, 10L, "My fav look", List.of("Blue Shirt", "Black Jeans"), Instant.now());
    }

    @Test
    @WithMockUser(username = "user@example.com")
    void saveLook_authenticated_returns201() throws Exception {
        when(savedLookService.saveLook(anyString(), any())).thenReturn(sampleLook());

        SavedLookRequest request = new SavedLookRequest(10L, "My fav look");
        String body = objectMapper.writeValueAsString(request);

        mockMvc.perform(post("/api/looks")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1L));
    }

    @Test
    void saveLook_unauthenticated_returns403() throws Exception {
        SavedLookRequest request = new SavedLookRequest(10L, "My fav look");
        String body = objectMapper.writeValueAsString(request);

        mockMvc.perform(post("/api/looks")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "user@example.com")
    void getLooks_authenticated_returns200() throws Exception {
        when(savedLookService.getSavedLooks(anyString())).thenReturn(List.of(sampleLook()));

        mockMvc.perform(get("/api/looks"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1L));
    }

    @Test
    @WithMockUser(username = "user@example.com")
    void updateLook_authenticated_returns200() throws Exception {
        when(savedLookService.updateNote(anyString(), anyLong(), any())).thenReturn(sampleLook());

        SavedLookRequest request = new SavedLookRequest(10L, "Updated note");
        String body = objectMapper.writeValueAsString(request);

        mockMvc.perform(put("/api/looks/1")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1L));
    }

    @Test
    @WithMockUser(username = "user@example.com")
    void deleteLook_authenticated_returns204() throws Exception {
        doNothing().when(savedLookService).deleteLook(anyString(), anyLong());

        mockMvc.perform(delete("/api/looks/1")
                        .with(csrf()))
                .andExpect(status().isNoContent());
    }
}
