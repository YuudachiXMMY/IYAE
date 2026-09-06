package com.iyae.service;

import com.iyae.config.AnalyticsProperties;
import com.iyae.dto.KpiSummaryResponse;
import com.iyae.entity.AnalyticsEvent;
import com.iyae.entity.CohortAssignment;
import com.iyae.entity.enums.EventType;
import com.iyae.repository.AnalyticsEventRepository;
import com.iyae.repository.CohortAssignmentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Records first-party analytics events and assigns each user to a deterministic experiment
 * cohort, so conversion / return / retention / size-bracket KPIs are queryable by cohort.
 *
 * <p>Recording is <b>best-effort</b>: every write is wrapped so a failure never propagates into
 * the caller (checkout must not break because analytics did). Cohort assignment is deterministic
 * (a hash of the user id) so the same user always lands in the same cohort across restarts.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AnalyticsService {

    private final AnalyticsEventRepository eventRepository;
    private final CohortAssignmentRepository cohortRepository;
    private final AnalyticsProperties properties;

    /** Deterministic, sticky cohort for a user; assigns + persists once, then returns the stored value. */
    @Transactional
    public String assignCohort(Long userId) {
        if (userId == null) {
            return null;
        }
        return cohortRepository.findByUserId(userId)
                .map(CohortAssignment::getCohort)
                .orElseGet(() -> persistCohort(userId, computeCohort(userId)));
    }

    private String computeCohort(Long userId) {
        List<String> cohorts = properties.cohorts();
        int idx = Math.floorMod(Long.hashCode(userId), cohorts.size());
        return cohorts.get(idx);
    }

    private String persistCohort(Long userId, String cohort) {
        try {
            cohortRepository.save(CohortAssignment.builder().userId(userId).cohort(cohort).build());
            return cohort;
        } catch (DataIntegrityViolationException raced) {
            // Concurrent assignment for the same user — re-read the winning row.
            return cohortRepository.findByUserId(userId).map(CohortAssignment::getCohort).orElse(cohort);
        }
    }

    /**
     * Records an event for a (possibly null) user. Best-effort: never throws into the caller.
     * The user's cohort is resolved (and assigned if needed) and stamped onto the event.
     */
    @Transactional
    public void record(Long userId, EventType type, Long productId, Long orderId,
                       String sizeBracket, String metadata) {
        if (!properties.enabled()) {
            return;
        }
        try {
            String cohort = userId != null ? assignCohort(userId) : null;
            eventRepository.save(AnalyticsEvent.builder()
                    .userId(userId)
                    .cohort(cohort)
                    .eventType(type)
                    .productId(productId)
                    .orderId(orderId)
                    .sizeBracket(sizeBracket)
                    .metadata(metadata)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to record analytics event {} for user {} (swallowed)", type, userId, e);
        }
    }

    /** Aggregate KPIs sliced by cohort. */
    @Transactional(readOnly = true)
    public KpiSummaryResponse kpisByCohort() {
        Map<String, EnumMap<EventType, Long>> byCohort = new LinkedHashMap<>();
        // Seed configured cohorts so a cohort with zero events still appears.
        for (String cohort : properties.cohorts()) {
            byCohort.put(cohort, new EnumMap<>(EventType.class));
        }
        for (Object[] row : eventRepository.countByCohortAndEventType()) {
            String cohort = (String) row[0];
            EventType type = (EventType) row[1];
            long count = ((Number) row[2]).longValue();
            byCohort.computeIfAbsent(cohort, c -> new EnumMap<>(EventType.class)).put(type, count);
        }

        List<KpiSummaryResponse.CohortKpi> cohortKpis = new ArrayList<>();
        for (Map.Entry<String, EnumMap<EventType, Long>> e : byCohort.entrySet()) {
            EnumMap<EventType, Long> counts = e.getValue();
            long views = counts.getOrDefault(EventType.VIEW, 0L);
            long addToCart = counts.getOrDefault(EventType.ADD_TO_CART, 0L);
            long initiated = counts.getOrDefault(EventType.CHECKOUT_INITIATED, 0L);
            long paid = counts.getOrDefault(EventType.ORDER_PAID, 0L);
            long returned = counts.getOrDefault(EventType.ORDER_RETURNED, 0L);
            double conversion = initiated > 0 ? (double) paid / initiated : 0.0;
            double returnRate = paid > 0 ? (double) returned / paid : 0.0;
            cohortKpis.add(new KpiSummaryResponse.CohortKpi(
                    e.getKey(), views, addToCart, initiated, paid, returned, conversion, returnRate));
        }

        List<KpiSummaryResponse.SizeBracketKpi> sizeKpis = new ArrayList<>();
        for (Object[] row : eventRepository.countPaidBySizeBracket()) {
            sizeKpis.add(new KpiSummaryResponse.SizeBracketKpi(
                    (String) row[0], (String) row[1], ((Number) row[2]).longValue()));
        }

        return new KpiSummaryResponse(cohortKpis, sizeKpis);
    }
}
