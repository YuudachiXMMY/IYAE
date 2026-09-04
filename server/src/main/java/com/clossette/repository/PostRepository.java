package com.clossette.repository;

import com.clossette.entity.Post;
import com.clossette.entity.User;
import com.clossette.entity.enums.PostStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostRepository extends JpaRepository<Post, Long> {
    Page<Post> findByStatusOrderByCreatedAtDesc(PostStatus status, Pageable pageable);
    Page<Post> findByUserAndStatusOrderByCreatedAtDesc(User user, PostStatus status, Pageable pageable);
}
