# IYAE — Product Requirements Document (PRD)

> **Version**: 2.0 (Full Rebuild Blueprint)
> **Date**: 2026-05-16
> **Owner**: Jadyn Wu
> **Status**: Draft — awaiting review before rebuild kickoff

---

## 1. Executive Summary

IYAE is an AI-powered fashion marketplace that combines **conversational AI styling**, **3D/AR virtual try-on**, and an **independent designer marketplace** to help Gen Z and young millennial shoppers (18-30) go from "I have nothing to wear" to "I feel great about this look" — with zero decision fatigue and near-zero returns.

### Core Value Propositions

| Stakeholder | Value |
|-------------|-------|
| **Buyer** | Personalized outfit recommendations via AI chat → visualize on 3D avatar → buy with confidence → fewer returns |
| **Designer** | Low-barrier marketplace to publish → AI surfaces products organically → 3D asset generation automates catalog enrichment |
| **Platform** | Reduced return rate (environmental win) → sponsored product slots → AI-driven cross-sell → marketplace transaction fees |

---

## 2. Target Users

### 2.1 Primary: Fashion-Conscious Buyer

- **Demographics**: 18-30, digitally native, visually literate
- **Context**: Arrives with a vague occasion ("dinner date", "interview", "gallery opening") or style mood
- **Pain points**: Decision fatigue from endless scrolling; sizing uncertainty causing returns; lack of trusted curation
- **Job to be done**: Go from uncertainty to outfit confidence with minimal friction
- **Key behaviors**: Prefers conversational discovery over search; trusts visual confirmation (3D/AR); values authenticity and independent brands

### 2.2 Secondary: Independent Designer / Fashion Student

- **Demographics**: Emerging designers, fashion school graduates, small-batch creators
- **Context**: Has unique products but lacks distribution; cannot afford traditional photography or 3D modeling
- **Pain points**: High barrier to entry on traditional marketplaces; expensive product photography; no 3D capabilities
- **Job to be done**: Publish products, get AI-powered distribution, and have 3D models generated automatically
- **Key behaviors**: Manages small catalog (5-50 products); needs simple CRUD; values design studio aesthetics

---

## 3. Product Pillars

### Pillar 1: AI Stylist (Conversational Commerce)

The AI stylist is a multi-turn chatbot that guides buyers through a natural conversation to generate personalized outfit recommendations from the actual product catalog.

### Pillar 2: 3D/AR Virtual Try-On

Buyers build a body profile and visualize recommended outfits on a customizable 3D avatar, with WebXR AR on supported devices for real-world overlay.

### Pillar 3: Independent Designer Marketplace

Small designers and fashion students publish products that would never appear in brick-and-mortar stores. AI surfaces their products organically through styling recommendations.

### Pillar 4: Return Reduction (Environmental Impact)

Accurate virtual try-on and AI-powered fit recommendations lower the return rate, reducing fashion waste and shipping emissions.

---

## 4. Feature Specifications

### Epic 1: Authentication & User Management

#### E1.1 — User Registration

| Aspect | Specification |
|--------|---------------|
| **Roles** | `BUYER`, `DESIGNER` (selected at registration) |
| **Fields** | Email (required, unique), password (8-100 chars), name (optional), role |
| **Security** | BCrypt password hashing (cost 10), constant-time login comparison to prevent user enumeration |
| **Token** | JWT HS256, 24h TTL, stored client-side in `localStorage` |
| **Acceptance** | Register → auto-login → token issued; duplicate email → 400; invalid password → 400 |

#### E1.2 — Login / Logout

| Aspect | Specification |
|--------|---------------|
| **Flow** | Email + password → JWT token → stored in localStorage |
| **Error handling** | Invalid credentials → 400 (NOT 401 — constant-time design choice) |
| **Session hydration** | On app load, `GET /me` validates token; expired → clear token + redirect to login |
| **Logout** | Client-side token removal + state reset |

#### E1.3 — Role-Based Access Control

| Route Pattern | Access |
|---------------|--------|
| Public catalog, auth, health | Anonymous |
| Cart, checkout, chat, outfits, looks, profile | Authenticated (any role) |
| Designer product CRUD, promotions | `DESIGNER` role only |

#### E1.4 — Body Profile

| Aspect | Specification |
|--------|---------------|
| **Fields** | Height (cm), weight (kg), chest (cm), waist (cm), hips (cm) |
| **Validation** | Height: 50-300, Weight: 20-500, Measurements: 30-200 |
| **Usage** | Fed into AI outfit explanation for fit-aware styling; avatar generation |
| **UX** | Dedicated `/profile/body` page; upsert pattern (get-or-create) |

---

### Epic 2: Product Catalog & Browsing

#### E2.1 — Product Listing

