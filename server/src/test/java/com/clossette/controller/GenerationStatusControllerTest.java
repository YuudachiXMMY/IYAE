package com.clossette.controller;

import com.clossette.dto.GenerationStatusResponse;
import com.clossette.service.GenerationService;
import com.clossette.testsupport.WebMvcSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(GenerationStatusController.class)
@Import(WebMvcSecurityConfig.class)
class GenerationStatusControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    GenerationService generationService;

    private GenerationStatusResponse readyStatus() {
        return new GenerationStatusResponse("READY", "/assets/model.glb", null, null, 0);
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void getStatus_designer_returns200() throws Exception {
        when(generationService.getStatus(anyLong(), anyString())).thenReturn(readyStatus());

        mockMvc.perform(get("/api/designer/products/1/generation-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"));
    }

    @Test
    @WithMockUser(username = "buyer@example.com", roles = "BUYER")
    void getStatus_nonDesigner_returns403() throws Exception {
        mockMvc.perform(get("/api/designer/products/1/generation-status"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void regenerate_designer_returns200() throws Exception {
        when(generationService.regenerate(anyLong(), anyString())).thenReturn(readyStatus());

        mockMvc.perform(post("/api/designer/products/1/regenerate")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"));
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void retry_designer_returns200() throws Exception {
        when(generationService.retry(anyLong(), anyString())).thenReturn(readyStatus());

        mockMvc.perform(post("/api/designer/products/1/generation-status/retry")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"));
    }

    @Test
    void getStatus_unauthenticated_returns403() throws Exception {
        mockMvc.perform(get("/api/designer/products/1/generation-status"))
                .andExpect(status().isForbidden());
    }
}
