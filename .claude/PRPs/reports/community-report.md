# Implementation Report: Community (Phase 6)

## Summary
Implemented **PR-A (server foundation)** in full and **PR-B/F1 (web typed community client)** from the
Phase 6 Community plan. PR-A turns the community backend into a real, honesty-first UGC surface:
four named server feeds (Following / Discover / Toronto / Body-confidence, every query constrains
`status = ACTIVE`), **real** follower/following counts (derived `COUNT`, no denormalized columns),
Share-a-Look linkage (nullable `saved_look_id` FK + `product_ids` JSON), a user report → admin
moderation path, and comment hide/remove. PR-B/F1 adds the additive `api.ts` typed client
(`posts`/`follows`/`adminReports`) that the remaining web work builds on.

The remaining web tasks (PR-B F2–F4 and PR-C F5–F9) are **not built** — see *Remaining Work*. They
were deferred because they are large, cross-file, higher-regression-risk rewrites and one of them
surfaced a genuine server-contract gap (below) that needs a design decision.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual (this session) |
|---|---|---|
| Complexity | XL (server + web + migration, ~34 files, 3 stacked PRs) | PR-A + F1 delivered; F2–F9 deferred |
| Confidence | High (single-pass server) | Confirmed for server; web has an integration gap |
| Files Changed | ~34 incl. tests | 23 (22 server + 1 web) + 3 docs |
| Server tests | ~388 + ~25 new | 388 → **494** (0 failures, 0 errors) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| S1 | V15 migration | ✅ Complete | posts city/topic/saved_look_id(FK)/product_ids; users.city; post_comments.status/deleted_at; post_reports |
| S2 | Entities + enums | ✅ Complete | Post/User/PostComment extended; PostReport + CommentStatus + ReportStatus |
| S3 | Repository methods | ✅ Complete | findFollowingFeed (JPQL) + city/topic finders; Follow count queries; PostReportRepository; comment status finder |
| S4 | PostService feed dispatch + Share-a-Look + report + comments | ✅ Complete | 4-arg getFeed (+ back-compat 2-arg); ownership→403; idempotent report |
| S5 | FollowService.getCounts | ✅ Complete | real counts |
| S6 | AdminModerationService reports + comment hide | ✅ Complete | listReports/resolveReport(+takedown)/removeComment |
| S7 | Controllers | ✅ Complete | posts ?feed=/{id}/comments/report; follows /counts+/status; admin /reports+/comments/{id}/remove |
| S8 | DTOs | ✅ Complete | PostRequest/Response extended (back-compat ctors); PostReportRequest/Response; FollowCountsResponse |
| S9 | Security matcher sanity | ✅ Complete | No change needed — writes authed, /api/admin/** auto-gated |
| S10 | Server tests | ✅ Complete | +PostFeedDataJpaTest, service/controller coverage, TestUsers.anAdmin, IyaeApplicationTests mock |
| F1 | api.ts posts/follows/adminReports clients | ✅ Complete | additive; tsc clean; api.test.ts 20/20 |
| F2 | community-feed.ts server adapter + unions | ⬜ Deferred | high-risk (65-test immutability suite) |
| F3 | Delete 3 fabrication sites | ⬜ Deferred/Blocked | **blocked** — needs user id on public-profile API |
| F4 | useCommunityState write-through | ⬜ Deferred | depends on F2 |
| F5–F9 | 4 feed tabs, Share-a-Look surfaces, report UI, admin tab, e2e | ⬜ Deferred | PR-C |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (server) | ✅ Pass | `gradle compileJava compileTestJava` clean (Java 22) |
| Static Analysis (web) | ✅ Pass (for change) | `tsc --noEmit`: 0 errors in changed files; 2 pre-existing errors in `useGenerationStatus.test.ts` (untouched, unrelated) |
| Unit Tests (server) | ✅ Pass | **494 tests, 0 failures, 0 errors** |
| Unit Tests (web) | ✅ Pass (for change) | `api.test.ts` 20/20; full suite 244 passed. One pre-existing fork-pool teardown flake on `useOutfitRiggingStatus.test.ts` reproduces on baseline in isolation (not caused by this change) |
| Build | ⚠️ N/A | server compiles; web build not run (deps installed mid-session) |
| Migration boot (MySQL) | ⚠️ Not run | Flyway is off in tests; V15↔entity column parity verified by inspection. Run `./dev.sh start` to confirm `ddl-auto=validate` boot |
| Integration / E2E | ⚠️ N/A | community e2e rewrite is PR-C (F9), not built |

## Files Changed

### Server (PR-A) — 12 main + 9 test + 1 migration
| File | Action |
|---|---|
| `db/migration/V15__community_feeds_share_report.sql` | CREATED |
| `entity/PostReport.java`, `entity/enums/CommentStatus.java`, `entity/enums/ReportStatus.java` | CREATED |
| `entity/Post.java`, `entity/User.java`, `entity/PostComment.java` | UPDATED |
| `repository/PostReportRepository.java` | CREATED |
| `repository/PostRepository.java`, `FollowRepository.java`, `PostCommentRepository.java` | UPDATED |
| `service/PostService.java`, `FollowService.java`, `AdminModerationService.java` | UPDATED |
| `controller/PostController.java`, `FollowController.java`, `AdminController.java` | UPDATED |
| `dto/PostReportRequest.java`, `PostReportResponse.java`, `FollowCountsResponse.java` | CREATED |
| `dto/PostRequest.java`, `PostResponse.java` | UPDATED (back-compat ctors) |
| `test/.../repository/PostFeedDataJpaTest.java` | CREATED |
| `test/.../{PostServiceTest,PostControllerTest,FollowServiceTest,FollowControllerTest,AdminControllerTest,AdminModerationServiceTest,IyaeApplicationTests}.java`, `testsupport/TestUsers.java` | UPDATED |

### Web (PR-B/F1) — 1
| File | Action |
|---|---|
| `web/lib/api.ts` | UPDATED — `posts`/`follows`/`adminReports` clients + interfaces |

### Docs — 3
`CLAUDE.md`, `server/CLAUDE.md` (PostStatus doc-drift fix + changelog), this report.

## Deviations from Plan
- **PostRequest/PostResponse back-compat constructors** added so existing tests/callers compile
  without churn (the plan expected wider test edits). Jackson still uses the canonical all-args ctor.
- **`GET /api/posts` left authenticated** (not made public). Current `SecurityConfig` already routes it
  through `anyRequest().authenticated()`; signed-out browsing uses the localStorage demo per the plan's
  own "demo layer for signed-out" design. Following-feed anonymous handling is still tested at the
  service layer (returns empty page).
- **`AdminModerationService.listPostsForModeration` not paginated** — kept the existing `List` return
  to avoid breaking committed Phase-5 tests; the new report queue uses `PagedResponse`.

## Issues Encountered
- `IyaeApplicationTests.contextLoads()` failed after adding `PostReportRepository` (that test excludes
  JPA autoconfig and `@MockBean`s every repo) → added the missing `@MockBean`. Now green.
- No `gradle-wrapper.jar` committed and no system gradle → used the cached `gradle-8.10` distribution
  in `~/.gradle/wrapper/dists` directly. Web deps weren't present in the worktree → ran `npm install`.

## Blocker discovered (feedback for PR-B F3)
`GET /api/auth/users/profile/{username}` (`PublicProfileResponse`) exposes **no numeric user id**, but
`follows.counts(userId)` / `posts.byUser(userId)` are id-keyed. Deleting `profileFollowerEstimate()` and
wiring real counts on `/profile/[username]` therefore needs one of: (a) add `id` to `PublicProfileResponse`,
or (b) add a by-username counts endpoint. This is a small additive server change and should precede F3.

## Remaining Work (precise handoff — plan tasks F2–F9)
1. **F2** `community-feed.ts`: `toSocialPost(serverPost)` adapter; extend `FeedView`/`CommunityTab` unions
   with `discover|toronto|body-confidence`; keep transforms pure (65-test immutability suite) and
   `saved/reposted` as local personal collections.
2. **F3** delete fabrication sites — after the profile-id server change above: `social-graph.ts`
   (drop `followerCount/followingCount/outfitCount`), `profile/[username]/page.tsx`
   (drop `profileFollowerEstimate`), `StyleCircleDialog.tsx` (drop `SOCIAL_PROFILES.slice(0,5)`).
3. **F4** `useCommunityState` write-through with graceful localStorage fallback on 404/offline.
4. **F5–F9** community page 4 feed tabs (BRAND heading, per-feed empty states), Share-a-Look bind +
   multi-surface `ShareALookButton`, report UI in `PostDetailDialog`, admin reports/comment tab,
   `community-feed.test.ts` + `e2e/community.spec.ts` rewrite.

## Next Steps
- [ ] Add numeric `id` (or username-counts endpoint) to unblock F3, then implement F2–F9.
- [ ] Run `./dev.sh start` to confirm V15 boots under `ddl-auto=validate` on real MySQL.
- [ ] Code review via `/code-review`; the draft PR is open for PR-A + F1.
