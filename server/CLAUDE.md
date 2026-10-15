[Root](../CLAUDE.md) > **server**

# IYAE Server (Spring Boot 3.4)

Spring Boot REST API providing authentication (with email verification and password reset), product catalog, AI conversational styling, outfit generation, shopping cart with cloth size selection, 3D model generation orchestration, guest avatar generation, designer studio features, and rate-limited security.

## Module Purpose

The server is the central backend service. It exposes all REST endpoints, manages business logic, enforces security (JWT + rate limiting), sends transactional emails (verification, password reset), and coordinates with the Python worker for 3D model generation via a shared MySQL task queue.

## Entry & Startup

- **Main class**: `com.iyae.IyaeApplication` (standard Spring Boot `@SpringBootApplication` + `@ConfigurationPropertiesScan`)
- **Port**: 8080 (configurable via `server.port`)
- **Profile**: `application.yml` (base), `application-dev.yml` (dev overrides with SQL logging), `application-prod.yml` (production: INFO logging, no SQL), `application-test.yml` (H2 in-memory, Flyway disabled)
- **On startup**: `DataSeeder` (CommandLineRunner) seeds initial data if the database is empty (5 users, 3 designer profiles, 2 body profiles, 36 products, 10 promotions, 10 garment assets)

## Commands

```bash
./gradlew build              # Compile + test
./gradlew test               # Unit tests only
./gradlew bootRun            # Run locally (needs MySQL on :3306)
./gradlew bootJar            # Build fat JAR
```

## Architecture

```
controller/ (27)  --> REST endpoints (@Valid DTO binding, incl. StripeWebhookController, GuestAvatarController, SizeRecommendationController, FulfillmentController)
service/    (34)  --> Business logic + ownership checks + orchestration + email delivery + Stripe checkout (incl. StripeCheckoutGateway interface + DefaultStripeCheckoutGateway) + GuestAvatarService + SizeRecommendationService + FulfillmentService
repository/ (31)  --> Spring Data JPA interfaces (incl. PickupLocationRepository)
entity/     (29)  --> JPA entities (incl. PasswordResetToken, AvatarGenerationTask, RiggingTask, Post, PostLike, PostComment, Follow, PickupLocation); Product carries a size_chart JSON column
entity/enums/ (17) --> Role, ProductStatus, TaskStatus (incl. MATERIALIZED), SessionStatus, PostStatus, FulfillmentMethod, ShippingCarrier, etc.
dto/        (69)  --> Request/Response records (incl. GuestAvatarRequest, GuestAvatarStatusResponse, SizeRecommendationResponse, CheckoutRequest, PickupLocationResponse, ShippingOptionResponse)
ai/          (7)  --> Pluggable AI provider system (interface, factory, exception, 4 impls)
security/    (3)  --> JWT filter + token provider + UserDetailsService
config/     (10)  --> SecurityConfig, CorsConfig, AIConfig, SchedulerConfig, GlobalExceptionHandler, DataSeeder, GlbAssetInitializer, RateLimitFilter, WebMvcConfig, BrandProperties (@ConfigurationProperties "app.brand")
util/        (1)  --> GlbPlaceholderGenerator (minimal GLB file generation)
test/       (77)  --> 73 JUnit 5 + Mockito test classes + 4 test support (637 methods total)
```

## API Endpoints (External Interface)

### Public (no auth)

| Method | Path | Controller | Purpose |
|--------|------|------------|---------|
| POST | `/api/auth/register` | AuthController | Create account (sends verification email) |
| POST | `/api/auth/login` | AuthController | Authenticate |
| POST | `/api/auth/verify-email` | AuthController | Verify email via token |
| POST | `/api/auth/forgot-password` | AuthController | Request password reset email |
| POST | `/api/auth/reset-password` | AuthController | Reset password via token |
| GET | `/api/products` | ProductController | Browse catalog (paginated, filterable) |
| GET | `/api/products/categories` | ProductController | Distinct published categories |
| GET | `/api/products/{id}` | ProductController | Product detail |
| GET | `/api/products/{id}/reviews` | ReviewController | Product reviews |
| GET | `/api/products/{id}/reviews/summary` | ReviewController | Review aggregation |
| GET | `/api/auth/users/profile/{username}` | AuthController | Public user profile (visibility-gated) |
| GET | `/api/health` | HealthController | Liveness check |
| GET | `/api/health/ai` | HealthController | AI provider probe |
| GET | `/api/promotions/featured` | PromotionController | Featured products |
| POST | `/api/public/avatar/generate` | GuestAvatarController | Anonymous avatar generation (rate-limited: 3/60s) |
| GET | `/api/public/avatar/status/{taskId}` | GuestAvatarController | Poll guest avatar task status |
| GET | `/api/fulfillment/pickup-locations` | FulfillmentController | Public reference reads for the checkout fulfillment selector |
| GET | `/api/fulfillment/shipping-options` | FulfillmentController | Public reference reads for the checkout fulfillment selector |

### Authenticated (any role)

| Method | Path | Controller | Purpose |
|--------|------|------------|---------|
| GET | `/api/auth/me` | AuthController | Current user (incl. emailVerified) |
| GET | `/api/products/{id}/recommended-size` | SizeRecommendationController | Recommended size (measurement-chart / self-reported basis) |
| GET/POST/PUT/DELETE | `/api/cart/**` | CartController | Cart operations |
| POST | `/api/checkout` | CheckoutController | Create order (stubbed) |
| POST/GET | `/api/outfits/**` | OutfitController | Generate/view outfits |
| POST/GET | `/api/chat/sessions/**` | ChatController | AI chat |
| GET/POST | `/api/body-profile` | BodyProfileController | Body measurements |
| POST | `/api/avatar/generate` | AvatarController | Generate avatar |
| DELETE | `/api/avatar` | AvatarController | One-tap delete of avatar + body data (returns 204 No Content) |
| GET/POST/PUT/DELETE | `/api/looks/**` | SavedLookController | Saved looks (outfit recommendations) |
| GET | `/api/saved-products` | SavedProductController | Wishlist of catalogue products, newest first |
| PUT | `/api/saved-products/{productId}` | SavedProductController | Save a product (idempotent; PUBLISHED only) |
| DELETE | `/api/saved-products/{productId}` | SavedProductController | Unsave a product (idempotent) |
| POST/DELETE | `/api/products/{id}/reviews` | ReviewController | Reviews |
| GET | `/api/orders/**` | OrderController | Order history |
| POST/GET/DELETE | `/api/posts/**` | PostController | Community posts (create, feed, detail, delete, like, comment) |
| POST | `/api/follows/{userId}` | FollowController | Toggle follow |
| GET | `/api/follows/followers` | FollowController | List followers |
| GET | `/api/follows/following` | FollowController | List following |

### Designer only (DESIGNER role)

| Method | Path | Controller | Purpose |
|--------|------|------------|---------|
| GET/POST/PUT/DELETE | `/api/designer/products/**` | DesignerProductController | Product CRUD |
| POST | `/api/designer/products/upload/image` | DesignerUploadController | Image upload (JPEG/PNG/WebP, <=10MB) |
| POST | `/api/designer/products/{id}/regenerate` | GenerationStatusController | Trigger 3D generation |
| GET | `/api/designer/products/{id}/generation-status` | GenerationStatusController | Poll generation |
| POST | `/api/designer/products/{id}/generation-status/retry` | GenerationStatusController | Retry failed generation |
| POST | `/api/designer/products/{id}/rigging` | RiggingController | Trigger garment rigging |
| GET | `/api/designer/products/{id}/rigging-status` | RiggingController | Poll rigging status |
| POST | `/api/designer/products/{id}/rigging-status/retry` | RiggingController | Retry failed rigging |
| GET/POST/PUT/DELETE | `/api/promotions/**` | PromotionController | Promotion management |

