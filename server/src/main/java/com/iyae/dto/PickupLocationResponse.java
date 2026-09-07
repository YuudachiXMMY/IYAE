package com.iyae.dto;

import com.iyae.entity.PickupLocation;

/** Public pickup-location option shown in the checkout selector (Phase 8). */
public record PickupLocationResponse(
        Long id,
        String name,
        String addressLine,
        String city,
        String instructions
) {
    public static PickupLocationResponse from(PickupLocation loc) {
        return new PickupLocationResponse(
                loc.getId(),
                loc.getName(),
                loc.getAddressLine(),
                loc.getCity(),
                loc.getInstructions());
    }
}
