package com.iyae.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * Sticky (deterministic, one-per-user) experiment cohort assignment so KPIs remain
 * reproducible across restarts. See {@code cohort_assignments} (unique on user_id).
 */
@Entity
@Table(name = "cohort_assignments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CohortAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false, unique = true)
    private Long userId;

    @Column(name = "cohort", nullable = false, length = 64)
    private String cohort;

    @CreationTimestamp
    @Column(name = "assigned_at", nullable = false, updatable = false)
    private Instant assignedAt;
}
