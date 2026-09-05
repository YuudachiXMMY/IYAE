package com.iyae.dto;

import com.iyae.entity.CartItem;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

public record CartResponse(
        Long id,
        List<CartItemResponse> items
) {
    public record CartItemResponse(
            Long id,
            Long productId,
            String productName,
            BigDecimal productPrice,
            Integer quantity,
            String imageUrl,
            String selectedSize,
            String currency
    ) {
        private static final ObjectMapper MAPPER = new ObjectMapper();

        public static CartItemResponse from(CartItem item) {
            return new CartItemResponse(
                    item.getId(),
                    item.getProduct().getId(),
                    item.getProduct().getName(),
                    item.getProduct().getPrice(),
                    item.getQuantity(),
                    extractFirstMedia(item.getProduct().getMedia()),
                    item.getSelectedSize(),
                    item.getProduct().getCurrency()
            );
        }

        private static String extractFirstMedia(String mediaJson) {
            if (mediaJson == null || mediaJson.isBlank()) {
                return null;
            }
            try {
                List<String> urls = MAPPER.readValue(mediaJson, new TypeReference<List<String>>() {});
                return urls.isEmpty() ? null : urls.get(0);
            } catch (Exception e) {
                return null;
            }
        }
    }
}
