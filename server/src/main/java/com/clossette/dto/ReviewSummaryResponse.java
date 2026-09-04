package com.clossette.dto;

public record ReviewSummaryResponse(
        double averageRating,
        long reviewCount
) {}
