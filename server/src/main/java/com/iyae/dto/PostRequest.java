package com.iyae.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record PostRequest(
    @NotBlank String content,
    List<String> mediaUrls,
    // Phase 6 — Share-a-Look + feed dimensions (all optional; plain photo posts omit them)
    Long savedLookId,
    List<String> productIds,
    String topic,
    String city
) {
    /** Back-compat constructor for callers that only supply content + media. */
    public PostRequest(String content, List<String> mediaUrls) {
        this(content, mediaUrls, null, null, null, null);
    }
}
