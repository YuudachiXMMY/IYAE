package com.clossette.ai;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

public class ClaudeProvider implements AIProvider {

    private static final String API_URL = "https://api.anthropic.com/v1/messages";
    private static final String MODEL = "claude-sonnet-4-20250514";
    private static final int MAX_TOKENS = 1024;

    private final RestTemplate restTemplate;
    private final String apiKey;

    public ClaudeProvider(RestTemplate restTemplate, String apiKey) {
        this.restTemplate = restTemplate;
        this.apiKey = apiKey;
    }

    @Override
    public String sendMessage(String systemPrompt, List<Map<String, String>> messages) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-api-key", apiKey);
        headers.set("anthropic-version", "2023-06-01");

        Map<String, Object> body = Map.of(
            "model", MODEL,
            "max_tokens", MAX_TOKENS,
            "system", systemPrompt,
            "messages", messages
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(API_URL, request, Map.class);
            if (response == null) {
                throw new AIProviderException("Claude API returned null response");
            }
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> content = (List<Map<String, Object>>) response.get("content");
            if (content == null || content.isEmpty()) {
                throw new AIProviderException("Claude API returned empty content");
            }
            Object text = content.get(0).get("text");
            if (text == null) {
                throw new AIProviderException("Claude API response missing text field");
            }
            return text.toString();
        } catch (RestClientException e) {
            throw new AIProviderException("Claude API call failed: " + e.getMessage(), e);
        }
    }
}
