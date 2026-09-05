package com.iyae.service;

import com.iyae.dto.AdminPostResponse;
import com.iyae.dto.ProductResponse;
import com.iyae.dto.PromotionResponse;
import com.iyae.entity.Post;
import com.iyae.entity.Product;
import com.iyae.entity.Promotion;
import com.iyae.entity.enums.PostStatus;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.entity.enums.SlotType;
import com.iyae.repository.PostRepository;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.PromotionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Privileged catalog / community / promotion moderation for the single-owner operator.
 *
 * <p>Callers are already gated to {@code ROLE_ADMIN} by {@code SecurityConfig} on
 * {@code /api/admin/**}; these methods therefore deliberately SKIP ownership checks (the
 * privileged override) but still throw {@link IllegalArgumentException} for genuine not-found
 * (mapped to 400 by {@code GlobalExceptionHandler}). No role is re-checked here.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminModerationService {

    private final ProductRepository productRepository;
    private final PostRepository postRepository;
    private final PromotionRepository promotionRepository;

    // -------------------------------------------------------------------------
    // Catalog moderation
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ProductResponse> listAllProducts(ProductStatus status) {
        List<Product> products = (status == null)
                ? productRepository.findAll()
                : productRepository.findByStatus(status);
        return products.stream().map(ProductResponse::from).toList();
    }

    @Transactional
    public ProductResponse setProductStatus(Long productId, ProductStatus status) {
        if (status == null) {
            throw new IllegalArgumentException("Status is required");
        }
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
        product.setStatus(status);
        log.info("Admin forced product {} to status {}", productId, status);
        return ProductResponse.from(productRepository.save(product));
    }

    // -------------------------------------------------------------------------
    // Community moderation
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<AdminPostResponse> listPostsForModeration(PostStatus status) {
        List<Post> posts = (status == null)
                ? postRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                : postRepository.findByStatusOrderByCreatedAtDesc(status);
        return posts.stream().map(AdminPostResponse::from).toList();
    }

    @Transactional
    public AdminPostResponse archivePost(Long postId) {
        Post post = requirePost(postId);
        post.setStatus(PostStatus.ARCHIVED);
        log.info("Admin archived post {}", postId);
        return AdminPostResponse.from(postRepository.save(post));
    }

    @Transactional
    public AdminPostResponse removePost(Long postId) {
        Post post = requirePost(postId);
        post.setStatus(PostStatus.PENDING_DELETE);
        post.setDeletedAt(Instant.now());
        log.info("Admin removed post {}", postId);
        return AdminPostResponse.from(postRepository.save(post));
    }

    // -------------------------------------------------------------------------
    // Promotion moderation
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<PromotionResponse> listPromotions() {
        return promotionRepository.findAll().stream().map(PromotionResponse::from).toList();
    }

    @Transactional
    public PromotionResponse setPromotionSlot(Long promotionId, SlotType slotType) {
        if (slotType == null) {
            throw new IllegalArgumentException("Slot type is required");
        }
        Promotion promotion = promotionRepository.findById(promotionId)
                .orElseThrow(() -> new IllegalArgumentException("Promotion not found: " + promotionId));
        promotion.setSlotType(slotType);
        log.info("Admin set promotion {} slot to {}", promotionId, slotType);
        return PromotionResponse.from(promotionRepository.save(promotion));
    }

    private Post requirePost(Long postId) {
        return postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found: " + postId));
    }
}
