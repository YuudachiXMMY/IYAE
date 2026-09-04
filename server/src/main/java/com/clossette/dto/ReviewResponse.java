package com.clossette.dto;

import com.clossette.entity.Review;

import java.time.Instant;

public record ReviewResponse(
        Long id,
        Long userId,
        String userName,
        Integer rating,
        String comment,
        Instant createdAt
) {
    public static ReviewResponse from(Review review) {
        return new ReviewResponse(
                review.getId(),
                review.getUser().getId(),
                review.getUser().getName(),
                review.getRating(),
                review.getComment(),
                review.getCreatedAt()
        );
    }
}
