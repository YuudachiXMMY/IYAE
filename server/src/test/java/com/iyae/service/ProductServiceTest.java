package com.iyae.service;

import com.iyae.dto.CreateProductRequest;
import com.iyae.dto.PagedResponse;
import com.iyae.dto.ProductResponse;
import com.iyae.dto.SizeMeasurementDto;
import com.iyae.dto.UpdateProductRequest;
import com.iyae.entity.DesignerProfile;
import com.iyae.entity.GarmentAsset;
import com.iyae.entity.ModelGenerationTask;
import com.iyae.entity.Product;
import com.iyae.entity.ProductSizeMeasurement;
import com.iyae.entity.User;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.entity.enums.Role;
import com.iyae.entity.enums.TaskStatus;
import com.iyae.repository.DesignerProfileRepository;
import com.iyae.repository.GarmentAssetRepository;
import com.iyae.repository.ModelGenerationTaskRepository;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.ProductSizeMeasurementRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;

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

    @Mock
    ProductSizeMeasurementRepository productSizeMeasurementRepository;

    @Mock
    SizeRecommendationService sizeRecommendationService;

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
        when(productRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(page);
        when(garmentAssetRepository.findByProductIdInOrderByCreatedAtDesc(anyList()))
                .thenReturn(Collections.emptyList());

        PagedResponse<ProductResponse> result = productService.getPublicCatalog(0, 10, null, null, false);

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).name()).isEqualTo("Silk Blouse");
        assertThat(result.content().get(0).status()).isEqualTo(ProductStatus.PUBLISHED);
    }

    @Test
    void getPublicCatalog_withCategory_filtersByCategory() {
        Page<Product> page = new PageImpl<>(List.of(publishedProduct));
        when(productRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(page);
        when(garmentAssetRepository.findByProductIdInOrderByCreatedAtDesc(anyList()))
                .thenReturn(Collections.emptyList());

        PagedResponse<ProductResponse> result = productService.getPublicCatalog(0, 10, "Tops", null, false);

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).category()).isEqualTo("Tops");
    }

    @Test
    void getPublicCatalog_withSearchQuery_filtersByNameOrDescription() {
        Page<Product> page = new PageImpl<>(List.of(publishedProduct));
        when(productRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(page);
        when(garmentAssetRepository.findByProductIdInOrderByCreatedAtDesc(anyList()))
                .thenReturn(Collections.emptyList());

        PagedResponse<ProductResponse> result = productService.getPublicCatalog(0, 10, null, "silk", false);

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).name()).isEqualTo("Silk Blouse");
    }

    @Test
    void getPublicCatalog_withCategoryAndSearch_appliesBothFilters() {
        Page<Product> page = new PageImpl<>(List.of(publishedProduct));
        when(productRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(page);
        when(garmentAssetRepository.findByProductIdInOrderByCreatedAtDesc(anyList()))
                .thenReturn(Collections.emptyList());

        PagedResponse<ProductResponse> result = productService.getPublicCatalog(0, 10, "Tops", "silk", false);

        assertThat(result.content()).hasSize(1);
    }

    @Test
    void getPublicCatalog_pageSizeClamped_toMaxPageSize() {
        Page<Product> page = new PageImpl<>(Collections.emptyList());
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        when(productRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(page);

        productService.getPublicCatalog(0, 500, null, null, false);

        verify(productRepository).findAll(any(Specification.class), pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(100);
    }

    @Test
    void getPublicCatalog_localOnly_delegatesToSpecification() {
        Page<Product> page = new PageImpl<>(List.of(publishedProduct));
        when(productRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(page);
        when(garmentAssetRepository.findByProductIdInOrderByCreatedAtDesc(anyList()))
                .thenReturn(Collections.emptyList());

        PagedResponse<ProductResponse> result = productService.getPublicCatalog(0, 10, null, null, true);

        assertThat(result.content()).hasSize(1);
        verify(productRepository).findAll(any(Specification.class), any(Pageable.class));
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

    @Test
    void getDesignerProducts_enrichesMeasurements() {
        // Regression (PR#10 H1): the designer list path must return per-size measurements so the
        // edit form can round-trip them. Previously measurements were always null here, so the
        // form saved an empty list and the server wiped the product's measurements.
        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(designerProfile));
        when(productRepository.findByDesignerProfileId(10L)).thenReturn(List.of(publishedProduct));
        when(garmentAssetRepository.findByProductIdInOrderByCreatedAtDesc(anyList()))
                .thenReturn(Collections.emptyList());
        ProductSizeMeasurement mRow = ProductSizeMeasurement.builder()
                .id(1L).product(publishedProduct).sizeLabel("M")
                .chestCm(90.0).waistCm(72.0).hipsCm(96.0).lengthCm(60.0)
                .build();
        when(productSizeMeasurementRepository.findByProductIdIn(anyList()))
                .thenReturn(List.of(mRow));

        List<ProductResponse> result = productService.getDesignerProducts("designer@example.com");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).measurements()).hasSize(1);
        assertThat(result.get(0).measurements().get(0).sizeLabel()).isEqualTo("M");
        assertThat(result.get(0).measurements().get(0).chestCm()).isEqualTo(90.0);
    }

    // -------------------------------------------------------------------------
    // updateProduct — measurement reconciliation (PR#10 H1/L6 regression)
    // -------------------------------------------------------------------------

    @Test
    void updateProduct_shrinkSizesOmitMeasurements_prunesOrphanMeasurements() {
        // Regression (PR#10 L6): shrinking the size list while omitting measurements (null) must
        // prune measurement rows for sizes no longer offered, so getProductById cannot later
        // recommend a size the product no longer sells.
        UpdateProductRequest request = new UpdateProductRequest(
                null, null, null, null, null, null, null,
                List.of("S", "M"), // sizes shrink from [S,M,L] -> [S,M]
                null, null, null,
                null); // measurements omitted
        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(designerProfile));
        when(productRepository.findById(100L)).thenReturn(Optional.of(publishedProduct));
        when(productRepository.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));
        ProductSizeMeasurement sRow = ProductSizeMeasurement.builder()
                .id(1L).product(publishedProduct).sizeLabel("S").chestCm(84.0).build();
        ProductSizeMeasurement mRow = ProductSizeMeasurement.builder()
                .id(2L).product(publishedProduct).sizeLabel("M").chestCm(90.0).build();
        ProductSizeMeasurement lRow = ProductSizeMeasurement.builder()
                .id(3L).product(publishedProduct).sizeLabel("L").chestCm(96.0).build();
        when(productSizeMeasurementRepository.findByProductId(100L))
                .thenReturn(List.of(sRow, mRow, lRow));

        productService.updateProduct("designer@example.com", 100L, request);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ProductSizeMeasurement>> captor = ArgumentCaptor.forClass(List.class);
        verify(productSizeMeasurementRepository).deleteAll(captor.capture());
        assertThat(captor.getValue())
                .extracting(ProductSizeMeasurement::getSizeLabel)
                .containsExactly("L");
        // Null measurements must NOT trigger the delete-all "clear" path.
        verify(productSizeMeasurementRepository, never()).deleteByProductId(anyLong());
    }

    @Test
    void updateProduct_priceOnlyOmitMeasurements_keepsAllMeasurements() {
        // Guard against over-deletion: a price-only edit (sizes unchanged, measurements omitted)
        // must not prune or clear any measurement rows.
        UpdateProductRequest request = new UpdateProductRequest(
                null, null, new BigDecimal("99.99"), null, null, null, null,
                null, // sizes unchanged
                null, null, null,
                null); // measurements omitted
        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(designerProfile));
        when(productRepository.findById(100L)).thenReturn(Optional.of(publishedProduct));
        when(productRepository.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));
        ProductSizeMeasurement sRow = ProductSizeMeasurement.builder()
                .id(1L).product(publishedProduct).sizeLabel("S").chestCm(84.0).build();
        ProductSizeMeasurement mRow = ProductSizeMeasurement.builder()
                .id(2L).product(publishedProduct).sizeLabel("M").chestCm(90.0).build();
        ProductSizeMeasurement lRow = ProductSizeMeasurement.builder()
                .id(3L).product(publishedProduct).sizeLabel("L").chestCm(96.0).build();
        when(productSizeMeasurementRepository.findByProductId(100L))
                .thenReturn(List.of(sRow, mRow, lRow));

        productService.updateProduct("designer@example.com", 100L, request);

        verify(productSizeMeasurementRepository, never()).deleteAll(any());
        verify(productSizeMeasurementRepository, never()).deleteByProductId(anyLong());
    }

    // -------------------------------------------------------------------------
    // updateProduct — moderation lock (PR#10 M2)
    // -------------------------------------------------------------------------

    @Test
    void updateProduct_moderationLocked_rejectsStatusChangeOutOfArchived() {
        // PR#10 M2: an admin-archived + locked product cannot be republished by the owning designer.
        publishedProduct.setStatus(ProductStatus.ARCHIVED);
        publishedProduct.setModerationLocked(true);
        UpdateProductRequest request = new UpdateProductRequest(
                null, null, null, null, null, null, null, null, null, null,
                ProductStatus.PUBLISHED, // attempt to republish
                null);
        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(designerProfile));
        when(productRepository.findById(100L)).thenReturn(Optional.of(publishedProduct));

        assertThatThrownBy(() -> productService.updateProduct("designer@example.com", 100L, request))
                .isInstanceOf(AccessDeniedException.class);

        // Guard throws before any write; status must remain ARCHIVED.
        verify(productRepository, never()).save(any());
        assertThat(publishedProduct.getStatus()).isEqualTo(ProductStatus.ARCHIVED);
    }

    @Test
    void updateProduct_moderationLocked_allowsNonStatusEdit() {
        // A locked product may still have non-status fields edited (e.g. a price correction).
        publishedProduct.setStatus(ProductStatus.ARCHIVED);
        publishedProduct.setModerationLocked(true);
        UpdateProductRequest request = new UpdateProductRequest(
                null, null, new BigDecimal("77.77"), null, null, null, null, null, null, null,
                null, // status omitted
                null);
        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(designerProfile));
        when(productRepository.findById(100L)).thenReturn(Optional.of(publishedProduct));
        when(productRepository.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));
        when(productSizeMeasurementRepository.findByProductId(100L)).thenReturn(Collections.emptyList());

        ProductResponse result = productService.updateProduct("designer@example.com", 100L, request);

        assertThat(result.price()).isEqualByComparingTo(new BigDecimal("77.77"));
        assertThat(result.status()).isEqualTo(ProductStatus.ARCHIVED);
        assertThat(publishedProduct.getStatus()).isEqualTo(ProductStatus.ARCHIVED);
    }

    @Test
    void updateProduct_notLocked_allowsSelfArchive() {
        // A designer may still self-archive an unlocked product (no regression to normal flow).
        UpdateProductRequest request = new UpdateProductRequest(
                null, null, null, null, null, null, null, null, null, null,
                ProductStatus.ARCHIVED,
                null);
        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(designerProfile));
        when(productRepository.findById(100L)).thenReturn(Optional.of(publishedProduct));
        when(productRepository.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));
        when(productSizeMeasurementRepository.findByProductId(100L)).thenReturn(Collections.emptyList());

        ProductResponse result = productService.updateProduct("designer@example.com", 100L, request);

        assertThat(result.status()).isEqualTo(ProductStatus.ARCHIVED);
        assertThat(publishedProduct.getStatus()).isEqualTo(ProductStatus.ARCHIVED);
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
                null,
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
                null, null, null, null, null, null
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
    // createProduct / getProductById — measurement write path + enrichment (PR#10 M4)
    // -------------------------------------------------------------------------

    @Test
    void createProduct_withMeasurements_persistsRows() {
        // PR#10 M4: a create carrying per-size measurements must delete-then-insert the rows.
        CreateProductRequest request = new CreateProductRequest(
                "New Top", "desc", new BigDecimal("59.99"), "CAD", "Tops",
                null, null, List.of("S", "M"), null, null,
                List.of(new SizeMeasurementDto("M", 90.0, 72.0, 96.0, 60.0)));

        Product savedProduct = Product.builder()
                .id(200L)
                .designerProfile(designerProfile)
                .name("New Top")
                .description("desc")
                .price(new BigDecimal("59.99"))
                .currency("CAD")
                .category("Tops")
                .sizes("[\"S\",\"M\"]")
                .status(ProductStatus.DRAFT)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(designerProfile));
        when(productRepository.save(any(Product.class))).thenReturn(savedProduct);

        productService.createProduct("designer@example.com", request);

        verify(productSizeMeasurementRepository).deleteByProductId(200L);
        verify(productSizeMeasurementRepository).flush();
        ArgumentCaptor<ProductSizeMeasurement> captor = ArgumentCaptor.forClass(ProductSizeMeasurement.class);
        verify(productSizeMeasurementRepository).save(captor.capture());
        assertThat(captor.getValue().getSizeLabel()).isEqualTo("M");
        assertThat(captor.getValue().getChestCm()).isEqualTo(90.0);
    }

    @Test
    void createProduct_unknownSizeLabel_throws400() {
        // PR#10 M4: a measurement whose label is not one of the product's declared sizes is rejected.
        CreateProductRequest request = new CreateProductRequest(
                "New Top", "desc", new BigDecimal("59.99"), "CAD", "Tops",
                null, null, List.of("S", "M"), null, null,
                List.of(new SizeMeasurementDto("XXL", 90.0, null, null, null)));

        Product savedProduct = Product.builder()
                .id(200L)
                .designerProfile(designerProfile)
                .name("New Top")
                .price(new BigDecimal("59.99"))
                .currency("CAD")
                .category("Tops")
                .sizes("[\"S\",\"M\"]")
                .status(ProductStatus.DRAFT)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(designerProfile));
        when(productRepository.save(any(Product.class))).thenReturn(savedProduct);

        assertThatThrownBy(() -> productService.createProduct("designer@example.com", request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not one of the product sizes");
    }

    @Test
    void getProductById_enrichesRecommendationAndMeasurements() {
        // PR#10 M4: a published-product detail response carries the buyer's recommendedSize and the
        // product's declared per-size measurements.
        ProductSizeMeasurement mRow = ProductSizeMeasurement.builder()
                .id(1L).product(publishedProduct).sizeLabel("M")
                .chestCm(90.0).waistCm(72.0).hipsCm(96.0).lengthCm(60.0)
                .build();
        when(productRepository.findById(100L)).thenReturn(Optional.of(publishedProduct));
        when(garmentAssetRepository.findTopByProductIdAndStatusOrderByCreatedAtDesc(100L, "ACTIVE"))
                .thenReturn(Optional.empty());
        when(garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Optional.empty());
        when(modelGenerationTaskRepository.findByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Collections.emptyList());
        when(productSizeMeasurementRepository.findByProductId(100L)).thenReturn(List.of(mRow));
        when(sizeRecommendationService.recommendForBuyer(anyList(), eq("buyer@example.com")))
                .thenReturn("M");

        ProductResponse result = productService.getProductById(100L, "buyer@example.com");

        assertThat(result.recommendedSize()).isEqualTo("M");
        assertThat(result.measurements()).hasSize(1);
        assertThat(result.measurements().get(0).sizeLabel()).isEqualTo("M");
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
