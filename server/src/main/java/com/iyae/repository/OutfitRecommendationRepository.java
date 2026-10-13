package com.iyae.repository;

import com.iyae.entity.OutfitRecommendation;
import com.iyae.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OutfitRecommendationRepository extends JpaRepository<OutfitRecommendation, Long> {

    List<OutfitRecommendation> findByUserOrderByCreatedAtDesc(User user);

    Optional<OutfitRecommendation> findByIdAndUser(Long id, User user);

    // Account deletion (AccountDeletionService): removes this user's outfit recommendations.
    void deleteByUser(User user);

}
