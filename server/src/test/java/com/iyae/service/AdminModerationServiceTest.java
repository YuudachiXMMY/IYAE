package com.iyae.service;

import com.iyae.dto.AdminPostResponse;
import com.iyae.dto.ProductResponse;
import com.iyae.dto.PromotionResponse;
import com.iyae.entity.DesignerProfile;
import com.iyae.entity.Post;
import com.iyae.entity.Product;
import com.iyae.entity.Promotion;
import com.iyae.entity.User;
import com.iyae.entity.enums.PostStatus;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.entity.enums.Role;
import com.iyae.entity.enums.SlotType;
import com.iyae.repository.PostRepository;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.PromotionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminModerationServiceTest {

    @Mock
    ProductRepository productRepository;

    @Mock
    PostRepository postRepository;

    @Mock
    PromotionRepository promotionRepository;

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
}