| Aspect | Specification |
|--------|---------------|
| **Pagination** | Zero-indexed, default page size 20, max 100 |
| **Sorting** | By `price`, `name`, `createdAt`; default `createdAt,desc` |
| **Filtering** | By category (free-text match), free-text search `q` |
| **Visibility** | Only `PUBLISHED` products appear in public catalog; `DRAFT`/`ARCHIVED` accessible by owner via ID |
| **Response** | `PagedResponse<ProductResponse>` envelope: `{ content, page, size, totalElements, totalPages, last }` |

#### E2.2 — Product Detail

| Aspect | Specification |
|--------|---------------|
| **Data** | Name, description, price, currency, category, style tags, color tags, sizes, media URLs, GLB URL |
| **Related** | Reviews (paginated), garment assets (3D models), promotions |
| **Actions** | Add to cart, view in 3D, AR try-on (if GLB available), write review |

#### E2.3 — Product Categories

| Category | Outfit Slot | Count Target |
|----------|-------------|--------------|
| Tops | top | 7+ |
| Bottoms | bottom | 7+ |
| Dresses | top (slot algorithm) | 4+ |
| Outerwear | top (slot algorithm) | 6+ |
| Shoes | shoes (sponsored) | 5+ |
| Accessories | accessory | 3+ |
| Bags | accessory | 1+ |
| Jewelry | accessory | 3+ |

#### E2.4 — Product Reviews

| Aspect | Specification |
|--------|---------------|
| **Rating** | 1-5 integer, required |
| **Comment** | Optional, max 2000 chars |
| **Constraint** | One review per user per product |
| **Aggregation** | Average rating + review count per product |

---

### Epic 3: AI Conversational Stylist

#### E3.1 — Chat Session Management

| Aspect | Specification |
|--------|---------------|
| **Session lifecycle** | `ACTIVE` → `COMPLETED` (auto-transitions when outfit is generated) |
| **Persistence** | Server-side: `ChatSession` + `ChatMessage` entities |
| **History** | Sidebar shows all past sessions; completed sessions are read-only |
| **Multi-session** | Users can have multiple sessions; new session for each styling request |

#### E3.2 — Conversational Flow

The AI follows a 7-step conversation protocol:

```
1. Greet → warm welcome, ask about occasion
2. Occasion → understand the event/context
3. Style → establish style preferences
4. Colors → identify color palette
5. Specific needs → any constraints (budget, weather, etc.)
6. Suggestions → propose outfit direction
7. Confirm → user agrees → generate outfit
```

#### E3.3 — Outfit Generation Trigger

| Aspect | Specification |
|--------|---------------|
| **Protocol** | AI emits `[GENERATE_OUTFIT]{"event":"...","style":"...","colorPalette":["..."]}[/GENERATE_OUTFIT]` |
| **Server processing** | Regex match → parse JSON → call `OutfitService.generateOutfit()` synchronously |
| **Frontend delivery** | `ChatMessageResponse.outfit` field contains the full `OutfitResponse` |
| **Post-generation** | Session marked `COMPLETED`; text area replaced with "New Chat" prompt |
| **Fallback** | AI provider failure → graceful fallback response; parsing failure → error message in chat |

#### E3.4 — AI Provider System (Pluggable)

| Provider | API | Use Case |
|----------|-----|----------|
| Claude (Anthropic) | Messages API `/v1/messages` | Production (preferred) |
| DeepSeek | OpenAI-compatible `/chat/completions` | Cost-effective alternative |
| MiniMax | OpenAI-compatible (CN endpoint available) | China market |
| Mock | Deterministic stub | Testing |

**Selection**: Via `AI_PROVIDER` env var. Hot-swap without code change.

**Error handling**: `AIProviderException` → 503; chat has inline fallback; outfit explanation has template fallback.

#### E3.5 — Outfit Recommendation Algorithm

Four-slot matching against published catalog:

| Slot | Categories | Required | Special |
|------|-----------|----------|---------|
| Top | tops, outerwear, dresses | Yes | — |
| Bottom | bottoms, pants, skirts | Yes | — |
| Shoes | shoes, footwear | Optional | Marked `sponsored=true` |
| Accessory | accessories, bags, jewelry | Yes | — |

**Scoring**: `+3` for exact style tag match, `+1` per color palette tag match. Seed product IDs (user favorites) get priority.

**AI Explanation**: Calls AI provider with matched products + optional body profile for fit-aware styling narrative.

---

### Epic 4: Shopping Cart & Checkout

#### E4.1 — Cart Management

| Aspect | Specification |
|--------|---------------|
| **Deduplication** | Adding existing product increments quantity (no duplicate rows) |
| **Quantity update** | PUT with quantity=0 removes the line |
| **Limits** | Add: max 100 per call; Update: no upper bound |
| **Isolation** | User can only access own cart |
| **Response** | Full `CartResponse` returned after every mutation |

#### E4.2 — Demo Cart (Frontend-only)

| Aspect | Specification |
|--------|---------------|
| **Purpose** | Support AI chat and AR flows when recommended outfits have no real product IDs |
| **IDs** | Negative integers (`-Math.floor(Date.now() + Math.random() * 1000)`) |
| **Storage** | `localStorage["iyae_demo_cart_items"]` |
| **Merge** | Cart badge/totals include both server items + demo items |
| **Cleanup** | Cleared on logout |

