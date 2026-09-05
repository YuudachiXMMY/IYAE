package com.iyae.controller;

import com.iyae.dto.GenerationStatusResponse;
import com.iyae.service.GenerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/designer/products")
@RequiredArgsConstructor
public class GenerationStatusController {

    private final GenerationService generationService;

    @GetMapping("/{id}/generation-status")
    public ResponseEntity<GenerationStatusResponse> getStatus(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(generationService.getStatus(id, authentication.getName()));
    }

    @PostMapping("/{id}/regenerate")
    public ResponseEntity<GenerationStatusResponse> regenerate(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(generationService.regenerate(id, authentication.getName()));
    }

    @PostMapping("/{id}/generation-status/retry")
    public ResponseEntity<GenerationStatusResponse> retry(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(generationService.retry(id, authentication.getName()));
    }
}