## Key Dependencies & Configuration

### Build (Gradle/Kotlin DSL)

- Spring Boot 3.4.1, Java 22
- `spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `spring-boot-starter-security`, `spring-boot-starter-validation` (no `spring-boot-starter-mail` -- email goes through the Next.js Resend route via `java.net.http.HttpClient`)
- Flyway (`flyway-core`, `flyway-mysql`)
- MySQL Connector/J
- JJWT 0.12.6 (JWT API + impl + Jackson)
- stripe-java 26.12.0 (webhook signature verification + Checkout session creation). **Pinned exactly, and a dynamic range will not resolve**: `resolutionStrategy { failOnDynamicVersions(); failOnChangingVersions() }` applies to every configuration, so re-introducing `26.+` fails the build. It used to be `26.+`, which resolved to `26.13.0-beta.1` — a Gradle range does not exclude prereleases. Bump it in a reviewed commit.
- Lombok (compile-only)
- `spring-boot-starter-test` (JUnit 5, Mockito, MockMvc, AssertJ)

### Configuration (`application.yml`)

| Property | Env Var | Default | Purpose |
|----------|---------|---------|---------|
| `spring.datasource.url` | `DB_HOST`, `DB_PORT`, `DB_NAME` | `localhost:3306/iyae` | MySQL connection |
| `spring.datasource.password` | `DB_PASSWORD` | -- | DB password |
| `spring.jpa.hibernate.ddl-auto` | -- | `validate` | Schema validation only |
| `spring.jpa.open-in-view` | -- | `false` | No lazy loading outside tx |
| `app.jwt.secret` | `JWT_SECRET` | -- | HS256 signing key |
| `app.jwt.expiration-ms` | -- | `86400000` (24h) | Token TTL |
| `app.ai.provider` | `AI_PROVIDER` | `mock` | AI provider selection |
| `app.cors.origins` | `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3001,http://iyae.localhost` | CORS allowlist |
| `app.frontend.base-url` | `FRONTEND_BASE_URL` | `http://localhost:3000` | Base URL for email links |
| `app.mail.resend-endpoint` | `RESEND_MAIL_ENDPOINT` | -- | URL of the Next.js internal mail route (server POSTs here; empty = delivery fails) |
| `app.mail.internal-secret` | `INTERNAL_MAIL_SECRET` | -- | Shared secret sent as `x-internal-mail-secret` header to the mail route |
| `app.brand.domain` | `BRAND_DOMAIN` | `iyae.ca` | Brand domain (backs seed-user emails) |
| `app.brand.service-id` | `BRAND_SERVICE_ID` | `iyae-server` | Service id reported by `/api/health` |
| `app.brand.guest-email` | `BRAND_GUEST_EMAIL` | `guest@iyae.internal` | Internal sentinel email for guest avatar generation |
| `app.auth.verification-token-ttl` | -- | `24h` | Email verification token expiry |
| `app.auth.password-reset-ttl` | -- | `1h` | Password reset token expiry |

### Mail Delivery (Resend-only)

There is no SMTP path in any profile. `AuthMailService` POSTs the mail `{type, toEmail, name, actionUrl}` to the Next.js internal route (`app.mail.resend-endpoint`, e.g. `http://web:3000/api/internal/mail/send`) with the `app.mail.internal-secret` shared secret; the web route renders the template and calls Resend. Dev and prod use the same mechanism -- set `RESEND_API_KEY` (web container) for delivery to actually occur. The former `spring-boot-starter-mail` / JavaMailSender / `SMTP_*` configuration has been removed.

### Test Configuration (`application-test.yml`)

- **Database**: H2 in-memory (`jdbc:h2:mem:testdb`), `ddl-auto: create-drop`
- **Flyway**: Disabled (schema auto-created by Hibernate)
- **JWT secret**: Hardcoded test key (32+ chars)
- **AI provider**: `mock`
- **Profile activated via**: `@ActiveProfiles("test")` on SpringBootTest classes

## Data Model

Tables managed by Flyway migrations (`V1__baseline_schema.sql` through `V24__perf_indexes.sql`). `products.size_chart` is a nullable JSON column that stores a size chart array (per-size measurement entries) used by size recommendation. `pickup_locations` (V17) backs in-city Toronto order pickup, and `orders` carries fulfillment columns (`fulfillment_method`, `pickup_location_id`, `shipping_carrier`, `shipping_fee`).

### Entity Relationship

```
User (hub)
  |-- 1:1 DesignerProfile --> 1:N Product
  |                             |-- 1:N GarmentAsset
  |                             |    |-- 1:N RiggingTask
  |                             |-- 1:N ModelGenerationTask
  |                             |-- 1:N RiggingTask
  |                             |-- 1:N Promotion
  |                             |-- 1:N Review
  |                             |-- 1:N CartItem
  |-- 1:1 BodyProfile
  |-- 1:1 Cart --> 1:N CartItem (selectedSize) --> N:1 Product
  |-- 1:N OutfitRecommendation --> 1:N SavedLook
  |-- 1:N ChatSession --> 1:N ChatMessage
  |-- 1:N Order
  |-- 1:N Review
  |-- 1:N PasswordResetToken
  |-- 1:N AvatarGenerationTask
  |-- 1:N Post --> 1:N PostComment
  |            |-- 1:N PostLike
  |-- 1:N Follow (user_id -> followed_user_id)
```

### Key Enums

| Enum | Values |
|------|--------|
| Role | `BUYER`, `DESIGNER`, `ADMIN` |
| ProductStatus | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| TaskStatus | `PENDING`, `RUNNING`, `READY`, `FAILED`, `MATERIALIZED` |
| SessionStatus | `ACTIVE`, `COMPLETED` |
| MessageRole | `USER`, `ASSISTANT` |
| SlotType | `FEATURED`, `SPONSORED` |
| OrderStatus | `PENDING`, `PAID`, `PROCESSING`, `SHIPPED`, `DELIVERED` |
| GarmentSlotHint | `TOP`, `BOTTOM`, `DRESS`, `SHOES`, `ACCESSORY` |
| PostStatus | `ACTIVE`, `ARCHIVED`, `PENDING_DELETE` |
| CommentStatus | `ACTIVE`, `REMOVED` |
| ReportStatus | `OPEN`, `RESOLVED`, `DISMISSED` |
| FulfillmentMethod | `SHIP`, `PICKUP` |
| ShippingCarrier | `UPS`, `PUROLATOR`, `FEDEX`, `CANADA_POST` |

### Seed Data (DataSeeder)

On first startup (empty database), `DataSeeder` creates:
- **5 users**: 3 designers (luna, marco, aria) + 2 buyers (emma, james), all with password `password123`, all `emailVerified=true`
- **3 designer profiles**: Luna Studio (minimalist), VOSS (streetwear), Aria Atelier (artisanal handcraft)
- **2 body profiles**: for buyer accounts
- **36 PUBLISHED products**: 7 tops, 7 bottoms, 4 dresses, 6 outerwear, 5 shoes, 3 accessories, 1 bag, 3 jewelry -- spread across all 3 designers
- **10 promotions**: 6 FEATURED (homepage carousel, weights 10-60) + 4 SPONSORED (in-feed, weights 1-4)
- **10 garment assets**: 5 READY (placeholder.glb) + 5 PENDING (demo.glb or null)

## Service Layer (29 services)