#### E4.3 — Checkout

| Aspect | Specification |
|--------|---------------|
| **Current state** | Stubbed — returns fake Stripe session ID and URL |
| **Target** | Stripe Checkout integration with session creation |
| **Post-checkout** | Create `Order` record, clear cart, redirect to confirmation |

---

### Epic 5: 3D Visualization & AR Try-On

#### E5.1 — Avatar Viewer (3D)

| Aspect | Specification |
|--------|---------------|
| **Tech** | React Three Fiber + Drei (OrbitControls, Environment, ContactShadows) |
| **Input** | Array of GLB URLs from outfit products |
| **Rendering** | Each GLB loaded, scene cloned for multiple instances |
| **Interaction** | Orbit, zoom, pan; responsive canvas |
| **SSR** | Must be dynamically imported with `ssr: false` |

#### E5.2 — AR Viewer (WebXR)

| Aspect | Specification |
|--------|---------------|
| **Tech** | `@react-three/xr` with `hitTest: "required"` |
| **Platform support** | Android Chrome 79+, Meta Quest (WebXR); iOS → AR Quick Look fallback; Desktop → 3D only |
| **Device routing** | `SmartARViewer` component auto-detects capability and routes to appropriate renderer |
| **Camera permission** | Gated by `Permissions-Policy` header; only enabled on AR routes |
| **Fallback** | Demo mannequin when no GLB assets available |

#### E5.3 — Model Viewer (Fallback)

| Aspect | Specification |
|--------|---------------|
| **Tech** | `@google/model-viewer` web component |
| **Use case** | iOS (AR Quick Look), Android (Scene Viewer), standalone 3D preview |
| **Features** | Auto-rotate, AR entry button (platform-native) |

#### E5.4 — Body Profile → Avatar Generation

| Aspect | Specification |
|--------|---------------|
| **Current state** | Stubbed — returns parametric avatar config from measurements |
| **Target** | SMPL-X body model generation from measurements |
| **Input** | Height, weight, chest, waist, hips |
| **Output** | Personalized 3D avatar mesh |

---

### Epic 6: 3D Model Generation Pipeline

#### E6.1 — Task Queue Architecture

```
Designer uploads product image
  → Server creates PENDING task (MySQL row)
  → Python Worker polls queue (SELECT ... FOR UPDATE SKIP LOCKED)
  → Worker claims task, runs generation
  → Worker validates output (GLB header, geometry, bbox)
  → Worker marks task READY with output_payload JSON
  → Spring Scheduler materializes GarmentAsset
  → Frontend polling shows READY status with GLB/USDZ URLs
```

#### E6.2 — Task States

| State | Description | Transition |
|-------|-------------|------------|
| `PENDING` | Queued, awaiting worker | → RUNNING (worker claims) |
| `RUNNING` | Worker actively generating | → READY / FAILED |
| `READY` | Generation complete, awaiting materialization | → GarmentAsset created |
| `FAILED` | Generation failed | → PENDING (auto-retry with backoff) |
| `FINALIZING` | Synthetic status (READY but not yet materialized) | Frontend-only |

#### E6.3 — Generation Providers

| Provider | Type | Status |
|----------|------|--------|
| StubGenerator | Copies seed GLB files | Production (mock) |
| TripoGenerator | Tripo3D API (image-to-3D) | Production (real) |
| MeshyGenerator | Meshy.ai API (image-to-3D) | Production (real) |
| Hunyuan3D | Tencent Hunyuan3D | Deferred (not planned) |
| SMPLX Fitter | Body model fitting | Stub (not implemented) |
| Blender Exporter | Post-processing | Stub (not implemented) |

#### E6.4 — Output Validation

| Level | Checks |
|-------|--------|
| Basic GLB | File exists, non-empty, magic header `b"glTF"` |
| Geometry | Triangle count, bounding box, NaN vertex detection |
| Basic USDZ | File exists, non-empty |

#### E6.5 — Output Payload Schema (v1)

```json
{
  "schemaVersion": 1,
  "provider_used": "TRIPO3D",
  "provider_request_id": "task_gen_abc123",
  "glb_path": "products/{pid}/tasks/{tid}/preview.glb",
  "usdz_path": "products/{pid}/tasks/{tid}/preview.usdz",
  "triangle_count": 5000,
  "bbox": {"min": [0,0,0], "max": [1,1.5,0.8]},
  "sanity": { "glb_size_bytes": 1048576, "has_nan_vertices": false },
  "elapsed_ms": 45000,
  "public_glb_url": "/assets/products/{pid}/tasks/{tid}/preview.glb",
  "public_usdz_url": "/assets/products/{pid}/tasks/{tid}/preview.usdz"
}
```

#### E6.6 — Frontend Polling

