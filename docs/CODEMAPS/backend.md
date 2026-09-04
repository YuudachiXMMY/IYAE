<!-- Generated: 2026-05-27 | Updated: 2026-06-14 | Controllers: 21 | Services: 27 | DTOs: 46 | Tests: 48 files (339 methods) | Token estimate: ~1200 -->

# Backend (Spring Boot 3.4 / Java 22)

## API Routes

### Auth (`/api/auth`)
POST /register          → AuthController → AuthService → UserRepo + AuthMailService (verification email)
POST /login             → AuthController → AuthService → JwtTokenProvider (returns JWT)
GET  /me                → AuthController → AuthService → UserRepo (auth required)
PUT  /me                → AuthController → AuthService → UserRepo + BodyProfileRepo (auth required)
POST /verify-email      → AuthController → AuthService → UserRepo (token validation)
POST /forgot-password   → AuthController → AuthService → SecureTokenService + AuthMailService
POST /reset-password    → AuthController → AuthService → PasswordResetTokenRepo
GET  /users/profile/{username} → AuthController → AuthService → UserRepo (public profile, visibility-gated)

### Products (`/api/products`)
GET  /                  → ProductController → ProductService → ProductRepo (public, filterable)
GET  /categories        → ProductController → ProductService → ProductRepo (public)
GET  /{id}              → ProductController → ProductService → ProductRepo (public)

### Designer Products (`/api/designer/products`, DESIGNER role)
GET  /                  → DesignerProductController → ProductService (owner filtered)
POST /                  → DesignerProductController → ProductService → ProductRepo
PUT  /{id}              → DesignerProductController → ProductService (ownership check)
DELETE /{id}            → DesignerProductController → ProductService (ownership check)
POST /upload/image      → DesignerUploadController → FileStorageService (JPEG/PNG/WebP, 10MB)
GET  /{id}/generation-status  → GenerationStatusController → GenerationService
POST /{id}/regenerate         → GenerationStatusController → GenerationService
POST /{id}/generation-status/retry → GenerationStatusController → GenerationService

### Cart (`/api/cart`, auth required)
GET  /                  → CartController → CartService → CartRepo (get-or-create)
POST /items             → CartController → CartService → CartItemRepo (@Max(100) qty, selectedSize)
PUT  /items/{id}        → CartController → CartService (ownership check)
DELETE /items/{id}      → CartController → CartService (ownership check)

### Checkout & Orders
POST /api/checkout      → CheckoutController → CheckoutService → StripeCheckoutGateway → OrderRepo
GET  /api/orders        → OrderController → OrderService (auth required)
GET  /api/orders/{id}   → OrderController → OrderService (ownership check)

### Stripe Webhook
POST /api/webhooks/stripe → StripeWebhookController → CheckoutService (order fulfillment)

