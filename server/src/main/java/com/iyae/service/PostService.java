package com.iyae.service;

import com.iyae.dto.CommentRequest;
import com.iyae.dto.CommentResponse;
import com.iyae.dto.PagedResponse;
import com.iyae.dto.PostReportResponse;
import com.iyae.dto.PostRequest;
import com.iyae.dto.PostResponse;
import com.iyae.entity.Post;
import com.iyae.entity.PostComment;
import com.iyae.entity.PostLike;
import com.iyae.entity.PostReport;
import com.iyae.entity.SavedLook;
import com.iyae.entity.User;
import com.iyae.entity.enums.CommentStatus;
import com.iyae.entity.enums.PostStatus;
import com.iyae.entity.enums.ReportStatus;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import com.iyae.util.Pagination;
import com.iyae.repository.PostCommentRepository;
import com.iyae.repository.PostLikeRepository;
import com.iyae.repository.PostReportRepository;
import com.iyae.repository.PostRepository;
import com.iyae.repository.SavedLookRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
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
    private final SavedLookRepository savedLookRepository;
    private final PostReportRepository postReportRepository;

    @Transactional
    public PostResponse createPost(String email, PostRequest request) {
        User user = findUser(email);
        String mediaUrlsJson = serializeJsonList(request.mediaUrls());
        String productIdsJson = serializeJsonList(request.productIds());
        SavedLook savedLook = resolveSavedLook(request.savedLookId(), user);
        // City defaults to the author's home city when the composer doesn't override it.
        String city = (request.city() != null && !request.city().isBlank())
            ? request.city().trim()
            : user.getCity();
        Post post = Post.builder()
            .user(user)
            .content(request.content())
            .mediaUrls(mediaUrlsJson)
            .savedLook(savedLook)
            .productIds(productIdsJson)
            .topic(normalizeBlank(request.topic()))
            .city(normalizeBlank(city))
            .status(PostStatus.ACTIVE)
            .build();
        Post saved = postRepository.save(post);
        return toResponse(saved, user, false);
    }

    /**
     * Named-feed dispatch. Every branch constrains {@code status = ACTIVE} so moderated posts
     * (ARCHIVED / PENDING_DELETE) never leak into any feed.
     */
    @Transactional(readOnly = true)
    public PagedResponse<PostResponse> getFeed(String feed, String email, int page, int size) {
        User currentUser = email != null ? userRepository.findByEmail(email).orElse(null) : null;
        Pageable pageable = PageRequest.of(Pagination.clampPage(page), Pagination.clampSize(size));
        String feedType = (feed == null || feed.isBlank()) ? "discover" : feed.trim().toLowerCase();
        Page<Post> posts;
        switch (feedType) {
            case "discover", "for-you" ->
                posts = postRepository.findByStatusOrderByCreatedAtDesc(PostStatus.ACTIVE, pageable);
            case "following" ->
                // Anonymous or follows-nobody → empty page (never an error).
                posts = (currentUser == null)
                    ? Page.<Post>empty(pageable)
                    : postRepository.findFollowingFeed(currentUser, PostStatus.ACTIVE, pageable);
            case "toronto" ->
                posts = postRepository.findByStatusAndCityOrderByCreatedAtDesc(
                    PostStatus.ACTIVE, "Toronto", pageable);
            case "body-confidence" ->
                posts = postRepository.findByStatusAndTopicOrderByCreatedAtDesc(
                    PostStatus.ACTIVE, "body-confidence", pageable);
            default -> throw new IllegalArgumentException("Unknown feed: " + feed);
        }
        return toResponsePage(posts, currentUser);
    }

    /** Back-compat overload: the feed-less call is the Discover stream. */
    @Transactional(readOnly = true)
    public PagedResponse<PostResponse> getFeed(String email, int page, int size) {
        return getFeed("discover", email, page, size);
    }

    @Transactional(readOnly = true)
    public PostResponse getPost(Long postId, String email) {
        Post post = findActivePost(postId);
        User currentUser = email != null ? userRepository.findByEmail(email).orElse(null) : null;
        return toResponse(post, currentUser, isLikedBy(post, currentUser));
    }

    @Transactional(readOnly = true)
    public PagedResponse<CommentResponse> getComments(Long postId, int page, int size) {
        Post post = findActivePost(postId);
        Pageable pageable = PageRequest.of(Pagination.clampPage(page), Pagination.clampSize(size));
        return PagedResponse.from(
            postCommentRepository
                .findByPostAndParentCommentIsNullAndStatusOrderByCreatedAtAsc(post, CommentStatus.ACTIVE, pageable)
                .map(CommentResponse::from));
    }

    /** User abuse report. Idempotent — one report per (post, reporter). */
    @Transactional
    public PostReportResponse reportPost(Long postId, String email, String reason) {
        User reporter = findUser(email);
        Post post = findActivePost(postId);
        Optional<PostReport> existing = postReportRepository.findByPostAndReporter(post, reporter);
        if (existing.isPresent()) {
            return PostReportResponse.from(existing.get());
        }
        PostReport report = PostReport.builder()
            .post(post)
            .reporter(reporter)
            .reason(reason)
            .status(ReportStatus.OPEN)
            .build();
        log.info("User {} reported post {}", reporter.getId(), postId);
        return PostReportResponse.from(postReportRepository.save(report));
    }

    @Transactional(readOnly = true)
    public PagedResponse<PostResponse> getByUser(Long userId, String email, int page, int size) {
        User targetUser = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        User currentUser = email != null ? userRepository.findByEmail(email).orElse(null) : null;
        Pageable pageable = PageRequest.of(Pagination.clampPage(page), Pagination.clampSize(size));
        Page<Post> posts = postRepository.findByUserAndStatusOrderByCreatedAtDesc(targetUser, PostStatus.ACTIVE, pageable);
        return toResponsePage(posts, currentUser);
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

    /**
     * Maps a whole page in three queries instead of three per post.
     *
     * <p>Rendering a 20-post feed page used to issue 60 extra round-trips: a like count, a
     * comment count and a like-status check for every post, each one its own query. The counts
     * and the viewer's likes are now batched by post id.
     */
    private PagedResponse<PostResponse> toResponsePage(Page<Post> posts, User currentUser) {
        List<Long> ids = posts.getContent().stream().map(Post::getId).toList();
        if (ids.isEmpty()) {
            return PagedResponse.from(posts.map(p -> PostResponse.from(p, 0, 0, false)));
        }

        Map<Long, Long> likeCounts = toCountMap(postLikeRepository.countByPostIds(ids));
        Map<Long, Long> commentCounts = toCountMap(postCommentRepository.countByPostIds(ids));
        Set<Long> likedByViewer = currentUser == null
                ? Set.of()
                : new HashSet<>(postLikeRepository.findLikedPostIds(currentUser, ids));

        return PagedResponse.from(posts.map(post -> PostResponse.from(
                post,
                likeCounts.getOrDefault(post.getId(), 0L),
                commentCounts.getOrDefault(post.getId(), 0L),
                likedByViewer.contains(post.getId()))));
    }

    /** A post with no likes or comments is simply absent from the GROUP BY result. */
    private static Map<Long, Long> toCountMap(List<Object[]> rows) {
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : rows) {
            counts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
        }
        return counts;
    }

    private SavedLook resolveSavedLook(Long savedLookId, User user) {
        if (savedLookId == null) return null;
        SavedLook look = savedLookRepository.findById(savedLookId)
            .orElseThrow(() -> new IllegalArgumentException("Saved look not found"));
        if (!look.getUser().getId().equals(user.getId())) {
            throw new AccessDeniedException("Access denied");
        }
        return look;
    }

    private String normalizeBlank(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    private String serializeJsonList(List<String> values) {
        if (values == null || values.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(values);
        } catch (Exception e) {
            log.warn("Failed to serialize JSON list", e);
            return null;
        }
    }
}