| Aspect | Specification |
|--------|---------------|
| **Endpoint** | `GET /api/designer/products/{id}/generation-status` |
| **Response** | Status, GLB URL, USDZ URL, error message, retry count |
| **Actions** | Retry (FAILED), Regenerate (any state, supersedes existing) |
| **UI** | `GenerationStatusBadge` (inline) + `GenerationStatusCard` (expanded) |

#### E6.7 — Garment Rigging Pipeline

Rigging binds a flat garment GLB to the SMPL-X skeleton so it can be animated on the avatar.

| Aspect | Detail |
|--------|--------|
| **Task table** | `rigging_tasks` (MySQL) — same PENDING→RUNNING→READY→MATERIALIZED lifecycle as generation |
| **Providers** | `PythonRiggingProvider` (weight transfer via igl + robust_laplacian) · `BlenderRiggingProvider` (legacy headless Blender subprocess) · `StubRiggingProvider` (mock, default for dev) |
| **Python provider status** | Production (Python provider) |
| **Blender provider status** | Legacy fallback (requires Blender installed) |
| **Endpoints** | `POST /api/designer/products/{id}/rigging` · `GET /api/designer/products/{id}/rigging-status` · `POST /api/designer/products/{id}/rigging-status/retry` |
| **Output** | `rigged_glb_url` stored in `garment_assets.rigged_glb_url`; status in `garment_assets.rigging_status` |

---

### Epic 7: Designer Studio

#### E7.1 — Product CRUD

| Operation | Endpoint | Notes |
|-----------|----------|-------|
| List own products | `GET /api/designer/products` | Returns ALL (not paged) |
| Create | `POST /api/designer/products` | Defaults to DRAFT |
| Update | `PUT /api/designer/products/{id}` | Partial update (PATCH-style) |
| Delete | `DELETE /api/designer/products/{id}` | Hard delete |
| Upload image | `POST /api/designer/products/upload/image` | JPEG only, ≤10MB |

#### E7.2 — Product Status Lifecycle

```
DRAFT → PUBLISHED → ARCHIVED
  ↑                     |
  └─────────────────────┘ (can revert)
```

- Only `PUBLISHED` products appear in buyer catalog and AI recommendations
- `DRAFT` products are accessible by owner via direct ID
- Status validated: must be exactly `DRAFT`, `PUBLISHED`, or `ARCHIVED`

#### E7.3 — Image Upload

| Aspect | Specification |
|--------|---------------|
| **Format** | JPEG only (MIME validated) |
| **Size** | ≤10 MB |
| **Storage** | `/var/iyae/assets/uploads/products/{uuid}.jpg` |
| **Atomic write** | temp file + `os.replace` |
| **Response** | `{ url, originalFilename, size, contentType }` |

#### E7.4 — 3D Model Generation (Designer-facing)

| Action | Behavior |
|--------|----------|
| Auto-generate on publish | New PENDING task created when product has an image |
| Regenerate | Supersedes any active tasks, creates fresh PENDING |
| Retry | Re-queues a FAILED task |
| Status display | Real-time badge on product card |

---

### Epic 8: Promotions & Featured Content

#### E8.1 — Promotion Slots

| Slot Type | Purpose | Display |
|-----------|---------|---------|
| `FEATURED` | Homepage carousel, prominent placement | 6 active at a time |
| `SPONSORED` | In-feed promoted position | Inline with catalog |

#### E8.2 — Promotion Scheduling

| Aspect | Specification |
|--------|---------------|
| **Scheduling** | `startAt` / `endAt` (Instant) |
| **Active filter** | `startAt <= now <= endAt` (checked at read time) |
| **Weight** | Integer priority (higher = more prominent) |
| **Ownership** | Designer can only promote own products |

---

### Epic 9: Saved Looks & Wishlist

#### E9.1 — Saved Looks

| Aspect | Specification |
|--------|---------------|
| **Source** | Generated outfit recommendations |
| **Fields** | Reference to `OutfitRecommendation`, optional user note (max 1000 chars) |
| **Actions** | Save, update note, delete |
| **Display** | Grid view on `/looks` page |

#### E9.2 — Demo Looks (Frontend)

| Aspect | Specification |
|--------|---------------|
| **Purpose** | Save demo outfits from AI chat before real products are attached |
| **Detection** | `isDemoOutfitId()` check on recommendation ID |
| **Storage** | Client-side persistence |

---

### Epic 10: Orders & Checkout (Future)

#### E10.1 — Order Creation (Target State)

| Aspect | Specification |
|--------|---------------|
| **Flow** | Cart → Stripe Checkout → Payment confirmation → Order created |
| **Order record** | Products, quantities, prices frozen at checkout time |
| **Status lifecycle** | `PENDING` → `PAID` → `PROCESSING` → `SHIPPED` → `DELIVERED` |
| **Current state** | Stubbed — returns HTTP 501 |

#### E10.2 — Order History

