package com.iyae.dto;

import java.util.Map;

public record ManualOutfitRequest(
    Map<String, Long> slots,
    String note,
    String occasion
) {}
