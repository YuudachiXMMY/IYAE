package com.clossette.dto;

import jakarta.validation.constraints.NotBlank;

public record CommentRequest(
    @NotBlank String content,
    Long parentCommentId
) {}
