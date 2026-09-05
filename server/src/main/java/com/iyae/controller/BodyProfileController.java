package com.iyae.controller;

import com.iyae.dto.BodyProfileRequest;
import com.iyae.dto.BodyProfileResponse;
import com.iyae.service.BodyProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/body-profile")
@RequiredArgsConstructor
public class BodyProfileController {

    private final BodyProfileService bodyProfileService;

    @GetMapping
    public ResponseEntity<BodyProfileResponse> getProfile(Authentication authentication) {
        try {
            return ResponseEntity.ok(bodyProfileService.getProfile(authentication.getName()));
        } catch (IllegalArgumentException e) {
            if (e.getMessage() != null && e.getMessage().contains("Body profile not found")) {
                return ResponseEntity.notFound().build();
            }
            throw e;
        }
    }

    @PostMapping
    public ResponseEntity<BodyProfileResponse> upsertProfile(
            @Valid @RequestBody BodyProfileRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(bodyProfileService.upsertProfile(authentication.getName(), request));
    }
}
