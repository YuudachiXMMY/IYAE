package com.iyae.dto;

import java.time.Instant;
import java.util.List;

public record OutfitResponse(
    Long id,
    List<OutfitSlotResponse> items,
    String explanation,
    Instant createdAt
) {}
