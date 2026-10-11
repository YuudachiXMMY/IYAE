package com.iyae.controller;

import com.iyae.ai.AIProviderFactory;
import com.iyae.config.BrandProperties;
import com.iyae.config.RateLimitProperties;
import com.iyae.repository.UserRepository;
import com.iyae.security.JwtTokenProvider;
import com.iyae.security.UserDetailsServiceImpl;
import com.iyae.service.HealthService;
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

    // The controller now delegates to HealthService instead of duplicating its logic.
    @MockBean
    HealthService healthService;

    @MockBean
    AIProviderFactory aiProviderFactory;

    @MockBean
    BrandProperties brandProperties;

    // RateLimitFilter (a Filter bean) is picked up by @WebMvcTest and needs its
    // RateLimitProperties; the mock's enabled() defaults to false so the filter passes through.
    @MockBean
    RateLimitProperties rateLimitProperties;

    @MockBean
    JwtTokenProvider jwtTokenProvider;

    @MockBean
    UserDetailsServiceImpl userDetailsService;

    // JwtAuthenticationFilter (a Filter bean) is picked up by @WebMvcTest; it now depends on
    // UserRepository (for token-version + email-verified checks), so the slice must provide it.
    @MockBean
    UserRepository userRepository;

    @Test
    void getHealth_returnsUpStatus() throws Exception {
        when(healthService.getServerHealth())
                .thenReturn(java.util.Map.of("status", "UP", "service", "iyae-server"));

        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.service").value("iyae-server"));
    }

    @Test
    void getAiHealth_returnsMockProviderStatus() throws Exception {
        when(healthService.getAiHealth())
                .thenReturn(java.util.Map.of("provider", "mock", "status", "UP"));

        mockMvc.perform(get("/api/health/ai"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.provider").value("mock"))
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    void getAiHealth_whenProviderDown_returnsDownStatus() throws Exception {
        when(healthService.getAiHealth())
                .thenReturn(java.util.Map.of("provider", "claude", "status", "DOWN"));

        mockMvc.perform(get("/api/health/ai"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.provider").value("claude"))
                .andExpect(jsonPath("$.status").value("DOWN"));
    }

    // ---- #42: the readiness probe must be able to fail ----

    @Test
    void getReady_whenDatabaseReachable_returns200() throws Exception {
        when(healthService.isReady()).thenReturn(true);

        mockMvc.perform(get("/api/health/ready"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"))
                .andExpect(jsonPath("$.database").value("UP"));
    }

    @Test
    void getReady_whenDatabaseUnreachable_returns503() throws Exception {
        // The whole point of the finding: the old probe reported healthy with no database, so
        // the container stayed in rotation and `prod_deploy.sh` declared a broken deploy a success.
        when(healthService.isReady()).thenReturn(false);

        mockMvc.perform(get("/api/health/ready"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("NOT_READY"))
                .andExpect(jsonPath("$.database").value("DOWN"));
    }
}
