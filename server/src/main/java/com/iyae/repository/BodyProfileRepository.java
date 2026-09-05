package com.iyae.repository;

import com.iyae.entity.BodyProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BodyProfileRepository extends JpaRepository<BodyProfile, Long> {

    Optional<BodyProfile> findByUserId(Long userId);
}
