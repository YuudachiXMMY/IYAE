package com.iyae.dto;

import com.iyae.entity.Product;
import com.iyae.entity.ResaleListing;
import com.iyae.entity.enums.ResaleCondition;
import com.iyae.entity.enums.ResaleStatus;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;

public record ResaleListingResponse(
        Long id,
        Long productId,
        String productName,
        List<String> productMedia,
        String sellerUsername,
        String sizeLabel,
        ResaleCondition condition,
        BigDecimal askingPrice,
        String currency,
        ResaleStatus status,
        String sellerNote,
        List<String> media,
        Instant createdAt
) {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** Build from a managed {@link ResaleListing}; call within an active transaction (lazy product/seller). */
    public static ResaleListingResponse from(ResaleListing listing) {
        Product product = listing.getProduct();
        return new ResaleListingResponse(
                listing.getId(),
                product.getId(),
                product.getName(),
                parseJsonList(product.getMedia()),
                listing.getSeller().getUsername(),
                listing.getSizeLabel(),
                listing.getCondition(),
                listing.getAskingPrice(),
                listing.getCurrency(),
                listing.getStatus(),
                listing.getSellerNote(),
                parseJsonList(listing.getMedia()),
                listing.getCreatedAt()
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
