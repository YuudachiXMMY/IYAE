package com.iyae.repository;

import com.iyae.entity.Product;
import com.iyae.entity.enums.ProductStatus;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

/**
 * Dynamic catalog filters composed as a JPA {@link Specification}, so the
 * (status, category, q, localOnly) dimensions combine without a named-query
 * permutation explosion.
 */
public final class ProductSpecifications {

    private ProductSpecifications() {}

    public static Specification<Product> catalog(ProductStatus status, String category, String q, boolean localOnly) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("status"), status));

            if (category != null && !category.isBlank()) {
                predicates.add(cb.like(cb.lower(root.get("category")),
                        "%" + category.toLowerCase() + "%"));
            }
            if (q != null && !q.isBlank()) {
                String pattern = "%" + q.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("name")), pattern),
                        cb.like(cb.lower(root.get("description")), pattern)
                ));
            }
            if (localOnly) {
                Join<Object, Object> designer = root.join("designerProfile");
                predicates.add(cb.isTrue(designer.get("isLocal")));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
