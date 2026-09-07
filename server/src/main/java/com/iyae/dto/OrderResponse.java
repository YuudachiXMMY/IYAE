package com.iyae.dto;

import com.iyae.entity.Order;
import com.iyae.entity.enums.FulfillmentMethod;
import com.iyae.entity.enums.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record OrderResponse(
        Long id,
        OrderStatus status,
        BigDecimal totalAmount,
        String items,
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
