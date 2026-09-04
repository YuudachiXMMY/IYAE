package com.clossette.service;

import com.clossette.dto.CommentRequest;
import com.clossette.dto.CommentResponse;
import com.clossette.dto.PagedResponse;
import com.clossette.dto.PostRequest;
import com.clossette.dto.PostResponse;
import com.clossette.entity.Post;
import com.clossette.entity.PostComment;
import com.clossette.entity.PostLike;
import com.clossette.entity.User;
import com.clossette.entity.enums.PostStatus;
import com.clossette.repository.PostCommentRepository;
import com.clossette.repository.PostLikeRepository;
import com.clossette.repository.PostRepository;
import com.clossette.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;
    private final PostLikeRepository postLikeRepository;
    private final PostCommentRepository postCommentRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public PostResponse createPost(String email, PostRequest request) {
        User user = findUser(email);
        String mediaUrlsJson = serializeMediaUrls(request.mediaUrls());
        Post post = Post.builder()
            .user(user)
            .content(request.content())
            .mediaUrls(mediaUrlsJson)
            .status(PostStatus.ACTIVE)
            .build();
        Post saved = postRepository.save(post);
        return toResponse(saved, user, false);
    }

    @Transactional(readOnly = true)
    public PagedResponse<PostResponse> getFeed(String email, int page, int size) {
        User currentUser = email != null ? userRepository.findByEmail(email).orElse(null) : null;
        Pageable pageable = PageRequest.of(page, size);
        Page<Post> posts = postRepository.findByStatusOrderByCreatedAtDesc(PostStatus.ACTIVE, pageable);
        return PagedResponse.from(posts.map(p -> toResponse(p, currentUser, isLikedBy(p, currentUser))));
    }

    @Transactional(readOnly = true)
    public PagedResponse<PostResponse> getByUser(Long userId, String email, int page, int size) {
        User targetUser = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        User currentUser = email != null ? userRepository.findByEmail(email).orElse(null) : null;
        Pageable pageable = PageRequest.of(page, size);
        Page<Post> posts = postRepository.findByUserAndStatusOrderByCreatedAtDesc(targetUser, PostStatus.ACTIVE, pageable);
        return PagedResponse.from(posts.map(p -> toResponse(p, currentUser, isLikedBy(p, currentUser))));
    }

    @Transactional
    public PostResponse toggleLike(Long postId, String email) {
        User user = findUser(email);
        Post post = findActivePost(postId);
        Optional<PostLike> existing = postLikeRepository.findByPostAndUser(post, user);
        if (existing.isPresent()) {
            postLikeRepository.delete(existing.get());
            log.debug("User {} unliked post {}", user.getId(), postId);
        } else {
            postLikeRepository.save(PostLike.builder().post(post).user(user).build());
            log.debug("User {} liked post {}", user.getId(), postId);
        }
        return toResponse(post, user, existing.isEmpty());
    }

    @Transactional
    public CommentResponse addComment(Long postId, String email, CommentRequest request) {
        User user = findUser(email);
        Post post = findActivePost(postId);
        PostComment parent = null;
        if (request.parentCommentId() != null) {
            parent = postCommentRepository.findById(request.parentCommentId())
                .orElseThrow(() -> new IllegalArgumentException("Parent comment not found"));
        }
        PostComment comment = PostComment.builder()
            .post(post)
            .user(user)
            .parentComment(parent)
            .content(request.content())
            .build();
        return CommentResponse.from(postCommentRepository.save(comment));
    }

    @Transactional
    public void softDelete(Long postId, String email) {
        User user = findUser(email);
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new IllegalArgumentException("Post not found"));
        if (!post.getUser().getId().equals(user.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Access denied");
        }
        post.setStatus(PostStatus.PENDING_DELETE);
        post.setDeletedAt(Instant.now());
        postRepository.save(post);
    }

    @Transactional
    public PostResponse archive(Long postId, String email) {
        User user = findUser(email);
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new IllegalArgumentException("Post not found"));
        if (!post.getUser().getId().equals(user.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Access denied");
        }
        post.setStatus(PostStatus.ARCHIVED);
        return toResponse(postRepository.save(post), user, isLikedBy(post, user));
    }

    private Post findActivePost(Long postId) {
        Post post = postRepository.findById(postId)
            .orElseThrow(() -> new IllegalArgumentException("Post not found"));
        if (post.getStatus() != PostStatus.ACTIVE) {
            throw new IllegalArgumentException("Post not found");
        }
        return post;
    }

    private User findUser(String email) {
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private boolean isLikedBy(Post post, User user) {
        if (user == null) return false;
        return postLikeRepository.findByPostAndUser(post, user).isPresent();
    }

    private PostResponse toResponse(Post post, User currentUser, boolean liked) {
        long likeCount = postLikeRepository.countByPost(post);
        long commentCount = postCommentRepository.countByPost(post);
        return PostResponse.from(post, likeCount, commentCount, liked);
    }

    private String serializeMediaUrls(List<String> mediaUrls) {
        if (mediaUrls == null || mediaUrls.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(mediaUrls);
        } catch (Exception e) {
            log.warn("Failed to serialize mediaUrls", e);
            return null;
        }
    }
}
