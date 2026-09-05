package com.iyae.controller;

import com.iyae.dto.AddCartItemRequest;
import com.iyae.dto.CartResponse;
import com.iyae.dto.UpdateCartItemRequest;
import com.iyae.service.CartService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @GetMapping
    public ResponseEntity<CartResponse> getCart(Authentication authentication) {
        return ResponseEntity.ok(cartService.getCart(authentication.getName()));
    }

    @PostMapping("/items")
    public ResponseEntity<CartResponse> addItem(
            @Valid @RequestBody AddCartItemRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(cartService.addItem(authentication.getName(), request));
    }

    @PutMapping("/items/{id}")
    public ResponseEntity<CartResponse> updateItem(
            @PathVariable Long id,
            @Valid @RequestBody UpdateCartItemRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(cartService.updateItem(authentication.getName(), id, request));
    }

    @DeleteMapping("/items/{id}")
    public ResponseEntity<CartResponse> removeItem(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(cartService.removeItem(authentication.getName(), id));
    }
}
