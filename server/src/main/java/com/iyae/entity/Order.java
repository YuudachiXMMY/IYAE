package com.iyae.entity;

import com.iyae.entity.enums.FulfillmentMethod;
import com.iyae.entity.enums.OrderStatus;
import com.iyae.entity.enums.ShippingCarrier;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private OrderStatus status;

    @Column(name = "total_amount", precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "items_snapshot", columnDefinition = "json")
    private String itemsSnapshot;

    @Column(name = "stripe_session_id")
    private String stripeSessionId;

    @Column(name = "stripe_payment_intent")
    private String stripePaymentIntent;

    @Column(name = "payment_status", nullable = false)
    @Builder.Default
    private String paymentStatus = "PENDING";

    /** Set for a resale (pre-loved) purchase order; links to the resale_listings row (Phase 7). */
    @Column(name = "resale_listing_id")
    private Long resaleListingId;

    /** Phase 8 — how the buyer receives this order: SHIP via a carrier, or PICKUP at a Toronto location. */
    @Enumerated(EnumType.STRING)
    @Column(name = "fulfillment_method", nullable = false)
    @Builder.Default
    private FulfillmentMethod fulfillmentMethod = FulfillmentMethod.SHIP;

    @Column(name = "pickup_location_id")
    private Long pickupLocationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "shipping_carrier")
    private ShippingCarrier shippingCarrier;

    @Column(name = "shipping_fee", precision = 10, scale = 2, nullable = false)
    @Builder.Default
    private BigDecimal shippingFee = BigDecimal.ZERO;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
