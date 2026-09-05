package com.iyae.ai;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
@RequiredArgsConstructor
public class AIProviderFactory {

    @Value("${app.ai.provider:mock}")
    private String providerName;

    @Value("${app.ai.claude.api-key:}")
    private String claudeApiKey;

    @Value("${app.ai.deepseek.api-key:}")
    private String deepSeekApiKey;

    @Value("${app.ai.minimax.api-key:}")
    private String miniMaxApiKey;

    private final RestTemplate restTemplate;
    private final MockAIProvider mockAIProvider;

    public AIProvider getProvider() {
        return switch (providerName.toLowerCase()) {
            case "mock" -> mockAIProvider;
            case "claude" -> new ClaudeProvider(restTemplate, claudeApiKey);
            case "deepseek" -> new DeepSeekProvider(restTemplate, deepSeekApiKey);
            case "minimax" -> new MiniMaxProvider(restTemplate, miniMaxApiKey);
            default -> throw new AIProviderException(
                "Unknown AI provider: '" + providerName + "'. Supported values: mock, claude, deepseek, minimax"
            );
        };
    }

    public String getProviderName() {
        return providerName;
    }

    public String healthCheck() {
        return getProvider().healthCheck();
    }
}
