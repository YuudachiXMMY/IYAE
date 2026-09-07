package com.iyae.controller;

import com.iyae.dto.PickupLocationResponse;
import com.iyae.dto.ShippingOptionResponse;
import com.iyae.service.FulfillmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Public reference reads for the checkout fulfillment selector (Phase 8). GET-only, permitAll. */
@RestController
@RequestMapping("/api/fulfillment")
@RequiredArgsConstructor
public class FulfillmentController {

    private final FulfillmentService fulfillmentService;

    @GetMapping("/pickup-locations")
    public ResponseEntity<List<PickupLocationResponse>> pickupLocations() {
        return ResponseEntity.ok(fulfillmentService.listActivePickupLocations());
    }

    @GetMapping("/shipping-options")
    public ResponseEntity<List<ShippingOptionResponse>> shippingOptions() {
        return ResponseEntity.ok(fulfillmentService.listShippingOptions());
    }
}
