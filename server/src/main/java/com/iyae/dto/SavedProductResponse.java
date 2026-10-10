package com.iyae.dto;

import com.iyae.entity.SavedProduct;

import java.time.Instant;

/**
 * A wishlist entry. Carries the full {@link ProductResponse} rather than a bare
 * id so a wishlist surface needs one request instead of one per saved item, and
 * so the client can see {@code status} — a product can be archived after it was
 * saved, and the entry stays.
 */
public record SavedProductResponse(
        Long id,
        Long productId,
        ProductResponse product,
        Instant createdAt
) {
    public static SavedProductResponse from(SavedProduct savedProduct) {
        return new SavedProductResponse(
                savedProduct.getId(),
                savedProduct.getProduct().getId(),
                ProductResponse.from(savedProduct.getProduct()),
                savedProduct.getCreatedAt()
        );
    }
}
