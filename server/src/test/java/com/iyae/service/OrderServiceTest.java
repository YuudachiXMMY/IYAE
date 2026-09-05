package com.iyae.service;

import com.iyae.dto.OrderResponse;
import com.iyae.entity.Order;
import com.iyae.entity.User;
import com.iyae.entity.enums.OrderStatus;
import com.iyae.entity.enums.Role;
import com.iyae.repository.OrderRepository;
import com.iyae.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    OrderRepository orderRepository;

    @Mock
    UserRepository userRepository;

    @InjectMocks
    OrderService orderService;

    private User testUser;
    private Order testOrder;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L)
                .email("buyer@test.com")
                .passwordHash("$2a$10$hash")
                .name("Test Buyer")
                .role(Role.BUYER)
                .build();

        testOrder = Order.builder()
                .id(42L)
                .user(testUser)
                .status(OrderStatus.PAID)
                .totalAmount(new BigDecimal("99.99"))
                .stripeSessionId("cs_test_abc")
                .paymentStatus("STUB")
                .createdAt(Instant.now())
                .build();
    }

    @Test
    void getOrders_returnsOrderList() {
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(testOrder));

        List<OrderResponse> result = orderService.getOrders("buyer@test.com");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo(42L);
        assertThat(result.get(0).status()).isEqualTo(OrderStatus.PAID);
    }

    @Test
    void getOrders_noOrders_returnsEmptyList() {
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of());

        List<OrderResponse> result = orderService.getOrders("buyer@test.com");

        assertThat(result).isEmpty();
    }

    @Test
    void getOrderById_existingOrder_returnsOrder() {
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(orderRepository.findByIdAndUserId(42L, 1L)).thenReturn(Optional.of(testOrder));

        OrderResponse result = orderService.getOrderById("buyer@test.com", 42L);

        assertThat(result.id()).isEqualTo(42L);
        assertThat(result.totalAmount()).isEqualByComparingTo("99.99");
    }

    @Test
    void getOrderById_notFound_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(orderRepository.findByIdAndUserId(999L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.getOrderById("buyer@test.com", 999L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Order not found");
    }

    @Test
    void getOrderById_unknownUser_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("ghost@test.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.getOrderById("ghost@test.com", 42L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }
}
