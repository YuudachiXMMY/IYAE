package com.iyae.service;

import com.iyae.ai.AIProviderFactory;
import com.iyae.config.BrandProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class HealthService {

    private final AIProviderFactory aiProviderFactory;
    private final BrandProperties brandProperties;

    public Map<String, String> getServerHealth() {
        return Map.of(
            "status", "UP",
            "service", brandProperties.serviceId()
        );
    }

    public Map<String, String> getAiHealth() {
        String providerName = aiProviderFactory.getProviderName();
        String status = aiProviderFactory.healthCheck();
        return Map.of(
            "provider", providerName,
            "status", status
        );
    }
}
