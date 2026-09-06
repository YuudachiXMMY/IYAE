package com.iyae.service;

import com.iyae.dto.AdminPostResponse;
import com.iyae.dto.PagedResponse;
import com.iyae.dto.PostReportResponse;
import com.iyae.dto.ProductResponse;
import com.iyae.dto.PromotionResponse;
import com.iyae.entity.Post;
import com.iyae.entity.PostComment;
import com.iyae.entity.PostReport;
import com.iyae.entity.Product;
import com.iyae.entity.Promotion;
import com.iyae.entity.enums.CommentStatus;
import com.iyae.entity.enums.PostStatus;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.entity.enums.ReportStatus;
import com.iyae.entity.enums.SlotType;
import com.iyae.repository.PostCommentRepository;
import com.iyae.repository.PostReportRepository;
import com.iyae.repository.PostRepository;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.PromotionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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
    private final PostReportRepository postReportRepository;
    private final PostCommentRepository postCommentRepository;

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
        // PR#10 M2: an admin ARCHIVE durably locks the listing so the owning designer cannot
        // silently republish it via the ordinary update path; an admin un-hide (PUBLISHED/DRAFT)
        // is the explicit release that hands status control back to the designer.
        product.setModerationLocked(status == ProductStatus.ARCHIVED);
        log.info("Admin forced product {} to status {} (moderationLocked={})",
                productId, status, product.isModerationLocked());
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

    // ---- User report queue ----

    @Transactional(readOnly = true)
    public PagedResponse<PostReportResponse> listReports(ReportStatus status, int page, int size) {
        ReportStatus filter = (status == null) ? ReportStatus.OPEN : status;
        Pageable pageable = PageRequest.of(page, size);
        return PagedResponse.from(
                postReportRepository.findByStatusOrderByCreatedAtDesc(filter, pageable)
                        .map(PostReportResponse::from));
    }

    /**
     * Resolve a report. {@code status} moves the report to RESOLVED (default) or DISMISSED;
     * when {@code removePost} is true the reported post is taken down (PENDING_DELETE) so it
     * drops out of every feed.
     */
    @Transactional
    public PostReportResponse resolveReport(Long reportId, ReportStatus status, boolean removePost) {
        PostReport report = postReportRepository.findById(reportId)
                .orElseThrow(() -> new IllegalArgumentException("Report not found: " + reportId));
        ReportStatus target = (status == null || status == ReportStatus.OPEN)
                ? ReportStatus.RESOLVED : status;
        report.setStatus(target);
        if (removePost) {
            Post post = report.getPost();
            post.setStatus(PostStatus.PENDING_DELETE);
            post.setDeletedAt(Instant.now());
            postRepository.save(post);
        }
        log.info("Admin resolved report {} -> {} (removePost={})", reportId, target, removePost);
        return PostReportResponse.from(postReportRepository.save(report));
    }

    /** Hide a comment (soft) so it drops out of {@code getComments}. */
    @Transactional
    public void removeComment(Long commentId) {
        PostComment comment = postCommentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("Comment not found: " + commentId));
        comment.setStatus(CommentStatus.REMOVED);
        comment.setDeletedAt(Instant.now());
        postCommentRepository.save(comment);
        log.info("Admin removed comment {}", commentId);
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
