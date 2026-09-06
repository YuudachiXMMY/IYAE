package com.iyae.repository;

import com.iyae.entity.Post;
import com.iyae.entity.PostComment;
import com.iyae.entity.enums.CommentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostCommentRepository extends JpaRepository<PostComment, Long> {
    Page<PostComment> findByPostAndParentCommentIsNullOrderByCreatedAtAsc(Post post, Pageable pageable);
    // Phase 6 — surface only non-moderated top-level comments
    Page<PostComment> findByPostAndParentCommentIsNullAndStatusOrderByCreatedAtAsc(
            Post post, CommentStatus status, Pageable pageable);
    long countByPost(Post post);
}
