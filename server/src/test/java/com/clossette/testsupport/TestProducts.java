package com.clossette.testsupport;

import com.clossette.entity.DesignerProfile;
import com.clossette.entity.Product;
import com.clossette.entity.enums.ProductStatus;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Pre-built Product fixtures for unit tests.
 */
public final class TestProducts {

    private TestProducts() {}

    public static Product aPublishedProduct() {
        DesignerProfile profile = DesignerProfile.builder()
                .id(10L)
                .user(TestUsers.aDesigner())
                .displayName("Test Studio")
                .shopName("test-studio")
                .build();

        return Product.builder()
                .id(1L)
                .designerProfile(profile)
                .name("Test Silk Blouse")
                .description("A luxurious test blouse")
                .price(new BigDecimal("99.99"))
                .currency("USD")
                .category("Tops")
                .styleTags("[\"minimalist\"]")
                .colorTags("[\"white\"]")
                .sizes("[\"S\",\"M\",\"L\"]")
                .media("[\"img1.jpg\"]")
                .status(ProductStatus.PUBLISHED)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }

    public static Product aDraftProduct() {
        DesignerProfile profile = DesignerProfile.builder()
                .id(10L)
                .user(TestUsers.aDesigner())
                .displayName("Test Studio")
                .shopName("test-studio")
                .build();

        return Product.builder()
                .id(2L)
                .designerProfile(profile)
                .name("Test Draft Jacket")
                .description("Work in progress")
                .price(new BigDecimal("149.00"))
                .currency("USD")
                .category("Outerwear")
                .status(ProductStatus.DRAFT)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
    }
}
