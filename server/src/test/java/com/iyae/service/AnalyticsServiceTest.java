package com.iyae.service;

import com.iyae.config.AnalyticsProperties;
import com.iyae.dto.KpiSummaryResponse;
import com.iyae.entity.AnalyticsEvent;
import com.iyae.entity.CohortAssignment;
import com.iyae.entity.enums.EventType;
import com.iyae.repository.AnalyticsEventRepository;
import com.iyae.repository.CohortAssignmentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnalyticsServiceTest {

    @Mock
    AnalyticsEventRepository eventRepository;

    @Mock
    CohortAssignmentRepository cohortRepository;

    private AnalyticsService service(boolean enabled) {
        return new AnalyticsService(eventRepository, cohortRepository,
                new AnalyticsProperties(enabled, List.of("control", "variant")));
    }

    @Test
    void assignCohort_isDeterministic_forSameUser() {
        AnalyticsService service = service(true);
        when(cohortRepository.findByUserId(42L)).thenReturn(Optional.empty());
        when(cohortRepository.save(any(CohortAssignment.class))).thenAnswer(inv -> inv.getArgument(0));

        String first = service.assignCohort(42L);
        String second = service.assignCohort(42L);

        assertThat(first).isIn("control", "variant");
        assertThat(second).isEqualTo(first);
    }

    @Test
    void assignCohort_idempotent_reusesExistingAssignment() {
        AnalyticsService service = service(true);
        when(cohortRepository.findByUserId(7L)).thenReturn(Optional.of(
                CohortAssignment.builder().userId(7L).cohort("variant").build()));

        String cohort = service.assignCohort(7L);

        assertThat(cohort).isEqualTo("variant");
        verify(cohortRepository, never()).save(any());
    }

    @Test
    void assignCohort_nullUser_returnsNull() {
        assertThat(service(true).assignCohort(null)).isNull();
    }

    @Test
    void record_disabled_isNoOp() {
        service(false).record(1L, EventType.VIEW, null, null, null, null);
        verifyNoInteractions(eventRepository);
    }

    @Test
    void record_persistsEventStampedWithCohort() {
        AnalyticsService service = service(true);
        when(cohortRepository.findByUserId(2L)).thenReturn(Optional.empty());
        when(cohortRepository.save(any(CohortAssignment.class))).thenAnswer(inv -> inv.getArgument(0));

        service.record(2L, EventType.ORDER_PAID, null, 99L, "M", null);

        verify(eventRepository).save(argThat((AnalyticsEvent e) ->
                e.getUserId().equals(2L)
                        && e.getEventType() == EventType.ORDER_PAID
                        && e.getOrderId().equals(99L)
                        && "M".equals(e.getSizeBracket())
                        && e.getCohort() != null));
    }

    @Test
    void record_repoFailure_isSwallowed() {
        AnalyticsService service = service(true);
        when(cohortRepository.findByUserId(3L)).thenReturn(Optional.of(
                CohortAssignment.builder().userId(3L).cohort("control").build()));
        when(eventRepository.save(any(AnalyticsEvent.class))).thenThrow(new RuntimeException("db down"));

        // Must not throw into the caller (checkout must not break because analytics did).
        service.record(3L, EventType.CHECKOUT_INITIATED, null, 1L, null, null);
    }

    @Test
    void kpisByCohort_computesConversionRate() {
        AnalyticsService service = service(true);
        when(eventRepository.countByCohortAndEventType()).thenReturn(List.of(
                new Object[]{"control", EventType.TRYON_STARTED, 4L},
                new Object[]{"control", EventType.CHECKOUT_INITIATED, 2L},
                new Object[]{"control", EventType.ORDER_PAID, 1L}));
        when(eventRepository.countPaidBySizeBracket()).thenReturn(List.of());

        KpiSummaryResponse summary = service.kpisByCohort();

        KpiSummaryResponse.CohortKpi control = summary.cohorts().stream()
                .filter(c -> c.cohort().equals("control")).findFirst().orElseThrow();
        assertThat(control.tryOnStarted()).isEqualTo(4L);
        assertThat(control.checkoutInitiated()).isEqualTo(2L);
        assertThat(control.ordersPaid()).isEqualTo(1L);
        assertThat(control.conversionRate()).isEqualTo(0.5);
        // Configured cohort with no events still appears with zeroed metrics.
        assertThat(summary.cohorts()).anyMatch(c ->
                c.cohort().equals("variant") && c.tryOnStarted() == 0L && c.checkoutInitiated() == 0L);
    }
}
