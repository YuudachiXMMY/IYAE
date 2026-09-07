package com.iyae.repository;

import com.iyae.entity.ResaleListing;
import com.iyae.entity.enums.ResaleStatus;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

/**
 * Dynamic browse filters for the pre-loved feed, composed as a JPA {@link Specification} so the
 * (status, q, category) dimensions combine without a named-query permutation explosion. Mirrors
 * {@link ProductSpecifications}; q/category filter against the joined originating {@code product}.
 */
public final class ResaleListingSpecifications {

    private ResaleListingSpecifications() {}

    public static Specification<ResaleListing> browse(ResaleStatus status, String q, String category) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("status"), status));

            boolean needsProduct = (q != null && !q.isBlank()) || (category != null && !category.isBlank());
            if (needsProduct) {
                Join<Object, Object> product = root.join("product");
                if (q != null && !q.isBlank()) {
                    predicates.add(cb.like(cb.lower(product.get("name")), "%" + q.toLowerCase() + "%"));
                }
                if (category != null && !category.isBlank()) {
                    predicates.add(cb.like(cb.lower(product.get("category")), "%" + category.toLowerCase() + "%"));
                }
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
