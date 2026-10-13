package com.iyae.dto;

import com.iyae.entity.Post;
import com.iyae.entity.enums.PostStatus;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.Collections;
import java.util.List;

public record PostResponse(
    Long id,
    Long userId,
    String username,
    String content,
    List<String> mediaUrls,
    PostStatus status,
    long likeCount,
    long commentCount,
    boolean likedByCurrentUser,
    Instant createdAt,
    // Phase 6 — feed dimensions + Share-a-Look linkage
    String city,
    String topic,
    Long savedLookId,
    List<String> productIds
) {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** Back-compat constructor for tests/callers that predate the Phase-6 fields. */
    public PostResponse(Long id, Long userId, String username, String content,
                        List<String> mediaUrls, PostStatus status,
                        long likeCount, long commentCount, boolean likedByCurrentUser,
                        Instant createdAt) {
        this(id, userId, username, content, mediaUrls, status, likeCount, commentCount,
             likedByCurrentUser, createdAt, null, null, null, null);
    }

    public static PostResponse from(Post post, long likeCount, long commentCount, boolean likedByCurrentUser) {
        List<String> urls = parseMediaUrls(post.getMediaUrls());
        // Never the email address — see User.publicDisplayName().
        String username = post.getUser().publicDisplayName();
        return new PostResponse(
            post.getId(),
            post.getUser().getId(),
            username,
            post.getContent(),
            urls,
            post.getStatus(),
            likeCount,
            commentCount,
            likedByCurrentUser,
            post.getCreatedAt(),
            post.getCity(),
            post.getTopic(),
            post.getSavedLook() != null ? post.getSavedLook().getId() : null,
            parseMediaUrls(post.getProductIds())
        );
    }

    private static List<String> parseMediaUrls(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return MAPPER.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
