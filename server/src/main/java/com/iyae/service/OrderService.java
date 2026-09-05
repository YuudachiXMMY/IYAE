package com.iyae.service;

import com.iyae.dto.OrderResponse;
import com.iyae.entity.User;
import com.iyae.repository.OrderRepository;
import com.iyae.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<OrderResponse> getOrders(String email) {
        User user = resolveUser(email);
        return orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream()
                .map(OrderResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrderById(String email, Long id) {
        User user = resolveUser(email);
        return orderRepository.findByIdAndUserId(id, user.getId())
                .map(OrderResponse::from)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + id));
    }

    private User resolveUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
    }
}
