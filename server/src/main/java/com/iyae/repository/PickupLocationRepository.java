package com.iyae.repository;

import com.iyae.entity.PickupLocation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PickupLocationRepository extends JpaRepository<PickupLocation, Long> {

    /** Active locations in a stable order for the checkout selector. */
    List<PickupLocation> findByActiveTrueOrderByIdAsc();
}
