package com.iyae.repository;

import com.iyae.entity.ProductSizeMeasurement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductSizeMeasurementRepository extends JpaRepository<ProductSizeMeasurement, Long> {

    List<ProductSizeMeasurement> findByProductId(Long productId);

    List<ProductSizeMeasurement> findByProductIdIn(List<Long> productIds);

    void deleteByProductId(Long productId);
}
