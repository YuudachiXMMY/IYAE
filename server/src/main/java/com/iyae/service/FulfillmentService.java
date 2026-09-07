package com.iyae.service;

import com.iyae.dto.CheckoutRequest;
import com.iyae.dto.PickupLocationResponse;
import com.iyae.dto.ShippingOptionResponse;
import com.iyae.entity.PickupLocation;
import com.iyae.entity.enums.FulfillmentMethod;
import com.iyae.entity.enums.ShippingCarrier;
import com.iyae.repository.PickupLocationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

/**
 * Resolves + validates a buyer's checkout fulfillment choice (Phase 8). Owns pickup-location /
 * carrier reference reads and SHIP-vs-PICKUP validation. One-way: must NOT depend on CheckoutService
 * (mirrors the ResaleService/CheckoutService separation).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FulfillmentService {

    /** Default carrier when the checkout body is absent — first non-Canada-Post (strike-resilient). */
    static final ShippingCarrier DEFAULT_CARRIER = ShippingCarrier.PUROLATOR;

    private final PickupLocationRepository pickupLocationRepository;

    @Transactional(readOnly = true)
    public List<PickupLocationResponse> listActivePickupLocations() {
        return pickupLocationRepository.findByActiveTrueOrderByIdAsc().stream()
                .map(PickupLocationResponse::from)
                .toList();
    }

    public List<ShippingOptionResponse> listShippingOptions() {
        return Arrays.stream(ShippingCarrier.values())
                .map(c -> new ShippingOptionResponse(c.name(), c.getDisplayName(), c.getFlatFee()))
                .toList();
    }

    /** Immutable resolved fulfillment handed to CheckoutService (fee already computed). */
    public record ResolvedFulfillment(FulfillmentMethod method, Long pickupLocationId,
                                      ShippingCarrier carrier, BigDecimal fee) {}

    /**
     * Validate the request and compute the fee. Null body → SHIP + default carrier. SHIP requires a
     * carrier and no pickup location; PICKUP requires an active location and no carrier. Throws
     * IllegalArgumentException (→400) on any violation.
     */
    @Transactional(readOnly = true)
    public ResolvedFulfillment resolve(CheckoutRequest req) {
        if (req == null || req.fulfillmentMethod() == null) {
            return new ResolvedFulfillment(FulfillmentMethod.SHIP, null,
                    DEFAULT_CARRIER, DEFAULT_CARRIER.getFlatFee());
        }
        return switch (req.fulfillmentMethod()) {
            case SHIP -> {
                if (req.shippingCarrier() == null) {
                    throw new IllegalArgumentException("A shipping carrier is required for shipped orders");
                }
                if (req.pickupLocationId() != null) {
                    throw new IllegalArgumentException("A shipped order can't also have a pickup location");
                }
                yield new ResolvedFulfillment(FulfillmentMethod.SHIP, null,
                        req.shippingCarrier(), req.shippingCarrier().getFlatFee());
            }
            case PICKUP -> {
                if (req.pickupLocationId() == null) {
                    throw new IllegalArgumentException("A pickup location is required for pickup orders");
                }
                if (req.shippingCarrier() != null) {
                    throw new IllegalArgumentException("A pickup order can't also have a shipping carrier");
                }
                PickupLocation loc = pickupLocationRepository.findById(req.pickupLocationId())
                        .filter(PickupLocation::isActive)
                        .orElseThrow(() -> new IllegalArgumentException(
                                "Pickup location not available: " + req.pickupLocationId()));
                yield new ResolvedFulfillment(FulfillmentMethod.PICKUP, loc.getId(),
                        null, BigDecimal.ZERO);
            }
        };
    }
}
