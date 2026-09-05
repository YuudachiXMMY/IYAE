package com.iyae.controller;

import com.iyae.ai.AIProviderFactory;
import com.iyae.config.BrandProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
public class HealthController {

    private final AIProviderFactory aiProviderFactory;
    private final BrandProperties brandProperties;

    @GetMapping
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", brandProperties.serviceId()
        ));
    }

    @GetMapping("/ai")
    public ResponseEntity<Map<String, String>> aiHealth() {
        String providerName = aiProviderFactory.getProviderName();
        String status = aiProviderFactory.healthCheck();
        return ResponseEntity.ok(Map.of(
            "provider", providerName,
            "status", status
        ));
    }
}
