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
import com.iyae.entity.enums.Role;
import com.iyae.repository.PostCommentRepository;
import com.iyae.repository.PostLikeRepository;
import com.iyae.repository.PostReportRepository;
import com.iyae.repository.PostRepository;
import com.iyae.repository.SavedLookRepository;
import com.iyae.repository.UserRepository;
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
    @Mock SavedLookRepository savedLookRepository;
    @Mock PostReportRepository postReportRepository;

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
                userRepository, objectMapper, savedLookRepository, postReportRepository);

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
        // Batched: the whole page's counts come back in one query each (#11/#16).
        when(postLikeRepository.countByPostIds(any()))
                .thenReturn(List.<Object[]>of(new Object[] {activePost.getId(), 3L}));
        when(postCommentRepository.countByPostIds(any()))
                .thenReturn(List.<Object[]>of(new Object[] {activePost.getId(), 1L}));

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
        when(userRepository.findActiveById(1L)).thenReturn(Optional.of(author));
        when(postRepository.findByUserAndStatusOrderByCreatedAtDesc(
                eq(author), eq(PostStatus.ACTIVE), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(activePost)));
        // Batched: the whole page's counts come back in one query each (#11/#16).
        when(postLikeRepository.countByPostIds(any()))
                .thenReturn(List.<Object[]>of(new Object[] {activePost.getId(), 0L}));
        when(postCommentRepository.countByPostIds(any()))
                .thenReturn(List.<Object[]>of(new Object[] {activePost.getId(), 0L}));

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

    // ── getFeed dispatch (Phase 6 named feeds) ─────────────────────────────────

    @Test
    void getFeed_following_returnsFollowedAuthorsActivePosts() {
        when(userRepository.findByEmail("other@test.com")).thenReturn(Optional.of(other));
        when(postRepository.findFollowingFeed(eq(other), eq(PostStatus.ACTIVE), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(activePost)));
        // Batched: the whole page's counts and the viewer's likes come back in one query each
        // (#11/#16). The per-post findByPostAndUser / countByPost calls are gone — a 20-post
        // page used to issue 60 of them.
        when(postLikeRepository.countByPostIds(any()))
                .thenReturn(List.<Object[]>of(new Object[] {activePost.getId(), 2L}));
        when(postCommentRepository.countByPostIds(any()))
                .thenReturn(List.<Object[]>of(new Object[] {activePost.getId(), 0L}));
        when(postLikeRepository.findLikedPostIds(eq(other), any()))
                .thenReturn(List.of(activePost.getId()));

        PagedResponse<PostResponse> feed = postService.getFeed("following", "other@test.com", 0, 10);

        assertThat(feed.content()).hasSize(1);
        assertThat(feed.content().get(0).likeCount()).isEqualTo(2L);
        // The viewer's like status comes from the batched lookup, not a per-post query.
        assertThat(feed.content().get(0).likedByCurrentUser()).isTrue();
        verify(postLikeRepository, never()).findByPostAndUser(any(), any());
    }

    @Test
    void getFeed_following_anonymous_returnsEmptyPageNoError() {
        PagedResponse<PostResponse> feed = postService.getFeed("following", null, 0, 10);

        assertThat(feed.content()).isEmpty();
        verify(postRepository, never()).findFollowingFeed(any(), any(), any());
    }

    @Test
    void getFeed_toronto_filtersByCity() {
        when(postRepository.findByStatusAndCityOrderByCreatedAtDesc(
                eq(PostStatus.ACTIVE), eq("Toronto"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(activePost)));
        // Batched: the whole page's counts come back in one query each (#11/#16).
        when(postLikeRepository.countByPostIds(any()))
                .thenReturn(List.<Object[]>of(new Object[] {activePost.getId(), 0L}));
        when(postCommentRepository.countByPostIds(any()))
                .thenReturn(List.<Object[]>of(new Object[] {activePost.getId(), 0L}));

        PagedResponse<PostResponse> feed = postService.getFeed("toronto", null, 0, 10);

        assertThat(feed.content()).hasSize(1);
    }

    @Test
    void getFeed_bodyConfidence_filtersByTopic() {
        when(postRepository.findByStatusAndTopicOrderByCreatedAtDesc(
                eq(PostStatus.ACTIVE), eq("body-confidence"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(activePost)));
        // Batched: the whole page's counts come back in one query each (#11/#16).
        when(postLikeRepository.countByPostIds(any()))
                .thenReturn(List.<Object[]>of(new Object[] {activePost.getId(), 0L}));
        when(postCommentRepository.countByPostIds(any()))
                .thenReturn(List.<Object[]>of(new Object[] {activePost.getId(), 0L}));

        PagedResponse<PostResponse> feed = postService.getFeed("body-confidence", null, 0, 10);

        assertThat(feed.content()).hasSize(1);
    }

    @Test
    void getFeed_unknownFeed_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> postService.getFeed("bogus", null, 0, 10))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unknown feed");
    }

    // ── createPost — Share-a-Look ──────────────────────────────────────────────

    @Test
    void createPost_withSavedLook_bindsAssociationAndProducts() throws Exception {
        SavedLook look = SavedLook.builder().id(5L).user(author).build();
        PostRequest req = new PostRequest("wearing this", null,
                5L, List.of("100", "200"), "body-confidence", "Toronto");
        Post saved = Post.builder().id(12L).user(author).content("wearing this")
                .savedLook(look).productIds(objectMapper.writeValueAsString(List.of("100", "200")))
                .topic("body-confidence").city("Toronto").status(PostStatus.ACTIVE).build();

        when(userRepository.findByEmail("author@test.com")).thenReturn(Optional.of(author));
        when(savedLookRepository.findById(5L)).thenReturn(Optional.of(look));
        when(postRepository.save(any(Post.class))).thenReturn(saved);
        when(postLikeRepository.countByPost(saved)).thenReturn(0L);
        when(postCommentRepository.countByPost(saved)).thenReturn(0L);

        PostResponse resp = postService.createPost("author@test.com", req);

        assertThat(resp.savedLookId()).isEqualTo(5L);
        assertThat(resp.productIds()).containsExactly("100", "200");
        assertThat(resp.topic()).isEqualTo("body-confidence");
        assertThat(resp.city()).isEqualTo("Toronto");
    }

    @Test
    void createPost_withOthersSavedLook_throwsAccessDeniedException() {
        SavedLook othersLook = SavedLook.builder().id(9L).user(other).build();
        PostRequest req = new PostRequest("stealing your look", null, 9L, null, null, null);

        when(userRepository.findByEmail("author@test.com")).thenReturn(Optional.of(author));
        when(savedLookRepository.findById(9L)).thenReturn(Optional.of(othersLook));

        assertThatThrownBy(() -> postService.createPost("author@test.com", req))
                .isInstanceOf(AccessDeniedException.class);
        verify(postRepository, never()).save(any());
    }

    @Test
    void createPost_defaultsCityFromAuthor_whenNotProvided() {
        author.setCity("Toronto");
        PostRequest req = new PostRequest("plain photo", null, null, null, null, null);
        ArgumentCaptor<Post> captor = ArgumentCaptor.forClass(Post.class);
        Post saved = Post.builder().id(13L).user(author).content("plain photo")
                .city("Toronto").status(PostStatus.ACTIVE).build();

        when(userRepository.findByEmail("author@test.com")).thenReturn(Optional.of(author));
        when(postRepository.save(captor.capture())).thenReturn(saved);
        when(postLikeRepository.countByPost(saved)).thenReturn(0L);
        when(postCommentRepository.countByPost(saved)).thenReturn(0L);

        postService.createPost("author@test.com", req);

        assertThat(captor.getValue().getCity()).isEqualTo("Toronto");
    }

    // ── reportPost ─────────────────────────────────────────────────────────────

    @Test
    void reportPost_firstTime_savesOpenReport() {
        PostReport saved = PostReport.builder().id(70L).post(activePost).reporter(other)
                .reason("spam").status(ReportStatus.OPEN).build();
        when(userRepository.findByEmail("other@test.com")).thenReturn(Optional.of(other));
        when(postRepository.findById(10L)).thenReturn(Optional.of(activePost));
        when(postReportRepository.findByPostAndReporter(activePost, other)).thenReturn(Optional.empty());
        when(postReportRepository.save(any(PostReport.class))).thenReturn(saved);

        PostReportResponse resp = postService.reportPost(10L, "other@test.com", "spam");

        assertThat(resp.status()).isEqualTo(ReportStatus.OPEN);
        assertThat(resp.reason()).isEqualTo("spam");
        verify(postReportRepository).save(any(PostReport.class));
    }

    @Test
    void reportPost_duplicate_isIdempotent() {
        PostReport existing = PostReport.builder().id(71L).post(activePost).reporter(other)
                .reason("dup").status(ReportStatus.OPEN).build();
        when(userRepository.findByEmail("other@test.com")).thenReturn(Optional.of(other));
        when(postRepository.findById(10L)).thenReturn(Optional.of(activePost));
        when(postReportRepository.findByPostAndReporter(activePost, other)).thenReturn(Optional.of(existing));

        PostReportResponse resp = postService.reportPost(10L, "other@test.com", "spam again");

        assertThat(resp.id()).isEqualTo(71L);
        verify(postReportRepository, never()).save(any());
    }

    // ── getComments ────────────────────────────────────────────────────────────

    @Test
    void getComments_returnsActiveTopLevelComments() {
        PostComment comment = PostComment.builder().id(50L).post(activePost).user(other)
                .content("Nice!").status(CommentStatus.ACTIVE).build();
        when(postRepository.findById(10L)).thenReturn(Optional.of(activePost));
        when(postCommentRepository.findByPostAndParentCommentIsNullAndStatusOrderByCreatedAtAsc(
                eq(activePost), eq(CommentStatus.ACTIVE), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(comment)));

        PagedResponse<CommentResponse> comments = postService.getComments(10L, 0, 10);

        assertThat(comments.content()).hasSize(1);
        assertThat(comments.content().get(0).content()).isEqualTo("Nice!");
    }
}
