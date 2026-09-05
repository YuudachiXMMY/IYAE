package com.iyae.dto;

import com.iyae.entity.DesignerProfile;
import com.iyae.entity.GarmentAsset;
import com.iyae.entity.Product;
import com.iyae.entity.enums.ProductStatus;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;

public record ProductResponse(
        Long id,
        Long designerProfileId,
        String designerDisplayName,
        String name,
        String description,
        BigDecimal price,
        String currency,
        String category,
        List<String> styleTags,
        List<String> colorTags,
        List<String> sizes,
        List<String> media,
        String glbUrl,
        ProductStatus status,
        Instant createdAt,
        Instant updatedAt,
        String glbAssetUrl,
        String usdzAssetUrl,
        String assetStatus,
        // Phase 5: marketplace locality + cross-brand sizing
        boolean designerLocal,
        String designerCity,
        String recommendedSize,
        List<SizeMeasurementDto> measurements
) {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static ProductResponse from(Product product) {
        return from(product, null);
    }

    public static ProductResponse from(Product product, GarmentAsset asset) {
        DesignerProfile profile = product.getDesignerProfile();
        return new ProductResponse(
                product.getId(),
                profile.getId(),
                profile.getDisplayName(),
                product.getName(),
                product.getDescription(),
                product.getPrice(),
                product.getCurrency(),
                product.getCategory(),
                parseJsonList(product.getStyleTags()),
                parseJsonList(product.getColorTags()),
                parseJsonList(product.getSizes()),
                parseJsonList(product.getMedia()),
                product.getGlbUrl(),
                product.getStatus(),
                product.getCreatedAt(),
                product.getUpdatedAt(),
                asset != null ? asset.getGlbUrl() : null,
                asset != null ? asset.getUsdzUrl() : null,
                asset != null ? asset.getStatus() : null,
                profile.isLocal(),
                profile.getCity(),
                null,
                null
        );
    }

    /** Copy with an overridden asset status (used for the PENDING/RUNNING generation-task fallback). */
    public ProductResponse withAssetStatus(String newAssetStatus) {
        return new ProductResponse(
                id, designerProfileId, designerDisplayName, name, description, price, currency,
                category, styleTags, colorTags, sizes, media, glbUrl, status, createdAt, updatedAt,
                glbAssetUrl, usdzAssetUrl, newAssetStatus,
                designerLocal, designerCity, recommendedSize, measurements
        );
    }

    /** Copy enriched with the buyer's recommended size and the product's declared measurements. */
    public ProductResponse withRecommendation(String newRecommendedSize, List<SizeMeasurementDto> newMeasurements) {
        return new ProductResponse(
                id, designerProfileId, designerDisplayName, name, description, price, currency,
                category, styleTags, colorTags, sizes, media, glbUrl, status, createdAt, updatedAt,
                glbAssetUrl, usdzAssetUrl, assetStatus,
                designerLocal, designerCity, newRecommendedSize, newMeasurements
        );
    }

    private static List<String> parseJsonList(String json) {
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return MAPPER.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
