package com.clossette.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "body_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BodyProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "height_cm")
    private Double heightCm;

    @Column(name = "weight_kg")
    private Double weightKg;

    @Column(name = "chest_cm")
    private Double chestCm;

    @Column(name = "waist_cm")
    private Double waistCm;

    @Column(name = "hips_cm")
    private Double hipsCm;

    @Column(name = "shoulder_width_cm")
    private Double shoulderWidthCm;

    @Column(name = "inseam_cm")
    private Double inseamCm;

    @Column(name = "shoe_size", length = 20)
    private String shoeSize;

    @Column(name = "top_size", length = 20)
    private String topSize;

    @Column(name = "bottom_size", length = 20)
    private String bottomSize;

    @Column(name = "dress_size", length = 20)
    private String dressSize;

    @Column(name = "jacket_size", length = 20)
    private String jacketSize;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
