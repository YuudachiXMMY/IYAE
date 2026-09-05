package com.iyae.service;

import com.iyae.dto.PagedResponse;
import com.iyae.dto.ReviewRequest;
import com.iyae.dto.ReviewResponse;
import com.iyae.dto.ReviewSummaryResponse;
import com.iyae.entity.Product;
import com.iyae.entity.Review;
import com.iyae.entity.User;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.ReviewRepository;
import com.iyae.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private static final int MAX_PAGE_SIZE = 100;

    private final ReviewRepository reviewRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;

    // -------------------------------------------------------------------------
    // POST /api/products/{productId}/reviews
    // -------------------------------------------------------------------------

    @Transactional
    public ReviewResponse createReview(String email, Long productId, ReviewRequest request) {
        User user = requireUser(email);
        Product product = requireProduct(productId);

        Review review = Review.builder()
                .user(user)
                .product(product)
                .rating(request.rating())
                .comment(request.comment())
                .build();

        try {
            return ReviewResponse.from(reviewRepository.save(review));
        } catch (DataIntegrityViolationException ex) {
            throw new IllegalArgumentException("You have already reviewed this product");
        }
    }

    // -------------------------------------------------------------------------
    // GET /api/products/{productId}/reviews
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PagedResponse<ReviewResponse> getReviews(Long productId, int page, int size) {
        requireProduct(productId);
        int clampedSize = Math.min(size, MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(page, clampedSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<ReviewResponse> result = reviewRepository.findByProductId(productId, pageable)
                .map(ReviewResponse::from);
        return PagedResponse.from(result);
    }

    // -------------------------------------------------------------------------
    // GET /api/products/{productId}/reviews/summary
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public ReviewSummaryResponse getReviewSummary(Long productId) {
        requireProduct(productId);
        Double avg = reviewRepository.findAverageRatingByProductId(productId);
        Long count = reviewRepository.countByProductId(productId);
        return new ReviewSummaryResponse(
                avg != null ? avg : 0.0,
                count != null ? count : 0L
        );
    }

    // -------------------------------------------------------------------------
    // DELETE /api/products/{productId}/reviews — deletes the caller's own review
    // -------------------------------------------------------------------------

    @Transactional
    public void deleteReview(String email, Long productId) {
        User user = requireUser(email);
        requireProduct(productId);
        Review review = reviewRepository.findByUserIdAndProductId(user.getId(), productId)
                .orElseThrow(() -> new IllegalArgumentException("Review not found for this product"));
        reviewRepository.delete(review);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
    }

    private Product requireProduct(Long productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
    }
}
