package com.iyae.dto;

import com.iyae.entity.enums.FulfillmentMethod;
import com.iyae.entity.enums.ShippingCarrier;
import jakarta.validation.constraints.NotNull;

/**
 * Optional body for {@code POST /api/checkout} (Phase 8). Only {@code fulfillmentMethod} is
 * structurally required; the cross-field rules (carrier iff SHIP, pickupLocationId iff PICKUP) are
 * enforced in {@link com.iyae.service.FulfillmentService#resolve}. A null request body defaults to
 * SHIP + the default carrier (backward-compatible with the previous no-body checkout call).
 */
public record CheckoutRequest(
        @NotNull(message = "fulfillmentMethod is required")
        FulfillmentMethod fulfillmentMethod,

        Long pickupLocationId,          // required iff PICKUP

        ShippingCarrier shippingCarrier // required iff SHIP
) {}