| Aspect | Specification |
|--------|---------------|
| **Pages** | `/orders` (list), `/orders/[id]` (detail) |
| **Data** | Products, quantities, total, status, dates |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric | Target |
|--------|--------|
| Page load (LCP) | < 2.5s |
| API response (p95) | < 500ms (excluding AI calls) |
| AI chat response | < 10s (provider dependent) |
| 3D model generation | < 5 min (Tripo3D) |
| GLB file size | < 5MB per model |
| Concurrent users | 100+ (initial launch) |

### 5.2 Security

| Requirement | Implementation |
|-------------|----------------|
| Password hashing | BCrypt (cost 10) |
| Token security | JWT HS256, >=32 byte secret, 24h TTL |
| User enumeration prevention | Constant-time login comparison |
| Input validation | Jakarta Bean Validation at controller layer |
| SQL injection | JPA parameterized queries |
| XSS | React auto-escaping + CSP headers |
| CORS | Allowlist-based origins |
| File upload | MIME validation + size limits |
| User isolation | Service-layer ownership checks |

### 5.3 Accessibility

| Requirement | Target |
|-------------|--------|
| Standard | WCAG 2.1 AA |
| Contrast | 4.5:1 minimum |
| Keyboard navigation | Full (via Radix primitives) |
| Motion | `motion-safe:` gating |
| Screen reader | ARIA labels on all interactive elements |
| Reduced motion | Respects `prefers-reduced-motion` |

### 5.4 Internationalization (Future)

| Aspect | Notes |
|--------|-------|
| Language | English primary; Chinese planned |
| Currency | USD default; multi-currency via `currency` field |
| AI providers | MiniMax for CN market |
| Content | RTL not required initially |

---

## 6. Technical Architecture

### 6.1 System Topology

```
┌─────────────┐    REST/JSON     ┌──────────────┐     JDBC      ┌─────────┐
│  Next.js    │ <──────────────> │ Spring Boot  │ <───────────> │ MySQL 8 │
│  (Frontend) │     + JWT        │  (Backend)   │               │          │
└─────────────┘                  └──────────────┘               └─────────┘
                                       │              ┌──────────────┐
                                       │              │ Python Worker│
                                       │              │ (3D Gen)     │
                                       │              └──────┬───────┘
                                       │                     │
                                  Shared MySQL          File System
                                  (task queue)          (/assets/)
```

### 6.2 Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | 16 |
| UI Framework | React | 19 |
| Styling | Tailwind CSS | 4 |
| 3D Engine | React Three Fiber + Drei | 9.x |
| AR | @react-three/xr + model-viewer | 6.x |
| Component Library | shadcn/ui (Radix) | Latest |
| Backend | Spring Boot | 3.4.x |
| Language | Java | 21 |
| ORM | Spring Data JPA + Hibernate | Latest |
| Auth | Spring Security + JJWT | 0.12.x |
| Database | MySQL | 8.x |
| Worker | Python | 3.12 |
| Worker Queue | MySQL (SELECT ... FOR UPDATE SKIP LOCKED) | — |
| 3D Generation | Tripo3D API | v2 |
| Containerization | Docker + Docker Compose | Latest |

### 6.3 Backend Layer Architecture

```
Controller (16)
  ↓ @Valid DTO
Service (19)
  ↓ Business logic + ownership checks
Repository (15)
  ↓ Spring Data JPA
Entity (23)
  ↓ Hibernate
MySQL 8
```

### 6.4 Frontend Architecture

```
App Router (26 pages)
  ↓ "use client" (all pages)
Components (30+)
  ↓ shadcn/ui primitives
Lib (11 files)
  ├── API client (typed, token-injecting)
  ├── AuthContext (JWT lifecycle)
  ├── CartContext (server + demo hybrid)
  └── Hooks (useRequireAuth, useDebounce, useARSupport, useGenerationStatus)
```

---

## 7. Design System

### 7.1 Brand Identity

| Attribute | Value |
|-----------|-------|
| Personality | Effortless, Modern, Approachable |
| Voice | Conversational but considered; warm, direct, gently opinionated |
| Emotional goals | Understood → Inspired → Confident → Calm |
| Anti-reference | SHEIN density, SaaS coldness, generic e-commerce |

### 7.2 Visual Foundations

| Token | Value | Usage |
|-------|-------|-------|
| Page background | `#f5efe8` (warm linen) | Primary canvas |
| Near-black | `#171311` | Headlines, dark blocks |
| Text scale | Tailwind `stone-500` to `stone-950` | Warm grey hierarchy |
| Brand accent | `purple-600` / `purple-700` | Interactive highlights |
| Display font | Cormorant Garamond | Headings |
| Body font | Inter | UI, body copy |
| Shape | `rounded-[2rem]+` cards, `rounded-full` buttons | Soft, editorial |
| Shadows | Ultra-soft (`rgba(0,0,0,0.04)`) | Atmospheric depth |
| Motion | `editorialFloat` / `editorialDrift` (10-18s) | Gentle, gated by `motion-safe:` |
| Theme | Light-mode primary (dark planned) | — |

