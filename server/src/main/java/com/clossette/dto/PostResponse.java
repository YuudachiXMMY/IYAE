package com.clossette.dto;

import com.clossette.entity.Post;
import com.clossette.entity.enums.PostStatus;
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
    Instant createdAt
) {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static PostResponse from(Post post, long likeCount, long commentCount, boolean likedByCurrentUser) {
        List<String> urls = parseMediaUrls(post.getMediaUrls());
        String username = post.getUser().getUsername() != null
            ? post.getUser().getUsername()
            : post.getUser().getEmail();
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
            post.getCreatedAt()
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
