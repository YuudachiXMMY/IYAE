package com.clossette.dto;

import jakarta.validation.constraints.Size;

public record SavedLookRequest(
        Long recommendationId,

        @Size(max = 1000, message = "Note must be at most 1000 characters")
        String note
) {}
