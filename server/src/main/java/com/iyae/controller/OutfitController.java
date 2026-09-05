package com.iyae.controller;

import com.iyae.dto.GenerateOutfitRequest;
import com.iyae.dto.ManualOutfitRequest;
import com.iyae.dto.OutfitResponse;
import com.iyae.service.OutfitService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/outfits")
@RequiredArgsConstructor
public class OutfitController {

    private final OutfitService outfitService;

    @PostMapping("/generate")
    public ResponseEntity<OutfitResponse> generate(
        @RequestBody GenerateOutfitRequest request,
        Authentication authentication
    ) {
        OutfitResponse response = outfitService.generateOutfit(request, authentication.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/manual")
    public ResponseEntity<OutfitResponse> createManual(
        @RequestBody ManualOutfitRequest request,
        Authentication authentication
    ) {
        OutfitResponse response = outfitService.createManualOutfit(request, authentication.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<List<OutfitResponse>> list(Authentication authentication) {
        List<OutfitResponse> outfits = outfitService.listOutfits(authentication.getName());
        return ResponseEntity.ok(outfits);
    }

    @GetMapping("/{id}")
    public ResponseEntity<OutfitResponse> get(
        @PathVariable Long id,
        Authentication authentication
    ) {
        OutfitResponse outfit = outfitService.getOutfit(id, authentication.getName());
        return ResponseEntity.ok(outfit);
    }
}
