package com.clossette.repository;

import com.clossette.entity.Promotion;
import com.clossette.entity.enums.SlotType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface PromotionRepository extends JpaRepository<Promotion, Long> {

    @Query("SELECT p FROM Promotion p WHERE p.slotType = :slotType AND p.startAt <= :now AND p.endAt >= :now ORDER BY p.weight DESC")
    List<Promotion> findActiveBySlotType(@Param("slotType") SlotType slotType, @Param("now") Instant now);

    @Query("SELECT p FROM Promotion p WHERE p.product.designerProfile.user.id = :userId")
    List<Promotion> findByDesignerUserId(@Param("userId") Long userId);

    Optional<Promotion> findByIdAndProductDesignerProfileUserId(Long id, Long userId);
}
