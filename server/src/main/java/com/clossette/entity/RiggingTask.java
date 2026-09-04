package com.clossette.entity;

import com.clossette.entity.enums.GarmentSlotHint;
import com.clossette.entity.enums.TaskStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "rigging_tasks")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RiggingTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "garment_asset_id", nullable = false)
    private GarmentAsset garmentAsset;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(name = "source_glb_url", length = 500, nullable = false)
    private String sourceGlbUrl;

    @Column(name = "avatar_glb_url", length = 500)
    private String avatarGlbUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "slot_hint", nullable = false)
    private GarmentSlotHint slotHint;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private TaskStatus status;

    @Column(name = "provider", length = 50)
    private String provider;

    @Column(name = "input_payload", columnDefinition = "json")
    private String inputPayload;

    @Column(name = "output_payload", columnDefinition = "json")
    private String outputPayload;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "failure_code", length = 100)
    private String failureCode;

    @Column(name = "attempt_count")
    private Integer attemptCount;

    @Column(name = "claimed_at")
    private Instant claimedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
