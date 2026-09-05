package com.iyae.dto;

import java.util.List;

public record GenerateOutfitRequest(
    String event,
    String style,
    List<String> colorPalette,
    List<Long> seedProductIds
) {}
