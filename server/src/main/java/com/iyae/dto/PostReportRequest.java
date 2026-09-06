package com.iyae.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** User-submitted abuse report for a community post. */
public record PostReportRequest(
    @NotBlank @Size(max = 500) String reason
) {}
