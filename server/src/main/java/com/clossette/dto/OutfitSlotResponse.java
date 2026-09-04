package com.clossette.dto;

import java.math.BigDecimal;
import java.util.List;

public record OutfitSlotResponse(
    String slot,
    Long productId,
    String productName,
    BigDecimal productPrice,
    String category,
    List<String> media,
    String glbUrl,
    boolean sponsored,
    double score,
    String glbAssetUrl,
    String usdzUrl,
    String riggedGlbUrl  // rigged garment GLB URL
) {}
