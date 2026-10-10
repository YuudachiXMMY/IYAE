package com.iyae.controller;

import com.iyae.dto.SavedProductResponse;
import com.iyae.service.SavedProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Wishlist of catalogue products.
 *
 * <p>Separate from {@code /api/looks}, which saves generated outfit
 * recommendations and requires a {@code recommendationId}.
 *
 * <p>PUT rather than POST for the save: membership of a set is idempotent, the
 * product id is the whole identity of the entry, and a client replaying a local
 * wishlist or double-tapping a heart must not create duplicates or 409s.
 */
@RestController
@RequestMapping("/api/saved-products")
@RequiredArgsConstructor
public class SavedProductController {

    private final SavedProductService savedProductService;

    @GetMapping
    public ResponseEntity<List<SavedProductResponse>> getSavedProducts(Authentication authentication) {
        return ResponseEntity.ok(savedProductService.getSavedProducts(authentication.getName()));
    }

    @PutMapping("/{productId}")
    public ResponseEntity<SavedProductResponse> saveProduct(
            @PathVariable Long productId,
            Authentication authentication
    ) {
        return ResponseEntity.ok(savedProductService.saveProduct(authentication.getName(), productId));
    }

    @DeleteMapping("/{productId}")
    public ResponseEntity<Void> removeProduct(
            @PathVariable Long productId,
            Authentication authentication
    ) {
        savedProductService.removeProduct(authentication.getName(), productId);
        return ResponseEntity.noContent().build();
    }
}
