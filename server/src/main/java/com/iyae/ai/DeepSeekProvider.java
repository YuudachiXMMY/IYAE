package com.iyae.ai;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class DeepSeekProvider implements AIProvider {

    private static final String API_URL = "https://api.deepseek.com/chat/completions";
    private static final String MODEL = "deepseek-chat";

    private final RestTemplate restTemplate;
    private final String apiKey;

    public DeepSeekProvider(RestTemplate restTemplate, String apiKey) {
        this.restTemplate = restTemplate;
        this.apiKey = apiKey;
    }

    @Override
    public String sendMessage(String systemPrompt, List<Map<String, String>> messages) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + apiKey);

        List<Map<String, String>> allMessages = new ArrayList<>();
        allMessages.add(Map.of("role", "system", "content", systemPrompt));
        allMessages.addAll(messages);

        Map<String, Object> body = Map.of(
            "model", MODEL,
            "messages", allMessages
        );

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(API_URL, request, Map.class);
            if (response == null) {
                throw new AIProviderException("DeepSeek API returned null response");
            }
            return extractChoiceContent(response, "DeepSeek");
        } catch (RestClientException e) {
            throw new AIProviderException("DeepSeek API call failed: " + e.getMessage(), e);
        }
    }

    @SuppressWarnings("unchecked")
    private String extractChoiceContent(Map<String, Object> response, String providerName) {
        List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
        if (choices == null || choices.isEmpty()) {
            throw new AIProviderException(providerName + " API returned empty choices");
        }
        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
        if (message == null) {
            throw new AIProviderException(providerName + " API response missing message field");
        }
        Object content = message.get("content");
        if (content == null) {
            throw new AIProviderException(providerName + " API response missing content field");
        }
        return content.toString();
    }
}
