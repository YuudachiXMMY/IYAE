package com.clossette.service;

import com.clossette.dto.PagedResponse;
import com.clossette.dto.ReviewRequest;
import com.clossette.dto.ReviewResponse;
import com.clossette.dto.ReviewSummaryResponse;
import com.clossette.entity.Product;
import com.clossette.entity.Review;
import com.clossette.entity.User;
import com.clossette.entity.enums.Role;
import com.clossette.repository.ProductRepository;
import com.clossette.repository.ReviewRepository;
import com.clossette.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewServiceTest {

    @Mock ReviewRepository reviewRepository;
    @Mock UserRepository userRepository;
    @Mock ProductRepository productRepository;

    @InjectMocks ReviewService reviewService;

    private User testUser;
    private Product testProduct;
    private Review testReview;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L).email("buyer@example.com").name("Buyer").role(Role.BUYER).build();

        testProduct = Product.builder()
                .id(100L).name("Cool Dress").price(new BigDecimal("120.00")).build();

        testReview = Review.builder()
                .id(10L).user(testUser).product(testProduct)
                .rating(4).comment("Love it!").createdAt(Instant.now()).build();
    }

    @Test
    void createReview_success_returnsReviewResponse() {
        ReviewRequest request = new ReviewRequest(4, "Love it!");

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(reviewRepository.save(any(Review.class))).thenReturn(testReview);

        ReviewResponse response = reviewService.createReview("buyer@example.com", 100L, request);

        assertThat(response.id()).isEqualTo(10L);
        assertThat(response.rating()).isEqualTo(4);
        assertThat(response.comment()).isEqualTo("Love it!");
        assertThat(response.userId()).isEqualTo(1L);
    }

    @Test
    void createReview_duplicateReview_throwsIllegalArgumentException() {
        ReviewRequest request = new ReviewRequest(5, "Second review attempt");

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(reviewRepository.save(any(Review.class)))
                .thenThrow(new DataIntegrityViolationException("unique constraint"));

        assertThatThrownBy(() -> reviewService.createReview("buyer@example.com", 100L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already reviewed");
    }

    @Test
    void createReview_unknownUser_throwsIllegalArgumentException() {
        ReviewRequest request = new ReviewRequest(3, "Nice");

        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reviewService.createReview("ghost@example.com", 100L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    void createReview_unknownProduct_throwsIllegalArgumentException() {
        ReviewRequest request = new ReviewRequest(3, "Nice");

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reviewService.createReview("buyer@example.com", 999L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Product not found");
    }

    @Test
    void getReviews_returnsPagedResponse() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(reviewRepository.findByProductId(eq(100L), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(testReview)));

        PagedResponse<ReviewResponse> result = reviewService.getReviews(100L, 0, 10);

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).rating()).isEqualTo(4);
    }

    @Test
    void getReviewSummary_returnsAverageAndCount() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(reviewRepository.findAverageRatingByProductId(100L)).thenReturn(4.2);
        when(reviewRepository.countByProductId(100L)).thenReturn(5L);

        ReviewSummaryResponse summary = reviewService.getReviewSummary(100L);

        assertThat(summary.averageRating()).isEqualTo(4.2);
        assertThat(summary.reviewCount()).isEqualTo(5L);
    }

    @Test
    void getReviewSummary_noReviews_returnsZeroDefaults() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(reviewRepository.findAverageRatingByProductId(100L)).thenReturn(null);
        when(reviewRepository.countByProductId(100L)).thenReturn(null);

        ReviewSummaryResponse summary = reviewService.getReviewSummary(100L);

        assertThat(summary.averageRating()).isEqualTo(0.0);
        assertThat(summary.reviewCount()).isEqualTo(0L);
    }

    @Test
    void deleteReview_success_deletesReview() {
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(reviewRepository.findByUserIdAndProductId(1L, 100L)).thenReturn(Optional.of(testReview));

        reviewService.deleteReview("buyer@example.com", 100L);

        verify(reviewRepository).delete(testReview);
    }

    @Test
    void deleteReview_reviewNotFound_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(reviewRepository.findByUserIdAndProductId(1L, 100L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reviewService.deleteReview("buyer@example.com", 100L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Review not found");
    }
}
