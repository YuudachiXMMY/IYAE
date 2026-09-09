package com.iyae.controller;

import com.iyae.dto.PromotionRequest;
import com.iyae.dto.PromotionResponse;
import com.iyae.dto.UpdatePromotionRequest;
import com.iyae.service.PromotionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/promotions")
@RequiredArgsConstructor
public class PromotionController {

    private final PromotionService promotionService;

    @GetMapping("/featured")
    public ResponseEntity<List<PromotionResponse>> getFeatured() {
        return ResponseEntity.ok(promotionService.getFeatured());
    }

    @GetMapping
    public ResponseEntity<List<PromotionResponse>> getDesignerPromotions(Authentication authentication) {
        return ResponseEntity.ok(promotionService.getDesignerPromotions(authentication.getName()));
    }

    @PostMapping
    public ResponseEntity<PromotionResponse> createPromotion(
            @Valid @RequestBody PromotionRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(promotionService.createPromotion(authentication.getName(), request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<PromotionResponse> updatePromotion(
            @PathVariable Long id,
            @Valid @RequestBody UpdatePromotionRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(promotionService.updatePromotion(authentication.getName(), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePromotion(
            @PathVariable Long id,
            Authentication authentication
    ) {
        promotionService.deletePromotion(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
