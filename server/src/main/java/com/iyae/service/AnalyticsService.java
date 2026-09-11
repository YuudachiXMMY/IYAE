package com.iyae.service;

import com.iyae.config.AnalyticsProperties;
import com.iyae.dto.DrapeDecisionResponse;
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

import java.time.Instant;
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
            long tryOnStarted = counts.getOrDefault(EventType.TRYON_STARTED, 0L);
            long addToCart = counts.getOrDefault(EventType.ADD_TO_CART, 0L);
            long initiated = counts.getOrDefault(EventType.CHECKOUT_INITIATED, 0L);
            long paid = counts.getOrDefault(EventType.ORDER_PAID, 0L);
            long returned = counts.getOrDefault(EventType.ORDER_RETURNED, 0L);
            double conversion = initiated > 0 ? (double) paid / initiated : 0.0;
            double returnRate = paid > 0 ? (double) returned / paid : 0.0;
            cohortKpis.add(new KpiSummaryResponse.CohortKpi(
                    e.getKey(), views, tryOnStarted, addToCart, initiated, paid, returned, conversion, returnRate));
        }

        List<KpiSummaryResponse.SizeBracketKpi> sizeKpis = new ArrayList<>();
        for (Object[] row : eventRepository.countPaidBySizeBracket()) {
            sizeKpis.add(new KpiSummaryResponse.SizeBracketKpi(
                    (String) row[0], (String) row[1], ((Number) row[2]).longValue()));
        }

        return new KpiSummaryResponse(cohortKpis, sizeKpis);
    }

    /** PRD 主指标目标:试穿→加购相对提升 ≥ +10%。 */
    private static final double TARGET_RELATIVE_LIFT = 0.10;

    /**
     * Phase 4 前后对比决策门:以 {@code cutoff} 切分 analytics_events,比较部署前 vs 部署后的
     * 试穿→加购(TRYON_STARTED→ADD_TO_CART)聚合转化率、lift 与两比例 z 检验显著性,产出
     * INVEST/STOP/INCONCLUSIVE 方向建议。守卫比率(分母为 0 时返回 0.0),绝不除零/抛异常。
     */
    @Transactional(readOnly = true)
    public DrapeDecisionResponse drapeDecision(Instant cutoff) {
        long tryBefore = eventRepository.countByEventTypeAndCreatedAtBefore(EventType.TRYON_STARTED, cutoff);
        long cartBefore = eventRepository.countByEventTypeAndCreatedAtBefore(EventType.ADD_TO_CART, cutoff);
        long tryAfter = eventRepository.countByEventTypeAndCreatedAtGreaterThanEqual(EventType.TRYON_STARTED, cutoff);
        long cartAfter = eventRepository.countByEventTypeAndCreatedAtGreaterThanEqual(EventType.ADD_TO_CART, cutoff);

        double rateBefore = tryBefore > 0 ? (double) cartBefore / tryBefore : 0.0;
        double rateAfter = tryAfter > 0 ? (double) cartAfter / tryAfter : 0.0;
        double absLift = rateAfter - rateBefore;
        double relLift = rateBefore > 0 ? (rateAfter - rateBefore) / rateBefore : 0.0;

        double z = twoProportionZ(cartBefore, tryBefore, cartAfter, tryAfter);
        double p = Double.isNaN(z) ? 1.0 : 2.0 * (1.0 - normalCdf(Math.abs(z)));
        boolean significant = p < 0.05;

        String rec;
        if (tryBefore == 0 || tryAfter == 0) {
            rec = "INCONCLUSIVE";           // 任一窗口无试穿样本
        } else if (significant && relLift >= TARGET_RELATIVE_LIFT) {
            rec = "INVEST";
        } else if (significant && relLift < 0) {
            rec = "STOP";
        } else {
            rec = "INCONCLUSIVE";
        }
        return new DrapeDecisionResponse(cutoff,
                new DrapeDecisionResponse.FunnelWindow(tryBefore, cartBefore, rateBefore),
                new DrapeDecisionResponse.FunnelWindow(tryAfter, cartAfter, rateAfter),
                absLift, relLift, z, p, significant, rec);
    }

    /** 两比例 z 检验(pooled)。分母为 0 或退化(SE=0)时返回 NaN(上游按 p=1 处理)。 */
    private static double twoProportionZ(long x1, long n1, long x2, long n2) {
        if (n1 <= 0 || n2 <= 0) {
            return Double.NaN;
        }
        double p1 = clamp01((double) x1 / n1);
        double p2 = clamp01((double) x2 / n2);
        double pooled = clamp01((double) (x1 + x2) / (n1 + n2));
        double se = Math.sqrt(pooled * (1 - pooled) * (1.0 / n1 + 1.0 / n2));
        if (se == 0.0) {
            return Double.NaN;
        }
        return (p2 - p1) / se;
    }

    private static double clamp01(double v) {
        return v < 0 ? 0 : (v > 1 ? 1 : v);
    }

    /** 标准正态 CDF,Abramowitz & Stegun 7.1.26 erf 逼近(零依赖)。 */
    private static double normalCdf(double z) {
        return 0.5 * (1.0 + erf(z / Math.sqrt(2.0)));
    }

    private static double erf(double x) {
        double t = 1.0 / (1.0 + 0.3275911 * Math.abs(x));
        double y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
                - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
        return x >= 0 ? y : -y;
    }
}
