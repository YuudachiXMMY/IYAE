package com.iyae.dto;

import java.util.List;

public record GenerateOutfitRequest(
    String event,
    String style,
    List<String> colorPalette,
    String weather,
    String mood,
    List<Long> seedProductIds
) {}
