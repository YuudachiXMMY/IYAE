# Plan: Community (Phase 6)

## Summary
Turn IYAE's community from a **localStorage demo with fabricated social proof** into an **authentic, server-backed UGC surface**. The backend already persists posts/likes/comments/follows (V8) and exposes real like/comment counts — but **zero web code calls it**: the community UI runs entirely on `web/lib/community-feed.ts` + `social-graph.ts` with hardcoded counts (likeCount `12000/9800/6200`, followerCount `18420/9310/22100`, a `profileFollowerEstimate()` formula, and `StyleCircleDialog` faking followers as `SOCIAL_PROFILES.slice(0,5)`). Phase 6 (1) **wires the web onto the real server API and deletes every fabrication site** (the PRD's #1 Must + guardrail: real, non-fabricated counts, no dark patterns), (2) adds the **four named feeds** (Following / Discover / Toronto / Body-confidence) server-side, (3) makes **Share a Look** bind a real saved look/products to a post and post through the server from multiple surfaces, and (4) adds a **user report → admin moderation** flow on top of the existing ADMIN takedown API.

## User Story
As a **Toronto Gen Z shopper who is skeptical of polished AI/branded content and values authentic UGC**, I want **to browse real looks from people I follow and from my city, share my own looks with the exact pieces I wore, and see honest like/follower counts (never inflated)**, so that **I trust the community, discover local style, and feel safe posting — with a way to report anything abusive**.

## Problem → Solution
**Current state:** The community backend (`PostService`/`FollowService`, `/api/posts`, `/api/follows`, V8 tables, Phase-5 ADMIN moderation on `/api/admin/posts`) is merged and its like/comment counts are **real DB aggregates** — but the frontend never touches it. The web community is 100% `localStorage`: `getFeedByTab` supports only `for-you|following|saved|reposted`; every count is a hardcoded literal or a local `±1`; "Share a Look" (`CreateFashionPostDialog`) is wired only into `/dashboard`, isn't bound to any saved look/outfit entity, and persists to `localStorage` only; there is no user report path and comments have no moderation field. In production (`IS_PROD` guards) the demo seeds are empty, so **prod community is blank**. The server has no notion of a feed *type*, no location or topic dimension on posts, no follower/following count query, and no Share-a-Look linkage.
**Desired state:** Authenticated community reads/writes hit the server; displayed counts are server-derived and honest (fabrication sites deleted); the four named feeds are real server queries that always constrain `status = ACTIVE` (so moderated posts vanish everywhere); a shared look references a real `SavedLook` + product ids and is created via `POST /api/posts`; any user can report a post into an admin queue; an admin can hide posts/comments and hidden content drops out of every feed.

## Metadata
- **Complexity**: **XL** (spans server + web + a migration; ~34 files incl. tests; delivers as 3 stacked PRs — see Delivery Split)
- **Source PRD**: `.claude/PRPs/prds/iyae.prd.md`
- **PRD Phase**: Phase 6 — Community
- **Estimated Files**: ~34 (18 server · 14 web · 2 shared/docs), incl. tests
- **Depends on**: Phase 1 (Rebrand — complete), Phase 2 (Design System — complete), Phase 5 (Marketplace + **ADMIN role + `/api/admin/**` moderation** — complete). Phase 6 is `with 7` (Resale can run in parallel).
- **Next Flyway migration**: **V15** (V14 = `analytics_events_and_cohorts` is the current highest — **not** V13 as older plans hint)

---

## Delivery Split (recommended PR boundaries)

Three stacked workstreams. PR-A is pure-additive backend (full suite stays green independently); the web PRs consume PR-A and **degrade gracefully** (fall back to the existing localStorage demo layer) if an endpoint 404s.

| PR | Workstream | Tasks | Risk |
|----|-----------|-------|------|
| **PR-A** | **Server** — V15 migration, feed dimensions, real counts, Share-a-Look FKs, report intake, moderation | S1–S10 | Additive; new migration + endpoints; strong existing net (388 tests) |
| **PR-B** | **Web real-data cutover** — `api.ts` `posts`/`follows` helpers, route community/profile onto the server, **delete the 3 fabrication sites** | F1–F4 | Consumes PR-A; the honesty foundation |
| **PR-C** | **Web feature** — 4 named feed tabs, Share-a-Look entry points, report UI, admin reports/comment tab, e2e | F5–F9 | Consumes PR-A + PR-B; UI + brand-residue cleanup |

Land order: **PR-A → PR-B → PR-C.** PR-B and PR-C both edit `community-feed.ts` / `community/page.tsx`, so they may co-land as one web branch if reviewing stacked; keep them as separate commits.

---

## UX Design

### Before
```
/community  (localStorage only — never calls the server)
┌─────────────────────────────────────────────┐
│  "Communette"                                │ ← hardcoded name (not BRAND)
│  [For you] [Following] [Saved] [Reposted]    │ ← not the 4 named feeds
│  ┌───────────────┐                           │
│  │ mila.rue      │  ♥ 12,000                 │ ← FABRICATED like count
│  │ [look image]  │  💬 3                      │
│  └───────────────┘                           │
│  Discover creators  (sidebar heading only)   │ ← no Discover feed
└─────────────────────────────────────────────┘

/profile/[username]
   Followers 1.2k   ← profileFollowerEstimate(240 + …) FABRICATED
   [Style circle] → followers = SOCIAL_PROFILES.slice(0,5)  FABRICATED

Share a Look: only in /dashboard; manual product re-pick; localStorage only.
Report abuse: (none)
```

