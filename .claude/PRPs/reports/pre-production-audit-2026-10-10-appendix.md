# Appendix — full finding list

Generated from the audit workflow's structured output after the final verification pass of
2026-10-11, in which **all 198 verifier agents and both completeness critics ran**. The
machine-readable version, carrying `evidence`, `proof`, `fix`, the full per-lens
`verifierSummary` for every row and all 29 coverage gaps, is
`pre-production-audit-2026-10-10-findings.json`.

**Verify column.** `3/3 held` = all three adversarial lenses (production reachability /
existing mitigation / factual accuracy) ran and none refuted it. Every blocking row now
carries 3/3 — nothing is retained fail-closed any more. A `X→Y` severity means the
verifiers talked the severity down from X to Y.

Totals: 48 blocking (all 48 held 3/3), 148 advisory (17 of them downgraded here by the verifiers), 1 refuted outright, 29 coverage gaps.

## Blocking (48)

| Sev | Category | Location | Verify | Finding |
|---|---|---|---|---|
| CRITICAL | security | `nginx/conf.d/default.conf`:21 | 3/3 held | Production nginx has no active TLS: HTTP->HTTPS redirect and the entire HTTPS server block are commented out, and ssl-init does not re-enable them automatically |
| CRITICAL | security | `nginx/conf.d/default.conf`:42 | 3/3 held | Unauthenticated, enumerable public access to every user's generated body-avatar GLB via /assets/ |
| CRITICAL | security | `nginx/conf.d/default.conf`:41 | 3/3 held | Nginx serves user avatar body meshes from /assets/avatars/{userId}/ with no authentication — body-measurement PII enumerable by unauthenticated visitors |
| CRITICAL | security | `server/src/main/java/com/iyae/config/GlbAssetInitializer.java`:61 | 3/3 held | Path traversal via designer-controlled glbUrl leads to arbitrary file write at startup |
| CRITICAL | security | `server/src/main/java/com/iyae/config/SecurityConfig.java`:46 | 3/3 held | Any user's 3D body scan is downloadable with no authentication at a guessable path |
| CRITICAL | data-integrity | `server/src/main/java/com/iyae/service/CheckoutService.java`:77 | 3/3 held | Stripe payment collection is unconditionally bypassed in production — every order ships free |
| CRITICAL | data-integrity | `server/src/main/java/com/iyae/service/ResaleService.java`:55 | 3/3 held | Stale-reservation sweep can release a listing for resale while an earlier buyer's Stripe payment still settles, causing a double-sale with a silent double-charge |
| CRITICAL | security | `web/package.json`:35 | 3/3 held | Production pins next@16.2.6, which carries multiple disclosed unauthenticated vulnerabilities including RCE and SSRF in the built-in Image Optimization API |
| CRITICAL | data-integrity | `worker/main.py`:138 | 3/3 held | rigging-worker silently becomes a second claimant for model/avatar tasks, completing them with mock/stub output |
| HIGH | availability | `docker-compose.prod.yml`:78 | 3/3 held | No restart policy on the production worker service -- a crash permanently halts all three queues |
| HIGH | availability | `docker-compose.prod.yml`:57 | 3/3 held | No restart policy on any production service, including the worker — a startup or OOM crash halts all 3D/avatar/rigging generation silently |
| HIGH | config | `docker-compose.prod.yml`:35 | 3/3 held | CORS_ORIGINS and FRONTEND_BASE_URL are unvalidated at startup; their effective prod defaults silently break all state-changing requests and every checkout/email link |
| HIGH | availability | `docker-compose.prod.yml`:48 | 3/3 held | No restart policy on any service in docker-compose.prod.yml — a crash or host reboot becomes a full outage with no auto-recovery |
| HIGH | availability | `docker-compose.prod.yml`:134 | 3/3 held | No automated TLS certificate renewal — ssl-renew is a fully manual command |
| HIGH | data-integrity | `docker-compose.prod.yml`:141 | 3/3 held | No automated backup of the MySQL or assets volume in the production stack, and no restore procedure — orders, PII and uploads live on one unreplicated Docker volume |
| HIGH | availability | `docker-compose.prod.yml`:105 | 3/3 held | No restart policy on any production service, and the worker has no healthcheck — one container death is a permanent outage |
| HIGH | security | `docker-compose.yml`:123 | 3/3 held | Hardcoded dev fallback for INTERNAL_MAIL_SECRET ships with no runtime safeguard, and the compose file that carries it exposes the web container directly |
| HIGH | security | `nginx/conf.d/default.conf`:21 | 3/3 held | Production nginx is HTTP-only — the HTTPS block and the 301 redirect are both commented out, so passwords and JWTs cross the internet in cleartext |
| HIGH | config | `prod_deploy.sh`:107 | 3/3 held | Production deploy path never validates INTERNAL_MAIL_SECRET, so email verification and password reset silently and completely break with zero deploy-time error |
| HIGH | availability | `prod_deploy.sh`:127 | 3/3 held | prod_deploy.sh 'update' cuts traffic over with no real health gate and no rollback |
| HIGH | security | `server/src/main/java/com/iyae/config/DataSeeder.java`:22 | 3/3 held | DataSeeder's profile guard is a deny-list ("!prod"), so any deployment that doesn't set SPRING_PROFILES_ACTIVE exactly to "prod" seeds a known-password ADMIN account |
| HIGH | availability | `server/src/main/java/com/iyae/config/GlobalExceptionHandler.java`:86 | 3/3 held | Catch-all 500 handler never logs — unexpected RuntimeExceptions vanish with zero server-side trace |
| HIGH | availability | `server/src/main/java/com/iyae/config/RateLimitFilter.java`:26 | 3/3 held | No rate limit or cooldown on job-creation endpoints that trigger paid/compute-heavy generation work |
| HIGH | availability | `server/src/main/java/com/iyae/controller/DesignerUploadController.java`:26 | 3/3 held | No rate limit or quota on designer image upload endpoint — shared-volume disk-fill DoS |
| HIGH | availability | `server/src/main/java/com/iyae/controller/HealthController.java`:22 | 3/3 held | /api/health returns a hardcoded 200 that never touches the database, and it is the container healthcheck and the deploy script's only success signal |
| CRITICAL→HIGH | security | `server/src/main/java/com/iyae/dto/PostResponse.java`:42 | 3/3 held | Email address leaks as the public "username" on community posts/comments when a user never set a username |
| HIGH | perf | `server/src/main/java/com/iyae/repository/OrderRepository.java`:15 | 3/3 held | Stripe webhook order lookup has no backing index on orders.stripe_session_id |
| HIGH | security | `server/src/main/java/com/iyae/service/AvatarService.java`:133 | 3/3 held | No account or data-deletion path exists: only the avatar/measurements can be deleted, leaving chat transcripts, posts, orders and analytics rows permanently |
| HIGH | data-integrity | `server/src/main/java/com/iyae/service/CheckoutService.java`:232 | 3/3 held | Resale webhook never persists the PAID order status — `markSold`'s `clearAutomatically = true` discards the unflushed Order change |
| HIGH | availability | `server/src/main/java/com/iyae/service/GuestAvatarService.java`:40 | 3/3 held | Guest avatar task creation never supersedes or caps prior tasks for the shared anonymous account |
| HIGH | perf | `server/src/main/java/com/iyae/service/PostService.java`:233 | 3/3 held | N+1 query pattern across the community feed, followers list, and saved looks (no JOIN FETCH / @EntityGraph) |
| HIGH | availability | `server/src/main/java/com/iyae/service/PostService.java`:82 | 3/3 held | Unbounded `size` query parameter on feed/follow/comment pagination allows a single request to bypass pagination entirely |
| HIGH | perf | `server/src/main/java/com/iyae/service/PostService.java`:233 | 3/3 held | Community feed N+1: per-post like/comment counts and like-status checks on every page of posts |
| HIGH | data-integrity | `server/src/main/java/com/iyae/service/ResaleService.java`:121 | 3/3 held | No server-side enforcement against the same owned unit being listed (and sold) more than once |
| HIGH | data-integrity | `server/src/main/java/com/iyae/service/ResaleService.java`:124 | 3/3 held | A seller can create unlimited active resale listings for a single owned unit — the duplicate guard exists only in the read path |
| HIGH | correctness | `server/src/main/java/com/iyae/service/ResaleService.java`:242 | 3/3 held | Resale fulfillment ignores a lost reservation: a `markSold` that matches 0 rows is logged at INFO and the buyer is still charged |
| HIGH | security | `web/Dockerfile`:14 | 3/3 held | Production container runs as root with no non-root USER, directly amplifying the next.js RCE above |
| HIGH | config | `web/Dockerfile`:11 | 3/3 held | NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION has no build-arg plumbing, so the production signup flow is permanently broken |
| HIGH | data-integrity | `web/app/profile/[username]/page.tsx`:146 | 3/3 held | Public profile's post grid is sourced from the viewer's own local community cache, not the profiled user's real posts — renders empty in production for every account |
| HIGH | data-integrity | `web/components/PostDetailDialog.tsx`:230 | 3/3 held | Comments and replies on community posts are never sent to the server — the UI reports success but the write is discarded |
| HIGH | accessibility-keyboard | `web/components/profile/LocalImagePicker.tsx`:104 | 3/3 held | Keyboard-only users cannot create a community post at all — mandatory image picker has no focusable/operable control |
| HIGH | config | `web/lib/auth-config.ts`:14 | 3/3 held | NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION can never reach `true` in a production build, bouncing every new signup |
| HIGH | data-integrity | `web/lib/hooks/useCommunityState.ts`:116 | 3/3 held | Follow button on the public profile page only updates local storage — never calls the real follow API |
| HIGH | data-integrity | `worker/providers/smplx_provider.py`:313 | 3/3 held | Every guest avatar overwrites one shared on-disk path, so a visitor can be shown another visitor's body mesh |
| HIGH | correctness | `worker/providers/tripo_generator.py`:86 | 3/3 held | TripoGenerator reads glb_resp.content after the stream has already been consumed — crashes every real Tripo3D generation |
| HIGH | correctness | `worker/providers/weight_transfer.py`:204 | 3/3 held | Rigging pipeline silently rebinds numerically-degenerate vertices to the pelvis with no error, log, or validation catch |
| HIGH | data-integrity | `worker/task_queue.py`:80 | 3/3 held | fail_task() has no RUNNING guard -- can overwrite an already-completed (READY) task back to FAILED |
| HIGH | availability | `worker/task_queue.py`:124 | 3/3 held | Stale-task reclamation has no heartbeat and no attempt cap, enabling duplicate processing and unbounded poison-task retries |

