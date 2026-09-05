package com.iyae.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record GuestAvatarRequest(
        @NotNull(message = "Body type is required")
        @Pattern(regexp = "female|male|neutral", message = "Body type must be female, male, or neutral")
        String bodyType,

        @NotNull(message = "Height is required")
        @DecimalMin(value = "50.0", message = "Height must be at least 50 cm")
        @DecimalMax(value = "300.0", message = "Height must be at most 300 cm")
        Double heightCm,

        @NotNull(message = "Weight is required")
        @DecimalMin(value = "20.0", message = "Weight must be at least 20 kg")
        @DecimalMax(value = "500.0", message = "Weight must be at most 500 kg")
        Double weightKg,

        @DecimalMin(value = "50.0", message = "Chest must be at least 50 cm")
        @DecimalMax(value = "200.0", message = "Chest must be at most 200 cm")
        Double chestCm,

        @DecimalMin(value = "40.0", message = "Waist must be at least 40 cm")
        @DecimalMax(value = "200.0", message = "Waist must be at most 200 cm")
        Double waistCm,

        @DecimalMin(value = "50.0", message = "Hips must be at least 50 cm")
        @DecimalMax(value = "200.0", message = "Hips must be at most 200 cm")
        Double hipsCm,

        @DecimalMin(value = "20.0", message = "Shoulder width must be at least 20 cm")
        @DecimalMax(value = "80.0", message = "Shoulder width must be at most 80 cm")
        Double shoulderWidthCm,

        @DecimalMin(value = "40.0", message = "Inseam must be at least 40 cm")
        @DecimalMax(value = "120.0", message = "Inseam must be at most 120 cm")
        Double inseamCm
) {}
