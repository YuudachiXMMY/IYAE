package com.iyae.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * One shopper's wishlist entry for one catalogue product.
 *
 * <p>Set membership rather than a mutable record: there is nothing to edit, so
 * unlike {@link SavedLook} there is no {@code note} and no {@code updatedAt}.
 * The {@code (user_id, product_id)} unique key in V21 is what makes a repeated
 * save idempotent.
 */
@Entity
@Table(
        name = "saved_products",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_saved_products_user_product",
                columnNames = {"user_id", "product_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SavedProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
