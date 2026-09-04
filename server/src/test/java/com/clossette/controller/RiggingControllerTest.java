package com.clossette.controller;

import com.clossette.dto.RiggingStatusResponse;
import com.clossette.service.RiggingService;
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

@WebMvcTest(RiggingController.class)
@Import(WebMvcSecurityConfig.class)
class RiggingControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    RiggingService riggingService;

    private RiggingStatusResponse pendingStatus() {
        return new RiggingStatusResponse("PENDING", null, null, null, 0);
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void requestRigging_designer_returns200() throws Exception {
        when(riggingService.requestRigging(anyLong(), anyString())).thenReturn(pendingStatus());

        mockMvc.perform(post("/api/designer/products/1/rigging")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    @WithMockUser(username = "buyer@example.com", roles = "BUYER")
    void requestRigging_nonDesigner_returns403() throws Exception {
        mockMvc.perform(post("/api/designer/products/1/rigging")
                        .with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void getStatus_designer_returns200() throws Exception {
        when(riggingService.getStatus(anyLong(), anyString())).thenReturn(pendingStatus());

        mockMvc.perform(get("/api/designer/products/1/rigging-status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void retry_designer_returns200() throws Exception {
        when(riggingService.retry(anyLong(), anyString())).thenReturn(pendingStatus());

        mockMvc.perform(post("/api/designer/products/1/rigging-status/retry")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void requestRigging_unauthenticated_returns403() throws Exception {
        mockMvc.perform(post("/api/designer/products/1/rigging")
                        .with(csrf()))
                .andExpect(status().isForbidden());
    }
}
