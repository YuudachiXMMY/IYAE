package com.clossette.repository;

import com.clossette.entity.Follow;
import com.clossette.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FollowRepository extends JpaRepository<Follow, Long> {
    Optional<Follow> findByFollowerAndFollowing(User follower, User following);
    boolean existsByFollowerAndFollowing(User follower, User following);
    Page<Follow> findByFollowingOrderByCreatedAtDesc(User following, Pageable pageable);
    Page<Follow> findByFollowerOrderByCreatedAtDesc(User follower, Pageable pageable);
}
