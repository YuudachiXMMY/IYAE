package com.iyae.entity.enums;

/**
 * Lifecycle of a peer-to-peer resale listing (Phase 7).
 * {@code RESERVED} is an internal transient (mirrors {@link TaskStatus#MATERIALIZED}): a listing is
 * moved LISTED-&gt;RESERVED for the duration of a checkout so a unique second-hand unit cannot be
 * sold twice, then RESERVED-&gt;SOLD on payment, or released back to LISTED if the checkout is abandoned.
 */
public enum ResaleStatus {
    DRAFT, LISTED, RESERVED, SOLD, REMOVED
}