### After
```
/community  (authenticated → server; demo layer only for signed-out/offline)
┌─────────────────────────────────────────────┐
│  "IYAE Community"           (from BRAND)     │
│  [Following] [Discover] [Toronto] [Body-confidence]
│  ┌───────────────┐                           │
│  │ mila.rue      │  ♥ 3   💬 1   ⚑ report    │ ← REAL server counts
│  │ [look image]  │  wearing: 2 pieces →      │ ← Share-a-Look products
│  └───────────────┘                           │
│  Empty-state per feed (e.g. "Follow people   │
│  to fill your Following feed")               │
└─────────────────────────────────────────────┘

/profile/[username]
   Followers 3   Following 5     ← GET /api/follows/{id}/counts (REAL)
   [Style circle] → real followers/following lists from /api/follows

Share a Look:  PDP · Try-on result · Outfit view · Profile · Community
   → picks a saved look + tags real products + topic/city → POST /api/posts
Report abuse:  ⚑ on every post → POST /api/posts/{id}/report → admin queue
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Feed tabs | `for-you / following / saved / reposted` (client filter) | `following / discover / toronto / body-confidence` (server) + keep `saved/reposted` as personal collections | `GET /api/posts?feed=<type>` |
| Like/comment counts | Fabricated literal / local `±1` | Server `countByPost` aggregates | delete `toggleLike` `±1` on real posts |
| Follower/following counts | `profileFollowerEstimate()` + `slice(0,5)` | `GET /api/follows/{id}/counts` (real) + real lists | 3 fabrication sites deleted |
| Share a Look | `/dashboard` only, unbound, localStorage | Multi-surface entry, binds `SavedLook` + product ids, `POST /api/posts` | new nullable FKs on `posts` |
| Report | none | `⚑` → `POST /api/posts/{id}/report` → admin queue | new `post_reports` table |
| Moderation | admin archive/remove posts (Phase 5) | + user reports queue + comment hide; hidden content drops from all feeds | extends `AdminController` |
| Prod community | empty (IS_PROD seeds `[]`) | populated from real server data | server is the source of truth |

---

## Mandatory Reading

Read before implementing. Grouped by workstream. **Line numbers are approximate anchors** — confirm on open.

### Server (PR-A)
| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `server/src/main/java/com/iyae/service/PostService.java` | 30–71, 150–164 | The single flat feed (`getFeed` → `findByStatusOrderByCreatedAtDesc(ACTIVE)`), the **real-count** `toResponse` (150–154), `serializeMediaUrls` JSON pattern (156–164) to copy for `product_ids` |
| P0 | `server/src/main/java/com/iyae/repository/PostRepository.java` | 10–15 | Only two finders exist; add following-join / city / topic queries here |
| P0 | `server/src/main/java/com/iyae/entity/Post.java` | 11–48 | Entity to extend (`city`, `topic`, `saved_look_id`, `product_ids`); Lombok `@Builder`, `@ManyToOne(LAZY)`, `@Enumerated(STRING)`, JSON column, soft-delete pattern |
| P0 | `server/src/main/java/com/iyae/service/FollowService.java` | 24–72 | Toggle + paged followers/following; add `getCounts` + route `isFollowing` (already exists, unrouted) |
| P0 | `server/src/main/java/com/iyae/repository/FollowRepository.java` | 11–16 | No count method — add `countByFollowing/countByFollower` (real follower/following counts) |
| P0 | `server/src/main/java/com/iyae/service/AdminModerationService.java` | 24–31, 75–97 | Privileged-override doc + `archivePost`/`removePost` (status flip hides from feed); extend for reports + comment hide |
| P1 | `server/src/main/java/com/iyae/controller/PostController.java` | 16–87 | `/api/posts` surface; add `?feed=`, `GET /{id}`, `GET /{id}/comments`, `POST /{id}/report` |
| P1 | `server/src/main/java/com/iyae/controller/FollowController.java` | 1–53 | `POST/DELETE /{userId}`, `GET /{userId}/followers|following`; add `/{userId}/counts`, `/{userId}/status` |
| P1 | `server/src/main/java/com/iyae/controller/AdminController.java` | 44–60 | Existing `/api/admin/posts` list/archive/remove; add `/reports`, comment hide |
| P1 | `server/src/main/java/com/iyae/dto/PostResponse.java` | 12–53 | Record + `from()`; extend with `city/topic/savedLookId/productIds` |
| P1 | `server/src/main/java/com/iyae/dto/PostRequest.java` | 7–10 | `(content, mediaUrls)` — extend for Share-a-Look |
| P1 | `server/src/main/java/com/iyae/dto/PagedResponse.java` | 5–23 | Paging envelope — reuse for every new feed + reports queue |
| P1 | `server/src/main/java/com/iyae/entity/enums/PostStatus.java` | 3–5 | **`ACTIVE, ARCHIVED, PENDING_DELETE`** — root CLAUDE.md wrongly says `DELETED`; use `PENDING_DELETE` |
| P1 | `server/src/main/resources/db/migration/V8__community_tables.sql` | 1–57 | DDL style to mirror for V15 (CREATE TABLE + FK + UNIQUE + INDEX); header comment mislabels itself "V7" — cosmetic |
| P1 | `server/src/main/resources/db/migration/V14__analytics_events_and_cohorts.sql` | all | Confirms **next number is V15** |
| P1 | `server/src/main/java/com/iyae/config/SecurityConfig.java` | 34–53 | Line 49 `/api/admin/** → hasRole("ADMIN")`; `/api/posts` feed GET is public-nullable-auth, writes need auth. Any new `/api/admin/**` route auto-gates |
| P1 | `server/src/main/java/com/iyae/config/GlobalExceptionHandler.java` | 23–83 | `IllegalArgumentException→400`, `AccessDeniedException→403`, `DataIntegrityViolationException→409` — new code inherits |
| P2 | `server/src/main/java/com/iyae/entity/SavedLook.java` + `saved_looks` (V1 `baseline_schema.sql:124`) | all | Share-a-Look FK target; confirm PK `saved_looks.id` and ownership |
| P2 | `server/src/main/java/com/iyae/config/DataSeeder.java` | 39–100 | `@Profile(!prod) @Order(2)`; seeds users/designers/products but **not** posts/follows → DB counts honestly zero. If seeding demo posts, keep counts derived |

### Web (PR-B / PR-C)
| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `web/lib/community-feed.ts` | 3–6, 76–82, 285–361, 508–549 | Type unions + `getFeedByTab` + `toggleLike ±1` + `createPost` + `toggleFollow` + `storageKey` (`clossette-` prefix) + version-4 migration. The seam to route onto the server |
| P0 | `web/lib/api.ts` | 1–43, 313–321, 360–368 | Typed fetch (`clossette_token` JWT, 401→/login), `admin` helper (has post moderation), `chat` helper (shape to mirror for `posts`/`follows`). **No public `posts`/`follows` client exists** |
| P0 | `web/lib/social-graph.ts` | 1–19, 26–27, 51–63, 112–116 | Fabricated `followerCount`; `location` string (only `nori.afterclass='Toronto'`); `findSocialProfile`; empty in prod |
| P0 | `web/app/profile/[username]/page.tsx` | 32–38, 77–116 | **`profileFollowerEstimate()` fabrication** to delete; merges serverProfile + static socialProfile |
| P0 | `web/components/profile/StyleCircleDialog.tsx` | 211–221 | **`followers = SOCIAL_PROFILES.slice(0,5)` fabrication** to delete |
| P1 | `web/app/community/page.tsx` | 40–45, 206, 359, 366–381 | `TABS` const, `humanizeNumber(post.likeCount)`, hardcoded `"Communette"` heading, semantic-token tab strip to mirror |
| P1 | `web/components/profile/CreateFashionPostDialog.tsx` | 17, 44, 51–72, 173–184, 322 | The "Share a Look" dialog; `CreatePostInput`; label `"Tag Closette Products"` (brand residue); fetches `/api/products` |
| P1 | `web/lib/hooks/useCommunityState.ts` | all | Central CRUD/follow/archive hook (dashboard + community); where server fetches slot in |
| P1 | `web/app/dashboard/page.tsx` | 130–260 | Only host of `CreateFashionPostDialog`; `handleCreatePost` → localStorage |
| P1 | `web/components/PostDetailDialog.tsx` | all | Comments/replies modal; where a report control + real comments fetch attach |
| P1 | `web/lib/utils.ts` (`humanizeNumber`) | — | Compact count display; keep feeding it a number |
| P1 | `web/lib/brand.ts` (`BRAND`) | all | Source community name/labels from here, not hardcoded |

### Tests (both)
| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `server/src/test/java/com/iyae/service/PostServiceTest.java` | 39–92, 119–130, 229–248 | Service-test skeleton (`MockitoExtension`, **manually re-new `PostService` with a real `ObjectMapper`**), real-count + ownership assertions |
| P0 | `server/src/test/java/com/iyae/controller/PostControllerTest.java` | 28–78 | `@WebMvcTest + @Import(WebMvcSecurityConfig)`, `@WithMockUser`, `.with(csrf())`, `jsonPath`, unauth→403 |
| P0 | `server/src/test/java/com/iyae/controller/AdminControllerTest.java` | 118–143 | ADMIN role gating (`roles="ADMIN"` 200 vs DESIGNER/BUYER 403) |
| P1 | `server/src/test/java/com/iyae/service/AdminModerationServiceTest.java` | 99–125 | Moderation skips ownership; status-flip assertions |
| P1 | `server/src/test/java/com/iyae/service/FollowServiceTest.java` | 1–138 | Idempotent toggle, self-follow 400, paged lists |
| P1 | `server/src/test/java/com/iyae/repository/ProductSpecificationsDataJpaTest.java` | 34–72 | `@DataJpaTest` slice with **scoped `@EnableJpaRepositories`** (dodges broken `consumeToken`) — the pattern for a real feed-query test |
| P1 | `server/src/test/java/com/iyae/testsupport/{WebMvcSecurityConfig,MockAuthenticationFactory,TestUsers}.java` | all | Must-import test support; **`TestUsers` has no `anAdmin()`** — add it |
| P1 | `server/src/test/resources/application-test.yml` | 1–26 | H2 + `flyway.enabled=false` → **migrations are never run in tests**; a V15 file gets zero CI validation |
| P1 | `web/__tests__/lib/community-feed.test.ts` | 26–46, 283–321 | `makePost` factory + immutability + `getFeedByTab` — copy for adapter + new feed filters |
| P1 | `web/e2e/community.spec.ts` | 3–36 | Playwright login + tab assertions + heading `"Communette"` — **must be rewritten** for new tabs |

## External Documentation
No external research needed — Phase 6 uses only established internal patterns (Spring Data JPA, Flyway, Lombok records/entities, Next.js client fetch, Vitest, Playwright). All patterns are captured below from the codebase.

---

## Patterns to Mirror

Actual codebase snippets. New code must be indistinguishable from these.

### ENTITY (Lombok @Builder + LAZY FK + enum + JSON + soft-delete)
```java
// SOURCE: server/src/main/java/com/iyae/entity/Post.java:11-48
@Entity
@Table(name = "posts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Post {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "media_urls", columnDefinition = "json")
    private String mediaUrls;              // JSON string via ObjectMapper

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PostStatus status;

    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Column(name = "deleted_at")
    private Instant deletedAt;
    // Phase 6 adds: city (VARCHAR), topic (VARCHAR), savedLook (@ManyToOne LAZY, nullable), productIds (json String)
}
```

### SERVICE (header + REAL count derivation — never store/fabricate counts)
```java
// SOURCE: server/src/main/java/com/iyae/service/PostService.java:30-60,150-154
@Slf4j @Service @RequiredArgsConstructor
public class PostService {
    private final PostRepository postRepository;
    private final PostLikeRepository postLikeRepository;
    private final PostCommentRepository postCommentRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public PagedResponse<PostResponse> getFeed(String email, int page, int size) {
        User currentUser = email != null ? userRepository.findByEmail(email).orElse(null) : null;
        Pageable pageable = PageRequest.of(page, size);
        Page<Post> posts = postRepository.findByStatusOrderByCreatedAtDesc(PostStatus.ACTIVE, pageable);
        return PagedResponse.from(posts.map(p -> toResponse(p, currentUser, isLikedBy(p, currentUser))));
    }
    // counts are REAL — COUNT queries, never stored/faked:
    private PostResponse toResponse(Post post, User currentUser, boolean liked) {
        long likeCount = postLikeRepository.countByPost(post);
        long commentCount = postCommentRepository.countByPost(post);
        return PostResponse.from(post, likeCount, commentCount, liked);
    }
}
```

### REPOSITORY QUERY (JPQL follow-join for the Following feed — add to PostRepository)
```java
// SOURCE: PROPOSED (mirrors Spring Data conventions in PostRepository.java:10-15)
@Query("SELECT p FROM Post p WHERE p.status = :status " +
       "AND p.user.id IN (SELECT f.following.id FROM Follow f WHERE f.follower = :follower) " +
       "ORDER BY p.createdAt DESC")
Page<Post> findFollowingFeed(@Param("follower") User follower,
                             @Param("status") PostStatus status, Pageable pageable);

// City / topic feeds are derived finders (ACTIVE is ALWAYS constrained):
Page<Post> findByStatusAndCityOrderByCreatedAtDesc(PostStatus status, String city, Pageable pageable);
Page<Post> findByStatusAndTopicOrderByCreatedAtDesc(PostStatus status, String topic, Pageable pageable);
```

### REAL FOLLOWER/FOLLOWING COUNT (add to FollowRepository — no denormalized counter columns)
```java
// SOURCE: PROPOSED (mirrors FollowRepository.java:11-16)
long countByFollowing(User following);   // followers of `following`
long countByFollower(User follower);     // accounts `follower` follows
```

### CONTROLLER (feed GET tolerates anonymous; create → 201)
```java
// SOURCE: server/src/main/java/com/iyae/controller/PostController.java:32-40
@GetMapping
public ResponseEntity<PagedResponse<PostResponse>> getFeed(
        @RequestParam(defaultValue = "discover") String feed,          // Phase 6: feed type
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        Authentication authentication) {
    String email = authentication != null ? authentication.getName() : null;
    return ResponseEntity.ok(postService.getFeed(feed, email, page, size));
}
```

### JSON LIST COLUMN (serialize product ids the same way media_urls are stored)
```java
// SOURCE: server/src/main/java/com/iyae/service/PostService.java:156-164
private String serializeMediaUrls(List<String> mediaUrls) {
    if (mediaUrls == null || mediaUrls.isEmpty()) return null;
    try { return objectMapper.writeValueAsString(mediaUrls); }
    catch (Exception e) { log.warn("Failed to serialize mediaUrls", e); return null; }
}
```

### ADMIN MODERATION (status flip hides from feed; skips ownership; ADMIN URL-gated)
```java
// SOURCE: server/src/main/java/com/iyae/service/AdminModerationService.java:82-97
@Transactional
public AdminPostResponse archivePost(Long postId) {
    Post post = requirePost(postId);
    post.setStatus(PostStatus.ARCHIVED);
    log.info("Admin archived post {}", postId);
    return AdminPostResponse.from(postRepository.save(post));
}
@Transactional
public AdminPostResponse removePost(Long postId) {
    Post post = requirePost(postId);
    post.setStatus(PostStatus.PENDING_DELETE);
    post.setDeletedAt(Instant.now());
    return AdminPostResponse.from(postRepository.save(post));
}
```

### MIGRATION DDL (mirror for V15)
```sql
-- SOURCE: server/src/main/resources/db/migration/V8__community_tables.sql:16-25,40-56
CREATE TABLE post_likes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY uk_post_likes_post_user (post_id, user_id)
);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
```

### SERVICE TEST (MockitoExtension + real ObjectMapper + real-count stub)
```java
// SOURCE: server/src/test/java/com/iyae/service/PostServiceTest.java:39-92,119-130
@ExtendWith(MockitoExtension.class)
class PostServiceTest {
    @Mock PostRepository postRepository;
    @Mock PostLikeRepository postLikeRepository;
    @Mock PostCommentRepository postCommentRepository;
    @Mock UserRepository userRepository;
    @InjectMocks PostService postService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach void setUp() {
        // ObjectMapper isn't a @Mock — re-create the service with a real one:
        postService = new PostService(postRepository, postLikeRepository,
                postCommentRepository, userRepository, objectMapper);
        // ... build author + activePost fixtures ...
    }

    @Test void getFeed_returnsPaginatedActivePosts() {
        when(postRepository.findByStatusOrderByCreatedAtDesc(eq(PostStatus.ACTIVE), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(activePost)));
        when(postLikeRepository.countByPost(activePost)).thenReturn(3L);
        when(postCommentRepository.countByPost(activePost)).thenReturn(1L);
        PagedResponse<PostResponse> feed = postService.getFeed(null, 0, 10);
        assertThat(feed.content().get(0).likeCount()).isEqualTo(3L);   // REAL, not fabricated
    }
}
```

### CONTROLLER TEST (WebMvcTest security import, csrf, jsonPath, unauth 403)
```java
// SOURCE: server/src/test/java/com/iyae/controller/PostControllerTest.java:28-78
@WebMvcTest(PostController.class)
@Import(WebMvcSecurityConfig.class)
class PostControllerTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @MockBean PostService postService;

    @Test @WithMockUser(username = "test@example.com")
    void createPost_authenticated_returns201() throws Exception {
        when(postService.createPost(eq("test@example.com"), any())).thenReturn(samplePost());
        mockMvc.perform(post("/api/posts").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PostRequest("Hello world", null))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1));
    }
    @Test void createPost_unauthenticated_returns403() throws Exception {
        mockMvc.perform(post("/api/posts").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PostRequest("x", null))))
                .andExpect(status().isForbidden());
    }
}
```

### @DataJpaTest SLICE (scoped repos to dodge the broken consumeToken query; TestEntityManager)
```java
// SOURCE: server/src/test/java/com/iyae/repository/ProductSpecificationsDataJpaTest.java:34-72
@DataJpaTest
@ActiveProfiles("test")
@EnableJpaRepositories(
        basePackageClasses = PostRepository.class,
        excludeFilters = @ComponentScan.Filter(type = FilterType.REGEX,
                pattern = "com\\.iyae\\.repository\\.(?!PostRepository|FollowRepository).*"))
class PostFeedDataJpaTest {
    @Autowired TestEntityManager em;
    @Autowired PostRepository postRepository;
    @Autowired FollowRepository followRepository;
    // persist + em.flush() + em.clear(), then assert findFollowingFeed / city / topic predicates
}
```

### WEB TYPED-FETCH HELPER (mirror the `chat` object for new `posts`/`follows`)
```ts
// SOURCE: web/lib/api.ts:360-368
export const chat = {
  listSessions: (signal?: AbortSignal) => api.get<ChatSession[]>("/api/chat/sessions", { signal }),
  createSession: () => api.post<ChatSession>("/api/chat/sessions"),
  sendMessage: (sessionId: number, content: string) =>
    api.post<ChatMessage>(`/api/chat/sessions/${sessionId}/messages`, { content }),
};
// Phase 6 adds, in the same shape:
// export const posts = { feed: (feed, page, size, signal) => api.get<Paged<Post>>(`/api/posts?feed=${feed}&page=${page}&size=${size}`, {signal}),
//   create, like, unlike, comment, listComments, report };
// export const follows = { toggle, remove, counts: (id) => api.get<FollowCounts>(`/api/follows/${id}/counts`), status, followers, following };
```

### WEB DATA-MODULE (pure, immutable — never mutate; feed filter switch)
```ts
// SOURCE: web/lib/community-feed.ts:285-305
export function getFeedByTab(tab, posts, followedUsernames) {
  const active = posts.filter(isPostActive);
  switch (tab) {
    case "for-you":   return active.filter((p) => p.feedViews.includes("for-you"));
    case "following": return active.filter((p) => followedUsernames.includes(p.creatorUsername));
    case "saved":     return active.filter((p) => p.savedByCurrentUser === true);
    case "reposted":  return active.filter((p) => p.repostedByCurrentUser === true);
    default:          return active;
  }
}
// Phase 6: source posts from the server; keep saved/reposted as local personal collections.
```

### WEB SEMANTIC-TOKEN TAB STRIP (mirror for the 4 named feeds)
```tsx
// SOURCE: web/app/community/page.tsx:366-381
<div className="rounded-[2.4rem] bg-card/80 backdrop-blur-xl p-1.5 flex gap-1 shadow-heavy mb-8">
  {TABS.map((tab) => (
    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
      className={cn("flex-1 rounded-full px-4 py-2.5 text-xs font-medium tracking-wide transition-all",
        activeTab === tab.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
      {tab.label}
    </button>
  ))}
</div>
```

### VITEST DATA-MODULE TEST (factory + immutability + feed filter)
```ts
// SOURCE: web/__tests__/lib/community-feed.test.ts:26-46,283-321
function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return { id: 'post-1', creatorUsername: 'test.user', creatorName: 'Test User',
    image: 'gradient:#fff,#000', caption: 'Test caption', postedAt: '1h', type: 'outfit_photo',
    tags: [], productLinks: [], feedViews: ['for-you'], likeCount: 10, comments: [],
    likedByCurrentUser: false, savedByCurrentUser: false, repostedByCurrentUser: false,
    lifecycleState: 'active', ...overrides };
}
```

---

## Files to Change

### Server (PR-A)
| File | Action | Justification |
|---|---|---|
| `db/migration/V15__community_feeds_share_report.sql` | CREATE | `posts.city`, `posts.topic`, `posts.saved_look_id` FK, `posts.product_ids` json; `users.city`; `post_comments.status`; `post_reports` table + indexes |
| `entity/Post.java` | UPDATE | Add `city`, `topic`, `savedLook` (LAZY FK), `productIds` (json String) |
| `entity/User.java` | UPDATE | Add nullable `city` |
| `entity/PostComment.java` | UPDATE | Add `status` (enum `CommentStatus{ACTIVE,REMOVED}`) + `deletedAt` |
| `entity/PostReport.java` | CREATE | Report entity (reporter, post, reason, status, createdAt) |
| `entity/enums/CommentStatus.java` | CREATE | `ACTIVE, REMOVED` |
| `entity/enums/ReportStatus.java` | CREATE | `OPEN, RESOLVED, DISMISSED` |
| `repository/PostRepository.java` | UPDATE | `findFollowingFeed` (JPQL join), `findByStatusAndCity…`, `findByStatusAndTopic…` |
| `repository/FollowRepository.java` | UPDATE | `countByFollowing`, `countByFollower` |
| `repository/PostReportRepository.java` | CREATE | `findByStatusOrderByCreatedAtDesc`, `existsByPostAndReporter` |
| `repository/PostCommentRepository.java` | UPDATE | `findByPostAndParentCommentIsNullAndStatus…` (surface the unused query, add status) |
| `service/PostService.java` | UPDATE | `getFeed(feedType,…)` dispatch; Share-a-Look in `createPost`; `getPost`, `getComments`, `reportPost` |
| `service/FollowService.java` | UPDATE | `getCounts`, route-friendly `isFollowing` |
| `service/AdminModerationService.java` | UPDATE | `listReports`, `resolveReport`, `removeComment`, paginate post list |
| `controller/PostController.java` | UPDATE | `?feed=`, `GET /{id}`, `GET /{id}/comments`, `POST /{id}/report` |
| `controller/FollowController.java` | UPDATE | `GET /{userId}/counts`, `GET /{userId}/status` |
| `controller/AdminController.java` | UPDATE | `GET /reports`, `PUT /reports/{id}/resolve`, `PUT /comments/{id}/remove` |
| `dto/PostRequest.java`, `PostResponse.java` | UPDATE | Share-a-Look + city/topic fields |
| `dto/{PostReportRequest,PostReportResponse,FollowCountsResponse}.java` | CREATE | New DTO records |
| `config/DataSeeder.java` | UPDATE (opt) | Optionally seed a few demo posts/follows in dev **with derived counts** (no hardcoded totals); set seeded users' `city="Toronto"` |

### Server tests (PR-A)
| File | Action |
|---|---|
| `service/PostServiceTest.java` | UPDATE — feed-type variants, Share-a-Look, report, comment fetch |
| `service/FollowServiceTest.java` | UPDATE — real counts |
| `service/AdminModerationServiceTest.java` | UPDATE — reports queue, comment removal, moderated-post-hidden |
| `controller/PostControllerTest.java` | UPDATE — `?feed=` cases + invalid-feed 400 + report 201/auth |
| `controller/FollowControllerTest.java` | UPDATE — counts/status |
| `controller/AdminControllerTest.java` | UPDATE — reports/comment endpoints role-gating |
| `repository/PostFeedDataJpaTest.java` | CREATE — real feed-query predicates |
| `testsupport/TestUsers.java` | UPDATE — add `anAdmin()` |

### Web (PR-B + PR-C)
| File | Action | Justification |
|---|---|---|
| `web/lib/api.ts` | UPDATE | Add `posts` + `follows` typed helpers + `Post/Comment/FollowCounts` interfaces |
| `web/lib/community-feed.ts` | UPDATE | Server adapter `toSocialPost`; extend `FeedView`/`CommunityTab` (`discover/toronto/body-confidence`); route reads/writes to server when authed; keep localStorage as offline/demo fallback |
| `web/lib/social-graph.ts` | UPDATE | **Delete fabricated counts**; keep only display metadata (name/avatar/tones) as dev fallback |
| `web/app/profile/[username]/page.tsx` | UPDATE | **Delete `profileFollowerEstimate()`**; use `follows.counts()` |
| `web/components/profile/StyleCircleDialog.tsx` | UPDATE | **Delete `slice(0,5)`**; fetch real followers/following |
| `web/lib/hooks/useCommunityState.ts` | UPDATE | Fetch server feed; server-sourced counts; write-through create/like/follow |
| `web/app/community/page.tsx` | UPDATE | 4 named feed tabs; `BRAND`-sourced heading; per-feed empty states; server counts |
| `web/components/profile/CreateFashionPostDialog.tsx` | UPDATE | Bind `SavedLook` + topic/city; `POST /api/posts`; fix `"Tag Closette Products"` → `BRAND` |
| `web/components/community/ShareALookButton.tsx` | CREATE | Reusable entry-point button mounting the dialog |
| PDP / try-on / outfit view / profile pages | UPDATE | Mount `ShareALookButton` |
| `web/components/PostDetailDialog.tsx` | UPDATE | Report control + real comments fetch |
| `web/app/admin/page.tsx` | UPDATE | Reports queue tab + comment moderation |
| `web/__tests__/lib/community-feed.test.ts` | UPDATE | Adapter + new feed filters + immutability |
| `web/__tests__/lib/api.*.test.ts` | CREATE/UPDATE | `posts`/`follows` client tests |
| `web/e2e/community.spec.ts` | REWRITE | New tabs, Share-a-Look, report, moderated-post-hidden |

## NOT Building
- **No denormalized/stored count columns** (like/follower counters). Counts stay derived (`COUNT` queries) — this is the honesty guarantee. (Optional batch-count optimization is noted under Risks, not built here.)
- **No new realtime/websocket feed** — feeds are paginated REST, reverse-chronological (Discover) or filtered.
- **No recommendation/ranking algorithm** for Discover — it is the existing global ACTIVE-by-`createdAt` stream (ranking is a later iteration).
- **No image upload pipeline change** — Share-a-Look reuses existing media handling (`media_urls` JSON + the existing image picker); no new storage service.
- **No full comment-thread moderation UI beyond hide/remove** — no edit history, no appeals workflow.
- **No hard-delete purge job** for `PENDING_DELETE` posts (note it as follow-up; web already prunes its demo copies after 30 days).
- **No geolocation/geo-IP** — the Toronto feed uses an explicit `city` field, not device location.
- **No cross-account follow suggestions / "people you may know."**
- **No migration of existing `clossette-`-prefixed localStorage** beyond a fallback read (prod is server-backed; demo is dev-only).

---

## Step-by-Step Tasks

### PR-A — Server

#### Task S1: V15 migration
- **ACTION**: Create `server/src/main/resources/db/migration/V15__community_feeds_share_report.sql`.
- **IMPLEMENT**: `ALTER TABLE posts ADD COLUMN city VARCHAR(120) NULL, ADD COLUMN topic VARCHAR(60) NULL, ADD COLUMN saved_look_id BIGINT NULL, ADD COLUMN product_ids JSON NULL, ADD CONSTRAINT fk_posts_saved_look FOREIGN KEY (saved_look_id) REFERENCES saved_looks(id);` + `CREATE INDEX idx_posts_status_city ON posts(status, city);` + `CREATE INDEX idx_posts_status_topic ON posts(status, topic);`. `ALTER TABLE users ADD COLUMN city VARCHAR(120) NULL;`. `ALTER TABLE post_comments ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', ADD COLUMN deleted_at TIMESTAMP NULL;`. `CREATE TABLE post_reports (id BIGINT AUTO_INCREMENT PRIMARY KEY, post_id BIGINT NOT NULL, reporter_id BIGINT NOT NULL, reason VARCHAR(500) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'OPEN', created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE, FOREIGN KEY (reporter_id) REFERENCES users(id), UNIQUE KEY uk_post_reports_post_reporter (post_id, reporter_id)); CREATE INDEX idx_post_reports_status ON post_reports(status, created_at DESC);`
- **MIRROR**: MIGRATION DDL (V8 style).
- **GOTCHA**: `ddl-auto: validate` — entity fields must match columns exactly or the app won't boot. Tests never run Flyway (H2 create-drop), so validate against real MySQL via `dev.sh`. Do **not** reuse V13/V14 (taken).
- **VALIDATE**: `./gradlew bootRun` against a MySQL with prior migrations applied boots clean (or `./dev.sh start` + check logs).

#### Task S2: Entities + enums
- **ACTION**: Extend `Post`, `User`, `PostComment`; add `PostReport`, `CommentStatus`, `ReportStatus`.
- **IMPLEMENT**: `Post`: `@Column(name="city") String city;` `@Column(name="topic") String topic;` `@ManyToOne(fetch=LAZY) @JoinColumn(name="saved_look_id") SavedLook savedLook;` `@Column(name="product_ids", columnDefinition="json") String productIds;`. `User`: `@Column(name="city") String city;`. `PostComment`: `@Enumerated(STRING) @Column(name="status",nullable=false) CommentStatus status;` `@Column(name="deleted_at") Instant deletedAt;`. `PostReport`: fields per S1 with `@ManyToOne(LAZY)` reporter+post, `@Enumerated(STRING) ReportStatus status`, `@CreationTimestamp createdAt`.
- **MIRROR**: ENTITY pattern.
- **IMPORTS**: `jakarta.persistence.*`, `org.hibernate.annotations.CreationTimestamp`, existing enums package `com.iyae.entity.enums`.
- **GOTCHA**: keep `saved_look` FK nullable (plain photo posts have none). `open-in-view=false` → touch LAZY `savedLook` inside the `@Transactional` service.
- **VALIDATE**: `./gradlew compileJava` clean.

#### Task S3: Repository methods
- **ACTION**: Add feed queries + counts + report repo.
- **IMPLEMENT**: `PostRepository.findFollowingFeed(...)` (JPQL join snippet), `findByStatusAndCityOrderByCreatedAtDesc`, `findByStatusAndTopicOrderByCreatedAtDesc`. `FollowRepository.countByFollowing/countByFollower`. New `PostReportRepository extends JpaRepository<PostReport,Long>` with `Page<PostReport> findByStatusOrderByCreatedAtDesc(ReportStatus,Pageable)` + `boolean existsByPostAndReporter(Post,User)`. `PostCommentRepository`: add `…AndStatus(PostStatus,CommentStatus…)` variant.
- **MIRROR**: REPOSITORY QUERY + REAL COUNT snippets.
- **GOTCHA**: every new feed query **must** constrain `status = ACTIVE` (the single most important invariant — else moderated posts leak back).
- **VALIDATE**: `PostFeedDataJpaTest` (S10) green.

#### Task S4: PostService — feed dispatch, Share-a-Look, report, comments
- **ACTION**: Add feed-type dispatch and new operations.
- **IMPLEMENT**: `getFeed(String feed, String email, int page, int size)` switching on `feed` → `discover` (existing ACTIVE), `following` (needs current user; `findFollowingFeed`; empty page if user follows nobody / anonymous), `toronto` (`city="Toronto"`), `body-confidence` (`topic="body-confidence"`); unknown → `throw new IllegalArgumentException("Unknown feed: " + feed)` (→400). Keep the 2-arg `getFeed` as `discover` for back-compat or update callers. Extend `createPost` to accept `savedLookId`/`productIds`/`topic`/`city` (validate `savedLook` ownership when present; default `city` from author's `user.getCity()`). Add `getPost(id)`, `getComments(postId,page,size)` (surface `findByPostAndParentCommentIsNull…ACTIVE`), `reportPost(postId, email, reason)` (idempotent via `existsByPostAndReporter`).
- **MIRROR**: SERVICE pattern; ownership check (`AccessDeniedException`) from `softDelete`.
- **GOTCHA**: `toResponse` must keep counts derived. Don't leak enumeration: not-found uses `IllegalArgumentException("... not found")`.
- **VALIDATE**: `PostServiceTest` (S10) green.

#### Task S5: FollowService — real counts + isFollowing route support
- **ACTION**: Add `getCounts(userId)` returning `FollowCountsResponse(followers, following)` from `countByFollowing/countByFollower`; make `isFollowing(email, targetUserId)` reachable.
- **MIRROR**: FollowService paged methods.
- **VALIDATE**: `FollowServiceTest` counts assertions.

#### Task S6: AdminModerationService — reports + comment moderation
- **ACTION**: `listReports(status, page, size)` (paginate), `resolveReport(id, action)` (RESOLVED/DISMISSED; optional cascade to `removePost`), `removeComment(commentId)` (set `CommentStatus.REMOVED` + `deletedAt`); paginate `listPostsForModeration`.
- **MIRROR**: privileged-override doc + `archivePost/removePost`.
- **GOTCHA**: skip ownership (ADMIN URL-gated); not-found → `IllegalArgumentException` (400).
- **VALIDATE**: `AdminModerationServiceTest`.

#### Task S7: Controllers
- **ACTION**: Extend `PostController` (`?feed=`, `GET /{id}`, `GET /{id}/comments`, `POST /{id}/report`), `FollowController` (`GET /{userId}/counts`, `GET /{userId}/status`), `AdminController` (`GET /reports`, `PUT /reports/{id}/resolve`, `PUT /comments/{id}/remove`).
- **MIRROR**: CONTROLLER pattern; `Authentication` injection; 201 create / 204 delete.
- **GOTCHA**: `/api/posts/{id}/report` is a write → auth required (covered by `anyRequest().authenticated()`); feed GET stays public-nullable. New `/api/admin/**` auto-gates.
- **VALIDATE**: controller WebMvcTests (S10).

#### Task S8: DTOs
- **ACTION**: Extend `PostRequest` (`savedLookId:Long?`, `productIds:List<String>?`, `topic:String?`, `city:String?`), `PostResponse` (`city`, `topic`, `savedLookId`, `productIds`). Add `PostReportRequest(reason)`, `PostReportResponse`, `FollowCountsResponse(followers, following)`.
- **MIRROR**: DTO record + `from()`.
- **GOTCHA**: `@NotBlank` stays on `content`; new fields optional/nullable so plain posts still validate.
- **VALIDATE**: compile + serialization jsonPath in controller tests.

#### Task S9: Security matcher sanity
- **ACTION**: Confirm `SecurityConfig`: `/api/posts` GET public, writes authenticated, `/api/admin/**` ADMIN. Add explicit matchers only if a new route needs different treatment (none expected).
- **MIRROR**: SecurityConfig line 47–50.
- **VALIDATE**: WebMvc unauth/role tests pass.

#### Task S10: Server tests
- **ACTION**: Add/extend all tests in the "Server tests" table + `TestUsers.anAdmin()` + `PostFeedDataJpaTest`.
- **IMPLEMENT**: feed-type service tests (mock `followRepository` for following; assert `toronto`/`body-confidence` filter; unknown feed → `IllegalArgumentException`); Share-a-Look create test (asserts association persisted + surfaced); report idempotency; moderated-post-hidden (`getFeed` omits `ARCHIVED`/`PENDING_DELETE`); real follower/following counts; admin reports/comment role-gating.
- **MIRROR**: SERVICE TEST, CONTROLLER TEST, @DataJpaTest SLICE.
- **GOTCHA**: re-`new PostService(...)` with a real `ObjectMapper`. `@DataJpaTest` needs scoped `@EnableJpaRepositories` to dodge the broken `PasswordResetTokenRepository.consumeToken` query. Migrations aren't run in tests — entity/column drift only shows at MySQL boot.
- **VALIDATE**: `cd server && ./gradlew test` → all green (target ≈ 388 + ~25 new).

### PR-B — Web real-data cutover

#### Task F1: `api.ts` posts/follows helpers
- **ACTION**: Add `posts` and `follows` typed helper objects + response interfaces.
- **IMPLEMENT**: `posts.feed(feed,page,size,signal)`, `.get(id)`, `.create(payload)`, `.like/.unlike(id)`, `.comment(id,body)`, `.listComments(id)`, `.report(id,reason)`; `follows.toggle(id)`, `.remove(id)`, `.counts(id)`, `.status(id)`, `.followers(id)`, `.following(id)`. Interfaces `Post`, `Comment`, `FollowCounts` matching server DTOs.
- **MIRROR**: WEB TYPED-FETCH HELPER (`chat`).
- **GOTCHA**: reuse the existing `api.get/post/...` (JWT auto-inject, `AbortSignal`). Server `id` is `number`; web demo ids are strings — keep server ids numeric in the new interfaces.
- **VALIDATE**: `web/__tests__/api/*` client tests (mock fetch) pass.

#### Task F2: `community-feed.ts` server adapter + unions
- **ACTION**: Add `toSocialPost(serverPost): SocialPost` adapter; extend `FeedView`/`CommunityTab` to include `discover|toronto|body-confidence`; route authed reads/writes to the server via `useCommunityState`; keep localStorage as the signed-out/offline fallback (bump `COMMUNITY_STATE_VERSION` if the shape changes).
- **MIRROR**: WEB DATA-MODULE + VITEST TEST.
- **GOTCHA**: keep all transforms pure/immutable (65 tests assert non-mutation). `saved/reposted` remain **local** personal collections, not server feeds. Feed `likeCount` must come from the server (never the `±1` local path for real posts).
- **VALIDATE**: `community-feed.test.ts` green (updated).

#### Task F3: Delete the three fabrication sites
- **ACTION**: Remove fabricated counts.
- **IMPLEMENT**: `social-graph.ts` — drop `followerCount/followingCount/outfitCount` literals (keep display metadata as dev fallback only). `profile/[username]/page.tsx` — delete `profileFollowerEstimate()`; render `follows.counts()`. `StyleCircleDialog.tsx` — replace `SOCIAL_PROFILES.slice(0,5)` with `follows.followers()/following()`.
- **GOTCHA**: this is the PRD's #1 constraint — no remaining path may display an invented count. Grep for `followerCount`, `profileFollowerEstimate`, `slice(0, 5)` after.
- **VALIDATE**: manual + a test asserting the profile renders the server count, not the formula.

#### Task F4: `useCommunityState` write-through
- **ACTION**: Fetch the selected server feed; make create/like/follow write through to the server (optimistic UI acceptable) and reflect server counts.
- **MIRROR**: existing hook + `api.ts` helpers.
- **GOTCHA**: degrade gracefully to the localStorage demo if the API 404s/errors (offline/unauth) so signed-out browsing still works.
- **VALIDATE**: dashboard + community render server data when authed.

### PR-C — Web feature surface

#### Task F5: Community page — 4 named feeds
- **ACTION**: Replace `TABS` with `Following / Discover / Toronto / Body-confidence`; keep `Saved/Reposted` as a secondary personal group; source name from `BRAND` (fix `"Communette"`); add per-feed empty states.
- **MIRROR**: WEB SEMANTIC-TOKEN TAB STRIP; `humanizeNumber` for counts.
- **GOTCHA**: semantic tokens only (a residue-scan gate rejects `stone-*`/`bg-white`/hex/`purple-*`/`rose-*`).
- **VALIDATE**: page renders each feed; tab switch calls `posts.feed(<type>)`.

#### Task F6: Share a Look — bind + multi-surface
- **ACTION**: Extend `CreateFashionPostDialog` to select a `SavedLook` and topic/city, tag real products, and `POST /api/posts`; create `ShareALookButton`; mount on PDP, try-on result, outfit view/builder, profile, and community.
- **GOTCHA**: fix `"Tag Closette Products"` → `BRAND`. `savedLook` optional (plain photo still works). Persist through the server, not just localStorage.
- **VALIDATE**: e2e — share from PDP creates a server post that appears in Discover.

#### Task F7: Report UI
- **ACTION**: Add a `⚑ Report` control to `PostDetailDialog` (and the post card) → `posts.report(id, reason)` → `toast`.
- **GOTCHA**: idempotent server-side; show a friendly "already reported" on 4xx.
- **VALIDATE**: e2e report flow; report lands in admin queue.

#### Task F8: Admin console — reports + comments
- **ACTION**: Add a Reports tab (list `OPEN`, resolve/dismiss, jump-to-post) and comment-removal to `web/app/admin/page.tsx`, using new `admin` helpers.
- **MIRROR**: existing admin console tabs + `api.ts` `admin` helper.
- **VALIDATE**: ADMIN-gated; resolving a report / removing a comment reflects on next feed load.

#### Task F9: Web tests + e2e rewrite
- **ACTION**: Update `community-feed.test.ts` (adapter + new filters), add `api` client tests, **rewrite** `e2e/community.spec.ts` for the new tabs, Share-a-Look, report, and moderated-post-hidden; fix the `"Communette"` heading assertion.
- **GOTCHA**: e2e assumes a running dev server + API; keep defensive `test.skip()` when a feed is empty.
- **VALIDATE**: `npm run test` + `npm run test:e2e` green.

---

## Testing Strategy

### Unit / Integration Tests
| Test | Input | Expected | Edge? |
|---|---|---|---|
| `getFeed("following")` | user follows 2 authors, 3 posts | only followed authors' ACTIVE posts | — |
| `getFeed("following")` anonymous / follows nobody | no follower context | empty page (no error) | ✓ |
| `getFeed("toronto")` | posts city=Toronto + city=Vancouver | only Toronto ACTIVE | — |
| `getFeed("body-confidence")` | mixed topics | only `topic=body-confidence` ACTIVE | — |
| `getFeed("bogus")` | unknown feed | `IllegalArgumentException` → 400 | ✓ |
| moderated-post-hidden | post `ARCHIVED`/`PENDING_DELETE` | omitted from every feed | ✓ |
| `createPost` with `savedLookId` | valid saved look owned by author | association persisted + in `PostResponse` | — |
| `createPost` with others' `savedLookId` | not owned | `AccessDeniedException` → 403 | ✓ |
| `reportPost` twice | same user, same post | idempotent (one report) | ✓ |
| `FollowService.getCounts` | 3 followers / 5 following | `{3,5}` real | — |
| Admin `removeComment` | ADMIN | `CommentStatus.REMOVED`; drops from `getComments` | — |
| Admin endpoints as BUYER/DESIGNER | non-admin | 403 | ✓ |
| Web: profile follower count | server returns 3 | UI shows `3`, never the formula | ✓ |
| Web: authed feed | server likeCount=7 | renders `7` (not seed `12000`) | ✓ |
| Web `getFeedByTab`/adapter | server posts | mapped immutably; original unmutated | ✓ |

### Edge Cases Checklist
- [ ] Empty feed per type (following-nobody, no Toronto posts, no body-confidence) → friendly empty state, not error
- [ ] Anonymous GET feed (nullable auth) works for public feeds; Following requires a user
- [ ] Unknown `feed` param → 400
- [ ] Duplicate report / self-report handling (idempotent; decide if self-report allowed)
- [ ] Share a Look with no saved look (plain photo) still posts
- [ ] Moderated (ARCHIVED/PENDING_DELETE) post absent from all 4 feeds and profile
- [ ] Removed comment absent from `getComments`
- [ ] Offline/unauth → graceful localStorage fallback (no crash)
- [ ] No fabricated count survives (grep `followerCount`/`profileFollowerEstimate`/`slice(0, 5)`)
- [ ] Counts feed `humanizeNumber` as numbers

---

## Validation Commands

### Static Analysis
```bash
cd server && ./gradlew compileJava compileTestJava     # EXPECT: zero errors (Java 22)
cd web && npx tsc --noEmit                              # EXPECT: zero errors in changed files
```

### Unit Tests
```bash
cd server && ./gradlew test        # EXPECT: all green (~388 existing + ~25 new)
cd web && npm run test             # EXPECT: community-feed + api + profile tests pass
```

### Database / Migration Validation (migrations are NOT run by the test suite)
```bash
./dev.sh start                     # applies V1..V15 against MySQL; EXPECT: server boots (ddl-auto=validate passes)
./dev.sh logs server | grep -i "flyway\|validate\|schema"   # EXPECT: no validation errors
```

### E2E (requires running dev server + API)
```bash
cd web && npm run test:e2e -- community.spec.ts    # EXPECT: new tabs, Share-a-Look, report, moderated-hidden pass
```

### Manual Validation
- [ ] Sign in → `/community` shows Following/Discover/Toronto/Body-confidence with **real** counts
- [ ] Follow a user → their posts appear in Following; profile follower count increments by exactly 1 (real)
- [ ] Share a Look from a PDP → the post appears in Discover with the tagged products
- [ ] Report a post → it lands in `/admin` Reports; admin remove → it disappears from every feed
- [ ] Sign out → community still renders (demo fallback), no fabricated counts shown while authed

---

## Acceptance Criteria
- [ ] All tasks completed across PR-A/B/C
- [ ] All validation commands pass (server test, web test, tsc, migration boot, e2e)
- [ ] The four named feeds are real server queries, each constraining `status = ACTIVE`
- [ ] Every displayed count is server-derived; the three fabrication sites are deleted; no invented count remains
- [ ] Share a Look binds a real saved look/products and posts through the server from ≥2 surfaces
- [ ] User report → admin queue → takedown works end-to-end; moderated content drops from all feeds
- [ ] No type errors, no residue-scan (color) violations
- [ ] Matches the UX After diagram

## Completion Checklist
- [ ] Code follows discovered patterns (entity/service/DTO/repo/controller/tests)
- [ ] Error handling matches `GlobalExceptionHandler` (400/403/409)
- [ ] Logging via `@Slf4j log.info` on moderation actions
- [ ] Tests follow existing MockitoExtension / WebMvcTest / @DataJpaTest / Vitest / Playwright patterns
- [ ] No hardcoded brand strings (use `BRAND` / `BrandProperties`); `"Communette"` and `"Tag Closette Products"` fixed
- [ ] `PostStatus.PENDING_DELETE` used (not the doc's wrong `DELETED`); root/server CLAUDE.md doc-drift noted/fixed
- [ ] Docs updated (`CLAUDE.md` test counts + PRD Phase 6 → in-progress with plan link)
- [ ] No unnecessary scope additions (see NOT Building)
- [ ] Self-contained — no codebase searching needed during implementation

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Web→server cutover regresses the 65-test community-feed suite | M | M | Keep transforms pure; adapter layer preserves `SocialPost` shape; localStorage stays as fallback; update tests alongside |
| Server/client model mismatch (content vs caption, nested comments vs count) | M | M | `toSocialPost` adapter; fetch comments on demand via new `GET /{id}/comments`; keep server ids numeric |
| N+1 in feed mapping (per-post `countByPost` + `isLikedBy`) at scale | M | L | Acceptable for MVP page sizes; note optional GROUP-BY batch projection as follow-up (not built) |
| V15 not exercised by tests (Flyway off in CI) → entity/column drift only caught at MySQL boot | M | M | Explicit `./dev.sh start` boot check in validation; `@DataJpaTest` covers query predicates against H2 |
| A new feed query forgets `status = ACTIVE` → moderated posts leak | L | H | Invariant called out per task; a moderated-post-hidden test per feed |
| Toronto/Body-confidence dimensions (`city`/`topic`) need owner sign-off on taxonomy | M | L | Ship as documented Decisions; values swappable; author picks in composer |
| Brand/storage-key residue (`clossette-*`) causes confusion | L | L | Fix visible strings; leave storage-key rename as optional migration (prod is server-backed) |

## Notes

**Decisions (defensible defaults — flag for owner sign-off at implementation, mirroring how the Phase 2 plan flagged brand constants):**
1. **Toronto feed** = `posts.city = 'Toronto'`, `city` populated from the author's new `users.city` (seed dev users to Toronto). Alternative considered: join through `designer_profiles.city` (V12) — rejected because posts are authored by buyers too, not only designers.
2. **Body-confidence feed** = `posts.topic = 'body-confidence'`, chosen by the author in the composer. Alternative: a `post_tags` join table — deferred (heavier; a single nullable `topic` covers the one named feed now).
3. **Discover feed** = the existing global ACTIVE-by-`createdAt` stream (no ranking). `for-you` is folded into Discover in the UI.
4. **Share a Look** binds a nullable `saved_look_id` FK (→ `saved_looks`, V1) + a `product_ids` JSON column; `OutfitRecommendation` considered but `SavedLook` is the user-facing "look."
5. **Real counts**: derived only (`COUNT`), never denormalized columns — satisfies the PRD "real / no dark patterns" constraint and the bracketing/authenticity guardrails.
6. **Moderation**: user reports (`post_reports`) feed the existing Phase-5 ADMIN queue; comment moderation via `post_comments.status`. Durable post-lock (`moderation_locked`, V13 catalog pattern) is **not** replicated for posts (status flip already hides; no re-publish path exists for posts today).

**Doc-drift to correct while here (found during exploration):**
- Root **CLAUDE.md** lists `PostStatus` as `ACTIVE/ARCHIVED/DELETED`; the real enum is `ACTIVE/ARCHIVED/PENDING_DELETE`. Fix the doc.
- Root/web **CLAUDE.md** claims community is "server-persisted via `/api/posts`/`/api/follows`" — true for the backend, but the **web never calls it** today. Phase 6 makes the claim actually true; update the doc to reflect the real (post-Phase-6) state.
- `V8__community_tables.sql` header comment mislabels itself "V7" (cosmetic).

**Confidence**: High that this is single-pass-implementable — all patterns, line anchors, the exact next migration number (V15), the real-vs-fabricated-count map, and the four-feed dimension model are captured. The one genuinely open item is owner taxonomy sign-off for `city`/`topic`, which does not block implementation (values are swappable).
