package com.iyae.entity.enums;

import java.math.BigDecimal;

/**
 * Shipping carriers offered at checkout. Intentionally multi-carrier — the marketplace is
 * never Canada-Post-only (strike-resilience). Flat CAD rates for lightweight v1 (no live quotes).
 */
public enum ShippingCarrier {
    UPS("UPS", "12.99"),
    PUROLATOR("Purolator", "10.99"),
    FEDEX("FedEx", "14.99"),
    CANADA_POST("Canada Post", "9.99");

    private final String displayName;
    private final BigDecimal flatFee;

    ShippingCarrier(String displayName, String flatFee) {
        this.displayName = displayName;
        this.flatFee = new BigDecimal(flatFee);
    }

    public String getDisplayName() {
        return displayName;
    }

    public BigDecimal getFlatFee() {
        return flatFee;
    }
}
