package com.clossette.controller;

import com.clossette.ai.AIProviderFactory;
import com.clossette.security.JwtTokenProvider;
import com.clossette.security.UserDetailsServiceImpl;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(value = HealthController.class, excludeAutoConfiguration = SecurityAutoConfiguration.class)
class HealthControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    AIProviderFactory aiProviderFactory;

    @MockBean
    JwtTokenProvider jwtTokenProvider;

    @MockBean
    UserDetailsServiceImpl userDetailsService;

    @Test
    void getHealth_returnsUpStatus() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("clossette-server"));
    }

    @Test
    void getAiHealth_returnsMockProviderStatus() throws Exception {
        when(aiProviderFactory.getProviderName()).thenReturn("mock");
        when(aiProviderFactory.healthCheck()).thenReturn("UP");

        mockMvc.perform(get("/api/health/ai"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.provider").value("mock"))
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void getAiHealth_whenProviderDown_returnsDownStatus() throws Exception {
        when(aiProviderFactory.getProviderName()).thenReturn("claude");
        when(aiProviderFactory.healthCheck()).thenReturn("DOWN");

        mockMvc.perform(get("/api/health/ai"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.provider").value("claude"))
                .andExpect(jsonPath("$.status").value("DOWN"));
    }
}
