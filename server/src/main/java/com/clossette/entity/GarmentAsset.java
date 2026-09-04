package com.clossette.entity;

import com.clossette.entity.enums.GarmentSlotHint;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "garment_assets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GarmentAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "glb_url", length = 500)
    private String glbUrl;

    @Column(name = "usdz_url", length = 500)
    private String usdzUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "slot_hint")
    private GarmentSlotHint slotHint;

    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "rigged_glb_url", length = 500)
    private String riggedGlbUrl;

    @Column(name = "rigging_status", length = 50)
    private String riggingStatus;

    @Column(name = "rigging_error_message", columnDefinition = "TEXT")
    private String riggingErrorMessage;

    @Column(name = "rigging_failure_code", length = 100)
    private String riggingFailureCode;

    @Column(name = "rigged_at")
    private Instant riggedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
