package com.clossette.repository;

import com.clossette.entity.DesignerProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DesignerProfileRepository extends JpaRepository<DesignerProfile, Long> {
    Optional<DesignerProfile> findByUserId(Long userId);
}