### 7.3 Component Inventory

| Category | Components |
|----------|-----------|
| Layout | NavBar, page shells, section cards |
| UI Primitives | Button, Card, Dialog, Input, Select, Badge, Skeleton, Tabs, etc. (19 shadcn) |
| Product | ProductForm, ProductList, ProductListItem, SearchFilterBar |
| 3D/AR | AvatarViewer, ARViewer, SmartARViewer, ModelViewer, DemoOutfitModel |
| Designer | ImageUploader, GenerationStatusBadge, GenerationStatusCard |
| Feedback | Sonner toasts, inline Alerts, Skeleton loaders |

---

## 8. Data Model (Entity Relationship)

```
User (hub)
├── 1:1 DesignerProfile → 1:many Product
│                           ├── 1:many GarmentAsset
│                           ├── 1:many ModelGenerationTask
│                           ├── 1:many Promotion
│                           ├── 1:many Review
│                           └── 1:many CartItem
├── 1:1 BodyProfile
├── 1:1 Cart → 1:many CartItem → n:1 Product
├── 1:many OutfitRecommendation → 1:many SavedLook
├── 1:many ChatSession → 1:many ChatMessage
├── 1:many Order
└── 1:many Review
```

### Key Entities

| Entity | Purpose | Key Fields |
|--------|---------|-----------|
| User | Account | email, passwordHash, name, role |
| DesignerProfile | Designer metadata | displayName, shopName, bio |
| BodyProfile | Body measurements | heightCm, weightKg, chestCm, waistCm, hipsCm |
| Product | Catalog item | name, price, category, styleTags[], colorTags[], sizes[], media[], glbUrl, status |
| GarmentAsset | 3D model for product | glbUrl, usdzUrl, slotHint, status |
| ModelGenerationTask | 3D gen job | status, provider, inputPayload, outputPayload, attemptCount |
| Cart / CartItem | Shopping cart | userId, productId, quantity |
| OutfitRecommendation | AI-generated outfit | request JSON, response JSON |
| SavedLook | User's saved outfits | recommendationId, note |
| ChatSession | AI conversation | status (ACTIVE/COMPLETED) |
| ChatMessage | Conversation message | role (USER/ASSISTANT), content, outfitRecommendationId |
| Review | Product review | rating (1-5), comment |
| Promotion | Featured/sponsored | slotType, weight, startAt, endAt |
| Order | Purchase record | status, items snapshot |

---

## 9. API Contract Summary

### Public Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Authenticate |
| GET | `/api/products` | Browse catalog (paginated, filterable) |
| GET | `/api/products/{id}` | Product detail |
| GET | `/api/products/{id}/reviews` | Product reviews |
| GET | `/api/products/{id}/reviews/summary` | Review aggregation |
| GET | `/api/health` | Liveness check |
| GET | `/api/health/ai` | AI provider probe |
| GET | `/api/promotions/featured` | Featured products |

### Authenticated Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/auth/me` | Current user |
| GET/POST/PUT/DELETE | `/api/cart/**` | Cart operations |
| POST | `/api/checkout` | Create order |
| POST/GET | `/api/outfits/**` | Generate/view outfits |
| POST/GET/DELETE | `/api/chat/sessions/**` | AI chat |
| GET/POST | `/api/body-profile` | Body measurements |
| POST | `/api/avatar/generate` | Generate avatar |
| GET/POST/PUT/DELETE | `/api/looks/**` | Saved looks |
| POST/DELETE | `/api/products/{id}/reviews` | Write/delete reviews |

### Designer Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST/PUT/DELETE | `/api/designer/products/**` | Product CRUD |
| POST | `/api/designer/products/upload/image` | Image upload |
| POST | `/api/designer/products/{id}/regenerate` | Trigger 3D generation |
| GET | `/api/designer/products/{id}/generation-status` | Poll generation |
| POST | `/api/designer/products/{id}/generation-status/retry` | Retry failed |
| GET/POST/PUT/DELETE | `/api/promotions/**` | Promotion management |

---

## 10. Page Routes (26)

| Route | Auth | Purpose |
|-------|------|---------|
| `/` | No | Landing page |
| `/login` | No | Login form |
| `/register` | No | Registration form |
| `/status` | No | Health diagnostics |
| `/products` | No | Catalog browse |
| `/products/[id]` | No | Product detail |
| `/cart` | Buyer | Shopping cart |
| `/checkout` | Buyer | Payment |
| `/checkout/success` | Buyer | Post-purchase confirmation |
| `/checkout/cancel` | Buyer | Payment cancelled |
| `/dashboard` | Any | Role-aware home |
| `/profile/body` | Buyer | Body measurements |
| `/profile/avatar` | Buyer | Avatar generation |
| `/chat` | Buyer | AI stylist |
| `/outfits` | Buyer | Generated recommendations |
| `/outfits/[id]/view` | Buyer | 3D outfit viewer |
| `/outfits/[id]/ar` | Buyer | AR try-on |
| `/ar-visualization` | Any | Demo AR |
| `/try-on` | Any | Try-on hub |
| `/looks` | Buyer | Saved looks |
| `/orders` | Buyer | Order history |
| `/orders/[id]` | Buyer | Order detail |
| `/design` | Any | Design hub |
| `/designer/products` | Designer | Product list/manage |
| `/designer/products/new` | Designer | Create product |
| `/designer/products/[id]/edit` | Designer | Edit product + 3D |

