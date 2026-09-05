package com.iyae.dto;

import java.util.List;

/**
 * Recommended size for a product given the authenticated user's body profile.
 *
 * @param recommendedSize the suggested size, or {@code null} when no recommendation is possible
 * @param basis           how the recommendation was derived: {@code MEASUREMENT_CHART},
 *                        {@code SELF_REPORTED}, or {@code NONE}
 * @param confidence      normalized confidence in [0.0, 1.0]
 * @param availableSizes  the product's available sizes
 */
public record SizeRecommendationResponse(
        String recommendedSize,
        String basis,
        double confidence,
        List<String> availableSizes
) {}
