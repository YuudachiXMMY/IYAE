package com.iyae.entity.enums;

/**
 * How a buyer receives an order (Phase 8 lightweight v1):
 * {@code SHIP} via a flat-rate {@link ShippingCarrier}, or {@code PICKUP} at a seeded Toronto
 * {@code pickup_locations} row. Recorded on the order; carrier and pickup location are mutually exclusive.
 */
public enum FulfillmentMethod {
    SHIP, PICKUP
}
