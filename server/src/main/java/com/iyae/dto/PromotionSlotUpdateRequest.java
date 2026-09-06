package com.iyae.dto;

import com.iyae.entity.enums.SlotType;
import jakarta.validation.constraints.NotNull;

/** Admin request to feature/unfeature a promotion by forcing its slot type. */
public record PromotionSlotUpdateRequest(
        @NotNull(message = "Slot type is required") SlotType slotType
) {}
