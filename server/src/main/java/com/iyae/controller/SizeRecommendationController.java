package com.iyae.controller;

import com.iyae.dto.SizeRecommendationResponse;
import com.iyae.service.SizeRecommendationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class SizeRecommendationController {

    private final SizeRecommendationService sizeRecommendationService;

    @GetMapping("/{id}/recommended-size")
    public ResponseEntity<SizeRecommendationResponse> getRecommendedSize(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(
                sizeRecommendationService.recommend(id, authentication.getName()));
    }
}
