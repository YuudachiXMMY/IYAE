package com.iyae.entity.enums;

/**
 * First-party analytics event kinds for the conversion / return / retention funnel.
 * Persisted as a string (see {@code analytics_events.event_type}).
 */
public enum EventType {
    VIEW,
    ADD_TO_CART,
    CHECKOUT_INITIATED,
    ORDER_PAID,
    ORDER_RETURNED
}
