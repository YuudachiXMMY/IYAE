package com.iyae.dto;

import com.iyae.entity.Post;
import com.iyae.entity.enums.PostStatus;

import java.time.Instant;

/** Lightweight community-post view for the admin moderation queue. */
public record AdminPostResponse(
        Long id,
        Long authorId,
        String authorName,
        String authorUsername,
        String content,
        PostStatus status,
        Instant createdAt
) {
    public static AdminPostResponse from(Post post) {
        return new AdminPostResponse(
                post.getId(),
                post.getUser().getId(),
                post.getUser().getName(),
                post.getUser().getUsername(),
                post.getContent(),
                post.getStatus(),
                post.getCreatedAt()
        );
    }
}
