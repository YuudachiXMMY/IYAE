package com.iyae.entity.enums;

/**
 * How a recommended size was derived. Serialized to its {@code name()} in the
 * {@code SizeRecommendationResponse.basis} JSON field.
 */
public enum SizeRecommendationBasis {
    /** Nearest entry in the product's measurement size chart. */
    MEASUREMENT_CHART,
    /** User's self-reported size for the product's category. */
    SELF_REPORTED,
    /** No recommendation possible (no profile / no comparable data). */
    NONE
}
