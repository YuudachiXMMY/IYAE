package com.iyae.controller;

import com.iyae.dto.SavedLookRequest;
import com.iyae.dto.SavedLookResponse;
import com.iyae.service.SavedLookService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/looks")
@RequiredArgsConstructor
public class SavedLookController {

    private final SavedLookService savedLookService;

    @GetMapping
    public ResponseEntity<List<SavedLookResponse>> getSavedLooks(Authentication authentication) {
        return ResponseEntity.ok(savedLookService.getSavedLooks(authentication.getName()));
    }

    @PostMapping
    public ResponseEntity<SavedLookResponse> saveLook(
            @Valid @RequestBody SavedLookRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(savedLookService.saveLook(authentication.getName(), request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SavedLookResponse> updateNote(
            @PathVariable Long id,
            @Valid @RequestBody SavedLookRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(savedLookService.updateNote(authentication.getName(), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLook(
            @PathVariable Long id,
            Authentication authentication
    ) {
        savedLookService.deleteLook(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
