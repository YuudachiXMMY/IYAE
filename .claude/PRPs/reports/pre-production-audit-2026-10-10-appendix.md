# Appendix — full finding list

Generated from the audit workflow's structured output. The machine-readable version,
carrying `evidence`, `proof` and `fix` for every row, is
`pre-production-audit-2026-10-10-findings.json`.

Severity is **as filed by the reviewing agent**. Only the rows called out in the main
report were independently re-checked; see that report's provenance section.

## Blocking (65)

| Sev | Category | Location | Finding |
|---|---|---|---|
| CRITICAL | security | `nginx/conf.d/default.conf`:21 | Production nginx has no active TLS: HTTP->HTTPS redirect and the entire HTTPS server block are commented out, and ssl-init does not re-enable them automatically |
| CRITICAL | security | `nginx/conf.d/default.conf`:42 | Unauthenticated, enumerable public access to every user's generated body-avatar GLB via /assets/ |
| CRITICAL | security | `nginx/conf.d/default.conf`:41 | Nginx serves user avatar body meshes from /assets/avatars/{userId}/ with no authentication — body-measurement PII enumerable by unauthenticated visitors |
| CRITICAL | security | `server/src/main/java/com/iyae/config/GlbAssetInitializer.java`:61 | Path traversal via designer-controlled glbUrl leads to arbitrary file write at startup |
| CRITICAL | security | `server/src/main/java/com/iyae/config/SecurityConfig.java`:46 | Any user's 3D body scan is downloadable with no authentication at a guessable path |
| CRITICAL | data-integrity | `server/src/main/java/com/iyae/controller/AnalyticsController.java`:34 | Any authenticated user can forge business-critical analytics events (ORDER_PAID/CHECKOUT_INITIATED/ORDER_RETURNED), corrupting KPI and INVEST/STOP decision data |
| CRITICAL | security | `server/src/main/java/com/iyae/dto/PostResponse.java`:42 | Email address leaks as the public "username" on community posts/comments when a user never set a username |
| CRITICAL | data-integrity | `server/src/main/java/com/iyae/service/CheckoutService.java`:77 | Stripe payment collection is unconditionally bypassed in production — every order ships free |
| CRITICAL | data-integrity | `server/src/main/java/com/iyae/service/ResaleService.java`:55 | Stale-reservation sweep can release a listing for resale while an earlier buyer's Stripe payment still settles, causing a double-sale with a silent double-charge |
| CRITICAL | security | `web/package.json`:35 | Production pins next@16.2.6, which carries multiple disclosed unauthenticated vulnerabilities including RCE and SSRF in the built-in Image Optimization API |
| CRITICAL | data-integrity | `worker/main.py`:138 | rigging-worker silently becomes a second claimant for model/avatar tasks, completing them with mock/stub output |
| HIGH | test-gap | `.github/workflows/e2e.yml`:185 | No test (unit, integration, or E2E) ever runs the real server<->worker task-queue contract against a real database |
| HIGH | availability | `docker-compose.prod.yml`:78 | No restart policy on the production worker service -- a crash permanently halts all three queues |
| HIGH | availability | `docker-compose.prod.yml`:57 | No restart policy on any production service, including the worker — a startup or OOM crash halts all 3D/avatar/rigging generation silently |
| HIGH | config | `docker-compose.prod.yml`:35 | CORS_ORIGINS and FRONTEND_BASE_URL are unvalidated at startup; their effective prod defaults silently break all state-changing requests and every checkout/email link |
| HIGH | availability | `docker-compose.prod.yml`:48 | No restart policy on any service in docker-compose.prod.yml — a crash or host reboot becomes a full outage with no auto-recovery |
| HIGH | availability | `docker-compose.prod.yml`:134 | No automated TLS certificate renewal — ssl-renew is a fully manual command |
| HIGH | data-integrity | `docker-compose.prod.yml`:141 | No automated backup of the MySQL or assets volume in the production stack, and no restore procedure — orders, PII and uploads live on one unreplicated Docker volume |
| HIGH | availability | `docker-compose.prod.yml`:105 | No restart policy on any production service, and the worker has no healthcheck — one container death is a permanent outage |
| HIGH | security | `docker-compose.yml`:123 | Hardcoded dev fallback for INTERNAL_MAIL_SECRET ships with no runtime safeguard, and the compose file that carries it exposes the web container directly |
| HIGH | security | `nginx/conf.d/default.conf`:21 | Production nginx is HTTP-only — the HTTPS block and the 301 redirect are both commented out, so passwords and JWTs cross the internet in cleartext |
| HIGH | config | `prod_deploy.sh`:107 | Production deploy path never validates INTERNAL_MAIL_SECRET, so email verification and password reset silently and completely break with zero deploy-time error |
| HIGH | availability | `prod_deploy.sh`:127 | prod_deploy.sh 'update' cuts traffic over with no real health gate and no rollback |
| HIGH | security | `server/src/main/java/com/iyae/config/DataSeeder.java`:22 | DataSeeder's profile guard is a deny-list ("!prod"), so any deployment that doesn't set SPRING_PROFILES_ACTIVE exactly to "prod" seeds a known-password ADMIN account |
| HIGH | availability | `server/src/main/java/com/iyae/config/GlobalExceptionHandler.java`:86 | Catch-all 500 handler never logs — unexpected RuntimeExceptions vanish with zero server-side trace |
| HIGH | availability | `server/src/main/java/com/iyae/config/RateLimitFilter.java`:26 | No rate limit or cooldown on job-creation endpoints that trigger paid/compute-heavy generation work |
| HIGH | availability | `server/src/main/java/com/iyae/controller/DesignerUploadController.java`:26 | No rate limit or quota on designer image upload endpoint — shared-volume disk-fill DoS |
| HIGH | availability | `server/src/main/java/com/iyae/controller/HealthController.java`:22 | /api/health returns a hardcoded 200 that never touches the database, and it is the container healthcheck and the deploy script's only success signal |
| HIGH | perf | `server/src/main/java/com/iyae/repository/OrderRepository.java`:15 | Stripe webhook order lookup has no backing index on orders.stripe_session_id |
| HIGH | security | `server/src/main/java/com/iyae/service/AvatarService.java`:133 | No account or data-deletion path exists: only the avatar/measurements can be deleted, leaving chat transcripts, posts, orders and analytics rows permanently |
| HIGH | correctness | `server/src/main/java/com/iyae/service/CartService.java`:136 | Cart read/write path N+1 loads Product per line item (no JOIN FETCH, no batch-fetch) |
| HIGH | correctness | `server/src/main/java/com/iyae/service/ChatService.java`:187 | Uncaught ClassCastException from a type-confused [GENERATE_OUTFIT] payload 500s the chat turn and orphans the user's message |
| HIGH | data-integrity | `server/src/main/java/com/iyae/service/CheckoutService.java`:232 | Resale webhook never persists the PAID order status — `markSold`'s `clearAutomatically = true` discards the unflushed Order change |
| HIGH | availability | `server/src/main/java/com/iyae/service/GuestAvatarService.java`:40 | Guest avatar task creation never supersedes or caps prior tasks for the shared anonymous account |
| HIGH | security | `server/src/main/java/com/iyae/service/GuestAvatarService.java`:65 | Guest avatar status endpoint is an unauthenticated IDOR: the ownership check is a no-op because every guest shares one user row |
| HIGH | perf | `server/src/main/java/com/iyae/service/OutfitService.java`:130 | AI outfit generation loads the entire products table into memory on every chat turn instead of using the indexed status filter |
| HIGH | perf | `server/src/main/java/com/iyae/service/PostService.java`:233 | N+1 query pattern across the community feed, followers list, and saved looks (no JOIN FETCH / @EntityGraph) |
| HIGH | availability | `server/src/main/java/com/iyae/service/PostService.java`:82 | Unbounded `size` query parameter on feed/follow/comment pagination allows a single request to bypass pagination entirely |
| HIGH | perf | `server/src/main/java/com/iyae/service/PostService.java`:233 | Community feed N+1: per-post like/comment counts and like-status checks on every page of posts |
| HIGH | correctness | `server/src/main/java/com/iyae/service/PostService.java`:101 | Community feed N+1: 3 extra queries per post on every page load |
| HIGH | correctness | `server/src/main/java/com/iyae/service/ProductService.java`:209 | Admin moderation lock (moderation_locked) is not enforced on the designer DELETE path |
| HIGH | perf | `server/src/main/java/com/iyae/service/ProductService.java`:346 | N+1 query per product in ProductService.buildTaskStatusFallbackMap, hit on every public catalog page load |
| HIGH | data-integrity | `server/src/main/java/com/iyae/service/ResaleService.java`:121 | No server-side enforcement against the same owned unit being listed (and sold) more than once |
| HIGH | data-integrity | `server/src/main/java/com/iyae/service/ResaleService.java`:124 | A seller can create unlimited active resale listings for a single owned unit — the duplicate guard exists only in the read path |
| HIGH | correctness | `server/src/main/java/com/iyae/service/ResaleService.java`:242 | Resale fulfillment ignores a lost reservation: a `markSold` that matches 0 rows is logged at INFO and the buyer is still charged |
| HIGH | data-integrity | `server/src/main/resources/db/migration/V16__resale_listings.sql`:20 | resale_listings FK to products/users has no ON DELETE action — product deletion permanently fails once an item is ever resold |
| HIGH | security | `web/Dockerfile`:14 | Production container runs as root with no non-root USER, directly amplifying the next.js RCE above |
| HIGH | config | `web/Dockerfile`:11 | NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION has no build-arg plumbing, so the production signup flow is permanently broken |
| HIGH | availability | `web/app/ar-visualization/page.tsx`:326 | No error boundary around the 3D canvas on the public /ar-visualization page |
| HIGH | availability | `web/app/error.tsx`:16 | Root error.tsx has no escape route, and since every page renders its own SiteHeader, a crash anywhere strands the user with no navigation |
| HIGH | correctness | `web/app/orders/[id]/page.tsx`:123 | Order detail page does not reset order/error/loading when navigating between two different order ids — stale or wrong-order data and a stuck error banner can render |
| HIGH | correctness | `web/app/products/page.tsx`:100 | Primary shop/catalog page renders a failed fetch identically to a genuine zero-result search |
| HIGH | data-integrity | `web/app/profile/[username]/page.tsx`:146 | Public profile's post grid is sourced from the viewer's own local community cache, not the profiled user's real posts — renders empty in production for every account |
| HIGH | availability | `web/components/AvatarViewer.tsx`:106 | Unbounded GPU/JS-heap retention of every loaded GLB -- drei's useGLTF cache is never cleared |
| HIGH | data-integrity | `web/components/PostDetailDialog.tsx`:230 | Comments and replies on community posts are never sent to the server — the UI reports success but the write is discarded |
| HIGH | accessibility-keyboard | `web/components/profile/LocalImagePicker.tsx`:104 | Keyboard-only users cannot create a community post at all — mandatory image picker has no focusable/operable control |
| HIGH | config | `web/lib/auth-config.ts`:14 | NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION can never reach `true` in a production build, bouncing every new signup |
| HIGH | correctness | `web/lib/cart-context.tsx`:156 | CartProvider refetches /api/cart with no request sequencing — a stale response can overwrite a fresher cart, silently reverting items the user just added/removed |
| HIGH | data-integrity | `web/lib/hooks/useCommunityState.ts`:116 | Follow button on the public profile page only updates local storage — never calls the real follow API |
| HIGH | data-integrity | `web/lib/saved-products.ts`:110 | Stale per-device wishlist cache can silently resurrect a product the user removed on another device |
| HIGH | data-integrity | `worker/providers/smplx_provider.py`:313 | Every guest avatar overwrites one shared on-disk path, so a visitor can be shown another visitor's body mesh |
| HIGH | correctness | `worker/providers/tripo_generator.py`:86 | TripoGenerator reads glb_resp.content after the stream has already been consumed — crashes every real Tripo3D generation |
| HIGH | correctness | `worker/providers/weight_transfer.py`:204 | Rigging pipeline silently rebinds numerically-degenerate vertices to the pelvis with no error, log, or validation catch |
| HIGH | data-integrity | `worker/task_queue.py`:80 | fail_task() has no RUNNING guard -- can overwrite an already-completed (READY) task back to FAILED |
| HIGH | availability | `worker/task_queue.py`:124 | Stale-task reclamation has no heartbeat and no attempt cap, enabling duplicate processing and unbounded poison-task retries |