### Chat (`/api/chat`, auth required)
POST /sessions          → ChatController → ChatService → ChatSessionRepo
GET  /sessions          → ChatController → ChatService (user's sessions)
POST /sessions/{id}/messages → ChatController → ChatService → AIProvider + OutfitService
GET  /sessions/{id}/messages → ChatController → ChatService

### Outfits & Looks (auth required)
POST /api/outfits/generate → OutfitController → OutfitService → ProductRepo (slot matching)
POST /api/outfits/manual   → OutfitController → OutfitService (manual slot-based product picker)
GET  /api/outfits          → OutfitController → OutfitService
GET  /api/outfits/{id}     → OutfitController → OutfitService
GET  /api/looks            → SavedLookController → SavedLookService
POST /api/looks            → SavedLookController → SavedLookService
PUT  /api/looks/{id}       → SavedLookController → SavedLookService
DELETE /api/looks/{id}     → SavedLookController → SavedLookService

### Reviews (`/api/products/{productId}/reviews`)
POST /                  → ReviewController → ReviewService (auth required)
GET  /                  → ReviewController → ReviewService (public)
GET  /summary           → ReviewController → ReviewService (public)
DELETE /                → ReviewController → ReviewService (ownership check)

### Body Profile (`/api/body-profile`, auth required)
GET  /                  → BodyProfileController → BodyProfileService
POST /                  → BodyProfileController → BodyProfileService (upsert)

### Promotions (`/api/promotions`)
GET  /featured          → PromotionController → PromotionService (public)
GET  /                  → PromotionController → PromotionService (DESIGNER)
POST /                  → PromotionController → PromotionService (DESIGNER)
PUT  /{id}              → PromotionController → PromotionService (DESIGNER)
DELETE /{id}            → PromotionController → PromotionService (DESIGNER)

### Rigging (`/api/rigging`, auth required)
POST /request           → RiggingController → RiggingService (request garment rigging)
GET  /{taskId}/status   → RiggingController → RiggingService (poll rigging status)
POST /{taskId}/retry    → RiggingController → RiggingService (retry failed rigging)

### Community Posts (`/api/posts`, auth required)
GET  /                  → PostController → PostService (feed)
POST /                  → PostController → PostService (create post)
GET  /{id}              → PostController → PostService (single post)
DELETE /{id}            → PostController → PostService (ownership check)
POST /{id}/like         → PostController → PostService (toggle like)
POST /{id}/comments     → PostController → PostService (add comment)

### Follows (`/api/follows`, auth required)
POST /{userId}          → FollowController → FollowService (toggle follow)
GET  /followers         → FollowController → FollowService (list followers)
GET  /following         → FollowController → FollowService (list following)

### Guest Avatar (`/api/public/avatar`, no auth)
POST /generate          → GuestAvatarController → GuestAvatarService (anonymous avatar generation)
GET  /status/{taskId}   → GuestAvatarController → GuestAvatarService (poll guest avatar status)

### Other
POST /api/avatar/generate → AvatarController → AvatarService (gender identity mapping → avatar_generation_task)
GET  /api/avatar/status     → AvatarController → AvatarService (poll avatar generation)
GET  /api/health          → HealthController → HealthService
GET  /api/health/ai       → HealthController → AIProviderFactory.healthCheck()

## Middleware Chain

```
Request → RateLimitFilter (per-IP) → JwtAuthenticationFilter (Bearer token) → SecurityConfig (path rules) → Controller
```

### Rate Limits
| Path Pattern                  | Max | Window |
|-------------------------------|-----|--------|
| POST /api/auth/login          | 5   | 60s    |
| POST /api/auth/register       | 3   | 60s    |
| POST /api/auth/forgot-password| 3   | 60s    |
| PUT  /api/auth/me             | 10  | 60s    |
| /api/chat/**                  | 10  | 60s    |
| /api/checkout                 | 5   | 60s    |
| POST /api/public/avatar/generate | 3 | 60s  |

## AI Provider Architecture

```
AIProviderFactory.getProvider() → AIProvider interface
  ├── MockAIProvider   (default, deterministic stub)
  ├── ClaudeProvider   (claude-sonnet-4-20250514, 1024 max tokens)
  ├── DeepSeekProvider (OpenAI-compatible)
  └── MiniMaxProvider  (OpenAI-compatible, CN endpoint)
```

Outfit generation protocol: ChatService detects `[GENERATE_OUTFIT]{json}[/GENERATE_OUTFIT]` in AI response → parses → OutfitService matches products (scoring: +3 style tag, +1 color).
Suggestion chips protocol: ChatService detects `[SUGGESTIONS]...[/SUGGESTIONS]` → strips from content → extracts as `ChatMessageResponse.suggestions` list. Email-unverified users get fallback suggestions instead of AI call.

## Key Files

```
server/src/main/java/com/clossette/
├── ClossettApplication.java        # Entry point
├── controller/ (21 files)          # REST endpoints (incl. GuestAvatarController, StripeWebhookController)
├── service/ (27 files)             # Business logic + ownership checks (incl. GuestAvatarService, StripeCheckoutGateway, DefaultStripeCheckoutGateway)
├── repository/ (22 files)          # Spring Data JPA
├── entity/ (22 files + 9 enums)    # JPA entities
├── dto/ (46 files)                 # Request/response records (incl. GuestAvatarRequest, GuestAvatarStatusResponse)
├── ai/ (7 files)                   # AIProvider interface + 4 impls + factory + exception
├── security/ (3 files)             # JwtAuthenticationFilter + JwtTokenProvider + UserDetailsServiceImpl
├── config/ (9 files)               # SecurityConfig, RateLimitFilter, CORS, Mail, Scheduler, DataSeeder, AI, WebMvc, GlbAssetInitializer
├── util/ (1 file)                  # GlbPlaceholderGenerator
└── src/test/ (48 files, 339 methods + 4 test support)
```
