package com.iyae.entity;

import com.iyae.entity.enums.ProductStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "designer_profile_id", nullable = false)
    private DesignerProfile designerProfile;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "price", nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "currency", length = 3)
    private String currency;

    @Column(name = "category", length = 100)
    private String category;

    @Column(name = "style_tags", columnDefinition = "json")
    private String styleTags;

    @Column(name = "color_tags", columnDefinition = "json")
    private String colorTags;

    @Column(name = "sizes", columnDefinition = "json")
    private String sizes;

    @Column(name = "size_chart", columnDefinition = "json")
    private String sizeChart;

    @Column(name = "media", columnDefinition = "json")
    private String media;

    @Column(name = "glb_url", length = 500)
    private String glbUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ProductStatus status;

    @Column(name = "moderation_locked", nullable = false)
    private boolean moderationLocked;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
