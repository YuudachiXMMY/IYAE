package com.iyae.entity;

import com.iyae.entity.enums.ResaleCondition;
import com.iyae.entity.enums.ResaleStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "resale_listings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResaleListing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "seller_id", nullable = false)
    private User seller;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /** Provenance: the order the seller bought this item in (kept as a plain id; FK is DB-level). */
    @Column(name = "original_order_id")
    private Long originalOrderId;

    @Column(name = "size_label", nullable = false, length = 32)
    private String sizeLabel;

    @Enumerated(EnumType.STRING)
    @Column(name = "cond", nullable = false, length = 20)
    private ResaleCondition condition;

    @Column(name = "asking_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal askingPrice;

    @Column(name = "currency", length = 3)
    private String currency;

    @Column(name = "seller_note", columnDefinition = "TEXT")
    private String sellerNote;

    @Column(name = "media", columnDefinition = "json")
    private String media;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ResaleStatus status;

    /** Set when a checkout reserves the listing; a scheduled sweep releases stale reservations. */
    @Column(name = "reserved_at")
    private Instant reservedAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
