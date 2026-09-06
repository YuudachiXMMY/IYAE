package com.iyae.repository;

import com.iyae.entity.Post;
import com.iyae.entity.User;
import com.iyae.entity.enums.PostStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostRepository extends JpaRepository<Post, Long> {
    Page<Post> findByStatusOrderByCreatedAtDesc(PostStatus status, Pageable pageable);
    Page<Post> findByUserAndStatusOrderByCreatedAtDesc(User user, PostStatus status, Pageable pageable);

    java.util.List<Post> findByStatusOrderByCreatedAtDesc(PostStatus status);

    // Phase 6 — named feeds. Every query MUST constrain status (moderated posts must never leak).

    /** Following feed: ACTIVE posts authored by accounts the given user follows. */
    @Query("SELECT p FROM Post p WHERE p.status = :status " +
           "AND p.user.id IN (SELECT f.following.id FROM Follow f WHERE f.follower = :follower) " +
           "ORDER BY p.createdAt DESC")
    Page<Post> findFollowingFeed(@Param("follower") User follower,
                                 @Param("status") PostStatus status,
                                 Pageable pageable);

    /** City feed (e.g. Toronto): ACTIVE posts whose city matches. */
    Page<Post> findByStatusAndCityOrderByCreatedAtDesc(PostStatus status, String city, Pageable pageable);

    /** Topic feed (e.g. body-confidence): ACTIVE posts whose topic matches. */
    Page<Post> findByStatusAndTopicOrderByCreatedAtDesc(PostStatus status, String topic, Pageable pageable);
}