## Refuted by the adversarial pass (1)

Filed by a reviewer, then affirmatively demonstrated to be a false positive. Do not act on these.

| Filed as | Location | Refute votes | Finding |
|---|---|---|---|
| HIGH | `web/app/orders/[id]/page.tsx` | 3/3 | Order detail page does not reset order/error/loading when navigating between two different order ids — stale or wrong-order data and a stuck error banner can render |

## Advisory (148)

| Sev | Category | Location | Finding |
|---|---|---|---|
| MEDIUM | config | `.github/workflows/e2e.yml`:15 | No explicit `permissions:` block — GITHUB_TOKEN runs at repo-default scope, not least-privilege |
| MEDIUM | security | `.github/workflows/e2e.yml`:38 | All third-party actions pinned to mutable version tags, not commit SHAs |
| MEDIUM | security | `.github/workflows/e2e.yml`:61 | No dependency, SAST, or secret-scanning job anywhere in CI |
| MEDIUM | config | `.github/workflows/e2e.yml`:187 | Production worker image and production Spring/nginx topology are never built or exercised by CI |
| HIGH→MEDIUM | test-gap | `.github/workflows/e2e.yml`:185 | No test (unit, integration, or E2E) ever runs the real server<->worker task-queue contract against a real database |
| MEDIUM | maintainability | `CLAUDE.md`:72 | The entire resale surface (4 pages, 8 endpoints incl. a checkout path, 2 migrations) is absent from every module doc |
| MEDIUM | config | `CLAUDE.md`:187 | Nine documented env vars are not passed into any container, so setting them in .env silently does nothing |
| MEDIUM | correctness | `CLAUDE.md`:341 | CLAUDE.md states "10 migrations (V1-V10)" while 21 exist, so the documented next-version number collides with a committed migration |
| MEDIUM | config | `README.md`:29 | README.md and DESIGN.md still document Mailpit and an SMTP fallback that were fully removed |
| MEDIUM | availability | `dev.sh`:253 | dev.sh 'reset' wipes all Docker volumes with zero confirmation |
| MEDIUM | availability | `dev.sh`:208 | 'db restore' confirmation prompt doesn't validate input, so it's a no-op gate |
| MEDIUM | security | `dev.sh`:194 | DB password passed as a mysqldump/mysql CLI argument (visible via ps/docker top) |
| MEDIUM | security | `dev.sh`:131 | .env and DB backup dumps are created with default (world-readable) permissions |
| MEDIUM | availability | `docker-compose.prod.yml`:57 | No resource limits anywhere in docker-compose.prod.yml — a torch-laden worker runs unbounded next to an uncapped JVM on the same host |
| MEDIUM | config | `docker-compose.prod.yml`:19 | JVM heap is explicitly capped in dev (384m) but left to container/host defaults in prod with no memory limit set |
| MEDIUM | config | `nginx/conf.d/default.conf`:35 | nginx add_header inheritance drops security headers for /uploads/ and /assets/ in production |
| MEDIUM | security | `nginx/conf.d/default.conf`:38 | add_header inheritance trap drops the three security headers on /uploads/, /assets/, and /_next/static |
| MEDIUM | availability | `nginx/conf.d/default.conf`:27 | No tuned proxy timeouts for /api/, while AI chat calls to external providers have no explicit HTTP client timeout either |
| MEDIUM | availability | `nginx/nginx.conf`:4 | No edge-level rate or connection limiting anywhere in nginx; only a 10-route in-app allowlist is throttled |
| MEDIUM | data-integrity | `prod_deploy.sh`:75 | No backup mechanism is wired into the production deployment tooling |
| MEDIUM | correctness | `prod_deploy.sh`:178 | prod_deploy.sh health check reports Docker 'unhealthy' containers as OK |
| MEDIUM | config | `server/build.gradle.kts`:46 | Stripe SDK pinned to a floating minor-version range with no dependency locking |
| MEDIUM | availability | `server/src/main/java/com/iyae/config/RateLimitFilter.java`:26 | Resale listing creation and buy-now checkout are not covered by RateLimitFilter |
| MEDIUM | correctness | `server/src/main/java/com/iyae/config/SchedulerConfig.java`:44 | No server-side detection of a task stuck in RUNNING if the worker dies mid-flight |
| MEDIUM | correctness | `server/src/main/java/com/iyae/controller/AdminController.java`:36 | Invalid enum query params on admin endpoints return 500 instead of 400 |
| CRITICAL→MEDIUM | data-integrity | `server/src/main/java/com/iyae/controller/AnalyticsController.java`:34 | Any authenticated user can forge business-critical analytics events (ORDER_PAID/CHECKOUT_INITIATED/ORDER_RETURNED), corrupting KPI and INVEST/STOP decision data |
| MEDIUM | test-gap | `server/src/main/java/com/iyae/controller/GuestAvatarController.java` | GuestAvatarController / GuestAvatarService (unauthenticated write path) has zero test coverage |
| MEDIUM | availability | `server/src/main/java/com/iyae/dto/ChatMessageRequest.java`:6 | No length cap on chat message content or on resent conversation history — unbounded prompt growth and AI-provider cost per session |
| MEDIUM | correctness | `server/src/main/java/com/iyae/dto/CreateProductRequest.java`:21 | CreateProductRequest/UpdateProductRequest have no length validation matching the products table's VARCHAR bounds |
| MEDIUM | correctness | `server/src/main/java/com/iyae/dto/CreateProductRequest.java`:18 | Product price / resale askingPrice accept unbounded values against a DECIMAL(10,2) column |
| MEDIUM | test-gap | `server/src/main/java/com/iyae/dto/CreateProductRequest.java`:25 | Several request DTOs accept unbounded-size arrays with no @Size cap on element count |
| MEDIUM | data-integrity | `server/src/main/java/com/iyae/dto/CreateProductRequest.java`:18 | Product price and resale asking price have no upper bound before hitting a DECIMAL(10,2) column |
| MEDIUM | correctness | `server/src/main/java/com/iyae/dto/CreateProductRequest.java`:12 | Product name/category/currency have no @Size guard before VARCHAR(255/100/3) columns |
| MEDIUM | correctness | `server/src/main/java/com/iyae/dto/CreateResaleListingRequest.java`:30 | Resale listing `media` list has no length/size validation, unlike sellerNote/sizeLabel |
| MEDIUM | correctness | `server/src/main/java/com/iyae/dto/PostRequest.java`:8 | Post and comment body text has no maximum length validation |
| MEDIUM | data-integrity | `server/src/main/java/com/iyae/entity/GarmentAsset.java`:34 | GarmentAsset.slotHint enum (GarmentSlotHint) has a DRESS value with no corresponding label in the garment_assets.slot_hint DB ENUM |
| MEDIUM | availability | `server/src/main/java/com/iyae/repository/AnalyticsEventRepository.java`:31 | KPI aggregation queries scan the full analytics_events table with no date bound |
| MEDIUM | perf | `server/src/main/java/com/iyae/repository/AnalyticsEventRepository.java`:19 | Admin drape-decision KPI query has no index on analytics_events(event_type, created_at) |
| MEDIUM | correctness | `server/src/main/java/com/iyae/repository/PostCommentRepository.java`:13 | Post commentCount includes moderation-removed comments and un-retrievable nested replies |
| MEDIUM | perf | `server/src/main/java/com/iyae/repository/ProductSpecifications.java`:31 | Catalog free-text search (`q`) uses a leading-wildcard LIKE with no usable index |
| MEDIUM | perf | `server/src/main/java/com/iyae/repository/UserRepository.java`:11 | Username lookups wrap the indexed column in LOWER(), defeating idx_users_username on every registration and profile view |
| MEDIUM | maintainability | `server/src/main/java/com/iyae/service/AdminModerationService.java`:77 | Admin moderation actions are logged without the acting admin's identity — no attributable audit trail for irreversible takedowns |
| MEDIUM | availability | `server/src/main/java/com/iyae/service/AdminModerationService.java`:60 | Admin catalog/post/promotion listings have no pagination and return the entire table |
| MEDIUM | perf | `server/src/main/java/com/iyae/service/AdminModerationService.java`:60 | Admin console loads the entire products/posts table with no pagination |
| MEDIUM | security | `server/src/main/java/com/iyae/service/AuthMailService.java`:117 | User email addresses are logged at INFO on every transactional email and on checkout failures |
| MEDIUM | security | `server/src/main/java/com/iyae/service/AuthService.java`:284 | forgot-password / resend-verification leak account existence via response-time side channel |
| MEDIUM | security | `server/src/main/java/com/iyae/service/ChatService.java`:76 | [GENERATE_OUTFIT] side-channel is a bare regex match on raw LLM text with no structural safeguard against prompt injection |
| HIGH→MEDIUM | correctness | `server/src/main/java/com/iyae/service/ChatService.java`:187 | Uncaught ClassCastException from a type-confused [GENERATE_OUTFIT] payload 500s the chat turn and orphans the user's message |
| MEDIUM | data-integrity | `server/src/main/java/com/iyae/service/CheckoutService.java`:335 | Stub checkout path never clears the cart, enabling duplicate free/PAID orders from one cart |
| MEDIUM | data-integrity | `server/src/main/java/com/iyae/service/CheckoutService.java`:131 | A DB failure between Stripe session creation and local Order save silently orphans a payable Stripe session |
| MEDIUM | availability | `server/src/main/java/com/iyae/service/CheckoutService.java`:214 | Paid Stripe session with no matching order is silently acknowledged |
| MEDIUM | data-integrity | `server/src/main/java/com/iyae/service/CheckoutService.java`:234 | Webhook clears the user's whole current cart, not the purchased snapshot — items added after checkout started are silently deleted |
| MEDIUM | availability | `server/src/main/java/com/iyae/service/CheckoutService.java`:250 | Any authenticated user can reserve (and so hide) any resale listing for 30 minutes, with no rate limit on the resale checkout path |
| MEDIUM | security | `server/src/main/java/com/iyae/service/FileStorageService.java`:33 | Upload accepts/extension-maps based on client-supplied Content-Type, not file content |
| MEDIUM | config | `server/src/main/java/com/iyae/service/FileStorageService.java`:19 | FileStorageService upload directory is hardcoded, diverging from the configurable asset root used elsewhere |
| MEDIUM | correctness | `server/src/main/java/com/iyae/service/GenerationService.java`:143 | `processReadyTasks` catches per-task failures inside one shared transaction, so the per-item isolation it implies does not exist |
| MEDIUM | security | `server/src/main/java/com/iyae/service/GuestAvatarService.java`:60 | Guest avatar status polling is not rate-limited and the 'ownership' check does not isolate different anonymous sessions |
| MEDIUM | security | `server/src/main/java/com/iyae/service/GuestAvatarService.java`:44 | Guest body measurements are stored indefinitely by unauthenticated callers with no deletion path and no retention job |
| CRITICAL→MEDIUM | security | `server/src/main/java/com/iyae/service/GuestAvatarService.java`:65 | Guest avatar generation shares one global user identity — cross-session avatar overwrite + unauthenticated IDOR on task status |
| HIGH→MEDIUM | perf | `server/src/main/java/com/iyae/service/OutfitService.java`:130 | AI outfit generation loads the entire products table into memory on every chat turn instead of using the indexed status filter |
| MEDIUM | correctness | `server/src/main/java/com/iyae/service/PostService.java`:177 | Reply creation does not verify the parent comment belongs to the same post |
| MEDIUM | correctness | `server/src/main/java/com/iyae/service/PostService.java`:157 | Like/follow toggle is not atomic -- concurrent double-click or two-tab requests surface as a 409 instead of idempotent success |
| HIGH→MEDIUM | correctness | `server/src/main/java/com/iyae/service/PostService.java`:101 | Community feed N+1: 3 extra queries per post on every page load |
| HIGH→MEDIUM | correctness | `server/src/main/java/com/iyae/service/ProductService.java`:209 | Admin moderation lock (moderation_locked) is not enforced on the designer DELETE path |
| HIGH→MEDIUM | perf | `server/src/main/java/com/iyae/service/ProductService.java`:346 | N+1 query per product in ProductService.buildTaskStatusFallbackMap, hit on every public catalog page load |
| MEDIUM | data-integrity | `server/src/main/java/com/iyae/service/ResaleService.java`:153 | Public getListing does not filter by status, so soft-removed/sold/reserved listings remain fully browsable by id |
| MEDIUM | silent-failure | `server/src/main/java/com/iyae/service/ResaleService.java`:318 | ResaleService JSON snapshot parsing swallows exceptions with no logging, silently emptying a buyer's resale eligibility and purchase-provenance checks |
| MEDIUM | test-gap | `server/src/main/java/com/iyae/service/ResaleService.java`:168 | ResaleService.updateListing (price change + status-immutability guard + ownership) has zero test coverage |
| MEDIUM | config | `server/src/main/resources/application.yml`:5 | spring.datasource.password silently degrades to an empty password instead of failing fast when DB_PASSWORD is unset |
| MEDIUM | data-integrity | `server/src/main/resources/application.yml`:22 | No graceful shutdown anywhere (Spring default is immediate, no stop_grace_period) and the Stripe webhook silently ACKs a session with no Order row |
| MEDIUM | perf | `server/src/main/resources/application.yml`:2 | No connection-pool, thread-pool or container resource sizing in production, and one worker container serializes all three task queues |
| HIGH→MEDIUM | data-integrity | `server/src/main/resources/db/migration/V16__resale_listings.sql`:20 | resale_listings FK to products/users has no ON DELETE action — product deletion permanently fails once an item is ever resold |
| MEDIUM | data-integrity | `server/src/main/resources/db/migration/V8__community_tables.sql`:13 | Community tables (posts/post_likes/post_comments/follows) reference users(id) with default RESTRICT, inconsistent with the cascade pattern everywhere else |
| MEDIUM | perf | `server/src/main/resources/db/migration/V9__checkout_orders.sql`:2 | orders.stripe_session_id has no index despite being the lookup key for every Stripe webhook call |
| MEDIUM | test-gap | `server/src/test/java/com/iyae/controller/StripeWebhookControllerTest.java`:43 | StripeWebhookController's "invalid signature" test exercises a code path the real service never takes |
| MEDIUM | test-gap | `server/src/test/resources/application-test.yml`:9 | No fast test validates that the JPA entity mappings match the real Flyway migrations (ddl-auto=validate in prod) |
| MEDIUM | availability | `web/app/api/internal/mail/send/route.ts`:19 | No rate limiting or payload-size cap on the internal mail route itself |
| HIGH→MEDIUM | availability | `web/app/ar-visualization/page.tsx`:326 | No error boundary around the 3D canvas on the public /ar-visualization page |
| MEDIUM | correctness | `web/app/cart/page.tsx`:221 | Cart page's displayed grand total includes demo/AI-recommendation items that checkout explicitly never charges |
| MEDIUM | correctness | `web/app/cart/page.tsx`:68 | ServerItemRow's quantity/remove handlers swallow API errors with no catch — unhandled promise rejection and silent no-op on failure |
| MEDIUM | correctness | `web/app/chat/page.tsx`:286 | Switching AI chat sessions while a reply is in flight appends the stale session's response into the newly selected session |
| MEDIUM | correctness | `web/app/checkout/page.tsx`:69 | Checkout's 'Please retry' banner for a failed delivery-options load has no retry control |
| MEDIUM | correctness | `web/app/checkout/success/page.tsx`:24 | Checkout success page can display the wrong (previous) order's fulfillment details if the Stripe webhook hasn't created the new order yet |
| MEDIUM | data-integrity | `web/app/designer/products/[id]/edit/page.tsx`:80 | Product edit/create silently truncates a product's media array to a single image on every save |
| MEDIUM | correctness | `web/app/designer/products/page.tsx`:73 | Designer's own product catalog list conflates fetch failure with 'no products yet', deleting their business state from view |
| MEDIUM | correctness | `web/app/designer/promotions/page.tsx`:76 | Designer-only pages render protected UI before the role guard redirects a non-designer away |
| MEDIUM | availability | `web/app/layout.tsx`:38 | No global-error.tsx at the app root |
| MEDIUM | accessibility-navigation | `web/app/products/page.tsx`:206 | Skip-to-content link has no matching landmark on most primary pages — `#main-content` only exists via PageShell |
| HIGH→MEDIUM | correctness | `web/app/products/page.tsx`:100 | Primary shop/catalog page renders a failed fetch identically to a genuine zero-result search |
| MEDIUM | a11y | `web/app/register/page.tsx`:121 | Register wizard has no semantic <form> element — unlike every other auth page |
| MEDIUM | correctness | `web/app/resale/[id]/page.tsx`:41 | Resale listing detail page gets stuck on the loading skeleton forever for a malformed/zero id |
| MEDIUM | correctness | `web/app/resale/[id]/page.tsx`:40 | A non-numeric resale listing id leaves the page stuck on the loading skeleton forever, with no error or not-found state |
| HIGH→MEDIUM | availability | `web/components/AvatarViewer.tsx`:106 | Unbounded GPU/JS-heap retention of every loaded GLB -- drei's useGLTF cache is never cleared |
| MEDIUM | correctness | `web/components/FittingHelper.tsx`:153 | FittingHelper mutates materials shared by drei's GLTF cache, not per-instance clones |
| MEDIUM | accessibility-aria | `web/components/PostDetailDialog.tsx`:270 | Community post detail modal has no accessible name, plus a redundant unlabeled icon-only close button |
| MEDIUM | accessibility-focus | `web/components/SearchFilterBar.tsx`:82 | Visible focus indicator removed from the Sort control on the product catalog page |
| MEDIUM | correctness | `web/components/dashboard/MeasurementsPanel.tsx`:134 | Body measurement client inputs allow values the server will always reject (no max, mismatched min) |
| MEDIUM | correctness | `web/components/designer/PromotionList.tsx`:83 | Promotion delete is a one-click irreversible destructive action with no confirmation |
| MEDIUM | correctness | `web/components/register/StepBasics.tsx`:29 | Terms/Privacy checkbox in the register wizard is inert — never gates or reaches submission |
| MEDIUM | config | `web/components/register/StepBasics.tsx`:128 | Registration requires agreeing to a Terms and Privacy Policy that does not exist anywhere in the product |
| MEDIUM | test-gap | `web/e2e/designer-crud.spec.ts` | No E2E coverage of the admin moderation flow or the 3D-generation lifecycle, despite the test inventory implying otherwise |
| MEDIUM | security | `web/lib/api.ts`:10 | JWT in localStorage has no CSP backstop — script-src ships 'unsafe-inline' in both prod and dev |
| HIGH→MEDIUM | correctness | `web/lib/cart-context.tsx`:156 | CartProvider refetches /api/cart with no request sequencing — a stale response can overwrite a fresher cart, silently reverting items the user just added/removed |
| MEDIUM | data-integrity | `web/lib/community-feed.ts`:571 | Saving/reposting a real (server-backed) post is lost on reload and never appears under the Saved/Reposted tabs |
| MEDIUM | availability | `web/lib/demo-cart.ts`:41 | saveDemoCartItems has no try/catch around localStorage.setItem, unlike its sibling loadDemoCartItems — a throw crashes the cart effect |
| MEDIUM | security | `web/lib/email-templates.ts`:54 | Email template interpolates actionUrl into an href attribute without HTML-escaping |
| MEDIUM | correctness | `web/lib/hooks/useGenerationStatus.ts`:22 | useGenerationStatus has no AbortController -- the race class fixed in sibling hooks was not applied here |
| MEDIUM | config | `web/next.config.ts`:15 | next.config.ts's /api, /uploads, /assets rewrites are not actually dev-only -- they ship unconditionally in the production image with no validation of the baked-in API_PROXY_TARGET |
| MEDIUM | config | `worker/Dockerfile`:10 | Missing .dockerignore — COPY . . bakes local dev artifacts (.venv, __pycache__, .pytest_cache, tests/) into the image when present in the build context |
| MEDIUM | config | `worker/Dockerfile.rigging`:11 | Dockerfile.rigging omits the CPU-only torch index used by the base Dockerfile — production worker image pulls the CUDA-bundled wheel |
| MEDIUM | config | `worker/Dockerfile.rigging`:5 | RIGGING_PROVIDER=blender is a documented, selectable option but neither worker image installs the Blender binary it requires |
| MEDIUM | availability | `worker/main.py`:304 | No SIGTERM handling -- container stop/redeploy kills an in-flight task ungracefully |
| MEDIUM | availability | `worker/main.py`:218 | PythonRiggingProvider has no execution timeout or mesh-size cap, unlike BlenderRiggingProvider, and runs synchronously inside the single-threaded worker poll loop |
| MEDIUM | config | `worker/main.py`:45 | Model/avatar/rigging provider selection silently falls back to the mock/stub provider on a missing or misspelled env var, with no deploy-time guard |
| MEDIUM | availability | `worker/main.py`:132 | 3D-generation/avatar/rigging worker is a single serial process — no horizontal scale-out configured |
| MEDIUM | config | `worker/providers/blender_rigging_provider.py`:89 | BlenderRiggingProvider's avatar_glb_url is never populated by the server -- RIGGING_PROVIDER=blender would fail every rigging task |
| MEDIUM | availability | `worker/providers/meshy_generator.py`:237 | No retry/backoff on transient 429/5xx from Meshy/Tripo — a single rate-limit or transient server error fails the whole multi-minute generation attempt |
| MEDIUM | maintainability | `worker/providers/smplx_provider.py`:93 | Stale 'git lfs pull' remediation advice baked into runtime error/log messages |
| MEDIUM | config | `worker/requirements.txt`:6 | All runtime dependencies are unpinned (floor-only `>=`), including compatibility-sensitive ML packages — no lock file or upper bound |
| MEDIUM | correctness | `worker/task_queue.py`:121 | Model/avatar stale-reclaim has no attempt ceiling and can run a second generation for a task that is still live, writing the same output path |
| LOW | test-gap | `CLAUDE.md`:376 | CLAUDE.md contradicts itself on web and E2E test counts, and the E2E detail table omits 2 of 10 spec files |
| LOW | maintainability | `docker-compose.prod.yml`:42 | RATE_LIMIT_TRUSTED_PROXIES is read by the server and defaulted in docker-compose.prod.yml but absent from .env.example |
| LOW | perf | `nginx/conf.d/default.conf`:61 | Connection: upgrade is forced on every proxied request to the web upstream, not just WebSocket upgrades |
| LOW | maintainability | `prod_deploy.sh`:109 | prod_deploy.sh's own messages call it './deploy.sh', not the actual filename |
| LOW | maintainability | `review_results.json`:32 | review_results.json and huly-automation.txt are stale one-off artifacts tracked at the repo root |
| LOW | config | `server/Dockerfile`:8 | Server Dockerfile has no non-root user, no built-in JVM memory ceiling, and no HEALTHCHECK |
| LOW | security | `server/src/main/java/com/iyae/config/RateLimitFilter.java`:26 | No rate limiting on /api/auth/verify-email and /api/auth/reset-password |
| LOW | maintainability | `server/src/main/java/com/iyae/config/SecurityConfig.java`:64 | Unused AuthenticationManager/UserDetailsServiceImpl create a dead auth path that could mislead future changes |
| LOW | security | `server/src/main/java/com/iyae/dto/PostReportResponse.java`:19 | Admin report queue exposes a reporter's raw email address when they have no username |
| LOW | correctness | `server/src/main/java/com/iyae/repository/PasswordResetTokenRepository.java`:20 | consumeToken bulk UPDATE lacks clearAutomatically, unlike the equivalent pattern used elsewhere in the same codebase |
| LOW | perf | `server/src/main/java/com/iyae/repository/ProductSpecifications.java`:30 | Catalog search uses leading-wildcard LIKE with no index support |
| LOW | maintainability | `server/src/main/java/com/iyae/service/AuthService.java`:205 | bodyProfileVisibility is validated, persisted and exposed to clients but never read by any authorisation decision |
| HIGH→LOW | correctness | `server/src/main/java/com/iyae/service/CartService.java`:136 | Cart read/write path N+1 loads Product per line item (no JOIN FETCH, no batch-fetch) |
| LOW | maintainability | `server/src/main/java/com/iyae/service/GenerationService.java`:128 | GenerationService.retry() does not increment attemptCount, unlike the equivalent RiggingService.retry() |
| HIGH→LOW | security | `server/src/main/java/com/iyae/service/GuestAvatarService.java`:65 | Guest avatar status endpoint is an unauthenticated IDOR: the ownership check is a no-op because every guest shares one user row |
| LOW | maintainability | `server/src/main/java/com/iyae/service/PostService.java`:202 | PostService.archive() is unreachable in production -- no controller route calls it |
| LOW | perf | `server/src/main/resources/db/migration/V14__analytics_events_and_cohorts.sql`:15 | Unbounded-growth tables with no retention or archival plan |
| LOW | data-integrity | `server/src/main/resources/db/migration/V1__baseline_schema.sql`:11 | TIMESTAMP (Y2038, session-tz-dependent) mixed with DATETIME for equivalent point-in-time columns, with no timezone pinned anywhere in config |
| LOW | perf | `server/src/main/resources/db/migration/V4__email_verification_and_password_reset.sql`:33 | Redundant index on password_reset_tokens.token_hash |
| LOW | security | `web/app/api/internal/mail/send/route.ts`:21 | Secret comparison is not constant-time |
| HIGH→LOW | availability | `web/app/error.tsx`:16 | Root error.tsx has no escape route, and since every page renders its own SiteHeader, a crash anywhere strands the user with no navigation |
| LOW | config | `web/app/status/page.tsx`:96 | Public status page discloses the active AI provider name to anonymous visitors |
| LOW | perf | `web/components/AvatarViewer.tsx`:326 | All 3D Canvases render continuously (frameloop="always") with no idle throttling |
| LOW | correctness | `web/components/ImageUploader.tsx`:46 | ImageUploader: stale upload can overwrite a newer selection, and an in-flight object URL can leak on unmount |
| LOW | accessibility-semantics | `web/components/design-system/ProductCard.tsx`:50 | Save (heart) button nested inside the product-card <Link> on every item in the shop grid |
| HIGH→LOW | data-integrity | `web/lib/saved-products.ts`:110 | Stale per-device wishlist cache can silently resurrect a product the user removed on another device |
| LOW | security | `web/package.json`:32 | Secondary known-vulnerable packages (dompurify, nanoid, postcss, source-map-js) are fixable by refreshing the committed lockfile, independent of the next.js bump |
| LOW | maintainability | `worker/providers/meshy_generator.py`:19 | Dead code: _enforce_download_cap is defined but never called |