## Advisory (132)

| Sev | Category | Location | Finding |
|---|---|---|---|
| MEDIUM | config | `.github/workflows/e2e.yml`:15 | No explicit `permissions:` block — GITHUB_TOKEN runs at repo-default scope, not least-privilege |
| MEDIUM | security | `.github/workflows/e2e.yml`:38 | All third-party actions pinned to mutable version tags, not commit SHAs |
| MEDIUM | security | `.github/workflows/e2e.yml`:61 | No dependency, SAST, or secret-scanning job anywhere in CI |
| MEDIUM | config | `.github/workflows/e2e.yml`:187 | Production worker image and production Spring/nginx topology are never built or exercised by CI |
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
| MEDIUM | security | `server/src/main/java/com/iyae/service/GuestAvatarService.java`:65 | Guest avatar generation shares one global user identity — cross-session avatar overwrite + unauthenticated IDOR on task status |
| MEDIUM | correctness | `server/src/main/java/com/iyae/service/PostService.java`:177 | Reply creation does not verify the parent comment belongs to the same post |
| MEDIUM | correctness | `server/src/main/java/com/iyae/service/PostService.java`:157 | Like/follow toggle is not atomic -- concurrent double-click or two-tab requests surface as a 409 instead of idempotent success |
| MEDIUM | data-integrity | `server/src/main/java/com/iyae/service/ResaleService.java`:153 | Public getListing does not filter by status, so soft-removed/sold/reserved listings remain fully browsable by id |
| MEDIUM | silent-failure | `server/src/main/java/com/iyae/service/ResaleService.java`:318 | ResaleService JSON snapshot parsing swallows exceptions with no logging, silently emptying a buyer's resale eligibility and purchase-provenance checks |
| MEDIUM | test-gap | `server/src/main/java/com/iyae/service/ResaleService.java`:168 | ResaleService.updateListing (price change + status-immutability guard + ownership) has zero test coverage |
| MEDIUM | config | `server/src/main/resources/application.yml`:5 | spring.datasource.password silently degrades to an empty password instead of failing fast when DB_PASSWORD is unset |
| MEDIUM | data-integrity | `server/src/main/resources/application.yml`:22 | No graceful shutdown anywhere (Spring default is immediate, no stop_grace_period) and the Stripe webhook silently ACKs a session with no Order row |
| MEDIUM | perf | `server/src/main/resources/application.yml`:2 | No connection-pool, thread-pool or container resource sizing in production, and one worker container serializes all three task queues |
| MEDIUM | data-integrity | `server/src/main/resources/db/migration/V8__community_tables.sql`:13 | Community tables (posts/post_likes/post_comments/follows) reference users(id) with default RESTRICT, inconsistent with the cascade pattern everywhere else |
| MEDIUM | perf | `server/src/main/resources/db/migration/V9__checkout_orders.sql`:2 | orders.stripe_session_id has no index despite being the lookup key for every Stripe webhook call |
| MEDIUM | test-gap | `server/src/test/java/com/iyae/controller/StripeWebhookControllerTest.java`:43 | StripeWebhookController's "invalid signature" test exercises a code path the real service never takes |
| MEDIUM | test-gap | `server/src/test/resources/application-test.yml`:9 | No fast test validates that the JPA entity mappings match the real Flyway migrations (ddl-auto=validate in prod) |
| MEDIUM | availability | `web/app/api/internal/mail/send/route.ts`:19 | No rate limiting or payload-size cap on the internal mail route itself |
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
| MEDIUM | a11y | `web/app/register/page.tsx`:121 | Register wizard has no semantic <form> element — unlike every other auth page |
| MEDIUM | correctness | `web/app/resale/[id]/page.tsx`:41 | Resale listing detail page gets stuck on the loading skeleton forever for a malformed/zero id |
| MEDIUM | correctness | `web/app/resale/[id]/page.tsx`:40 | A non-numeric resale listing id leaves the page stuck on the loading skeleton forever, with no error or not-found state |
| MEDIUM | correctness | `web/components/FittingHelper.tsx`:153 | FittingHelper mutates materials shared by drei's GLTF cache, not per-instance clones |
| MEDIUM | accessibility-aria | `web/components/PostDetailDialog.tsx`:270 | Community post detail modal has no accessible name, plus a redundant unlabeled icon-only close button |
| MEDIUM | accessibility-focus | `web/components/SearchFilterBar.tsx`:82 | Visible focus indicator removed from the Sort control on the product catalog page |
| MEDIUM | correctness | `web/components/dashboard/MeasurementsPanel.tsx`:134 | Body measurement client inputs allow values the server will always reject (no max, mismatched min) |
| MEDIUM | correctness | `web/components/designer/PromotionList.tsx`:83 | Promotion delete is a one-click irreversible destructive action with no confirmation |
| MEDIUM | correctness | `web/components/register/StepBasics.tsx`:29 | Terms/Privacy checkbox in the register wizard is inert — never gates or reaches submission |
| MEDIUM | config | `web/components/register/StepBasics.tsx`:128 | Registration requires agreeing to a Terms and Privacy Policy that does not exist anywhere in the product |
| MEDIUM | test-gap | `web/e2e/designer-crud.spec.ts` | No E2E coverage of the admin moderation flow or the 3D-generation lifecycle, despite the test inventory implying otherwise |
| MEDIUM | security | `web/lib/api.ts`:10 | JWT in localStorage has no CSP backstop — script-src ships 'unsafe-inline' in both prod and dev |
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
| LOW | maintainability | `server/src/main/java/com/iyae/service/GenerationService.java`:128 | GenerationService.retry() does not increment attemptCount, unlike the equivalent RiggingService.retry() |
| LOW | maintainability | `server/src/main/java/com/iyae/service/PostService.java`:202 | PostService.archive() is unreachable in production -- no controller route calls it |
| LOW | perf | `server/src/main/resources/db/migration/V14__analytics_events_and_cohorts.sql`:15 | Unbounded-growth tables with no retention or archival plan |
| LOW | data-integrity | `server/src/main/resources/db/migration/V1__baseline_schema.sql`:11 | TIMESTAMP (Y2038, session-tz-dependent) mixed with DATETIME for equivalent point-in-time columns, with no timezone pinned anywhere in config |
| LOW | perf | `server/src/main/resources/db/migration/V4__email_verification_and_password_reset.sql`:33 | Redundant index on password_reset_tokens.token_hash |
| LOW | security | `web/app/api/internal/mail/send/route.ts`:21 | Secret comparison is not constant-time |
| LOW | config | `web/app/status/page.tsx`:96 | Public status page discloses the active AI provider name to anonymous visitors |
| LOW | perf | `web/components/AvatarViewer.tsx`:326 | All 3D Canvases render continuously (frameloop="always") with no idle throttling |
| LOW | correctness | `web/components/ImageUploader.tsx`:46 | ImageUploader: stale upload can overwrite a newer selection, and an in-flight object URL can leak on unmount |
| LOW | accessibility-semantics | `web/components/design-system/ProductCard.tsx`:50 | Save (heart) button nested inside the product-card <Link> on every item in the shop grid |
| LOW | security | `web/package.json`:32 | Secondary known-vulnerable packages (dompurify, nanoid, postcss, source-map-js) are fixable by refreshing the committed lockfile, independent of the next.js bump |
| LOW | maintainability | `worker/providers/meshy_generator.py`:19 | Dead code: _enforce_download_cap is defined but never called |
