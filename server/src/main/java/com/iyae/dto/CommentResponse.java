package com.iyae.dto;

import com.iyae.entity.PostComment;

import java.time.Instant;

public record CommentResponse(
    Long id,
    Long postId,
    Long userId,
    String username,
    Long parentCommentId,
    String content,
    Instant createdAt
) {
    public static CommentResponse from(PostComment comment) {
        String username = comment.getUser().getUsername() != null
            ? comment.getUser().getUsername()
            : comment.getUser().getEmail();
        return new CommentResponse(
            comment.getId(),
            comment.getPost().getId(),
            comment.getUser().getId(),
            username,
            comment.getParentComment() != null ? comment.getParentComment().getId() : null,
            comment.getContent(),
            comment.getCreatedAt()
        );
    }
}