## Coverage gaps named by the two completeness critics (29)

These are the critics' answer to "what did this audit miss?". They are the terminal stage
of the pipeline, so — unlike the findings above — **they were not themselves put through the
3-lens adversarial pass**. Treat each as a lead with the critic's own evidence attached. The
ones I hand-verified are called out in the main report; the rest are unverified.

### G-1. No way to stop an abusive or compromised account: no suspension/ban flag, no server-side session revocation, no admin user management, no rate limit on UGC creation, no image moderation. Trust & safety / abuse response had no audit surface at all.

Verified: `server/src/main/java/com/iyae/entity/User.java` has no enabled/banned/locked/suspended/deleted column (grep returns nothing). `AdminController` (lines 34-98) exposes only product status, post archive/remove, comment remove, report resolve, promotion slot — zero user-directed endpoints; grep for suspend|banUser|disableUser|deactivate across `server/src/main/java` returns nothing. Logout is client-only (`web/lib/auth-context.tsx:106`, no server call) and `users.token_version` (V19) is bumped only on password reset, so a JWT lives its full 24h (`application.yml:28` expiration-ms 86400000) and cannot be revoked by the user, by an admin, or by anyone. `RateLimitFilter.RULES` (lines 26-40) covers 10 routes; `POST /api/posts`, `/api/posts/{id}/comments`, `/api/follows/{userId}`, `/api/designer/products` and `/api/resale/listings` are all absent. `FileStorageService` accepts any JPEG/PNG/WebP with no moderation hook, and `PostRequest.mediaUrls` is an unvalidated `List<String>`. Net: for a payments-carrying UGC marketplace, the only lever against a spammer, a harasser, or a stolen session is deleting content one row at a time while the actor keeps writing. The audit covered moderation of *content* (srv-admin-analytics) but never asked whether an *account* can be stopped.

