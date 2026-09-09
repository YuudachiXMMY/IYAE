package com.iyae.dto;

import java.util.List;

/**
 * Cohort-sliced KPI summary. Conversion = ordersPaid / checkoutInitiated; return rate =
 * ordersReturned / ordersPaid. Size-bracket rows give paid-order counts per bracket per cohort.
 */
public record KpiSummaryResponse(
    List<CohortKpi> cohorts,
    List<SizeBracketKpi> sizeBrackets
) {
    public record CohortKpi(
        String cohort,
        long views,
        long tryOnStarted,
        long addToCart,
        long checkoutInitiated,
        long ordersPaid,
        long ordersReturned,
        double conversionRate,
        double returnRate
    ) {}

    public record SizeBracketKpi(
        String cohort,
        String sizeBracket,
        long paidCount
    ) {}
}
