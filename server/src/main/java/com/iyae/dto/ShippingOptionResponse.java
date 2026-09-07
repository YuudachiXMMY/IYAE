package com.iyae.dto;

import java.math.BigDecimal;

/**
 * A carrier option shown in the checkout selector (Phase 8). {@code carrier} is the enum name
 * (sent back in {@link CheckoutRequest}); {@code displayName} + {@code fee} are for display.
 */
public record ShippingOptionResponse(
        String carrier,
        String displayName,
        BigDecimal fee
) {}
