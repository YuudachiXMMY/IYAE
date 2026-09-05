package com.iyae.dto;

import com.iyae.entity.ProductSizeMeasurement;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Per-size garment measurements (cm). All dimensions optional so designers can supply what they know;
 * the size recommender ignores null dims and requires at least one comparable dimension.
 */
public record SizeMeasurementDto(
        @NotBlank(message = "Size label is required") @Size(max = 32) String sizeLabel,
        @DecimalMin(value = "0.0", message = "Measurement must be non-negative") Double chestCm,
        @DecimalMin(value = "0.0", message = "Measurement must be non-negative") Double waistCm,
        @DecimalMin(value = "0.0", message = "Measurement must be non-negative") Double hipsCm,
        @DecimalMin(value = "0.0", message = "Measurement must be non-negative") Double lengthCm
) {
    public static SizeMeasurementDto from(ProductSizeMeasurement m) {
        return new SizeMeasurementDto(
                m.getSizeLabel(),
                m.getChestCm(),
                m.getWaistCm(),
                m.getHipsCm(),
                m.getLengthCm()
        );
    }
}