---

## 11. Seed Data Requirements

### Accounts

| Role | Count | Purpose |
|------|-------|---------|
| Designers | 3 | Diverse brand aesthetics (minimalist, streetwear, artisanal) |
| Buyers | 2 | Different body profiles for testing |

### Products

| Requirement | Value |
|-------------|-------|
| Total products | 36 (all PUBLISHED) |
| Categories covered | 8 (Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories, Bags, Jewelry) |
| Price range | $28 - $220 |
| All products have | SVG placeholder images |
| 3D models | 10 garment assets (5 with valid GLB, 5 stubs) |

### Promotions

| Requirement | Value |
|-------------|-------|
| Featured slots | 6 active |
| Sponsored slots | 4 active |
| Expiration | Staggered (7/14/21/28 days from seed) |

---

## 12. Known Gaps & Improvement Targets

### Must Fix (P0)

| Issue | Impact | Fix |
|-------|--------|-----|
| GLB asset drift (24 of 36 product GLBs missing) | Broken 3D viewer for most products | **Fixed** (`ensureGlbAssets()` backfills on startup) |
| Promotion weight ignored in sort | Featured carousel is random | **Fixed** (`ORDER BY weight DESC`) |
| BodyProfileRequest has zero validation | Garbage data stored | **Fixed** (`@Min`/`@Max` added) |
| Checkout is stubbed (501) | Cannot complete purchase | Implement Stripe integration |

### Should Fix (P1)

| Issue | Impact | Fix |
|-------|--------|-----|
| No email verification | Fake signups | **Fixed** (V4 migration — verify-email flow) |
| No password reset | Account lockout | **Fixed** (V4 migration — forgot/reset-password flow) |
| No image format flexibility (JPEG only) | UX friction | **Fixed** (JPEG + PNG + WebP supported) |
| Category list hardcoded on frontend | New categories invisible | API endpoint for categories or dynamic from catalog |
| No dark mode | User preference ignored | **Fixed** (semantic tokens + theme-provider) |
| Cart quantity has no upper bound on update | Potential abuse | **Fixed** (`@Max(100)` on UpdateCartItemRequest) |

### Nice to Have (P2)

| Feature | Value |
|---------|-------|
| Notification system (email/push) | Order updates, new recommendations |
| Wishlist/favorites (separate from saved looks) | Product bookmarking |
| Designer analytics dashboard | Sales, views, conversion data |
| Social sharing | Share looks/outfits to social media |
| Multi-language support | Expand to CN market |
| Payment processing (Stripe Connect) | Marketplace payouts to designers |
| Real SMPLX avatar generation | Personalized body model |
| Hunyuan3D provider | Alternative 3D generation |

---

## 13. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Return rate | < 10% (vs 30% industry) | Orders with returns / total orders |
| AI chat completion rate | > 60% | Sessions reaching outfit generation / total sessions |
| 3D/AR engagement | > 40% of buyers use | Unique users viewing 3D / total buyers |
| Designer onboarding | < 5 min to first product | Time from register to first PUBLISHED product |
| Cart conversion | > 15% | Orders / carts with items |
| Recommendation relevance | > 4.0/5 avg | Post-generation user rating (future feature) |

---

## 14. Delivery Phases (Rebuild Roadmap)

### Phase 0: Foundation (Week 1-2)

- [ ] Project scaffolding (monorepo, Docker Compose, CI)
- [ ] Database schema (Flyway migrations)
- [ ] Auth system (register, login, JWT, roles)
- [ ] Health endpoints
- [ ] Basic CORS + security config

### Phase 1: Core Commerce (Week 3-4)

- [ ] Product entity + CRUD (designer)
- [ ] Product catalog (public browsing, pagination, filter, search)
- [ ] Cart (add, update, remove, deduplication)
- [ ] Reviews (create, list, aggregate)
- [ ] Data seeding

### Phase 2: AI Stylist (Week 5-6)

- [ ] AI provider system (pluggable, 4 implementations)
- [ ] Chat session management
- [ ] Conversational flow (7-step protocol)
- [ ] Outfit generation (4-slot algorithm)
- [ ] AI explanation with body profile context
- [ ] Frontend chat UI

### Phase 3: 3D/AR (Week 7-8)

