package com.iyae.controller;

import com.iyae.dto.AvatarStatusResponse;
import com.iyae.service.AvatarService;
import com.iyae.testsupport.WebMvcSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AvatarController.class)
@Import(WebMvcSecurityConfig.class)
class AvatarControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    AvatarService avatarService;

    private AvatarStatusResponse pendingStatus() {
        return new AvatarStatusResponse("PENDING", null, null, 0);
    }

    @Test
    @WithMockUser(username = "user@example.com")
    void generateAvatar_authenticated_returns200() throws Exception {
        when(avatarService.generateAvatar(anyString())).thenReturn(pendingStatus());

        mockMvc.perform(post("/api/avatar/generate")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void generateAvatar_unauthenticated_returns401() throws Exception {
        mockMvc.perform(post("/api/avatar/generate")
                        .with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "user@example.com")
    void getStatus_authenticated_returns200() throws Exception {
        when(avatarService.getStatus(anyString())).thenReturn(pendingStatus());

        mockMvc.perform(get("/api/avatar/status"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void getStatus_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/avatar/status"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "user@example.com")
    void deleteAvatarData_authenticated_returns204() throws Exception {
        mockMvc.perform(delete("/api/avatar")
                        .with(csrf()))
                .andExpect(status().isNoContent());

        verify(avatarService).deleteAvatarData("user@example.com");
    }

    @Test
    void deleteAvatarData_unauthenticated_returns401() throws Exception {
        mockMvc.perform(delete("/api/avatar")
                        .with(csrf()))
                .andExpect(status().isUnauthorized());
    }
}
