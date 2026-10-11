package com.iyae.repository;

import com.iyae.entity.Post;
import com.iyae.entity.PostLike;
import com.iyae.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

import org.springframework.data.jpa.repository.Query;

import org.springframework.data.repository.query.Param;

import java.util.Collection;

import java.util.List;

public interface PostLikeRepository extends JpaRepository<PostLike, Long> {
    Optional<PostLike> findByPostAndUser(Post post, User user);
    long countByPost(Post post);

    // Account deletion (AccountDeletionService): removes this user's likes.
    void deleteByUser(User user);


    /**
     * Like counts for a whole page of posts in one query.
     *
     * <p>Replaces `countByPost` called once per post. A 20-post feed page issued 20 of those,
     * plus 20 comment counts, plus 20 like-status checks — 60 round-trips to render one page.
     */
    @Query("SELECT pl.post.id, COUNT(pl) FROM PostLike pl WHERE pl.post.id IN :postIds "
           + "GROUP BY pl.post.id")
    List<Object[]> countByPostIds(@Param("postIds") Collection<Long> postIds);

    /** Which of these posts the given user has liked — one query instead of one per post. */
    @Query("SELECT pl.post.id FROM PostLike pl WHERE pl.user = :user AND pl.post.id IN :postIds")
    List<Long> findLikedPostIds(@Param("user") User user, @Param("postIds") Collection<Long> postIds);

}
