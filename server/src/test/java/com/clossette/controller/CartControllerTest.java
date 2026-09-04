package com.clossette.controller;

import com.clossette.dto.AddCartItemRequest;
import com.clossette.dto.CartResponse;
import com.clossette.dto.UpdateCartItemRequest;
import com.clossette.service.CartService;
import com.clossette.testsupport.WebMvcSecurityConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(CartController.class)
@Import(WebMvcSecurityConfig.class)
class CartControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    CartService cartService;

    private CartResponse emptyCart() {
        return new CartResponse(1L, List.of());
    }

    @Test
    @WithMockUser(username = "buyer@example.com")
    void getCart_authenticated_returns200() throws Exception {
        when(cartService.getCart("buyer@example.com")).thenReturn(emptyCart());

        mockMvc.perform(get("/api/cart"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1L));
    }

    @Test
    void getCart_unauthenticated_returns403() throws Exception {
        mockMvc.perform(get("/api/cart"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "buyer@example.com")
    void addItem_validRequest_returns200() throws Exception {
        when(cartService.addItem(eq("buyer@example.com"), any())).thenReturn(emptyCart());

        String body = objectMapper.writeValueAsString(new AddCartItemRequest(10L, 2, "M"));

        mockMvc.perform(post("/api/cart/items")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());
    }

    @Test
    void addItem_unauthenticated_returns403() throws Exception {
        String body = objectMapper.writeValueAsString(new AddCartItemRequest(10L, 1, "M"));

        mockMvc.perform(post("/api/cart/items")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "buyer@example.com")
    void addItem_missingSelectedSize_returns400() throws Exception {
        String body = "{\"productId\":10,\"quantity\":1}";

        mockMvc.perform(post("/api/cart/items")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "buyer@example.com")
    void updateItem_validRequest_returns200() throws Exception {
        when(cartService.updateItem(eq("buyer@example.com"), eq(5L), any())).thenReturn(emptyCart());

        String body = objectMapper.writeValueAsString(new UpdateCartItemRequest(3));

        mockMvc.perform(put("/api/cart/items/5")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "buyer@example.com")
    void removeItem_authenticated_returns200() throws Exception {
        when(cartService.removeItem("buyer@example.com", 5L)).thenReturn(emptyCart());

        mockMvc.perform(delete("/api/cart/items/5")
                        .with(csrf()))
                .andExpect(status().isOk());
    }
}
