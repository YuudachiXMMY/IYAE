package com.iyae.entity;

import com.iyae.entity.enums.EventType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * A single first-party analytics event, stamped with the actor's experiment cohort so
 * conversion / return / retention / size-bracket KPIs are queryable {@code GROUP BY cohort}.
 * {@code userId}/{@code cohort} are nullable to allow anonymous events.
 */
@Entity
@Table(name = "analytics_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnalyticsEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "cohort", length = 64)
    private String cohort;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 32)
    private EventType eventType;

    @Column(name = "product_id")
    private Long productId;

    @Column(name = "order_id")
    private Long orderId;

    @Column(name = "size_bracket", length = 16)
    private String sizeBracket;

    @Column(name = "metadata", columnDefinition = "json")
    private String metadata;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
