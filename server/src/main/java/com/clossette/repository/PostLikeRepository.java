package com.clossette.repository;

import com.clossette.entity.Post;
import com.clossette.entity.PostLike;
import com.clossette.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PostLikeRepository extends JpaRepository<PostLike, Long> {
    Optional<PostLike> findByPostAndUser(Post post, User user);
    long countByPost(Post post);
}
