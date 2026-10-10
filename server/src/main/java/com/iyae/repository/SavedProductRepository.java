package com.iyae.repository;

import com.iyae.entity.SavedProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SavedProductRepository extends JpaRepository<SavedProduct, Long> {

    /**
     * This user's saves, newest first, with the product and its designer already
     * loaded. The fetch joins matter: {@code ProductResponse.from} reads
     * {@code product.getDesignerProfile().getDisplayName()}, so a plain
     * {@code findByUserId} would issue two extra queries per saved row.
     */
    @Query("""
            SELECT sp FROM SavedProduct sp
            JOIN FETCH sp.product p
            JOIN FETCH p.designerProfile
            WHERE sp.user.id = :userId
            ORDER BY sp.createdAt DESC
            """)
    List<SavedProduct> findByUserIdNewestFirst(@Param("userId") Long userId);

    Optional<SavedProduct> findByUserIdAndProductId(Long userId, Long productId);
}
