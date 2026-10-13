package com.iyae.repository;

import com.iyae.entity.User;
import com.iyae.entity.Post;
import com.iyae.entity.PostComment;
import com.iyae.entity.enums.CommentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.jpa.repository.Query;

import org.springframework.data.repository.query.Param;

import java.util.Collection;

import java.util.List;

public interface PostCommentRepository extends JpaRepository<PostComment, Long> {
    Page<PostComment> findByPostAndParentCommentIsNullOrderByCreatedAtAsc(Post post, Pageable pageable);
    // Phase 6 — surface only non-moderated top-level comments
    Page<PostComment> findByPostAndParentCommentIsNullAndStatusOrderByCreatedAtAsc(
            Post post, CommentStatus status, Pageable pageable);
    long countByPost(Post post);

    // Account deletion (AccountDeletionService): removes this user's comments.
    void deleteByUser(User user);


    /** Comment counts for a whole page of posts in one query (see PostLikeRepository). */
    @Query("SELECT pc.post.id, COUNT(pc) FROM PostComment pc WHERE pc.post.id IN :postIds "
           + "GROUP BY pc.post.id")
    List<Object[]> countByPostIds(@Param("postIds") Collection<Long> postIds);

}
