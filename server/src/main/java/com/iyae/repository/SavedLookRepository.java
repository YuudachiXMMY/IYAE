package com.iyae.repository;

import com.iyae.entity.SavedLook;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedLookRepository extends JpaRepository<SavedLook, Long> {

    List<SavedLook> findByUserId(Long userId);

    Optional<SavedLook> findByIdAndUserId(Long id, Long userId);

    // Account deletion (AccountDeletionService): removes this user's saved looks.
    void deleteByUserId(Long userId);

}