**Suggested scope:** x-trust-safety: account suspension, session revocation, admin user management, UGC rate limits, upload moderation

### G-2. Stripe is absent from the entire env contract, so the CRITICAL payment-bypass cannot be fixed in CheckoutService alone — and the half-configured state silently charges cards without fulfilling.

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` exist only as `@Value("${STRIPE_SECRET_KEY:}")` / `@Value("${STRIPE_WEBHOOK_SECRET:}")` at `server/src/main/java/com/iyae/service/CheckoutService.java:53-57`. A case-insensitive grep for "stripe" across `.env.example`, `server/src/main/resources/*.yml`, `docker-compose.yml`, `docker-compose.prod.yml` and `prod_deploy.sh` returns **zero** hits. So (a) there is no documented way to enable payments and the prod compose cannot forward the keys even if an operator sets them, making the filed CRITICAL structurally unfixable at the code layer alone; and (b) the partial-config state is worse than either extreme — with the secret key set but the webhook secret missing, `handleWebhook` throws at line 170 for every delivery, so the buyer is charged by Stripe, the Order stays PENDING forever, the cart is never cleared, the resale unit is never marked SOLD, and Stripe retries into a 400 until it gives up. `prod_deploy.sh:107` validates only DB_PASSWORD, MYSQL_ROOT_PASSWORD and JWT_SECRET, so nothing catches it at deploy time.

**Suggested scope:** infra-compose-env + srv-payments: Stripe env plumbing, deploy-time validation, partial-config failure modes

### G-3. Nothing in the stack can tell anyone that production broke: zero observability dependencies, zero alerting, and zero log rotation on the same disk that holds the only copy of the database.

Verified absent everywhere: a grep for actuator|micrometer|prometheus|sentry|opentelemetry|datadog|newrelic across `server/build.gradle.kts`, `web/package.json`, `worker/requirements.txt`, `docker-compose.prod.yml` and `nginx/` returns nothing — no metrics endpoint, no error aggregation, no tracing, no APM. `prod_deploy.sh` contains no alert/uptime/webhook hook; its `health` command is manual and human-invoked. Neither compose file has any `logging:` block, so every container uses Docker's default json-file driver with no max-size/max-file, while `nginx/nginx.conf:27-28` sends an access-log line for *every request* to stdout. mysql_data, assets_data and those unbounded logs all live on one host filesystem (`docker-compose.prod.yml` volumes), so log growth is a direct path to a full disk and a dead MySQL. x-prod-readiness covered health/backups/timeouts but never incident detection or log retention, which is why four separate restart-policy findings were filed without anyone noting that the resulting outage is also invisible.

**Suggested scope:** x-observability: metrics, error aggregation, alerting, log retention and disk-pressure failure

### G-4. Email deliverability and sender-domain authentication were never examined; the production default sender is a Resend sandbox address that cannot deliver to real users.

`docker-compose.prod.yml:93` sets `MAIL_FROM: ${RESEND_FROM_EMAIL:-onboarding@resend.dev}`, and `.env.example:135-136` itself documents that default as "a sandbox — can only deliver to your Resend account email". `prod_deploy.sh:107` validates only DB_PASSWORD/MYSQL_ROOT_PASSWORD/JWT_SECRET, so `RESEND_FROM_EMAIL` being unset ships silently. Server-side `app.auth.require-email-verification` defaults true (`JwtAuthenticationFilter:30`) and `application-prod.yml` does not override it, so in that state every new account is permanently unverifiable — same blast radius as the two email findings already filed, different root cause, and unfixed by either of them. Nothing anywhere (deploy script, .env.example, docs) mentions SPF, DKIM or DMARC records, so even with a correct from-address the first production send is an untested deliverability experiment on the password-reset and verification paths.

**Suggested scope:** infra-scripts + web-internal-api: sender domain verification, SPF/DKIM/DMARC, deploy-time mail validation

### G-5. The outfit generation and outfit-builder feature — the product's headline capability and the only write path reachable directly from LLM output — has no audit surface and not one finding.

Not one of the 46 surface keys names outfits, and "outfit" appears in the 180 findings only inside the `[GENERATE_OUTFIT]` prompt-injection advisory and a cart-total remark. Uncovered production files verified present: server `controller/OutfitController.java`, `service/OutfitService.java`, `entity/OutfitRecommendation.java`, `repository/OutfitRecommendationRepository.java`, `dto/GenerateOutfitRequest.java`, `dto/ManualOutfitRequest.java`, `dto/OutfitResponse.java`, `dto/OutfitSlotResponse.java`; web `app/outfits/page.tsx`, `app/outfits/new/page.tsx`, `app/outfits/[id]/view/page.tsx`, `app/outfits/[id]/ar/page.tsx`, `app/looks/page.tsx`, `app/style-lab/page.tsx`, `components/outfits/` (OutfitBuilderPreview, OutfitDetailsForm, OutfitSlotSidebarItem, ProductPickerDialog, ProductSelectCard), `components/OutfitCard.tsx`, `lib/outfit-slots.ts`, `lib/demo-looks.ts`. This matters beyond coverage bookkeeping: per server/CLAUDE.md, `ChatService` regex-parses raw model text and then calls `OutfitService.generateOutfitAnonymous()` + `persistOutfit()` synchronously, so unvalidated LLM output reaches a persistence path that nobody reviewed — the srv-ai-chat surface stopped at the regex (one MEDIUM) and never followed it into the service it triggers.

**Suggested scope:** srv-outfits + web-outfit-builder: outfit generation, slot matching, manual builder, LLM-triggered persistence

### G-6. No published privacy policy, terms, cookie/consent surface, or data-subject-request path, in a product whose core data is body measurements, photos and 3D body meshes. Legal/regulatory readiness had no surface.

`web/components/home/LandingFooter.tsx:19-27` ships `href="#"` for Privacy, Terms and Contact on the landing page every anonymous visitor sees. `web/components/register/StepBasics.tsx:128` makes the user agree to documents that do not exist. There is no `/terms`, `/privacy` or `/cookies` route in `web/app` (full route listing verified), no consent banner, and no data-export endpoint anywhere in `server/src/main/java/com/iyae/controller`. The audit filed the inert checkbox and the missing documents as two MEDIUMs about *UI correctness*, and separately filed "no account or data-deletion path" as a HIGH — but no surface asked the regulatory question for a Toronto launch handling biometric-adjacent PII (PIPEDA + Quebec Law 25 consent/retention duties; GDPR access/erasure/portability for any EU visitor, which the product has no mechanism to answer). Deletion is only half of a DSAR obligation and the only half that was looked at.

**Suggested scope:** x-legal-compliance: privacy notice, terms, consent, retention policy, DSAR access/export/erasure

### G-7. Dependency-CVE review covered one of three ecosystems, and the single CRITICAL it produced is asserted without any in-repo evidence or a named fix target.

The `web/package.json` CRITICAL claims next@16.2.6 (verified at line 35) carries "multiple disclosed unauthenticated vulnerabilities including RCE and SSRF in the built-in Image Optimization API" — but cites no advisory ID, no fixed version to upgrade to, and no committed `npm audit`/SBOM artifact; nothing in the repo lets a reader reproduce or date-check it. Its reachability argument is also unexamined: `web/next.config.ts` has no `images` block at all (no remotePatterns, no `unoptimized`), which bounds what the optimizer will accept, and the finding never establishes which of the two cited bug classes survives that configuration. Meanwhile the other two ecosystems got no CVE pass whatsoever: `server/build.gradle.kts` pins Spring Boot 3.4.1 (a Dec-2024 release line) with spring-security/tomcat/jackson/mysql-connector-j/flyway all floating on that BOM, jjwt 0.12.6, and `com.stripe:stripe-java:26.+`; `worker/requirements.txt` is floor-only `>=` for everything including torch. CI has no scanning job (already a MEDIUM), so there is no mechanism that would have caught the other two.

**Suggested scope:** x-dependency-cves: per-ecosystem advisory pass (Gradle/Maven + pip) with reproducible scan artifacts and named fix versions

### G-8. Builds are neither reproducible nor verifiable: the Gradle wrapper jar is untracked, and two of three modules have no lockfile or hash pinning. Toolchain/supply-chain integrity had no surface.

`git ls-files server/gradle` returns only `gradle-wrapper.properties` — `gradle-wrapper.jar` is not tracked, swallowed by the blanket `*.jar` at `.gitignore:24`. So `./gradlew` cannot run on a fresh clone (which is why CI substitutes `gradle/actions/setup-gradle`, per the root CLAUDE.md), every developer and every build host silently uses whatever Gradle it happens to have, and the checksum-verified wrapper mechanism is defeated. There is no `gradle/verification-metadata.xml`, no Gradle dependency locking, and no hash-pinned `worker/requirements.lock`; only `web/package-lock.json` is committed. x-secrets covered credential handling and infra-ci covered action pinning (correctly flagging mutable tags as MEDIUM), but nothing covered build-toolchain integrity or artifact reproducibility — so a dependency-substitution attack and routine "works on my machine" drift are both unguarded on the server and worker.

**Suggested scope:** x-supply-chain: wrapper/toolchain integrity, dependency locking, reproducible builds

### G-9. The avatar-PII exposure findings name two of the four code paths that serve `/assets/`, so the remediation as scoped leaves the exposure open.

Four independent paths serve the worker output directory, and three findings (two nginx CRITICALs plus the SecurityConfig CRITICAL) cover only two of them. The unnamed ones: `server/src/main/java/com/iyae/config/WebMvcConfig.java` registers `/assets/**` onto `file:${worker.output-dir}` and `/uploads/**` onto the same root plus `uploads/` — so the Spring app itself is a static file server for the avatar meshes, independent of nginx; and `web/next.config.ts` rewrites `/assets/:path*` to the API target, so the Next.js container proxies the same bytes. Consequences the audit did not state: closing it at nginx alone leaves the Spring handler reachable by anything that can hit the server directly, and leaves the dev stack (where `/assets` flows web → server, no nginx in the path) fully exposed. Also, because `/assets/**` is the asset root, the single permitAll rule covers designer `uploads/` and user `avatars/` with one grant, so there is no place in the current design to authorize them differently.

**Suggested scope:** srv-upload-storage: complete the /assets serving-path inventory (WebMvcConfig, next.config rewrite, nginx, SecurityConfig) before scoping the fix

### G-10. Zero CRITICAL on the auth path is not a clean bill of health — and the audit missed that the server never returns 401, so a revoked or unverified session wedges the SPA permanently.

The auth surfaces yielded one HIGH (DataSeeder) and three MEDIUM/LOW, which given the rest of the report is suspicious. A concrete unreported defect demonstrates the gap: `JwtAuthenticationFilter.authenticate()` *silently declines* — plain `return;` with no response — on unknown user (line ~47), stale tokenVersion (line ~52) and unverified email (line ~57), so the request continues as anonymous. Spring's stateless chain then answers 403, not 401, for `authenticated()` matchers (corroborated by the server's own tests, e.g. SavedProductControllerTest/AvatarControllerTest asserting 403 for unauthenticated). But `web/lib/api.ts:53` clears the stored token **only** on 401 — so an expired, revoked or unverified token is never cleared, and the user sits in a half-signed-in state that no amount of reloading escapes. A follow-up pass should also re-examine: revocation (see the trust-&-safety gap); `app.auth.require-email-verification` being one switch that gates both registration-issued JWTs and chat access; the per-request `userRepository.findByEmail` in the filter (an extra query on every authenticated call, never raised by x-perf); `GET /api/auth/users/profile/**` being permitAll and username-enumerable; and the total absence of integration tests over `SecurityConfig` matcher ordering, which server/CLAUDE.md itself lists as untested while the `/recommended-size`-before-`/api/products/**` comment proves the ordering is already load-bearing.

**Suggested scope:** srv-auth-flows re-run: 401-vs-403 contract, silent-skip authentication, revocation, matcher-order integration tests

### G-11. No spend ceiling, quota, or kill switch on the paid AI and 3D-generation providers; the cost-runaway class was only touched at its edges.

Two adjacent findings exist (no rate limit on job-creation endpoints; no length cap on chat content) but nothing caps aggregate spend: there is no per-user generation quota, no daily or global budget, no concurrency cap on paid work, no cost metric (nothing emits metrics at all — see the observability gap), and no runtime kill switch — disabling a provider means editing env and redeploying, since `MODEL_GENERATION_PROVIDER` / `AI_PROVIDER` are read once at startup (`docker-compose.prod.yml:30-33, 64-66`). Both default to `mock` in the prod compose, so the first time a real provider is switched on is also the first time any of this is exercised, in production, with no ceiling and no visibility. For Meshy/Tripo (per-generation credits) and Claude/DeepSeek/MiniMax (per-token), one scripted client against the unthrottled job endpoints is an unbounded invoice.

**Suggested scope:** x-cost-controls: per-user quotas, global budget ceiling, provider kill switch, spend telemetry

### G-12. Mobile/responsive behaviour and i18n/l10n/currency had no surface, on a Gen-Z mobile-first product launching in one city with CAD pricing.

web-a11y audited the primary journeys for accessibility but no surface asked about small viewports: the heaviest routes are a 3D/AR try-on (`AvatarViewer`, `ARViewer`, `SmartARViewer`, all `frameloop="always"` per an existing LOW), a 6-step register wizard, and a PDP with a size selector — and `web/e2e/*` has no mobile project or device emulation. On localisation: `web/app/layout.tsx:39` hardcodes `<html lang="en">`, every string in the tree is inline English, and currency is a free-text `currency: string` on the product, order and resale types (`web/lib/api.ts:273, 340, 485`) with V18 having widened the column to VARCHAR — there is no allowed-code validation, no `Intl.NumberFormat` locale handling, and no server-side guarantee that a Stripe line item's currency matches the product's. Money that renders wrong, or a cart mixing currencies, is a visible trust failure on the only revenue surface.

**Suggested scope:** web-responsive + x-i18n-currency: viewport coverage on primary journeys, locale/currency formatting and validation

### G-13. SEO and indexability are absent as an engineering concern, and the architecture forecloses the usual fix.

No `robots.ts`/`robots.txt`, no `sitemap.ts`/`sitemap.xml`, no `manifest`, and no favicon or `app/icon` anywhere (`web/public` holds only the Next starter `next.svg`, `vercel.svg`, `window.svg`, `globe.svg`, `file.svg` plus assets/models/textures) — `web/middleware.ts:54` even excludes a `favicon.ico` that does not exist, so every page request 404s on it. `web/app/layout.tsx:28-32` is the only `metadata` export in the tree, with no OpenGraph or Twitter tags, and because every page is `"use client"` (a documented architectural choice) **no route can export its own metadata at all** — all 37 routes serve one title and description and render no server-side content, so a crawler sees an empty shell for every product and every designer. For a marketplace whose growth thesis is discovery, that is a commercial launch gap, and it is not a config tweak: fixing it means introducing server components on at least the catalog and PDP routes.

**Suggested scope:** web-seo-metadata: robots/sitemap/icons, per-route metadata, server-rendered catalog and PDP

### G-14. Report integrity: roughly 13 of the 48 "confirmed blocking" findings restate 6 underlying defects, inflating both the blocking count and the apparent breadth of coverage.

Counted from the finding list itself: the missing `restart:` policy in docker-compose.prod.yml is filed **four** times as separate HIGHs (worker-only, "any service including the worker", "any service … host reboot", "any service, and the worker has no healthcheck"); nginx TLS being commented out is filed twice (one CRITICAL, one HIGH); the one unauthenticated `/assets/avatars` exposure is filed as **three** CRITICALs (two nginx, one SecurityConfig); the resale duplicate-listing guard twice; the PostService feed N+1 twice; `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` twice (auth-config.ts and Dockerfile). The advisory tier repeats the pattern (admin pagination ×2, catalog leading-wildcard LIKE ×2, `orders.stripe_session_id` index as both a HIGH and a MEDIUM, backups as both a HIGH and a MEDIUM). De-duplicated the blocking list is ~40 defects, not 48. This is not cosmetic: it will generate duplicate fix tickets, it makes "3 deployment blockers / 65 blocking findings" non-comparable against any later run, and the triple-filing of the `/assets` exposure is exactly the case where the audit still missed two of the four serving paths (see that gap) — breadth of restatement was mistaken for breadth of analysis.

**Suggested scope:** audit process: de-duplicate by root defect before severity rollup; one finding per fix

### G-15. Tracked non-production artifacts at the repo root and a second unreferenced marketing landing page that no surface claimed.

`git ls-files` confirms three tracked junk artifacts at the root: `huly-automation.txt` (a 233-line Chinese research memo on Huly workflow automation), `review_results.json` (a prior AI code-review dump that still references the pre-rebrand `com.clossette` package, i.e. stale guidance a future agent or reviewer may act on), and `.reports/codemap-diff.txt`. All three sit in the Docker build context, which compounds the already-filed missing `.dockerignore` on the worker image. Separately, `web/app/design/page.tsx` is a second full marketing landing page (LandingNav + LandingFooter + motion presets) linked from the global `web/components/Footer.tsx:14` alongside `/status` — publicly reachable, zero tests, and claimed by no surface; x-docs-drift covered documentation drift and dead code but reported neither the root artifacts nor this live duplicate route.

**Suggested scope:** x-docs-drift follow-up: untrack root artifacts, resolve or remove the duplicate /design landing route

### G-16. Expired or invalid JWTs return HTTP 403, but the web client only reacts to 401 — every logged-in user silently bricks at the 24h token expiry with no recovery path

`SecurityConfig` (/Users/jadyn/Development/IYAE/server/src/main/java/com/iyae/config/SecurityConfig.java:29-57) configures no `exceptionHandling`/`authenticationEntryPoint` and registers no formLogin/httpBasic, so Spring Security falls back to `Http403ForbiddenEntryPoint` — the server's own tests confirm this (`SavedProductControllerTest`: "403 for each unauthenticated"). `JwtAuthenticationFilter.authenticate` (JwtAuthenticationFilter.java:45-60) returns silently without authenticating when the token is expired, the user row is missing, `ver < tokenVersion`, or email is unverified. Meanwhile /Users/jadyn/Development/IYAE/web/lib/api.ts:53 clears the token and redirects to /login ONLY on `res.status === 401`. Net effect: at the 24h expiry boundary (`app.jwt.expiration-ms` 86400000) every API call starts throwing `ApiError(403)`, the stale token is never cleared, the user is never sent to /login, and the app renders as a cascade of error banners forever. The same dead-end hits any user whose `tokenVersion` was bumped by a password reset and any unverified account. This is the single highest-volume production failure in the tree — it fires for 100% of users on a daily cadence — and neither web-auth, srv-security-config, srv-authz-matrix nor x-error-ux reported it.

**Suggested scope:** web/lib/api.ts, server/.../config/SecurityConfig.java, server/.../security/JwtAuthenticationFilter.java

### G-17. No production ADMIN account can exist, so the entire moderation and abuse-response surface is unreachable on a correctly-configured deploy

`DataSeeder` is annotated `@Profile("!prod")` (/Users/jadyn/Development/IYAE/server/src/main/java/com/iyae/config/DataSeeder.java:22) and is the only thing that creates the ADMIN row (DataSeeder.java:93-100, comment: "granted only via seed/DB"). `AuthService.register` hard-rejects ADMIN (AuthService.java:86-89). There is no admin-provisioning endpoint, no CLI, no migration, and no instruction anywhere in `prod_deploy.sh`, `.env.example`, or the docs — a repo-wide grep for admin bootstrap turns up only test fixtures and PRP plans. So `docker-compose.prod.yml:36` (`SPRING_PROFILES_ACTIVE: prod`) correctly suppresses the known-password seed account the audit flagged, and in doing so leaves the production database with zero ADMIN users. `/api/admin/**` is `hasRole("ADMIN")` (SecurityConfig.java:51), so `/admin`, the KPI dashboard, the post-report queue, comment removal and the durable `moderation_locked` takedown are all permanently inaccessible. The audit found the insecure-default half of this (the "!prod" deny-list) and missed that the secure path has no escape hatch. The only remediation is a hand-written SQL INSERT with a bcrypt hash, undocumented and unreviewed.

**Suggested scope:** server/.../config/DataSeeder.java, server/.../service/AuthService.java, prod_deploy.sh, .env.example

### G-18. No logout, no session revocation, and no way to suspend or ban a user — a compromised or abusive account cannot be stopped

A repo-wide grep for `logout` across server/src/main/java returns nothing: there is no `/api/auth/logout` endpoint. `token_version` (V19 migration) is incremented in exactly one place — `AuthService.resetPassword` (AuthService.java:313). `JwtAuthenticationFilter.java:52` is the only consumer. So the web `logout()` merely deletes localStorage; the signed JWT remains valid for the rest of its 24h TTL on any device that captured it, and the only revocation mechanism in the product requires the victim to still control their mailbox. Separately, there is no account-state concept at all: no `enabled`/`status`/`suspended_at` column on users, no admin action in `AdminModerationService` that touches a user, and `JwtAuthenticationFilter.java:61-64` builds the principal with Spring's always-enabled `User` constructor. An admin (if one existed — see the ADMIN-bootstrap gap) can archive a post and resolve a report but cannot stop the account from immediately posting again. The audit covered UGC takedown mechanics and the report queue but never asked what happens to the offender, and treated JWT lifecycle only as a storage question (localStorage/CSP).

**Suggested scope:** server/.../service/AuthService.java, server/.../security/JwtTokenProvider.java, server/.../service/AdminModerationService.java, server/.../entity/User.java

### G-19. Community post images are unbounded base64 data URIs persisted directly into MySQL, with no size validation and no rate limit on post creation

`LocalImagePicker` reads the chosen file with `FileReader.readAsDataURL` (/Users/jadyn/Development/IYAE/web/components/profile/LocalImagePicker.tsx:81,98), and `CreateFashionPostDialog.handleSubmit` puts that data URI straight into the server payload: `mediaUrls: selectedImage ? [selectedImage] : []` (CreateFashionPostDialog.tsx:210) then `await postsApi.create(payload)` (line 219). Server-side, `PostRequest.mediaUrls` is a bare `List<String>` with no `@Size` on the list and no length constraint on the elements (/Users/jadyn/Development/IYAE/server/src/main/java/com/iyae/dto/PostRequest.java:9), and `PostService.createPost` serialises it verbatim into `posts.media_urls JSON` (PostService.java:54,64; V8__community_tables.sql:8). `RateLimitFilter.RULES` has no rule for `/api/posts`, and nginx allows 20MB bodies (`nginx/nginx.conf:13 client_max_body_size 20m`). So each post can push ~20MB of base64 into the row, unlimited posts per user, on the same unreplicated volume the audit already found has no backup — and because the feed selects the column, a single page of 20 posts can return hundreds of MB, multiplying the N+1 findings into a bandwidth and heap problem. The audit capped `media` on the resale DTO (advisory) and capped post *text* length (advisory) but never looked at where post images come from.

**Suggested scope:** server/.../dto/PostRequest.java, server/.../service/PostService.java, web/components/profile/LocalImagePicker.tsx, server/.../config/RateLimitFilter.java

### G-20. Production email sender defaults to Resend's shared sandbox address, which can only deliver to the account owner — and email deliverability (SPF/DKIM/DMARC, domain verification) was never audited as a class

`docker-compose.prod.yml:93` sets `MAIL_FROM: ${RESEND_FROM_EMAIL:-onboarding@resend.dev}` and `.env.example:136` ships that same sandbox value as the default. `prod_deploy.sh` validates nothing about RESEND_* (grep for RESEND/MAIL in prod_deploy.sh: no matches). `web/app/api/internal/mail/send/route.ts:53` passes it to Resend unchanged. Resend permits `onboarding@resend.dev` to send only to the API-key owner's own verified address and rejects every other recipient — so on a deploy that sets `RESEND_API_KEY` but forgets `RESEND_FROM_EMAIL`, 100% of verification and password-reset emails fail. Both failure modes are swallowed by design: registration logs a warning and still succeeds, and forgot-password always returns 200 to prevent enumeration. Combined with `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` being unreachable in a prod build (already found) and the filter's verification gate (JwtAuthenticationFilter.java:58), nobody can sign up and nobody can recover an account, with zero signal. Beyond the default: nothing in the repo documents domain verification, SPF, DKIM or a DMARC record, so even a correct `RESEND_FROM_EMAIL=noreply@iyae.ca` lands in spam. This whole risk class had no surface — web-internal-api audited the route's authz and payload handling, not whether mail arrives.

**Suggested scope:** docker-compose.prod.yml, prod_deploy.sh, .env.example, web/app/api/internal/mail/send/route.ts, docs/

### G-21. The money-path CRITICAL has no configuration surface to remediate it: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET appear in no env file, no compose file, and no deploy script

A grep for `STRIPE` across `.env.example`, `docker-compose.yml`, `docker-compose.prod.yml`, `prod_deploy.sh` and `dev.sh` returns zero matches. `CheckoutService.java:53` reads `@Value("${STRIPE_SECRET_KEY:}")` with a blank default and branches to `stubCheckout` (line 78) / `stubResaleCheckout` (line 254), logging "STRIPE_SECRET_KEY not configured" at INFO (lines 314, 361). `docker-compose.prod.yml` (lines 23-42) enumerates every other secret the server needs — JWT, DB, AI keys, INTERNAL_MAIL_SECRET — and passes neither Stripe variable. The confirmed CRITICAL is filed against `CheckoutService.java` alone, which frames it as a code bug fixable in one file; in reality the fix spans `.env.example`, both compose files, `prod_deploy.sh`'s required-var validation, and needs a fail-fast guard that refuses to boot under `SPRING_PROFILES_ACTIVE=prod` with a blank key (the `stub*` paths must be unreachable in prod, not merely unselected). Also unexamined: `handleWebhook` correctly fails closed on a blank webhook secret (CheckoutService.java:169-171), which means that with no plumbing the webhook rejects every Stripe callback — so the 'turn payment on' change is two coupled variables, not one.

**Suggested scope:** .env.example, docker-compose.yml, docker-compose.prod.yml, prod_deploy.sh, server/.../service/CheckoutService.java

### G-22. Every UGC write and the analytics ingest endpoint are entirely unthrottled — no spam, flood, or cost control on the community surface

`RateLimitFilter.RULES` is an explicit 10-rule allowlist (/Users/jadyn/Development/IYAE/server/src/main/java/com/iyae/config/RateLimitFilter.java:26-41) covering login, register, forgot-password, resend-verification, PUT /api/auth/me, POST /api/chat/, /api/checkout, public avatar generate, DELETE /api/avatar and the recommended-size GET. Nothing matches `POST /api/posts`, `POST /api/posts/{id}/comments`, `POST /api/posts/{id}/report`, `POST /api/follows/{userId}` or `POST /api/events`. Consequences the audit never named: (1) report-spam floods the admin queue that, per the ADMIN-bootstrap gap, no account exists to drain; (2) follow-spam is a harassment vector with no block/mute anywhere in the product; (3) `POST /api/events` (AnalyticsController.java:29-44) is an authenticated unbounded writer into `analytics_events`, a table the audit itself flagged as having no retention or archival plan — unlimited rows on the single unreplicated volume with no backup; (4) post-creation flood compounds the base64-media gap above. The audit pointed rate-limit scrutiny at paid/compute-heavy generation and at resale checkout, and treated 'abuse/spam of UGC' only as a moderation-tooling question.

**Suggested scope:** server/.../config/RateLimitFilter.java, server/.../controller/PostController.java, server/.../controller/FollowController.java, server/.../controller/AnalyticsController.java

### G-23. No link-preview metadata, no robots.txt, no sitemap, and every route is client-rendered — the product's stated growth loop (sharing looks) produces blank cards

The entire tree contains exactly one metadata export: `web/app/layout.tsx:27`, with only `metadataBase`, `title` and `description`. A grep for `openGraph`, `twitter:` and `generateMetadata` across web/ returns no matches, and `web/app/` has no `robots.ts`, `sitemap.ts`, `manifest.ts`, `opengraph-image` or `icon` file (only `favicon.ico`). Every page is `"use client"` by project convention, and product/post/profile data arrives from a client fetch, so Instagram, WhatsApp, iMessage, Discord and Twitter unfurlers — none of which execute JavaScript — see one generic title and no image for every one of the 37 routes. For a Gen-Z social-commerce product whose distribution mechanism is users sharing outfits and designer shops, this nullifies the acquisition channel; it also leaves 36 seeded products and every designer shop effectively unindexable with no sitemap and no per-PDP title. The SEO/metadata risk class had no audited surface at all, and web-build-config looked at the build/runtime config rather than discoverability.

**Suggested scope:** web/app/layout.tsx, web/app/ (robots.ts, sitemap.ts, opengraph-image), web/app/products/[id]/, web/app/profile/[username]/

### G-24. No Terms, Privacy Policy or any legal page exists; the footer links to '#' and registration demands consent to documents that are not even links

`web/components/home/LandingFooter.tsx:19-32` renders four placeholder anchors with `href="#"`, two of them labelled "Privacy" and "Terms". `web/components/register/StepBasics.tsx:120-130` renders a checkbox whose label is the plain text "I agree to {BRAND.name}'s Terms and Privacy Policy." — not a link to anything. There is no `/privacy`, `/terms`, `/legal`, `/cookies`, or `/accessibility` route in `web/app/` (verified by glob over all 47 page files). The product collects body measurements, body-scan meshes, user photos, email addresses and payment data from Toronto-based and international users, with no published privacy notice, no stated retention period, no lawful-basis statement, no cookie/localStorage consent mechanism, and no data-subject-request intake. The audit captured two adjacent symptoms as MEDIUM advisories (the inert checkbox; "a Terms and Privacy Policy that does not exist") and one HIGH on the missing deletion *code path*, but never treated the legal/privacy-compliance surface as a launch gate — which is what it is for a payment-taking consumer marketplace handling biometric-adjacent data.

**Suggested scope:** web/app/ (new legal routes), web/components/home/LandingFooter.tsx, web/components/register/StepBasics.tsx

### G-25. No log rotation and no container hardening anywhere in the production stack — logs grow unbounded on the same unbacked-up disk as the database

`docker-compose.prod.yml` (146 lines, read in full) contains no `logging:` key on any of its six services, so all five long-running containers use Docker's default `json-file` driver with no `max-size` or `max-file`. Those logs accumulate on the same host filesystem as the `mysql_data` and `assets_data` volumes, which the audit already established have no backup and no replication — and the stack has no restart policy, so the disk-full failure mode is a permanent outage of everything at once. Also absent from every service: `cap_drop`, `security_opt: [no-new-privileges:true]`, `read_only`, `user:`, `ulimits`, and `stop_grace_period` (the last one notable because the audit separately found no graceful shutdown in Spring and no SIGTERM handling in the worker — there is nothing on either side of that contract). The audit covered resource limits, restart policies, backups and the web container's root user individually; log retention and the container-escape/hardening posture of the compose file were not examined as classes.

**Suggested scope:** docker-compose.prod.yml, server/Dockerfile, worker/Dockerfile.rigging

### G-26. Zero CRITICAL findings on the auth path is a suspicious silence — here is the concrete re-examination list

The money path has two CRITICALs and the PII path has three, but authentication produced only HIGHs and MEDIUMs (DataSeeder, auth-config, timing side-channel, missing verify/reset rate limits). Four specific things a follow-up must re-test, beyond the 403-vs-401 and revocation gaps above: (1) `JwtTokenProvider.generateToken(String email)` (JwtTokenProvider.java:26-28) hardcodes `ver=0`; both production call sites correctly pass `user.getTokenVersion()` (AuthService.java:158,178) so it is test-only dead code today, but any future caller would mint tokens that `JwtAuthenticationFilter.java:52` rejects on sight for every user who has ever reset a password — a silent, permanent, per-user lockout that no test would catch since `JwtTokenProviderTest` exercises the overload in isolation. Delete it. (2) There is no `@PreAuthorize`/`@Secured` anywhere in the server; the URL rules in SecurityConfig are the sole authorization layer, so any controller added at a path not matched by lines 35-51 silently inherits only `anyRequest().authenticated()` — the authz matrix is correct today and structurally fragile. (3) `/api/designer/**` is `hasRole("DESIGNER")` (line 49), which excludes ADMIN — worth confirming no admin workflow needs it. (4) Spring Security 6 filters the ERROR dispatch type by default, so an unauthenticated request that triggers the already-found never-logging catch-all 500 handler is re-authorized on the `/error` forward and surfaces as 403 — masking the outage twice over. Verify the real status code an anonymous 500 produces.

**Suggested scope:** server/.../security/JwtTokenProvider.java, server/.../config/SecurityConfig.java, server/.../config/GlobalExceptionHandler.java

### G-27. The next@16.2.6 CRITICAL asserts RCE/SSRF without naming a CVE or demonstrating that the vulnerable path is reachable in this configuration

The finding title claims "multiple disclosed unauthenticated vulnerabilities including RCE and SSRF in the built-in Image Optimization API" but identifies no CVE, no affected-version range, and no fixed version — so the fix cannot be validated against the committed `web/package-lock.json`, and the upgrade target is unspecified for a framework the repo explicitly warns is full of breaking changes (`web/AGENTS.md`). The reachability assumption is also untested: `web/next.config.ts` (29 lines, read in full) declares no `images` block at all, so `images.remotePatterns` is empty and remote-URL optimization — the usual SSRF primitive — is off by default. `next/image` *is* used in 13 files, all against same-origin `/uploads/products/...` paths, so the chain that actually matters here is designer-uploaded bytes (whose type the audit's own advisory says is validated from the client-supplied Content-Type, not content) flowing into the local optimizer. That is a plausible and worse-than-stated story, but it is a different finding from the one written, with a different blast radius and a different mitigation (disable the optimizer / validate magic bytes / gate uploads) available if the upgrade is risky. A CRITICAL that drives a framework bump needs the CVE ids and the reachable-path proof written down.

**Suggested scope:** web/package.json, web/package-lock.json, web/next.config.ts, server/.../service/FileStorageService.java

### G-28. The authentication filter performs a database round trip on every single authenticated request, uncached, with no connection-pool sizing configured

`JwtAuthenticationFilter.authenticate` calls `userRepository.findByEmail(email)` (JwtAuthenticationFilter.java:47) on every request bearing a Bearer token, purely to read `tokenVersion`, `emailVerified` and `role` — three values that could ride in the JWT claims (`ver` already does). This is the hottest code path in the application: every cart read, every poll of `useGenerationStatus`/`useRiggingStatus`/`useOutfitRiggingStatus` (3s intervals), every `useWeather` poll and every feed page pays an extra query before any business logic runs. It compounds directly with two findings the audit already has — "no connection-pool, thread-pool or container resource sizing in production" and the community-feed N+1 — because the pool exhaustion those cause is reached sooner when each request needs one more connection-turn, and the resulting 500s hit the never-logging catch-all handler. x-perf examined catalog LIKE scans, KPI table scans, missing indexes and worker serialization, but not the per-request auth cost.

**Suggested scope:** server/.../security/JwtAuthenticationFilter.java, server/src/main/resources/application-prod.yml

### G-29. An entire undocumented component directory, web/components/design-system/ (8 files including the globally-mounted SiteHeader), appears in no module inventory and in only one finding

`web/components/design-system/` contains `AbstractForm.tsx`, `DarkPanel.tsx`, `EditorialHeading.tsx`, `FilterPill.tsx`, `ProductCard.tsx`, `SectionKicker.tsx`, `SiteHeader.tsx` and `UnderlineField.tsx`. `web/CLAUDE.md`'s component architecture section enumerates root, `home/` (6), `community/` (1), `profile/` (9), `outfits/` (5), `designer/` (2), `register/` (7) and `ui/` (19) — `design-system/` is absent from the list and from the stated 96-component total, yet `SiteHeader` is the header that mounts the theme toggle across 37 surfaces (per the dark-mode changelog) and `ProductCard` is what the catalog grid actually renders (`ProductListItem` is documented as having no importer). Only `ProductCard` surfaced in any finding (the nested save-button a11y advisory). So the real shared header, the real product card, and the form primitives behind them sit in a directory no surface was pointed at and no doc describes — the most likely place for an uncaught input-validation, a11y or auth-state defect, and a direct instance of the documentation drift the audit flagged elsewhere.

**Suggested scope:** web/components/design-system/, web/CLAUDE.md

