package com.iyae.dto;

public record ReviewSummaryResponse(
        double averageRating,
        long reviewCount
) {}
