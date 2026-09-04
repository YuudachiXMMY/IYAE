package com.clossette.controller;

import com.clossette.dto.PagedResponse;
import com.clossette.dto.ReviewRequest;
import com.clossette.dto.ReviewResponse;
import com.clossette.dto.ReviewSummaryResponse;
import com.clossette.service.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products/{productId}/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @PostMapping
    public ResponseEntity<ReviewResponse> createReview(
            @PathVariable Long productId,
            @Valid @RequestBody ReviewRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(reviewService.createReview(authentication.getName(), productId, request));
    }

    @GetMapping
    public ResponseEntity<PagedResponse<ReviewResponse>> getReviews(
            @PathVariable Long productId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(reviewService.getReviews(productId, page, size));
    }

    @GetMapping("/summary")
    public ResponseEntity<ReviewSummaryResponse> getReviewSummary(@PathVariable Long productId) {
        return ResponseEntity.ok(reviewService.getReviewSummary(productId));
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteReview(
            @PathVariable Long productId,
            Authentication authentication
    ) {
        reviewService.deleteReview(authentication.getName(), productId);
        return ResponseEntity.noContent().build();
    }
}
