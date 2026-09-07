package com.iyae.service;

import com.iyae.dto.OrderResponse;
import com.iyae.entity.Order;
import com.iyae.entity.PickupLocation;
import com.iyae.entity.User;
import com.iyae.repository.OrderRepository;
import com.iyae.repository.PickupLocationRepository;
import com.iyae.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final PickupLocationRepository pickupLocationRepository;

    @Transactional(readOnly = true)
    public List<OrderResponse> getOrders(String email) {
        User user = resolveUser(email);
        List<Order> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        Map<Long, String> names = pickupNames(orders);
        return orders.stream()
                .map(o -> OrderResponse.from(o,
                        o.getPickupLocationId() == null ? null : names.get(o.getPickupLocationId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrderById(String email, Long id) {
        User user = resolveUser(email);
        Order order = orderRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + id));
        String name = order.getPickupLocationId() == null ? null
                : pickupLocationRepository.findById(order.getPickupLocationId())
                        .map(PickupLocation::getName).orElse(null);
        return OrderResponse.from(order, name);
    }

    /** Batch-resolve pickup-location names for the orders that have one (avoids N lookups / lazy fetch). */
    private Map<Long, String> pickupNames(List<Order> orders) {
        List<Long> ids = orders.stream()
                .map(Order::getPickupLocationId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return pickupLocationRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(PickupLocation::getId, PickupLocation::getName));
    }

    private User resolveUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
    }
}
