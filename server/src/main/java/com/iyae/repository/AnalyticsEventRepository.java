package com.iyae.repository;

import com.iyae.entity.AnalyticsEvent;
import com.iyae.entity.enums.EventType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AnalyticsEventRepository extends JpaRepository<AnalyticsEvent, Long> {

    long countByEventType(EventType eventType);

    /**
     * Per-cohort event-type counts: rows of {@code [cohort, eventType, count]}.
     * Powers conversion / return / retention aggregates in {@code AnalyticsService}.
     */
    @Query("SELECT e.cohort, e.eventType, COUNT(e) FROM AnalyticsEvent e "
            + "WHERE e.cohort IS NOT NULL GROUP BY e.cohort, e.eventType")
    List<Object[]> countByCohortAndEventType();

    /**
     * Per-cohort size-bracket counts for paid orders: rows of {@code [cohort, sizeBracket, count]}.
     */
    @Query("SELECT e.cohort, e.sizeBracket, COUNT(e) FROM AnalyticsEvent e "
            + "WHERE e.eventType = com.iyae.entity.enums.EventType.ORDER_PAID "
            + "AND e.cohort IS NOT NULL AND e.sizeBracket IS NOT NULL "
            + "GROUP BY e.cohort, e.sizeBracket")
    List<Object[]> countPaidBySizeBracket();
}
