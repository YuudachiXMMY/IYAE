package com.iyae.service;

import com.iyae.ai.AIProviderFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class HealthService {

    private final AIProviderFactory aiProviderFactory;

    public Map<String, String> getServerHealth() {
        return Map.of(
            "status", "UP",
            "service", "iyae-server"
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
