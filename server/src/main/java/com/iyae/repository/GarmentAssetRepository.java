package com.iyae.repository;

import com.iyae.entity.GarmentAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GarmentAssetRepository extends JpaRepository<GarmentAsset, Long> {

    List<GarmentAsset> findByProductId(Long productId);

    Optional<GarmentAsset> findTopByProductIdAndStatusOrderByCreatedAtDesc(Long productId, String status);

    Optional<GarmentAsset> findTopByProductIdOrderByCreatedAtDesc(Long productId);

    List<GarmentAsset> findByProductIdIn(List<Long> productIds);

    List<GarmentAsset> findByProductIdInOrderByCreatedAtDesc(List<Long> productIds);
}
