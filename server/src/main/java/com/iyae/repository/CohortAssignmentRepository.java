package com.iyae.repository;

import com.iyae.entity.CohortAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CohortAssignmentRepository extends JpaRepository<CohortAssignment, Long> {

    Optional<CohortAssignment> findByUserId(Long userId);

    boolean existsByUserId(Long userId);
}
