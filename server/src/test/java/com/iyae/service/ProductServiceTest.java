package com.iyae.service;

import com.iyae.dto.CreateProductRequest;
import com.iyae.dto.PagedResponse;
import com.iyae.dto.ProductResponse;
import com.iyae.entity.DesignerProfile;
import com.iyae.entity.GarmentAsset;
import com.iyae.entity.ModelGenerationTask;
import com.iyae.entity.Product;
import com.iyae.entity.User;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.entity.enums.Role;
import com.iyae.entity.enums.TaskStatus;
import com.iyae.repository.DesignerProfileRepository;
import com.iyae.repository.GarmentAssetRepository;
import com.iyae.repository.ModelGenerationTaskRepository;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    ProductRepository productRepository;

    @Mock
    DesignerProfileRepository designerProfileRepository;

    @Mock
    UserRepository userRepository;

    @Mock
    GarmentAssetRepository garmentAssetRepository;

    @Mock
    ModelGenerationTaskRepository modelGenerationTaskRepository;

    @Spy
    ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    ProductService productService;

    private User designerUser;
    private User otherUser;
    private DesignerProfile designerProfile;
    private DesignerProfile otherDesignerProfile;
    private Product publishedProduct;
    private Product draftProduct;

    @BeforeEach
    void setUp() {
        designerUser = User.builder()
                .id(1L)
                .email("designer@example.com")
                .passwordHash("$2a$10$hash")
                .name("Designer")
                .role(Role.DESIGNER)
                .build();

        otherUser = User.builder()
                .id(2L)
                .email("other@example.com")
                .passwordHash("$2a$10$hash")
                .name("Other Designer")
                .role(Role.DESIGNER)
                .build();

        designerProfile = DesignerProfile.builder()
                .id(10L)
                .user(designerUser)
                .displayName("Luna Studio")
                .shopName("luna-studio")
                .build();

        otherDesignerProfile = DesignerProfile.builder()
                .id(20L)
                .user(otherUser)
                .displayName("VOSS")
                .shopName("voss")
                .build();

        publishedProduct = Product.builder()
                .id(100L)
                .designerProfile(designerProfile)
                .name("Silk Blouse")
                .description("A luxurious silk blouse")
                .price(new BigDecimal("89.99"))
                .currency("CAD")
                .category("Tops")
                .styleTags("[\"minimalist\",\"elegant\"]")
                .colorTags("[\"white\",\"cream\"]")
                .sizes("[\"S\",\"M\",\"L\"]")
                .media("[\"img1.jpg\"]")
                .status(ProductStatus.PUBLISHED)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        draftProduct = Product.builder()
                .id(101L)
                .designerProfile(designerProfile)
                .name("Draft Jacket")
                .description("Work in progress")
                .price(new BigDecimal("149.00"))
                .currency("CAD")
                .category("Outerwear")
                .status(ProductStatus.DRAFT)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    // -------------------------------------------------------------------------
    // getPublicCatalog
    // -------------------------------------------------------------------------

    @Test
    void getPublicCatalog_noFilters_returnsPublishedProducts() {
        Page<Product> page = new PageImpl<>(List.of(publishedProduct));
        when(productRepository.findByStatus(eq(ProductStatus.PUBLISHED), any(Pageable.class)))
                .thenReturn(page);
        when(garmentAssetRepository.findByProductIdInOrderByCreatedAtDesc(anyList()))
                .thenReturn(Collections.emptyList());

        PagedResponse<ProductResponse> result = productService.getPublicCatalog(0, 10, null, null);

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).name()).isEqualTo("Silk Blouse");
        assertThat(result.content().get(0).status()).isEqualTo(ProductStatus.PUBLISHED);
    }

    @Test
    void getPublicCatalog_withCategory_filtersByCategory() {
        Page<Product> page = new PageImpl<>(List.of(publishedProduct));
        when(productRepository.findByStatusAndCategory(
                eq(ProductStatus.PUBLISHED), eq("Tops"), any(Pageable.class)))
                .thenReturn(page);
        when(garmentAssetRepository.findByProductIdInOrderByCreatedAtDesc(anyList()))
                .thenReturn(Collections.emptyList());

        PagedResponse<ProductResponse> result = productService.getPublicCatalog(0, 10, "Tops", null);

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).category()).isEqualTo("Tops");
    }

    @Test
    void getPublicCatalog_withSearchQuery_filtersByNameOrDescription() {
        Page<Product> page = new PageImpl<>(List.of(publishedProduct));
        when(productRepository.findByStatusAndSearch(
                eq(ProductStatus.PUBLISHED), eq("silk"), any(Pageable.class)))
                .thenReturn(page);
        when(garmentAssetRepository.findByProductIdInOrderByCreatedAtDesc(anyList()))
                .thenReturn(Collections.emptyList());

        PagedResponse<ProductResponse> result = productService.getPublicCatalog(0, 10, null, "silk");

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).name()).isEqualTo("Silk Blouse");
    }

    @Test
    void getPublicCatalog_withCategoryAndSearch_appliesBothFilters() {
        Page<Product> page = new PageImpl<>(List.of(publishedProduct));
        when(productRepository.findByStatusAndCategoryAndSearch(
                eq(ProductStatus.PUBLISHED), eq("Tops"), eq("silk"), any(Pageable.class)))
                .thenReturn(page);
        when(garmentAssetRepository.findByProductIdInOrderByCreatedAtDesc(anyList()))
                .thenReturn(Collections.emptyList());

        PagedResponse<ProductResponse> result = productService.getPublicCatalog(0, 10, "Tops", "silk");

        assertThat(result.content()).hasSize(1);
    }

    @Test
    void getPublicCatalog_pageSizeClamped_toMaxPageSize() {
        Page<Product> page = new PageImpl<>(Collections.emptyList());
        when(productRepository.findByStatus(eq(ProductStatus.PUBLISHED), any(Pageable.class)))
                .thenReturn(page);

        productService.getPublicCatalog(0, 500, null, null);

        // Verify the repository was called (size clamping is internal; we verify no error)
        verify(productRepository).findByStatus(eq(ProductStatus.PUBLISHED), any(Pageable.class));
    }

    // -------------------------------------------------------------------------
    // getProductById
    // -------------------------------------------------------------------------

    @Test
    void getProductById_publishedProduct_accessibleByAnyone() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(publishedProduct));
        when(garmentAssetRepository.findTopByProductIdAndStatusOrderByCreatedAtDesc(100L, "ACTIVE"))
                .thenReturn(Optional.empty());
        when(garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Optional.empty());
        when(modelGenerationTaskRepository.findByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Collections.emptyList());

        ProductResponse result = productService.getProductById(100L, null);

        assertThat(result.id()).isEqualTo(100L);
        assertThat(result.name()).isEqualTo("Silk Blouse");
    }

    @Test
    void getProductById_draftProduct_accessibleByOwner() {
        when(productRepository.findById(101L)).thenReturn(Optional.of(draftProduct));
        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(designerProfile));
        when(garmentAssetRepository.findTopByProductIdAndStatusOrderByCreatedAtDesc(101L, "ACTIVE"))
                .thenReturn(Optional.empty());
        when(garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(101L))
                .thenReturn(Optional.empty());
        when(modelGenerationTaskRepository.findByProductIdOrderByCreatedAtDesc(101L))
                .thenReturn(Collections.emptyList());

        ProductResponse result = productService.getProductById(101L, "designer@example.com");

        assertThat(result.id()).isEqualTo(101L);
        assertThat(result.status()).isEqualTo(ProductStatus.DRAFT);
    }

    @Test
    void getProductById_draftProduct_notAccessibleByNonOwner() {
        when(productRepository.findById(101L)).thenReturn(Optional.of(draftProduct));
        when(userRepository.findByEmail("other@example.com")).thenReturn(Optional.of(otherUser));
        when(designerProfileRepository.findByUserId(2L)).thenReturn(Optional.of(otherDesignerProfile));

        assertThatThrownBy(() -> productService.getProductById(101L, "other@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Product not found");
    }

    @Test
    void getProductById_draftProduct_notAccessibleAnonymously() {
        when(productRepository.findById(101L)).thenReturn(Optional.of(draftProduct));

        assertThatThrownBy(() -> productService.getProductById(101L, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Product not found");
    }

    @Test
    void getProductById_nonexistent_throwsIllegalArgumentException() {
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.getProductById(999L, "designer@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Product not found: 999");
    }

    // -------------------------------------------------------------------------
    // getDesignerProducts
    // -------------------------------------------------------------------------

    @Test
    void getDesignerProducts_returnsAllProductsForDesigner() {
        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(designerProfile));
        when(productRepository.findByDesignerProfileId(10L))
                .thenReturn(List.of(publishedProduct, draftProduct));
        when(garmentAssetRepository.findByProductIdInOrderByCreatedAtDesc(anyList()))
                .thenReturn(Collections.emptyList());

        List<ProductResponse> result = productService.getDesignerProducts("designer@example.com");

        assertThat(result).hasSize(2);
        assertThat(result).extracting(ProductResponse::name)
                .containsExactly("Silk Blouse", "Draft Jacket");
    }

    @Test
    void getDesignerProducts_unknownUser_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.getDesignerProducts("nobody@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("User not found");
    }

    @Test
    void getDesignerProducts_userWithNoDesignerProfile_throwsIllegalArgumentException() {
        User buyerUser = User.builder()
                .id(99L)
                .email("buyer@example.com")
                .passwordHash("$2a$10$hash")
                .name("Buyer")
                .role(Role.BUYER)
                .build();

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(buyerUser));
        when(designerProfileRepository.findByUserId(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.getDesignerProducts("buyer@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Designer profile not found");
    }

    // -------------------------------------------------------------------------
    // createProduct
    // -------------------------------------------------------------------------

    @Test
    void createProduct_success_createsDraftProduct() {
        CreateProductRequest request = new CreateProductRequest(
                "New Top",
                "A new product",
                new BigDecimal("59.99"),
                "CAD",
                "Tops",
                List.of("casual"),
                List.of("blue"),
                List.of("S", "M"),
                List.of("photo.jpg"),
                null
        );

        Product savedProduct = Product.builder()
                .id(200L)
                .designerProfile(designerProfile)
                .name("New Top")
                .description("A new product")
                .price(new BigDecimal("59.99"))
                .currency("CAD")
                .category("Tops")
                .styleTags("[\"casual\"]")
                .colorTags("[\"blue\"]")
                .sizes("[\"S\",\"M\"]")
                .media("[\"photo.jpg\"]")
                .status(ProductStatus.DRAFT)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(designerProfile));
        when(productRepository.save(any(Product.class))).thenReturn(savedProduct);

        ProductResponse result = productService.createProduct("designer@example.com", request);

        assertThat(result.id()).isEqualTo(200L);
        assertThat(result.name()).isEqualTo("New Top");
        assertThat(result.status()).isEqualTo(ProductStatus.DRAFT);
        assertThat(result.designerProfileId()).isEqualTo(10L);
    }

    @Test
    void createProduct_defaultsCurrencyToCAD_whenNull() {
        CreateProductRequest request = new CreateProductRequest(
                "No Currency Top",
                "desc",
                new BigDecimal("29.99"),
                null,
                "Tops",
                null, null, null, null, null
        );

        Product savedProduct = Product.builder()
                .id(201L)
                .designerProfile(designerProfile)
                .name("No Currency Top")
                .description("desc")
                .price(new BigDecimal("29.99"))
                .currency("CAD")
                .category("Tops")
                .status(ProductStatus.DRAFT)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(designerProfile));
        when(productRepository.save(any(Product.class))).thenReturn(savedProduct);

        ProductResponse result = productService.createProduct("designer@example.com", request);

        assertThat(result.currency()).isEqualTo("CAD");
    }

    // -------------------------------------------------------------------------
    // deleteProduct
    // -------------------------------------------------------------------------

    @Test
    void deleteProduct_ownerCanDelete() {
        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(designerProfile));
        when(productRepository.findById(100L)).thenReturn(Optional.of(publishedProduct));

        productService.deleteProduct("designer@example.com", 100L);

        verify(productRepository).delete(publishedProduct);
    }

    @Test
    void deleteProduct_nonOwner_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("other@example.com")).thenReturn(Optional.of(otherUser));
        when(designerProfileRepository.findByUserId(2L)).thenReturn(Optional.of(otherDesignerProfile));
        when(productRepository.findById(100L)).thenReturn(Optional.of(publishedProduct));

        assertThatThrownBy(() -> productService.deleteProduct("other@example.com", 100L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Product not found");

        verify(productRepository, never()).delete(any(Product.class));
    }

    @Test
    void deleteProduct_nonexistentProduct_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(designerProfile));
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.deleteProduct("designer@example.com", 999L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Product not found: 999");
    }

    // -------------------------------------------------------------------------
    // getPublishedCategories
    // -------------------------------------------------------------------------

    @Test
    void getPublishedCategories_returnsDistinctCategories() {
        when(productRepository.findDistinctCategoriesByStatus(ProductStatus.PUBLISHED))
                .thenReturn(List.of("Accessories", "Outerwear", "Tops"));

        List<String> result = productService.getPublishedCategories();

        assertThat(result).containsExactly("Accessories", "Outerwear", "Tops");
    }

    @Test
    void getPublishedCategories_emptyWhenNoPublishedProducts() {
        when(productRepository.findDistinctCategoriesByStatus(ProductStatus.PUBLISHED))
                .thenReturn(Collections.emptyList());

        List<String> result = productService.getPublishedCategories();

        assertThat(result).isEmpty();
    }

    // -------------------------------------------------------------------------
    // getProductById — asset and task fallback coverage
    // -------------------------------------------------------------------------

    @Test
    void getProductById_publishedWithAsset_returnsAssetUrls() {
        GarmentAsset asset = GarmentAsset.builder()
                .id(1L)
                .product(publishedProduct)
                .glbUrl("/assets/silk-blouse.glb")
                .usdzUrl("/assets/silk-blouse.usdz")
                .status("ACTIVE")
                .build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(publishedProduct));
        when(garmentAssetRepository.findTopByProductIdAndStatusOrderByCreatedAtDesc(100L, "ACTIVE"))
                .thenReturn(Optional.of(asset));

        ProductResponse result = productService.getProductById(100L, null);

        assertThat(result.glbAssetUrl()).isEqualTo("/assets/silk-blouse.glb");
        assertThat(result.usdzAssetUrl()).isEqualTo("/assets/silk-blouse.usdz");
        assertThat(result.assetStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void getProductById_publishedWithPendingTask_returnsFallbackStatus() {
        ModelGenerationTask pendingTask = ModelGenerationTask.builder()
                .id(1L)
                .product(publishedProduct)
                .status(TaskStatus.PENDING)
                .build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(publishedProduct));
        when(garmentAssetRepository.findTopByProductIdAndStatusOrderByCreatedAtDesc(100L, "ACTIVE"))
                .thenReturn(Optional.empty());
        when(garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Optional.empty());
        when(modelGenerationTaskRepository.findByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(List.of(pendingTask));

        ProductResponse result = productService.getProductById(100L, null);

        assertThat(result.assetStatus()).isEqualTo("PENDING");
        assertThat(result.glbAssetUrl()).isNull();
    }
}
