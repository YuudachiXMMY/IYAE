package com.iyae.dto;

import java.util.List;

/** An item the caller has purchased (and not yet actively listed) that they may resell. */
public record ResaleEligibleItemResponse(
        Long productId,
        String productName,
        String sizeLabel,
        List<String> productMedia,
        Long orderId
) {}
