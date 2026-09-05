package com.iyae.dto;

import com.iyae.entity.Order;
import com.iyae.entity.enums.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record OrderResponse(
        Long id,
        OrderStatus status,
        BigDecimal totalAmount,
        String items,
        Instant createdAt
) {
    public static OrderResponse from(Order order) {
        return new OrderResponse(
                order.getId(),
                order.getStatus(),
                order.getTotalAmount(),
                order.getItemsSnapshot(),
                order.getCreatedAt()
        );
    }
}
