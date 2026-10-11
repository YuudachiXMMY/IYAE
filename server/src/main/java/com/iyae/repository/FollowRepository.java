package com.iyae.repository;

import com.iyae.entity.Follow;
import com.iyae.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FollowRepository extends JpaRepository<Follow, Long> {
    Optional<Follow> findByFollowerAndFollowing(User follower, User following);
    boolean existsByFollowerAndFollowing(User follower, User following);
    Page<Follow> findByFollowingOrderByCreatedAtDesc(User following, Pageable pageable);
    Page<Follow> findByFollowerOrderByCreatedAtDesc(User follower, Pageable pageable);

    // Phase 6 — real follower/following counts (no denormalized counter columns)
    long countByFollowing(User following);   // number of accounts following `following`
    long countByFollower(User follower);     // number of accounts `follower` follows

    // Account deletion: a departing user's follows must go in BOTH directions — the people
    // they followed and the people who followed them.
    void deleteByFollower(User follower);

    void deleteByFollowing(User following);

}
