package com.clossette.controller;

import com.clossette.dto.RiggingStatusResponse;
import com.clossette.service.RiggingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/designer/products")
@RequiredArgsConstructor
public class RiggingController {

    private final RiggingService riggingService;

    @PostMapping("/{id}/rigging")
    public ResponseEntity<RiggingStatusResponse> requestRigging(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(riggingService.requestRigging(id, authentication.getName()));
    }

    @GetMapping("/{id}/rigging-status")
    public ResponseEntity<RiggingStatusResponse> getStatus(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(riggingService.getStatus(id, authentication.getName()));
    }

    @PostMapping("/{id}/rigging-status/retry")
    public ResponseEntity<RiggingStatusResponse> retry(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(riggingService.retry(id, authentication.getName()));
    }
}
