package com.iyae.service;

import com.iyae.ai.AIProviderFactory;
import com.iyae.config.BrandProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HealthServiceTest {

    @Mock
    AIProviderFactory aiProviderFactory;

    @Mock
    BrandProperties brandProperties;

    @InjectMocks
    HealthService healthService;

    @Test
    void getServerHealth_returnsUpStatus() {
        when(brandProperties.serviceId()).thenReturn("iyae-server");

        Map<String, String> result = healthService.getServerHealth();

        assertThat(result.get("status")).isEqualTo("UP");
        assertThat(result.get("service")).isEqualTo("iyae-server");
    }

    @Test
    void getAiHealth_returnsProviderNameAndStatus() {
        when(aiProviderFactory.getProviderName()).thenReturn("mock");
        when(aiProviderFactory.healthCheck()).thenReturn("UP");

        Map<String, String> result = healthService.getAiHealth();

        assertThat(result.get("provider")).isEqualTo("mock");
        assertThat(result.get("status")).isEqualTo("UP");
    }
}
