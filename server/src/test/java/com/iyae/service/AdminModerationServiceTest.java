package com.iyae.service;

import com.iyae.dto.AdminPostResponse;
import com.iyae.dto.PagedResponse;
import com.iyae.dto.PostReportResponse;
import com.iyae.dto.ProductResponse;
import com.iyae.dto.PromotionResponse;
import com.iyae.entity.DesignerProfile;
import com.iyae.entity.Post;
import com.iyae.entity.PostComment;
import com.iyae.entity.PostReport;
import com.iyae.entity.Product;
import com.iyae.entity.Promotion;
import com.iyae.entity.User;
import com.iyae.entity.enums.CommentStatus;
import com.iyae.entity.enums.PostStatus;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.entity.enums.ReportStatus;
import com.iyae.entity.enums.Role;
import com.iyae.entity.enums.SlotType;
import com.iyae.repository.PostCommentRepository;
import com.iyae.repository.PostReportRepository;
import com.iyae.repository.PostRepository;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.PromotionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminModerationServiceTest {

    @Mock
    ProductRepository productRepository;

    @Mock
    PostRepository postRepository;

    @Mock
    PromotionRepository promotionRepository;

    @Mock
    PostReportRepository postReportRepository;

    @Mock
    PostCommentRepository postCommentRepository;

    @InjectMocks
    AdminModerationService service;

    private Product ownedByOther() {
        User other = User.builder().id(99L).email("other@example.com").role(Role.DESIGNER).build();
        DesignerProfile profile = DesignerProfile.builder().id(50L).user(other).displayName("VOSS").build();
        return Product.builder()
                .id(100L).designerProfile(profile).name("Someone Else's Top")
                .price(new BigDecimal("59.99")).currency("CAD").category("Tops")
                .status(ProductStatus.PUBLISHED).createdAt(Instant.now()).updatedAt(Instant.now())
                .build();
    }

    @Test
    void setProductStatus_archivesProductNotOwnedByActor_noAccessDenied() {
        Product product = ownedByOther();
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(productRepository.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));

        ProductResponse result = service.setProductStatus(100L, ProductStatus.ARCHIVED);

        assertThat(result.status()).isEqualTo(ProductStatus.ARCHIVED);
        assertThat(product.getStatus()).isEqualTo(ProductStatus.ARCHIVED);
    }

    @Test
    void setProductStatus_notFound_throwsIllegalArgumentException() {
        when(productRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.setProductStatus(404L, ProductStatus.ARCHIVED))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Product not found");
    }

    @Test
    void listAllProducts_nullStatus_returnsAll() {
        when(productRepository.findAll()).thenReturn(List.of(ownedByOther()));

        List<ProductResponse> result = service.listAllProducts(null);

        assertThat(result).hasSize(1);
    }

    @Test
    void listAllProducts_withStatus_filtersByStatus() {
        when(productRepository.findByStatus(ProductStatus.DRAFT)).thenReturn(List.of());

        List<ProductResponse> result = service.listAllProducts(ProductStatus.DRAFT);

        assertThat(result).isEmpty();
    }

    @Test
    void archivePost_setsArchived_skipsOwnerCheck() {
        User author = User.builder().id(5L).email("author@example.com").name("Author").build();
        Post post = Post.builder().id(7L).user(author).content("hi").status(PostStatus.ACTIVE)
                .createdAt(Instant.now()).build();
        when(postRepository.findById(7L)).thenReturn(Optional.of(post));
        when(postRepository.save(any(Post.class))).thenAnswer(inv -> inv.getArgument(0));

        AdminPostResponse result = service.archivePost(7L);

        assertThat(result.status()).isEqualTo(PostStatus.ARCHIVED);
        assertThat(post.getStatus()).isEqualTo(PostStatus.ARCHIVED);
    }

    @Test
    void removePost_setsPendingDelete_andDeletedAt() {
        User author = User.builder().id(5L).email("author@example.com").name("Author").build();
        Post post = Post.builder().id(8L).user(author).content("bad").status(PostStatus.ACTIVE)
                .createdAt(Instant.now()).build();
        when(postRepository.findById(8L)).thenReturn(Optional.of(post));
        when(postRepository.save(any(Post.class))).thenAnswer(inv -> inv.getArgument(0));

        AdminPostResponse result = service.removePost(8L);

        assertThat(result.status()).isEqualTo(PostStatus.PENDING_DELETE);
        assertThat(post.getDeletedAt()).isNotNull();
    }

    @Test
    void setPromotionSlot_forcesSlotType() {
        Promotion promo = Promotion.builder().id(3L).product(ownedByOther())
                .slotType(SlotType.SPONSORED).weight(1).build();
        when(promotionRepository.findById(3L)).thenReturn(Optional.of(promo));
        when(promotionRepository.save(any(Promotion.class))).thenAnswer(inv -> inv.getArgument(0));

        PromotionResponse result = service.setPromotionSlot(3L, SlotType.FEATURED);

        assertThat(result.slotType()).isEqualTo(SlotType.FEATURED);
    }

    @Test
    void listPromotions_returnsAll() {
        Promotion promo = Promotion.builder().id(3L).product(ownedByOther())
                .slotType(SlotType.FEATURED).weight(10).build();
        when(promotionRepository.findAll()).thenReturn(List.of(promo));

        List<PromotionResponse> result = service.listPromotions();

        assertThat(result).hasSize(1);
    }

    // -------------------------------------------------------------------------
    // Community + promotion moderation gaps (PR#10 L7)
    // -------------------------------------------------------------------------

    @Test
    void listPostsForModeration_nullStatus_returnsAllOrdered() {
        User author = User.builder().id(5L).email("author@example.com").name("Author").username("author").build();
        Post post = Post.builder().id(7L).user(author).content("hi").status(PostStatus.ACTIVE)
                .createdAt(Instant.now()).build();
        when(postRepository.findAll(any(Sort.class))).thenReturn(List.of(post));

        List<AdminPostResponse> result = service.listPostsForModeration(null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).authorUsername()).isEqualTo("author");
    }

    @Test
    void listPostsForModeration_withStatus_filters() {
        when(postRepository.findByStatusOrderByCreatedAtDesc(PostStatus.ARCHIVED)).thenReturn(List.of());

        List<AdminPostResponse> result = service.listPostsForModeration(PostStatus.ARCHIVED);

        assertThat(result).isEmpty();
    }

    @Test
    void setPromotionSlot_notFound_throwsIllegalArgumentException() {
        when(promotionRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.setPromotionSlot(404L, SlotType.FEATURED))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Promotion not found");
    }

    // -------------------------------------------------------------------------
    // Moderation lock set/clear (PR#10 M2)
    // -------------------------------------------------------------------------

    @Test
    void setProductStatus_archived_setsModerationLocked() {
        Product product = ownedByOther(); // PUBLISHED, unlocked
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(productRepository.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));

        service.setProductStatus(100L, ProductStatus.ARCHIVED);

        assertThat(product.getStatus()).isEqualTo(ProductStatus.ARCHIVED);
        assertThat(product.isModerationLocked()).isTrue();
    }

    @Test
    void setProductStatus_published_clearsModerationLocked() {
        Product product = ownedByOther();
        product.setStatus(ProductStatus.ARCHIVED);
        product.setModerationLocked(true);
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(productRepository.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));

        service.setProductStatus(100L, ProductStatus.PUBLISHED);

        assertThat(product.getStatus()).isEqualTo(ProductStatus.PUBLISHED);
        assertThat(product.isModerationLocked()).isFalse();
    }

    // -------------------------------------------------------------------------
    // Phase 6 — report queue + comment moderation
    // -------------------------------------------------------------------------

    private PostReport openReport(long id) {
        User author = User.builder().id(5L).email("a@ex.com").name("Author").build();
        Post post = Post.builder().id(7L).user(author).status(PostStatus.ACTIVE)
                .createdAt(Instant.now()).build();
        User reporter = User.builder().id(9L).email("r@ex.com").username("reporter").build();
        return PostReport.builder().id(id).post(post).reporter(reporter).reason("spam")
                .status(ReportStatus.OPEN).createdAt(Instant.now()).build();
    }

    @Test
    void listReports_nullStatus_defaultsToOpen() {
        when(postReportRepository.findByStatusOrderByCreatedAtDesc(eq(ReportStatus.OPEN), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(openReport(1L))));

        PagedResponse<PostReportResponse> result = service.listReports(null, 0, 20);

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).status()).isEqualTo(ReportStatus.OPEN);
    }

    @Test
    void resolveReport_resolvesAndTakesDownPost_whenRemoveRequested() {
        PostReport report = openReport(1L);
        when(postReportRepository.findById(1L)).thenReturn(Optional.of(report));
        when(postReportRepository.save(any(PostReport.class))).thenAnswer(inv -> inv.getArgument(0));

        PostReportResponse result = service.resolveReport(1L, ReportStatus.RESOLVED, true);

        assertThat(result.status()).isEqualTo(ReportStatus.RESOLVED);
        assertThat(report.getPost().getStatus()).isEqualTo(PostStatus.PENDING_DELETE);
        verify(postRepository).save(report.getPost());
    }

    @Test
    void resolveReport_dismiss_doesNotRemovePost() {
        PostReport report = openReport(2L);
        when(postReportRepository.findById(2L)).thenReturn(Optional.of(report));
        when(postReportRepository.save(any(PostReport.class))).thenAnswer(inv -> inv.getArgument(0));

        PostReportResponse result = service.resolveReport(2L, ReportStatus.DISMISSED, false);

        assertThat(result.status()).isEqualTo(ReportStatus.DISMISSED);
        assertThat(report.getPost().getStatus()).isEqualTo(PostStatus.ACTIVE);
        verify(postRepository, org.mockito.Mockito.never()).save(any());
    }

    @Test
    void removeComment_setsRemovedAndDeletedAt() {
        PostComment comment = PostComment.builder().id(3L).content("bad")
                .status(CommentStatus.ACTIVE).build();
        when(postCommentRepository.findById(3L)).thenReturn(Optional.of(comment));
        when(postCommentRepository.save(any(PostComment.class))).thenAnswer(inv -> inv.getArgument(0));

        service.removeComment(3L);

        assertThat(comment.getStatus()).isEqualTo(CommentStatus.REMOVED);
        assertThat(comment.getDeletedAt()).isNotNull();
    }

    @Test
    void removeComment_notFound_throwsIllegalArgumentException() {
        when(postCommentRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.removeComment(404L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Comment not found");
    }
}
