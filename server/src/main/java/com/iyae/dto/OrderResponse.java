package com.iyae.dto;

import com.fasterxml.jackson.annotation.JsonRawValue;
import com.iyae.entity.Order;
import com.iyae.entity.enums.FulfillmentMethod;
import com.iyae.entity.enums.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record OrderResponse(
        Long id,
        OrderStatus status,
        BigDecimal totalAmount,
        // itemsSnapshot is already-serialized JSON (an array of item objects); emit it as an
        // embedded array rather than a JSON-escaped string so clients can consume it directly.
        @JsonRawValue String items,
        Instant createdAt,
        FulfillmentMethod fulfillmentMethod,
        String shippingCarrier,     // carrier display name; null for pickup
        BigDecimal shippingFee,
        Long pickupLocationId,
        String pickupLocationName   // resolved by OrderService; null for ship
) {
    public static OrderResponse from(Order order) {
        return from(order, null);
    }

    public static OrderResponse from(Order order, String pickupLocationName) {
        return new OrderResponse(
                order.getId(),
                order.getStatus(),
                order.getTotalAmount(),
                order.getItemsSnapshot(),
                order.getCreatedAt(),
                order.getFulfillmentMethod(),
                order.getShippingCarrier() != null ? order.getShippingCarrier().getDisplayName() : null,
                order.getShippingFee(),
                order.getPickupLocationId(),
                pickupLocationName);
    }
}
