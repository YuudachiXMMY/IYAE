package com.iyae.repository;

import com.iyae.entity.Product;
import com.iyae.entity.enums.ProductStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {

    Page<Product> findByStatus(ProductStatus status, Pageable pageable);

    @Query("SELECT p FROM Product p WHERE p.status = :status AND " +
           "(LOWER(p.category) LIKE LOWER(CONCAT('%', :category, '%')))")
    Page<Product> findByStatusAndCategory(@Param("status") ProductStatus status,
                                          @Param("category") String category, Pageable pageable);

    @Query("SELECT p FROM Product p WHERE p.status = :status AND " +
           "(LOWER(p.name) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "LOWER(p.description) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<Product> findByStatusAndSearch(@Param("status") ProductStatus status,
                                        @Param("q") String q, Pageable pageable);

    @Query("SELECT p FROM Product p WHERE p.status = :status AND " +
           "LOWER(p.category) LIKE LOWER(CONCAT('%', :category, '%')) AND " +
           "(LOWER(p.name) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "LOWER(p.description) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<Product> findByStatusAndCategoryAndSearch(@Param("status") ProductStatus status,
                                                   @Param("category") String category,
                                                   @Param("q") String q, Pageable pageable);

    List<Product> findByDesignerProfileId(Long designerProfileId);

    List<Product> findByIdInAndStatus(List<Long> ids, ProductStatus status);

    @Query("SELECT DISTINCT p.category FROM Product p WHERE p.status = :status AND p.category IS NOT NULL ORDER BY p.category")
    List<String> findDistinctCategoriesByStatus(@Param("status") ProductStatus status);
}