| Service | Purpose |
|---------|---------|
| AuthService | Registration (with email verification token, designer profile auto-creation for DESIGNER role), login, JWT issuance, email verification, password reset, public profile lookup |
| SecureTokenService | Cryptographic token generation (SecureRandom) and SHA-256 hashing |
| AuthMailService | Transactional email delivery (verification + password reset) -- Resend-only; POSTs `{type,toEmail,name,actionUrl}` to the Next.js internal mail route via `java.net.http.HttpClient` (no JavaMailSender/SMTP); throws `EmailDeliveryException` on any non-2xx / transport failure / unconfigured endpoint |
| ProductService | Product catalog CRUD, search, and category listing |
| CartService | Shopping cart operations with ownership checks and cloth size selection (selectedSize field, unique per cart+product+size) |
| ChatService | AI conversational styling + outfit generation protocol + suggestion chips (`[SUGGESTIONS]` extraction, fallback, XSS-safe truncation) + email verification gate |
| OutfitService | Outfit recommendation generation + slot matching |
| SavedLookService | CRUD for saved outfit looks (responses include outfit item names extracted from recommendation JSON) |
| SavedProductService | Wishlist of catalogue products. Both writes are idempotent so a client can replay a localStorage wishlist on sign-in; only PUBLISHED products are savable and anything else reports the same "Product not found" as a missing id (deliberately narrower than `ProductService.getProductById`, which also exempts the owning designer — that gate already exists in two places that must stay in sync) |
| ReviewService | Product review management |
| BodyProfileService | Body measurement profiles |
| PromotionService | Promotional slot management (FEATURED/SPONSORED) |
| OrderService | Order history retrieval |
| CheckoutService | Checkout flow (Stripe stub) |
| AvatarService | Avatar generation (gender identity mapping, body measurement validation, task supersession); `@Transactional deleteAvatarData(email)` one-tap purge (nulls `user.avatarGlbUrl`, idempotently deletes BodyProfile, deletes the user's AvatarGenerationTask rows; does NOT delete the User) |
| DesignerProfileService | Designer profile management |
| FileStorageService | File upload handling (JPEG, PNG, WebP; 10MB max; atomic write via temp file) |
| UserService | User account operations |
| HealthService | Server and AI health probes |
| GenerationService | 3D generation task lifecycle (status, regenerate, retry, materialize) |
| ModelGenerationOrchestrationService | High-level orchestration wrapper over GenerationService |
| GarmentAssetService | Garment asset retrieval |
| RiggingService | Garment rigging task lifecycle (request, status, retry, materialize READY->MATERIALIZED, supersede active tasks) |
| PostService | Community post CRUD (create, list feed, single post, delete with ownership, toggle like, add comment) |
| FollowService | User follow/unfollow toggle, list followers/following |
| GuestAvatarService | Anonymous avatar generation for unauthenticated users (creates/reuses internal guest user, body type mapping, waist estimation from BMI, task creation + status polling) |
| SizeRecommendationService | Two-tier recommended-size resolution: Tier 1 MEASUREMENT_CHART (RMS deviation over {chestCm,waistCm,hipsCm}) sourced from the product `size_chart` JSON when present, else falling back to the designer-authored `product_size_measurements` rows so the studio measurement UI drives the PDP hint (JSON takes precedence; `length_cm` is NOT mapped into the match); Tier 2 SELF_REPORTED (category->self-reported size mapping), else NONE |
| FulfillmentService | Resolve/validate checkout fulfillment (SHIP carrier or PICKUP Toronto location), list options; never Canada-Post-only |

## Rate Limiting

`RateLimitFilter` (`OncePerRequestFilter`, registered before `UsernamePasswordAuthenticationFilter` in the security filter chain) applies per-IP fixed-window rate limits:

| Path Prefix | Max Requests | Window |
|-------------|-------------|--------|
| `/api/auth/login` | 5 | 60s |
| `/api/auth/register` | 3 | 60s |
| `/api/auth/forgot-password` | 3 | 60s |
| `/api/chat/` | 10 | 60s |
| `/api/checkout` | 5 | 60s |
| `/api/public/avatar/generate` | 3 | 60s |

Returns HTTP 429 with JSON `{"message":"Too many requests. Please try again later."}` when exceeded. Uses `ConcurrentHashMap` with periodic eviction (every 5 minutes). Client IP resolution is trusted-proxy aware: it uses `request.getRemoteAddr()` unless the direct peer matches `app.rate-limit.trusted-proxies` (a comma-separated list of IPs **and/or CIDR ranges**, bound via the `RateLimitProperties` `@ConfigurationProperties("app.rate-limit")` record), in which case it walks `X-Forwarded-For` right-to-left to the first untrusted hop. Configure via `RATE_LIMIT_TRUSTED_PROXIES` (default empty → remoteAddr; prod compose defaults to the Docker bridge `172.16.0.0/12`). The whole filter can be disabled with `app.rate-limit.enabled=false` (`RATE_LIMIT_ENABLED`). Also includes `POST /api/auth/resend-verification` at 3/60s. `RateLimitFilter` is still in-memory per-instance — behind multiple instances, use an external limiter.

## Email Verification & Password Reset

### Email Verification Flow

1. `AuthService.register()` generates a raw token via `SecureTokenService`, stores SHA-256 hash in `users.verification_token`, sets `emailVerified=false`
2. `AuthMailService.sendVerificationEmail()` POSTs `{type:"verification", toEmail, name, actionUrl}` (where `actionUrl` = `{FRONTEND_BASE_URL}/verify-email?token={rawToken}`) to the Next.js/Resend internal route, which renders the template and sends via Resend
3. Registration succeeds even if email delivery fails (logged as warning)
4. `POST /api/auth/verify-email` hashes the submitted token, looks up user, verifies expiry, sets `emailVerified=true`, clears token fields

### Password Reset Flow

1. `POST /api/auth/forgot-password` always returns 200 (prevents account enumeration)
2. If user exists: invalidates previous unused tokens, creates `PasswordResetToken` row (SHA-256 hash, 1h expiry), sends reset email
3. `POST /api/auth/reset-password` validates token hash + expiry + unused, atomically marks token consumed (`consumeToken` query), updates password, invalidates remaining tokens for the user

### Token Security

- Tokens are 32-byte cryptographic random (Base64 URL-safe), only the SHA-256 hash is stored in the database
- Raw tokens are sent to users via email, never stored server-side
- `PasswordResetToken` has atomic `consumeToken` to prevent race conditions

## AI Provider System

Interface: `AIProvider.sendMessage(String systemPrompt, List<Map<String, String>> messages) -> String`
Default method: `AIProvider.healthCheck() -> String` (returns `"UNKNOWN"` unless overridden)

| Implementation | Env Setting | API | Notes |
|----------------|-------------|-----|-------|
| MockAIProvider | `AI_PROVIDER=mock` | -- | 7-step deterministic conversation stub with `[SUGGESTIONS]` markers (default), overrides `healthCheck()` returning `"UP"` |
| ClaudeProvider | `AI_PROVIDER=claude` | Anthropic Messages `/v1/messages` | Production preferred |
| DeepSeekProvider | `AI_PROVIDER=deepseek` | OpenAI-compatible `/chat/completions` | Cost-effective |
| MiniMaxProvider | `AI_PROVIDER=minimax` | OpenAI-compatible (CN endpoint api.minimaxi.com), model MiniMax-M2.7, strips `<think>` tags | China market |

Factory: `AIProviderFactory` selects implementation via `app.ai.provider` config property. Exposes `getProviderName()` and `healthCheck()` for the `/api/health/ai` endpoint. Hot-swap without code change.

Error handling: `AIProviderException` -> 503 via `GlobalExceptionHandler`; chat has inline fallback; outfit explanation uses template fallback.

### Outfit Generation Protocol

`ChatService` uses a regex pattern to detect `[GENERATE_OUTFIT]{...}[/GENERATE_OUTFIT]` markers in AI responses. When detected:
1. Parse the JSON payload (`event`, `style`, `colorPalette`)
2. Call `OutfitService.generateOutfitAnonymous()` synchronously
3. Match published products to 4 slots (top, bottom, shoes, accessory) using scoring: +3 for style tag match, +1 per color match
4. Persist outfit via `OutfitService.persistOutfit()` (links to user and chat session)
5. Return outfit in `ChatMessageResponse.outfit` field
6. Mark session as `COMPLETED` only if outfit was successfully persisted

### Suggestion Chips Protocol

`ChatService` also extracts `[SUGGESTIONS]["opt1","opt2","opt3"][/SUGGESTIONS]` markers from AI responses:
1. System prompt instructs AI to include 2-3 quick-reply suggestions after every response (except after outfit generation)
2. `extractSuggestions()` parses the JSON array, filters blanks, trims whitespace, truncates each to 100 chars, limits to 3 items
3. `stripSuggestionMarkers()` removes `[SUGGESTIONS]...[/SUGGESTIONS]` from the persisted message content
4. `generateFallbackSuggestions()` provides step-appropriate defaults when AI omits suggestions (6 fallback sets keyed by conversation progress)
5. Suggestions are returned in `ChatMessageResponse.suggestions` field (transient, not persisted)

### Generation Task Lifecycle (MATERIALIZED status)

The `ModelGenerationTask` follows this lifecycle:
1. `PENDING` -- created by `GenerationService.regenerate()`, claimed by Python worker
2. `RUNNING` -- worker processing
3. `READY` -- worker completed successfully
4. `MATERIALIZED` -- `GenerationService.processReadyTasks()` materialized the READY task into a `GarmentAsset` row
5. `FAILED` -- error during generation or superseded by regeneration

The API maps `MATERIALIZED` back to `READY` for external consumers (PRD E6.6).

### Rigging Task Lifecycle

The `RiggingTask` follows the same lifecycle pattern as `ModelGenerationTask`:
1. `PENDING` -- created by `RiggingService.requestRigging()`, claimed by Python rigging worker
2. `RUNNING` -- rigging worker processing (weight transfer pipeline)
3. `READY` -- rigging worker completed successfully, output contains `rigged_glb_url`
4. `MATERIALIZED` -- `RiggingService.processReadyTasks()` materialized the READY task into `GarmentAsset` rigging columns
5. `FAILED` -- error during rigging or superseded by a new rigging request

Active tasks (PENDING/RUNNING) for the same garment asset are superseded (set to FAILED) when a new rigging request is made. Failed tasks can be retried, which backfills `input_payload` for legacy tasks that were created before the field was populated.

## Global Exception Handling

`GlobalExceptionHandler` (`@RestControllerAdvice`) maps exceptions to HTTP responses:

| Exception | HTTP Status | Response |
|-----------|-------------|----------|
| `MethodArgumentNotValidException` | 400 | Concatenated field error messages |
| `IllegalArgumentException` | 400 | Exception message |
| `AccessDeniedException` | 403 | `"Access denied"` |
| `AIProviderException` | 503 | `"AI service unavailable: ..."` |
| `AuthMailService.EmailDeliveryException` | 503 | `"Email service unavailable: ..."` |
| `RuntimeException` (fallback) | 500 | `"Internal server error"` |

## Scheduled Tasks

`SchedulerConfig` enables `@EnableScheduling`, provides a multi-threaded `TaskScheduler` bean (pool size 3, `iyae-sched-` threads) so a slow task can never starve the others, and runs four tasks:
- `processReadyGenerationTasks()` (every 5s) calls `GenerationService.processReadyTasks()` to materialize READY `ModelGenerationTask` rows into `GarmentAsset` entries, then marks them as `MATERIALIZED`
- `processReadyAvatarTasks()` (every 5s) calls `AvatarService.processReadyTasks()` to materialize READY `AvatarGenerationTask` rows into `User.avatarGlbUrl`, then marks them as `MATERIALIZED`
- `processReadyRiggingTasks()` (every 5s) calls `RiggingService.processReadyTasks()` to materialize READY `RiggingTask` rows into `GarmentAsset` rigging columns (riggedGlbUrl, riggingStatus, riggedAt), then marks them as `MATERIALIZED`
- `refreshWeatherCache()` (every `app.weather.cache-ttl-seconds`, default 30 min, first run 5s after boot) calls `WeatherService.refresh()` to pre-warm the Toronto weather cache OFF the chat hot path, so `WeatherService.getCurrentToronto()` stays a non-blocking in-memory read (a slow/unreachable Open-Meteo never adds latency to a stylist turn)
- Errors are caught and logged (no propagation)

## Security

- JWT HS256, 24h TTL, secret from `app.jwt.secret` (>=32 bytes)
- `JwtAuthenticationFilter` extracts token from `Authorization: Bearer` header
- `RateLimitFilter` applied before JWT filter in the security filter chain
- `SecurityConfig` defines route-level access (public incl. `GET /api/auth/users/profile/**`, authenticated, DESIGNER role); an explicit `GET /api/products/*/recommended-size` -> `authenticated()` matcher is placed BEFORE the public `/api/products/**` permitAll rule so the recommended-size endpoint requires auth
- CORS configured via dedicated `CorsConfig` bean injected into `SecurityConfig` -- origins from `app.cors.origins` (comma-separated), credentials allowed, scoped to `/api/**`
- Ownership enforced in service layer (not controller)
- Login returns **400** (not 401) on invalid credentials to prevent user enumeration
- Forgot-password always returns 200 to prevent account enumeration
- BCrypt password hashing (cost 10)
- CSRF disabled (stateless JWT)
- Session creation policy: STATELESS
- Email verification tokens and password reset tokens use SHA-256 hashing (raw token never stored)
- `@Max(100)` on `AddCartItemRequest.quantity` and `UpdateCartItemRequest.quantity` prevents abuse

## Test & Quality

- **Framework**: JUnit 5 + Mockito + MockMvc + AssertJ (via `spring-boot-starter-test`)
- **Test profile**: `application-test.yml` (H2 in-memory, Flyway disabled, mock AI)
- **Test directory**: `server/src/test/java/com/iyae/`
- **Current state**: 73 test classes, 637 test methods (+ 4 test support files)

### Test Inventory

| Test File | Type | Tests | What It Covers |
|-----------|------|-------|----------------|
| `IyaeApplicationTests` | `@SpringBootTest` (no web, mocked repos) | 1 | Application context loads |
| `AuthServiceTest` | `@ExtendWith(MockitoExtension)` | 19 | Register success/duplicate-email/with-measurements/duplicate-username/designer-role-creates-designer-profile/buyer-role-no-designer-profile, login success/wrong-password/nonexistent-user, updateProfile success/duplicate-username, verifyEmail success/invalid-token/expired-token, forgotPassword existing-user/non-existent-user, resetPassword success/expired-token/already-used-token |
| `CartServiceTest` | `@ExtendWith(MockitoExtension)` | 11 | Get cart (existing/new), add item (new/existing/with-size), remove item (owned/not-owned), unknown user, size selection (same product different sizes, update size) |
| `JwtTokenProviderTest` | Unit (no Spring) | 7 | Generate token, extract email, validate (valid/tampered/expired), different emails, round-trip |
| `HealthControllerTest` | `@WebMvcTest` (security excluded) | 3 | Health endpoint, AI health (mock/down); declares a `BrandProperties` mock |
| `GenerationServiceTest` | `@ExtendWith(MockitoExtension)` | 8 | Status (none/not-found/MATERIALIZED->READY), ownership checks (getStatus/regenerate/retry), regenerate (supersede pending), regenerate (no image) |
| `ProductServiceTest` | `@ExtendWith(MockitoExtension)` | 22 | Catalog (no filters/category/search/both/page-size clamp), product detail (published/draft-owner/draft-nonowner/draft-anon/nonexistent/with-asset/with-pending-task), designer products (list/unknown-user/no-profile), create product (success/default-currency), delete product (owner/non-owner/nonexistent), categories (populated/empty) |
| `GlbPlaceholderGeneratorTest` | Unit (no Spring) | 5 | GLB magic header, version 2, total length matches array size, writeGlbFile creates file, writeGlbFile creates parent directories |
| `SecureTokenServiceTest` | Unit (no Spring) | 5 | generateRawToken (Base64 URL-safe, unique per call), hashToken (64-char hex, idempotent, different inputs produce different hashes) |
| `RateLimitFilterTest` | Unit (MockHttpServlet) | 10 | Non-matching path passes, login allows up to limit, login blocks after limit, register blocks after limit, different IPs isolated counters, 429 response body JSON, 429 content-type application/json, chat endpoint any-method limit, X-Forwarded-For trusted proxy parses client IP, X-Forwarded-For untrusted proxy uses remoteAddr |
| `AuthMailServiceTest` | `@ExtendWith(MockitoExtension)` + in-process `HttpServer` | 6 | Resend POST for verification (correct path/headers/body), Resend POST for password-reset, secret header sent, non-2xx response throws EmailDeliveryException, transport failure throws EmailDeliveryException, unconfigured endpoint throws EmailDeliveryException |
| `RiggingServiceTest` | `@ExtendWith(MockitoExtension)` | 15 | requestRigging success/not-found/not-owner/no-asset/no-glb/supersede, getStatus ready/materialized-to-ready/none-no-task/none-no-asset, retry success/no-failed-task/backfill-input-payload, processReadyTasks materialize/skip-non-latest |
| `ChatServiceTest` | `@ExtendWith(MockitoExtension)` | 11 | AI provider fallback (error response, session remains active, fallback persisted), normal message save, suggestion extraction (valid/malformed/empty), suggestion marker stripping from persisted content, suggestion truncation (max 3, max 100 chars), blank/whitespace filtering |
| `BodyProfileServiceTest` | `@ExtendWith(MockitoExtension)` | 6 | Get profile (existing/new), upsert (create/update), ownership checks |
| `SavedLookServiceTest` | `@ExtendWith(MockitoExtension)` | 10 | List looks, save/update/delete look, ownership checks, invalid outfit |
| `SavedProductServiceTest` | `@ExtendWith(MockitoExtension)` | 10 | List (embedded product / empty / unknown user), save (new / idempotent-no-write / missing product / unpublished reports not-found), remove (owned / idempotent / lookup scoped to caller) |
| `SavedProductControllerTest` | `@WebMvcTest` | 6 | GET list shape, PUT 200 + identity pass-through, DELETE 204, and 403 for each unauthenticated |
| `ReviewServiceTest` | `@ExtendWith(MockitoExtension)` | 9 | Create review, delete review, get reviews, summary, ownership, duplicate prevention |
| `AvatarServiceTest` | `@ExtendWith(MockitoExtension)` | 8 | Gender identity mapping for avatar payload (null/blank->neutral, Male->male, Female->female, Non-binary->neutral, Prefer-not-to-say->neutral); deleteAvatarData clears avatar URL + body profile + avatar tasks, idempotent when no profile/tasks; declares a `BrandProperties` mock (guest email) |
| `OutfitServiceTest` | `@ExtendWith(MockitoExtension)` | 10 | Generate outfit (slot matching, scoring), manual outfit builder, get outfits, ownership |
| `CheckoutServiceTest` | `@ExtendWith(MockitoExtension)` | 17 | Stripe checkout (session creation, webhook handling, order fulfillment, size in line items, +3 fulfillment: SHIP adds fee line item + fields, PICKUP fee 0 + location, invalid combo rejected) |
| `PostServiceTest` | `@ExtendWith(MockitoExtension)` | 13 | Community post CRUD, feed, like, comment |
| `PromotionServiceTest` | `@ExtendWith(MockitoExtension)` | 9 | Promotion CRUD + slot management |
| `FollowServiceTest` | `@ExtendWith(MockitoExtension)` | 7 | Follow/unfollow toggle, list followers/following |
| `ModelGenerationOrchestrationServiceTest` | `@ExtendWith(MockitoExtension)` | 6 | High-level generation orchestration |
| `OrderServiceTest` | `@ExtendWith(MockitoExtension)` | 5 | Order history, detail, ownership |
| `UserServiceTest` | `@ExtendWith(MockitoExtension)` | 5 | User account operations |
| `DesignerProfileServiceTest` | `@ExtendWith(MockitoExtension)` | 5 | Designer profile management |
| `FileStorageServiceTest` | `@ExtendWith(MockitoExtension)` | 5 | File upload (JPEG/PNG/WebP, atomic write) |
| `GarmentAssetServiceTest` | `@ExtendWith(MockitoExtension)` | 4 | Garment asset retrieval |
| `HealthServiceTest` | `@ExtendWith(MockitoExtension)` | 2 | Server and AI health probes; declares a `BrandProperties` mock (service id) |
| `SizeRecommendationServiceTest` | `@ExtendWith(MockitoExtension)` | 33 | Tier-1 chart (nearest size, RMS-over-differing-dim-counts, tie-break, unavailable-size fall-through, available-cased label, oversized-cap, malformed/empty JSON), **Tier-1 fallback to `product_size_measurements` rows (fires MEASUREMENT_CHART when `size_chart` JSON absent; JSON takes precedence; all-null rows degrade)**, Tier-2 self-reported (tops/dress/coat/jeans/dress-shoes category mapping, unrecognized->NONE, not-available->NONE), no body profile->NONE, product-not-found + non-PUBLISHED visibility gate (draft owner/non-owner/buyer), pure `pickBestFit` + `recommendForBuyer` cm-normalization |
| `SizeRecommendationControllerTest` | `@WebMvcTest` | 2 | GET /api/products/{id}/recommended-size authenticated returns 200 with shape, unauthenticated is denied |
| `AvatarControllerTest` | `@WebMvcTest` | 6 | Avatar generate endpoint; DELETE /api/avatar authenticated returns 204, unauthenticated returns 403 |
| `FulfillmentServiceTest` | `@ExtendWith(MockitoExtension)` | 8 | resolve ship+carrier/pickup+location/null-default; reject ship-no-carrier, pickup-no-location, unknown-location, mutually-exclusive; guardrail ≥2 carriers & never Canada-Post-only |
| `FulfillmentControllerTest` | `@WebMvcTest` | 2 | GET /api/fulfillment/pickup-locations + /shipping-options return 200 unauthenticated (public) |

### Untested Areas (coverage gaps)

- SecurityConfig (integration: route-level access rules end-to-end)
- DataSeeder / GlbAssetInitializer (seeding logic)
- GuestAvatarController / GuestAvatarService (no dedicated test files yet)

## Gotchas

- `open-in-view: false` -- no lazy loading outside transactions; fetch eagerly or use JOIN FETCH
- Outfit generation uses `[GENERATE_OUTFIT]...[/GENERATE_OUTFIT]` protocol markers in AI response, parsed by regex in `ChatService`
- `ModelGenerationTask` is shared with the Python worker via the same MySQL table -- schema is owned by Flyway migrations here
- `MATERIALIZED` is an internal status -- API maps it to `READY` externally in `GenerationService.getStatus()`
- CORS origins configured via `app.cors.origins` (comma-separated), injected into `CorsConfig` bean which `SecurityConfig` consumes
- `DataSeeder` populates seed data on startup (designers, buyers, products, promotions, garment assets) -- skips if any users already exist; all seed users have `emailVerified=true`
- `SchedulerConfig` runs three 5s tasks: materialize READY generation tasks into `GarmentAsset` rows, READY avatar tasks into `User.avatarGlbUrl`, and READY rigging tasks into `GarmentAsset` rigging columns
- Guest avatar endpoint (`/api/public/avatar/*`) uses an internal `guest@iyae.internal` user account; the guest user is auto-created on first request
- `GuestAvatarService.estimateWaistCm()` estimates waist from height+weight using BMI-based formula when not provided
- Cart items now include `selectedSize` (default `ONE_SIZE`); unique constraint changed from `(cart_id, product_id)` to `(cart_id, product_id, selected_size)` allowing the same product in different sizes
- Checkout is currently stubbed (returns fake Stripe session)
- `GlobalExceptionHandler` catches `RuntimeException` as fallback -- be careful not to leak stack traces
- `FileStorageService` accepts JPEG, PNG, and WebP (previously JPEG only); writes atomically via temp file + `ATOMIC_MOVE`
- `RateLimitFilter` uses in-memory `ConcurrentHashMap` -- rate limit state is not shared across instances; in production behind a load balancer, consider external rate limiter
- Email delivery failures during registration are swallowed (logged as warning) so registration still succeeds
- Forgot-password swallows email delivery failures to prevent account enumeration via 503 vs 200 side-channel
- `PasswordResetToken.consumeToken()` uses an atomic UPDATE query to prevent race conditions
- Email is Resend-only in every profile -- `AuthMailService` POSTs to the Next.js internal route (`app.mail.resend-endpoint`); there is no JavaMailSender/SMTP anywhere. There is **no Mailpit** in dev: without `RESEND_API_KEY` set on the web container, delivery fails and is logged (no local inbox to inspect)
- Registration with `DESIGNER` role auto-creates a `DesignerProfile` entity; `BUYER` role registration does not
- `ChatService` requires email verification before AI stylist access (configurable via `app.auth.require-email-verification`, default `true`)
- `ChatService` persists cleaned AI responses (no `[SUGGESTIONS]` markers) but keeps `[GENERATE_OUTFIT]` markers (frontend handles stripping)
- `MockAIProvider` now includes `[SUGGESTIONS]` markers in all step responses -- tests relying on raw mock output should account for this
- `AvatarService.mapGenderIdentity()` maps user genderIdentity to avatar model gender: "Female"->"female", "Male"->"male", everything else->"neutral"
- `SavedLookService.extractItemNames()` parses `OutfitResponse` from `OutfitRecommendation.responseData` JSON -- returns empty list on parse failure

## Related Files

| Path | Purpose |
|------|---------|
| `build.gradle.kts` | Gradle build config (dependencies, Java 22) |
| `settings.gradle.kts` | Project name |
| `Dockerfile` | Multi-stage build (gradle -> temurin JRE 22) |
| `src/main/resources/application.yml` | Main config (incl. `app.brand.*`, Resend mail route, and auth token TTLs) |
| `src/main/resources/application-dev.yml` | Dev overrides (SQL logging, DEBUG, `require-email-verification: false`) |
| `src/main/resources/application-prod.yml` | Production overrides (INFO logging, no SQL) |
| `src/test/resources/application-test.yml` | Test overrides (H2 in-memory, Flyway off) |
| `src/main/resources/db/migration/V1__baseline_schema.sql` | 15-table baseline |
| `src/main/resources/db/migration/V2__indexes_and_constraints.sql` | Performance indexes |
| `src/main/resources/db/migration/V3__add_materialized_status.sql` | MATERIALIZED status for task lifecycle |
| `src/main/resources/db/migration/V4__email_verification_and_password_reset.sql` | Email verification columns on users + password_reset_tokens table |
| `src/main/resources/db/migration/V5__profile_social_fields.sql` | Username, style/color preferences, avatar, visibility fields on users + extended body measurement fields on body_profiles |
| `src/main/resources/db/migration/V6__avatar_generation_tasks.sql` | Avatar generation task queue table + users.avatar_glb_url column |
| `src/main/resources/db/migration/V7__garment_rigging_tasks.sql` | Rigging task queue table + garment_assets rigging columns |
| `src/main/resources/db/migration/V8__community_tables.sql` | Community tables (posts, post_comments, post_likes, follows) |
| `src/main/resources/db/migration/V9__checkout_orders.sql` | Stripe payment columns on orders (stripe_session_id, stripe_payment_intent, payment_status) |
| `src/main/resources/db/migration/V10__cart_item_selected_size.sql` | Add selected_size to cart_items, change unique key to (cart_id, product_id, selected_size) |
| `src/main/resources/db/migration/V11__product_size_chart.sql` | Add nullable `size_chart` JSON column to products (stores a size chart array for size recommendation) |
| `src/main/resources/db/migration/V12__marketplace_local_and_measurements.sql` | Add ADMIN to users.role enum; city/is_local on designer_profiles; new product_size_measurements table |
| `src/main/resources/db/migration/V13__product_moderation_lock.sql` | Add products.moderation_locked for durable admin moderation (M2) |
| `src/main/resources/db/migration/V14__analytics_events_and_cohorts.sql` | A/B-cohort KPI instrumentation (cohort_assignments + analytics_events tables) |
| `src/main/resources/db/migration/V15__community_feeds_share_report.sql` | Phase 6: posts city/topic/saved_look_id FK/product_ids; users.city; post_comments moderation; post_reports table |
| `src/main/resources/db/migration/V16__resale_listings.sql` | Phase 7: resale_listings table + orders.resale_listing_id (buyer resale of owned items) |
| `src/main/resources/db/migration/V17__fulfillment_and_shipping.sql` | Phase 8: pickup_locations table (+2 Toronto seed rows) + orders fulfillment columns (fulfillment_method, pickup_location_id, shipping_carrier, shipping_fee) |
| `src/main/resources/db/migration/V21__saved_products.sql` | Wishlist: `saved_products` set-membership table, unique `(user_id, product_id)` so a repeated save is idempotent in the database |

## Changelog

| Date | Action |
|------|--------|
| 2026-06-03 | Doc sync: suggestion chips, saved look items, avatar gender mapping; tests 17->18 files / 146->159 methods |
| 2026-06-07 | Major doc sync: Stripe checkout (V9), tests 18->48 files / 159->333 methods (20 controller + 11 service tests); Resend email integration |
| 2026-06-08 | Quality audit: corrected MAIL_FROM default `.com`->`.ca`, trimmed changelog |
| 2026-06-14 | Doc sync: +GuestAvatarController/Service (public avatar API), cart size selection (V10 migration), V9+V10 migration refs, services 26->27, controllers 20->21, DTOs 44->46, tests 333->339 |
| 2026-06-14 | Count audit: tests 339->338 (service header 220->215, controller header 105->100 -- corrected sum errors); AuthMailServiceTest 5->8 (Resend fallback tests were undercounted); added GuestAvatar to untested areas |
| 2026-09-05 | Email consolidated onto Resend: removed `spring-boot-starter-mail` + all `spring.mail.*`/`SMTP_*` config; `AuthMailService` is Resend-only (POSTs to Next.js internal route). Added `BrandProperties` (`app.brand.*`, config 9->10). Main class/context test renamed Clossett->Iyae. Tests 338->336 (AuthMailServiceTest 8->6; Health*/Avatar now mock BrandProperties) |
| 2026-09-05 | Phase 4 Virtual Fitting: V11 size_chart migration + Product.sizeChart; SizeRecommendationService/Controller/DTO (`GET /api/products/{id}/recommended-size`, authenticated matcher before public products rule); AvatarController `DELETE /api/avatar` one-tap delete + AvatarService.deleteAvatarData; tests 336->349 (+SizeRecommendation service/controller, +AvatarService/Controller delete) |
| 2026-09-05 | PR #8 follow-up: SizeRecommendationService selects chart entry on RMS to match the confidence metric (M2); added `SizeRecommendationBasis` enum backing the `basis` string (L6); capped `size_chart` parsing at 50 entries (L7); RateLimitFilter gained a nullable `pathSuffix` + rules for `DELETE /api/avatar` (10/60s) and `GET /api/products/*/recommended-size` (30/60s) (L1); AvatarService.deleteAvatarData logs active-task purge (L3). Added tests to SizeRecommendationServiceTest (M2/tie-break/malformed/empty/cap), RateLimitFilterTest (L1), AvatarServiceTest (L3) |
| 2026-09-05 | Phase 5 (Marketplace + Local Designers + ADMIN): marketplace migration (ADMIN role, designer_profiles.city/is_local, product_size_measurements table); +ADMIN enum value (auto ROLE_ADMIN via UserDetailsServiceImpl); `/api/admin/**` gated to ADMIN in SecurityConfig; new AdminController + AdminModerationService (privileged catalog/community/promotion moderation, no ownership check); SizeRecommendationService gains cm-based `recommendForBuyer` "your size" normalization vs BodyProfile (unified with the chart-based `recommend`); catalog `localOnly` filter via new ProductSpecifications; ProductResponse gains designerLocal/designerCity/recommendedSize/measurements; DesignerProduct create/update accept per-size measurements; AuthService rejects public ADMIN registration |
| 2026-09-05 | PR#10 follow-up (`fix/pr10-h1-l6-measurements`): product_moderation_lock migration + `Product.moderationLocked` for M2 durable admin moderation; `ProductService.updateProduct` throws `AccessDeniedException` (403) on moving a locked product out of ARCHIVED; new `ProductSpecificationsDataJpaTest`. NOTE latent pre-existing bug: `PasswordResetTokenRepository.consumeToken` assigns `CURRENT_TIMESTAMP` to `Instant` |
| 2026-09-06 | Merge #10 into main: reconciled two independent size-recommendation seams into one `SizeRecommendationService` (chart-based `recommend` + cm-measurement `recommendForBuyer`); renumbered Phase-5 migrations to avoid a V11 collision with `V11__product_size_chart` (marketplace -> V12, moderation_lock -> V13) |
| 2026-09-06 | Phase 6 (PR-A server): V15 migration (posts.city/topic/saved_look_id FK/product_ids json; users.city; post_comments.status/deleted_at; post_reports table); named-feed queries in PostRepository (findFollowingFeed JPQL + city/topic finders, all constrain status=ACTIVE); FollowRepository count queries; new PostReport entity + CommentStatus/ReportStatus enums; PostService 4-arg getFeed dispatch (discover/following/toronto/body-confidence, unknown→400) + Share-a-Look in createPost (SavedLook ownership→403) + getPost/getComments/reportPost (idempotent); FollowService.getCounts; AdminModerationService listReports/resolveReport/removeComment; controllers extended (posts ?feed=/{id}/comments/report; follows /counts+/status; admin /reports+/comments/{id}/remove); DTOs PostReportRequest/Response, FollowCountsResponse. Tests 388→494 (+PostFeedDataJpaTest @DataJpaTest; +TestUsers.anAdmin). Fixed PostStatus doc-drift (was DELETED). |
| 2026-09-06 | Phase 4 size-chart authoring (PR-B server): `SizeRecommendationService.recommend` Tier-1 now falls back to the designer-authored `product_size_measurements` rows (via `ProductSizeMeasurementRepository.findByProductId`) when `products.size_chart` JSON is null/blank, so the shipped studio measurement UI drives a `MEASUREMENT_CHART` recommendation end-to-end. JSON still takes precedence when present (no regression); the match stays on the three shared dims (chest/waist/hips) — Seam B `length_cm` is intentionally NOT mapped to `inseamCm`. No migration, no DTO/`ProductResponse` change. Retired the two `TODO(size-chart-authoring)` markers. +3 SizeRecommendationServiceTest cases. Full suite re-verified: **518 tests, 0 failures** (prior CLAUDE.md header counts of 349/50-files were stale drift — corrected to 518/62-files here) |
| 2026-09-06 | Code-review fix pass (H2/H3/H4/M1/M4/M6): `SizeRecommendationService.selfReportedSizeForCategory` reordered (shoe-before-dress) + synonyms; chart tier returns the available-cased label (M4); `AvatarService.deleteAvatarData` purges the on-disk avatar GLB under `worker.output-dir`/avatars/{id} (H3); `SchedulerConfig.weatherRefreshMs` SpEL floor so `WEATHER_CACHE_TTL=0`/negative can't crash startup (H4); `RateLimitFilter` chat rule scoped to `POST` so GET `/api/chat/weather` isn't throttled (M1); `ProductService.getProductById` non-owner path returns uniform "Product not found" (info-leak fix, mirrors the SizeRecommendationService gate — M6, full guard extraction deferred). +6 tests (SizeRecommendation category/casing, Avatar file-purge, Scheduler floor, RateLimit weather/POST, Product buyer-info-leak) |
| 2026-09-06 | Phase 8 — Toronto Physical Touchpoints + Shipping (lightweight v1): V17 migration (pickup_locations + orders fulfillment columns); FulfillmentService/Controller + FulfillmentMethod/ShippingCarrier enums + PickupLocation entity/repo + CheckoutRequest/PickupLocation/ShippingOption DTOs; checkout now takes optional CheckoutRequest body, adds a Stripe shipping line item, persists fulfillment_method/pickup_location_id/shipping_carrier/shipping_fee (total = items + fee); `GET /api/fulfillment/**` public; OrderResponse exposes fulfillment + resolved pickup name. Multi-carrier guardrail (never Canada-Post-only). Server tests → 528. |
| 2026-10-10 | Server-side wishlist: V21 `saved_products` (set membership, unique `(user_id, product_id)` so a repeated save is idempotent in the DB) + `SavedProduct` entity / `SavedProductRepository` (JOIN FETCH product+designerProfile, since `ProductResponse` reads the designer display name and `open-in-view` is off) / `SavedProductService` / `SavedProductController` / `SavedProductResponse`. `GET /api/saved-products`, `PUT|DELETE /api/saved-products/{productId}` — PUT not POST because set membership is idempotent and the web client replays a localStorage wishlist on first sign-in. Only PUBLISHED products are savable; anything else returns the same "Product not found" as a missing id. Registered the repository in `IyaeApplicationTests` (that context excludes JPA autoconfiguration, so every repository needs an explicit `@MockBean`). Tests 549 -> 565. Also corrected long-standing count drift in this file: controllers 23->27, services 29->34, repositories 23->31, entities 23->29, enums 11->17, DTOs 50->69, migrations through V17->V21, tests "63 files / 528 methods"->66 classes / 565 methods |
| 2026-09-08 | Tech-debt cleanup: fixed the latent `PasswordResetTokenRepository.consumeToken` bug — JPQL now binds an `Instant :now` param (`SET t.usedAt = :now ... AND t.expiresAt > :now`) instead of assigning `CURRENT_TIMESTAMP` to the `Instant` field (mirrors the correct `ResaleListingRepository` pattern); `AuthService` passes `Instant.now()`, `AuthServiceTest` stub updated to the 2-arg signature. Compile-all + AuthServiceTest green. |
| 2026-10-11 | **Audit remediation (server half).** New: `AdminBootstrap` (creates/promotes exactly one ADMIN from `ADMIN_BOOTSTRAP_EMAIL`/`_PASSWORD`, refusing to promote an unverified or password-mismatched account — registration is open and the intended admin address is guessable, so an unconditional promotion was squattable); `RestAuthenticationEntryPoint` (401 for anonymous — Spring's `Http403ForbiddenEntryPoint` fallback wedged every user at token expiry, since the web client only treats 401 as session death); `ProductionConfigValidator` (`@Profile("prod")`, fails startup on an empty `CORS_ORIGINS`, a localhost `FRONTEND_BASE_URL`, or the published dev `INTERNAL_MAIL_SECRET`); `AccountDeletionService` + `DELETE /api/auth/me` (V22 tombstone — the row survives because `orders` holds a non-null FK and an order is a financial record); `PublicConfigController` (`GET /api/public/config`, runtime feature flags, which replaced the `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` build-time flag rather than re-plumbing it: two booleans that must agree is the same defect waiting to recur); `Pagination` util; `PaymentsDisabledException` → 503. `CheckoutService` refuses instead of writing a free `PAID` order; `JwtAuthenticationFilter` answers 403 (not a silent decline) for unverified email with a **method-scoped** allow-list, and verifies an immutable `uid` claim — the email subject is not a stable identity once deletion frees the address for re-registration. `SecurityConfig`/`WebMvcConfig` expose only the non-personal `/assets` subtrees; `GET /api/avatar/model` is the sole route to a body scan. `GlbAssetInitializer` + `ProductService.validatedGlbUrl` close a designer-settable path traversal. `PostService` maps a feed page in 3 queries instead of 3 per post. `GlobalExceptionHandler` logs the catch-all with a correlation id; `/api/health/ready` can actually fail. Resale: session expiry now ordered strictly inside the reservation TTL (the sweep used to release a unit a live Stripe session could still pay for), one listing per owned unit (V23, unique index + de-duplicating migration), `flushAutomatically` so the webhook's PAID transition is not discarded, and a lost reservation marks the order `PAID_UNFULFILLABLE` and logs at ERROR instead of INFO. **`@SQLRestriction` on `User` was tried and reverted**: it applies to by-id and association loads on Hibernate 6.6, so `order.getUser()` threw for a tombstoned customer and broke the Stripe webhook — the filtering lives on `UserRepository`'s identity lookups, with `TombstonedUserDataJpaTest` pinning both that identity lookups cannot see a tombstone and that an order still resolves its deleted customer. Migrations V22 (account deletion), V23 (one resale listing per unit), V24 (`orders.stripe_session_id` index). Tests 565 → 631 across 72 classes (+`AdminBootstrapTest`, `AccountDeletionServiceTest`, `JwtAuthenticationFilterTest`, `PublicConfigControllerTest`, `PaginationTest`, `TombstonedUserDataJpaTest`). All 24 migrations verified against a real MySQL 8 — the test profile disables Flyway and runs H2, so V22–V24 had never been executed by anything. |
| 2026-10-12 | **PR #47 second review pass (server).** The `/assets` allow-list is the headline: `WebMvcConfig.PUBLIC_ASSET_SUBTREES` and the `SecurityConfig` matchers named `{models, poses, garments}`, which is not what the worker writes. `products` (every model generator's `glb_url`/`usdz_url`) and `rigged` (every rigging provider's `rigged_glb_url`) were absent, and those URLs are returned verbatim by `GenerationService.getStatus` and stored raw on `GarmentAsset`, with no route re-serving them — so the lockdown that stopped body scans being enumerable also 404'd every 3D preview and every try-on asset. Both are now exposed; `avatars` and the Blender provider's `rigging-work` scratch subtree stay out; and `AssetExposureConsistencyTest` reads the real nginx configs and compares all four lists, because four hand-maintained copies of one list is what let them disagree. `CheckoutService` requires **both** Stripe values: `isCheckoutEnabled` and all three call-site gates route through `stripeFullyConfigured()`, since a key with no webhook secret charges the buyer and then rejects every `checkout.session.completed` — leaving the order PENDING and resale units unsold — and `handleWebhook` now logs at ERROR before throwing, where `GlobalExceptionHandler.handleIllegalArgument`'s bare 400 had recorded nothing. `ProductionConfigValidator` dropped `@Profile("prod")`: that made every check depend on the variable being spelled exactly `prod`, so a deploy that forgot it skipped the class in silence — it now always loads, validates under `prod`, stays quiet under `dev`/`test`, logs loudly under anything else, and additionally refuses a half-configured Stripe pair (the deploy script checks it, but plain `docker compose` never runs that script). New `UserRepository.findActiveById` for caller-supplied ids: the unfiltered inherited `findById` has to stay so `order.getUser()` resolves a tombstoned customer, which made it the wrong lookup for `POST /api/follows/{id}` — a deleted account was followable, and the profile grid rendered it as ordinary. `AccountDeletionService` keeps a listing that records a **completed** sale: `hasPendingOrder` only sees PENDING, so a SOLD listing was deleted and `ON DELETE SET NULL` detached it from an order the buyer had paid for, with the order snapshot carrying neither condition nor seller. New `GET /api/public/avatar/model/{taskId}` + `GuestAvatarService.openTaskModel`, because the guest flow still handed anonymous callers the raw `/assets/avatars/...` path the lockdown had just closed; the containment check is shared with the authenticated route via `AvatarService.openAvatarModelAt`. And `stubResaleCheckout` reads `markSold`'s boolean — the stub path writes the order PAID, so discarding it made the one configuration that fabricates payments the only one unable to tell a sale from a lost reservation. Tests 637 → 683 across 77 classes (+`AssetExposureConsistencyTest`, +`AvatarModelAccessTest` — the ownership scoping and traversal guard the "no longer enumerable" claim rests on had no test at all, +`GuestAvatarServiceTest`, +`ProductionConfigValidatorTest`, +cases on checkout/follow/account-deletion/public-config). |
| 2026-10-12 | **PR #47 review follow-up (server).** `JwtAuthenticationFilter` no longer writes the response itself for an unverified email. It runs before `authorizeHttpRequests`, so its 403 **overrode every access rule including `permitAll`** — and because registration hands back a JWT that `api.ts` attaches to every request, a registered-but-unverified account got 403 from `GET /api/products/**`, `/api/auth/users/profile/**`, `/api/health/**` and `/api/public/**`, the last being the very endpoint that tells the client whether verification is required. The filter now sets `UNVERIFIED_EMAIL_ATTRIBUTE` and leaves the request anonymous; `RestAuthenticationEntryPoint` reads it and answers 403 instead of 401, preserving the B-15 "a valid credential must survive" distinction while leaving SecurityConfig as the single source of what is public. `authenticate` became `void` and the filter dropped its now-unused `ObjectMapper`. `RateLimitFilter` gained suffix-scoped rules for `POST /api/posts/{id}/{like,comments,report}` placed **ahead of** the bare create rule — matching is first-match-wins on `startsWith`, so liking ten posts while scrolling a feed used to exhaust the create bucket and then 429 the user's own post. Removed the dead `ResaleListingRepository.deleteBySellerId`: `AccountDeletionService` routes through `deleteResaleListingsExceptLiveSales` and only names the old method in a comment explaining why. Corrected a stale "403, not 401" comment in `SavedProductControllerTest` that contradicted the assertion beneath it. Tests 631 → 637 across 73 classes (+`RestAuthenticationEntryPointTest`: 401 for anonymous, 403 for unverified, and a non-Boolean attribute not mistaken for the marker; +`JwtAuthenticationFilterTest.unverifiedEmail_doesNotBlockPublicEndpoints`, measured failing against the old filter; +2 rate-limit bucket-separation cases). |
