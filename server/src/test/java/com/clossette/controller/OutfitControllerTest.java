package com.clossette.controller;

import com.clossette.dto.GenerateOutfitRequest;
import com.clossette.dto.OutfitResponse;
import com.clossette.service.OutfitService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(OutfitController.class)
@Import(WebMvcSecurityConfig.class)
class OutfitControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    OutfitService outfitService;

    private OutfitResponse sampleOutfit() {
        return new OutfitResponse(1L, List.of(), "A great casual look", Instant.now());
    }

    @Test
    @WithMockUser(username = "user@example.com")
    void generateOutfit_authenticated_returns201() throws Exception {
        when(outfitService.generateOutfit(any(), anyString())).thenReturn(sampleOutfit());

        GenerateOutfitRequest request = new GenerateOutfitRequest("casual", "minimalist", List.of("black"), List.of());
        String body = objectMapper.writeValueAsString(request);

        mockMvc.perform(post("/api/outfits/generate")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1L));
    }

    @Test
    void generateOutfit_unauthenticated_returns403() throws Exception {
        GenerateOutfitRequest request = new GenerateOutfitRequest("casual", "minimalist", List.of("black"), List.of());
        String body = objectMapper.writeValueAsString(request);

        mockMvc.perform(post("/api/outfits/generate")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "user@example.com")
    void getOutfits_authenticated_returns200() throws Exception {
        when(outfitService.listOutfits(anyString())).thenReturn(List.of(sampleOutfit()));

        mockMvc.perform(get("/api/outfits"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1L));
    }

    @Test
    void getOutfits_unauthenticated_returns403() throws Exception {
        mockMvc.perform(get("/api/outfits"))
                .andExpect(status().isForbidden());
    }
}
