package com.iyae.dto;

import com.iyae.entity.enums.ResaleCondition;
import com.iyae.entity.enums.ResaleStatus;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

/** Partial update — all fields nullable ("no change"). {@code status} may only be LISTED or REMOVED. */
public record UpdateResaleListingRequest(
        @DecimalMin(value = "0.01", message = "askingPrice must be at least 0.01")
        BigDecimal askingPrice,

        ResaleCondition condition,

        @Size(max = 2000, message = "sellerNote must not exceed 2000 characters")
        String sellerNote,

        List<String> media,

        ResaleStatus status
) {}
