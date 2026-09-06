package com.iyae.repository;

import com.iyae.entity.Post;
import com.iyae.entity.User;
import com.iyae.entity.enums.PostStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostRepository extends JpaRepository<Post, Long> {
    Page<Post> findByStatusOrderByCreatedAtDesc(PostStatus status, Pageable pageable);
    Page<Post> findByUserAndStatusOrderByCreatedAtDesc(User user, PostStatus status, Pageable pageable);

    java.util.List<Post> findByStatusOrderByCreatedAtDesc(PostStatus status);
}
