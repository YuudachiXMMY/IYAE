package com.iyae.controller;

import com.iyae.dto.CreateResaleListingRequest;
import com.iyae.dto.PagedResponse;
import com.iyae.dto.ResaleEligibleItemResponse;
import com.iyae.dto.ResaleListingResponse;
import com.iyae.dto.UpdateResaleListingRequest;
import com.iyae.service.CheckoutService;
import com.iyae.service.ResaleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/resale")
@RequiredArgsConstructor
public class ResaleController {

    private final ResaleService resaleService;
    private final CheckoutService checkoutService;

    // ---- Public browse (GET /api/resale/listings** is permitAll in SecurityConfig) ----

    @GetMapping("/listings")
    public ResponseEntity<PagedResponse<ResaleListingResponse>> browse(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category
    ) {
        return ResponseEntity.ok(resaleService.browse(page, size, q, category));
    }

    @GetMapping("/listings/{id}")
    public ResponseEntity<ResaleListingResponse> getListing(@PathVariable Long id) {
        return ResponseEntity.ok(resaleService.getListing(id));
    }

    // ---- Authenticated ----

    @GetMapping("/eligible-items")
    public ResponseEntity<List<ResaleEligibleItemResponse>> eligibleItems(Authentication authentication) {
        return ResponseEntity.ok(resaleService.listEligibleItems(authentication.getName()));
    }

    @GetMapping("/my-listings")
    public ResponseEntity<List<ResaleListingResponse>> myListings(Authentication authentication) {
        return ResponseEntity.ok(resaleService.getMyListings(authentication.getName()));
    }

    @PostMapping("/listings")
    public ResponseEntity<ResaleListingResponse> create(
            @Valid @RequestBody CreateResaleListingRequest request,
            Authentication authentication
    ) {
        ResaleListingResponse response = resaleService.createListing(authentication.getName(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/listings/{id}")
    public ResponseEntity<ResaleListingResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateResaleListingRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(resaleService.updateListing(authentication.getName(), id, request));
    }

    @DeleteMapping("/listings/{id}")
    public ResponseEntity<Void> remove(@PathVariable Long id, Authentication authentication) {
        resaleService.removeListing(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/listings/{id}/checkout")
    public ResponseEntity<Map<String, String>> checkout(@PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(checkoutService.initiateResaleCheckout(authentication.getName(), id));
    }
}