- [ ] Body profile capture
- [ ] 3D avatar viewer (R3F)
- [ ] AR viewer (WebXR + fallbacks)
- [ ] Smart device routing (SmartARViewer)
- [ ] 3D model generation pipeline (worker)
- [ ] Generation status polling + retry

### Phase 4: Marketplace Polish (Week 9-10)

- [ ] Promotions (featured/sponsored)
- [ ] Saved looks
- [ ] Designer studio UX
- [ ] Image upload + management
- [ ] Checkout integration (Stripe)
- [ ] Order management

### Phase 5: Launch Prep (Week 11-12)

- [ ] Dark mode
- [ ] Performance optimization
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] E2E test coverage (80%+)
- [ ] Security review
- [ ] Seed data alignment (all GLBs present)
- [ ] Production deployment

---

## 15. Environment Configuration

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `MYSQL_ROOT_PASSWORD` | Yes | — | Database root |
| `DB_PASSWORD` | Yes | — | App database user |
| `JWT_SECRET` | Yes | — | >=32 chars for HS256 |
| `AI_PROVIDER` | No | `mock` | claude/deepseek/minimax/mock |
| `ANTHROPIC_API_KEY` | When claude | — | Claude API |
| `DEEPSEEK_API_KEY` | When deepseek | — | DeepSeek API |
| `MINIMAX_API_KEY` | When minimax | — | MiniMax API |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Allowed origins |
| `NEXT_PUBLIC_API_URL` | No | `""` (proxy) | Frontend API base |
| `WORKER_TRIPO_API_KEY` | For Tripo3D | — | 3D generation |
| `MODEL_GENERATION_PROVIDER` | No | `mock` | mock/tripo3d/meshy |
| `WORKER_MESHY_API_KEY` | For meshy | — | Meshy.ai API key |
| `RIGGING_PROVIDER` | No | `mock` | mock/python/blender |
| `BLENDER_PATH` | For blender | `blender` | Path to Blender executable |

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| Outfit Recommendation | AI-generated combination of 4 products (top + bottom + shoes + accessory) |
| Garment Asset | 3D model (GLB/USDZ) bound to a specific product |
| Slot | One of four positions in an outfit (top, bottom, shoes, accessory) |
| Seed Product IDs | User's favorite products that get priority in outfit generation |
| Demo Item | Frontend-only cart/look entry with negative ID (no server backing) |
| FINALIZING | Synthetic status between worker READY and server materialization |
| Materialization | Process of creating a GarmentAsset row from a completed generation task |

## Appendix B: File Structure Reference

```
IYAE/
├── web/                    # Next.js 16 frontend
│   ├── app/               # 26 page routes
│   ├── components/        # 30+ components
│   ├── lib/               # 11 utility files
│   └── tests/             # Unit + E2E
├── server/                # Spring Boot backend
│   └── src/main/java/com/iyae/
│       ├── controller/    # 16 controllers
│       ├── service/       # 19 services
│       ├── repository/    # 15 repositories
│       ├── entity/        # 23 entities + enums
│       ├── dto/           # 31 DTOs
│       ├── ai/            # AI provider system
│       ├── modelgen/      # 3D generation providers
│       ├── security/      # JWT filter + provider
│       └── config/        # Security, CORS, AI, DataSeeder
├── worker/                # Python 3D generation daemon
│   ├── main.py           # Entry point
│   ├── task_queue.py     # MySQL queue
│   ├── providers/        # StubGenerator, TripoGenerator
│   └── tests/            # pytest
├── docs/                  # Documentation
├── scripts/               # Utility scripts
├── docker-compose.yml     # Full stack orchestration
└── dev.sh                 # Development CLI wrapper
```

---

## Appendix C: User Flows

### C.1 Buyer Journey: Chat → Try-On → Purchase

```
1. Login/Register as BUYER
2. Navigate to /chat
3. Start conversation with AI stylist
4. Describe occasion, style, colors (7-step flow)
5. AI generates outfit recommendation (4 products)
6. View outfit in 3D (/outfits/[id]/view)
7. Try AR overlay (/outfits/[id]/ar)
8. Save look for later (/looks)
9. Add products to cart
10. Checkout → Payment → Order confirmation
```

### C.2 Designer Journey: Publish → Generate 3D → Promote

```
1. Register as DESIGNER
2. Navigate to /designer/products
3. Create new product (name, price, category, tags)
4. Upload product image (JPEG, ≤10MB)
5. Set status to PUBLISHED
6. 3D model auto-generates (poll status badge)
7. Create promotion (FEATURED/SPONSORED)
8. Product appears in buyer catalog + AI recommendations
```

### C.3 AR Try-On Flow (Device-Adaptive)

```
User clicks "AR Try-On" on outfit
  → SmartARViewer detects device capability
  → WebXR available (Android Chrome/Quest)?
      → Launch immersive AR session (hit test → place model)
  → iOS Safari?
      → AR Quick Look with .usdz file
  → Android without WebXR?
      → Scene Viewer with .glb file
  → Desktop?
      → 3D-only viewer (orbit controls)
```
