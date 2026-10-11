package com.iyae.repository;

import com.iyae.entity.Post;
import com.iyae.entity.PostLike;
import com.iyae.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PostLikeRepository extends JpaRepository<PostLike, Long> {
    Optional<PostLike> findByPostAndUser(Post post, User user);
    long countByPost(Post post);

    // Account deletion (AccountDeletionService): removes this user's likes.
    void deleteByUser(User user);

}
