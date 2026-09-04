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
import com.clossette.entity.enums.Role;
import com.clossette.repository.PostCommentRepository;
import com.clossette.repository.PostLikeRepository;
import com.clossette.repository.PostRepository;
import com.clossette.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PostServiceTest {

    @Mock PostRepository postRepository;
    @Mock PostLikeRepository postLikeRepository;
    @Mock PostCommentRepository postCommentRepository;
    @Mock UserRepository userRepository;

    @InjectMocks PostService postService;

    // ObjectMapper is injected via constructor — supply a real one
    private final ObjectMapper objectMapper = new ObjectMapper();

    private User author;
    private User other;
    private Post activePost;

    @BeforeEach
    void setUp() {
        // PostService is constructed by Mockito via @InjectMocks; ObjectMapper won't be
        // injected automatically because it isn't a @Mock. Re-create service with real mapper.
        postService = new PostService(
                postRepository, postLikeRepository, postCommentRepository,
                userRepository, objectMapper);

        author = User.builder()
                .id(1L).email("author@test.com").name("Author")
                .username("author").role(Role.BUYER).build();

        other = User.builder()
                .id(2L).email("other@test.com").name("Other")
                .username("other").role(Role.BUYER).build();

        activePost = Post.builder()
                .id(10L).user(author).content("Hello world")
                .status(PostStatus.ACTIVE).build();
    }

    // ── createPost ────────────────────────────────────────────────────────────

    @Test
    void createPost_success_returnsResponse() {
        PostRequest req = new PostRequest("Hello world", null);
        when(userRepository.findByEmail("author@test.com")).thenReturn(Optional.of(author));
        when(postRepository.save(any(Post.class))).thenReturn(activePost);
        when(postLikeRepository.countByPost(activePost)).thenReturn(0L);
        when(postCommentRepository.countByPost(activePost)).thenReturn(0L);

        PostResponse resp = postService.createPost("author@test.com", req);

        assertThat(resp.content()).isEqualTo("Hello world");
        assertThat(resp.userId()).isEqualTo(1L);
        verify(postRepository).save(any(Post.class));
    }

    @Test
    void createPost_withMediaUrls_serializesJson() throws Exception {
        List<String> urls = List.of("https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg");
        PostRequest req = new PostRequest("Look at this", urls);

        ArgumentCaptor<Post> captor = ArgumentCaptor.forClass(Post.class);
        Post saved = Post.builder().id(11L).user(author).content("Look at this")
                .mediaUrls(objectMapper.writeValueAsString(urls))
                .status(PostStatus.ACTIVE).build();

        when(userRepository.findByEmail("author@test.com")).thenReturn(Optional.of(author));
        when(postRepository.save(captor.capture())).thenReturn(saved);
        when(postLikeRepository.countByPost(saved)).thenReturn(0L);
        when(postCommentRepository.countByPost(saved)).thenReturn(0L);

        PostResponse resp = postService.createPost("author@test.com", req);

        String capturedJson = captor.getValue().getMediaUrls();
        assertThat(capturedJson).contains("cdn.example.com/a.jpg");
        assertThat(resp.mediaUrls()).containsExactly(
                "https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg");
    }

    // ── getFeed ───────────────────────────────────────────────────────────────

    @Test
    void getFeed_returnsPaginatedActivePosts() {
        when(postRepository.findByStatusOrderByCreatedAtDesc(eq(PostStatus.ACTIVE), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(activePost)));
        when(postLikeRepository.countByPost(activePost)).thenReturn(3L);
        when(postCommentRepository.countByPost(activePost)).thenReturn(1L);

        PagedResponse<PostResponse> feed = postService.getFeed(null, 0, 10);

        assertThat(feed.content()).hasSize(1);
        assertThat(feed.content().get(0).likeCount()).isEqualTo(3L);
    }

    @Test
    void getFeed_empty_returnsEmptyPage() {
        when(postRepository.findByStatusOrderByCreatedAtDesc(eq(PostStatus.ACTIVE), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        PagedResponse<PostResponse> feed = postService.getFeed(null, 0, 10);

        assertThat(feed.content()).isEmpty();
        assertThat(feed.totalElements()).isZero();
    }

    // ── getByUser ─────────────────────────────────────────────────────────────

    @Test
    void getByUser_returnsPostsForTargetUser() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(author));
        when(postRepository.findByUserAndStatusOrderByCreatedAtDesc(
                eq(author), eq(PostStatus.ACTIVE), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(activePost)));
        when(postLikeRepository.countByPost(activePost)).thenReturn(0L);
        when(postCommentRepository.countByPost(activePost)).thenReturn(0L);

        PagedResponse<PostResponse> result = postService.getByUser(1L, null, 0, 10);

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).userId()).isEqualTo(1L);
    }

    // ── toggleLike ────────────────────────────────────────────────────────────

    @Test
    void toggleLike_notYetLiked_savesLike() {
        when(userRepository.findByEmail("other@test.com")).thenReturn(Optional.of(other));
        when(postRepository.findById(10L)).thenReturn(Optional.of(activePost));
        when(postLikeRepository.findByPostAndUser(activePost, other)).thenReturn(Optional.empty());
        when(postLikeRepository.countByPost(activePost)).thenReturn(1L);
        when(postCommentRepository.countByPost(activePost)).thenReturn(0L);

        PostResponse resp = postService.toggleLike(10L, "other@test.com");

        verify(postLikeRepository).save(any(PostLike.class));
        assertThat(resp.likedByCurrentUser()).isTrue();
    }

    @Test
    void toggleLike_alreadyLiked_deletesLike() {
        PostLike existingLike = PostLike.builder().id(99L).post(activePost).user(other).build();
        when(userRepository.findByEmail("other@test.com")).thenReturn(Optional.of(other));
        when(postRepository.findById(10L)).thenReturn(Optional.of(activePost));
        when(postLikeRepository.findByPostAndUser(activePost, other)).thenReturn(Optional.of(existingLike));
        when(postLikeRepository.countByPost(activePost)).thenReturn(0L);
        when(postCommentRepository.countByPost(activePost)).thenReturn(0L);

        PostResponse resp = postService.toggleLike(10L, "other@test.com");

        verify(postLikeRepository).delete(existingLike);
        assertThat(resp.likedByCurrentUser()).isFalse();
    }

    // ── addComment ────────────────────────────────────────────────────────────

    @Test
    void addComment_success_savesTopLevelComment() {
        CommentRequest req = new CommentRequest("Nice post!", null);
        PostComment saved = PostComment.builder()
                .id(50L).post(activePost).user(other).content("Nice post!").build();

        when(userRepository.findByEmail("other@test.com")).thenReturn(Optional.of(other));
        when(postRepository.findById(10L)).thenReturn(Optional.of(activePost));
        when(postCommentRepository.save(any(PostComment.class))).thenReturn(saved);

        CommentResponse resp = postService.addComment(10L, "other@test.com", req);

        assertThat(resp.content()).isEqualTo("Nice post!");
        assertThat(resp.parentCommentId()).isNull();
    }

    @Test
    void addComment_nested_linksParentComment() {
        PostComment parent = PostComment.builder()
                .id(40L).post(activePost).user(author).content("Parent").build();
        CommentRequest req = new CommentRequest("Reply!", 40L);
        PostComment saved = PostComment.builder()
                .id(51L).post(activePost).user(other).parentComment(parent).content("Reply!").build();

        when(userRepository.findByEmail("other@test.com")).thenReturn(Optional.of(other));
        when(postRepository.findById(10L)).thenReturn(Optional.of(activePost));
        when(postCommentRepository.findById(40L)).thenReturn(Optional.of(parent));
        when(postCommentRepository.save(any(PostComment.class))).thenReturn(saved);

        CommentResponse resp = postService.addComment(10L, "other@test.com", req);

        assertThat(resp.parentCommentId()).isEqualTo(40L);
    }

    // ── softDelete ────────────────────────────────────────────────────────────

    @Test
    void softDelete_byOwner_setsStatusPendingDelete() {
        when(userRepository.findByEmail("author@test.com")).thenReturn(Optional.of(author));
        when(postRepository.findById(10L)).thenReturn(Optional.of(activePost));
        when(postRepository.save(any(Post.class))).thenReturn(activePost);

        postService.softDelete(10L, "author@test.com");

        assertThat(activePost.getStatus()).isEqualTo(PostStatus.PENDING_DELETE);
        assertThat(activePost.getDeletedAt()).isNotNull();
    }

    @Test
    void softDelete_byNonOwner_throwsAccessDeniedException() {
        when(userRepository.findByEmail("other@test.com")).thenReturn(Optional.of(other));
        when(postRepository.findById(10L)).thenReturn(Optional.of(activePost));

        assertThatThrownBy(() -> postService.softDelete(10L, "other@test.com"))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── archive ───────────────────────────────────────────────────────────────

    @Test
    void archive_byOwner_setsStatusArchived() {
        Post archived = Post.builder().id(10L).user(author).content("Hello world")
                .status(PostStatus.ARCHIVED).build();
        when(userRepository.findByEmail("author@test.com")).thenReturn(Optional.of(author));
        when(postRepository.findById(10L)).thenReturn(Optional.of(activePost));
        when(postRepository.save(any(Post.class))).thenReturn(archived);
        when(postLikeRepository.findByPostAndUser(any(), any())).thenReturn(Optional.empty());
        when(postLikeRepository.countByPost(any())).thenReturn(0L);
        when(postCommentRepository.countByPost(any())).thenReturn(0L);

        PostResponse resp = postService.archive(10L, "author@test.com");

        assertThat(resp.status()).isEqualTo(PostStatus.ARCHIVED);
    }

    @Test
    void archive_byNonOwner_throwsAccessDeniedException() {
        when(userRepository.findByEmail("other@test.com")).thenReturn(Optional.of(other));
        when(postRepository.findById(10L)).thenReturn(Optional.of(activePost));

        assertThatThrownBy(() -> postService.archive(10L, "other@test.com"))
                .isInstanceOf(AccessDeniedException.class);
    }
}
