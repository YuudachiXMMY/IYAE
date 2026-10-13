package com.iyae.controller;

import com.iyae.dto.OrderResponse;
import com.iyae.entity.enums.FulfillmentMethod;
import com.iyae.entity.enums.OrderStatus;
import com.iyae.service.OrderService;
import com.iyae.testsupport.WebMvcSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(OrderController.class)
@Import(WebMvcSecurityConfig.class)
class OrderControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    OrderService orderService;

    private OrderResponse sampleOrder() {
        return new OrderResponse(1L, OrderStatus.PENDING, BigDecimal.valueOf(99.99), "[]", Instant.now(),
                FulfillmentMethod.SHIP, null, BigDecimal.ZERO, null, null);
    }

    @Test
    @WithMockUser(username = "buyer@example.com")
    void getOrders_authenticated_returnsList() throws Exception {
        when(orderService.getOrders("buyer@example.com")).thenReturn(List.of(sampleOrder()));

        mockMvc.perform(get("/api/orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1L))
                .andExpect(jsonPath("$[0].status").value("PENDING"));
    }

    @Test
    void getOrders_unauthenticated_returns401() throws Exception {
        mockMvc.perform(get("/api/orders"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "buyer@example.com")
    void getOrderById_authenticated_returnsOrder() throws Exception {
        when(orderService.getOrderById("buyer@example.com", 1L)).thenReturn(sampleOrder());

        mockMvc.perform(get("/api/orders/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1L));
    }
}
