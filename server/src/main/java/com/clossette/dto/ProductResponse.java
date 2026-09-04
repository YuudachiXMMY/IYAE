package com.clossette.dto;

import com.clossette.entity.GarmentAsset;
import com.clossette.entity.Product;
import com.clossette.entity.enums.ProductStatus;
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
        String assetStatus
) {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static ProductResponse from(Product product) {
        return from(product, null);
    }

    public static ProductResponse from(Product product, GarmentAsset asset) {
        return new ProductResponse(
                product.getId(),
                product.getDesignerProfile().getId(),
                product.getDesignerProfile().getDisplayName(),
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
                asset != null ? asset.getStatus() : null
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
