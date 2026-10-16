@AGENTS.md

[Root](../CLAUDE.md) > **web**

# IYAE Web (Next.js 16)

Next.js 16 frontend providing 37 page routes for buyers and designers. All pages use client-side rendering (`"use client"`). Features include product browsing, AI chat styling with suggestion chips, 3D/AR outfit viewing with pose animation, shopping cart, designer studio, order management, email verification, password reset, multi-step registration, user profiles, community features, and a floating AI stylist widget.

## Module Purpose

The web module is the user-facing SPA. It communicates with the server via REST/JSON with JWT authentication. 3D and AR features use React Three Fiber, Drei, and WebXR. Security headers (CSP, Permissions-Policy) are enforced via Next.js middleware. Community and profile features use client-side localStorage persistence with immutable update patterns.

## Entry & Startup

- **Layout root**: `app/layout.tsx` (wraps entire app with `AuthProvider` -> `CartProvider`, loads Cormorant Garamond + DM Sans fonts)
- **Port**: 3000 (Next.js dev server)
- **API proxy**: `next.config.ts` rewrites `/api/*` to `${API_PROXY_TARGET}/api/*` (default `http://localhost:3001`). In local `npm run dev`, `API_PROXY_TARGET` is a runtime env var. In the Docker container, it is a build-time `ARG` baked into the image at build time.

## Commands

```bash
npm run dev        # Dev server on :3000
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint
npm run test       # Vitest (run once)
npm run test:watch # Vitest (watch mode)
npm run test:e2e   # Playwright E2E (requires running dev server + API on :3000/:3001)
```

## Architecture

```
app/           (37 page routes)  --> All "use client", no RSC or server actions
app/not-found.tsx                --> Custom 404 page (static, no "use client")
app/error.tsx                    --> Global error boundary ("use client")
app/layout.tsx                   --> Root layout (AuthProvider -> CartProvider, fonts, metadata)
components/    (96 total)        --> 77 app-specific (74 .tsx + 3 .ts) + 19 shadcn/ui primitives
components/register/ (7)         --> Multi-step registration wizard components
components/community/ (1)        --> PostMedia (community post media rendering)
components/profile/ (9)          --> Profile page components (settings, post creation, image picker; 6 of the 9 have no importer -- see the table below)
components/home/ (6)             --> Landing page sections + shared motion presets (immersive-homepage, hero, about, nav, footer, motion-presets)
components/outfits/ (5)          --> Manual outfit builder (ProductPickerDialog, ProductSelectCard, OutfitDetailsForm, OutfitBuilderPreview, OutfitSlotSidebarItem)
components/designer/ (2)         --> Designer studio (PromotionList, PromotionForm)
components/ui/ (19)              --> shadcn/ui (Radix-based, CLI-generated, DO NOT edit)
lib/api.ts                       --> Typed fetch wrapper with auto JWT injection + AbortSignal + auth/rigging/avatar/sizing helpers + outfit types
lib/auth-context.tsx             --> AuthProvider (JWT lifecycle, hydration via GET /me)
lib/cart-context.tsx             --> CartProvider (server + demo hybrid cart)
lib/utils.ts                     --> cn() utility for Tailwind class merging + humanizeNumber() for compact display
lib/profile-surface.ts           --> Profile surface state (localStorage, cross-tab sync via CustomEvent)
lib/social-graph.ts              --> Static social profile data (demo users for community)
lib/profile-options.ts           --> Style aesthetics, fit preferences, colors, brands, budget, goal, avatar constants
lib/community-feed.ts            --> Community feed state management (posts, likes, saves, comments, follows, lifecycle, create/archive/restore)
lib/profile-dashboard.ts         --> Profile tab filtering, stats, body measurement coverage
lib/outfit-slots.ts              --> Outfit slot constants (top/bottom/shoes/accessory), types (Slot, SlotMap), empty slot factory
lib/pose-config.ts               --> Pose preset definitions (5 poses, 3 categories), PoseDef type, getPoseById() lookup
lib/fabric-textures.ts           --> Slot-keyed fabric normal-map config (getFabricNormalConfig); drives C2 tiled relief (pure data, no three imports)
lib/demo-looks.ts                --> Demo saved looks data for development
lib/brand.ts                     --> Single source of brand values (BRAND: name, tagline, url, mailFrom); consumed by wordmark sites, document title/metadataBase, email subjects, and email-templates.ts
lib/email-templates.ts           --> Email template utilities for Resend integration (reads copy/sender from BRAND)
lib/hooks/                       --> useRequireAuth, useDebounce, useARSupport, useGenerationStatus, useAvatar, useAvatarStatus, useCommunityState, useReveal, useRiggingStatus, useOutfitRiggingStatus, useRedirectIfAuthenticated, usePoseAnimation, useWeather (13 hooks)
middleware.ts                    --> CSP headers + Permissions-Policy (camera on AR routes only)
public/assets/                   --> Static assets (product placeholder SVG)
public/models/                   --> 3D model files (demo-outfit.glb for DemoOutfitModel, default-avatar.glb for guest avatar, poses/ directory for pose animation GLBs)
__tests__/                       --> Vitest test suite (18 files, 234 cases, jsdom environment)
e2e/                             --> Playwright E2E specs
```

## Page Routes (37)

### Public (no auth)

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Landing page |
| `/login` | `app/login/page.tsx` | Login form |
| `/register` | `app/register/page.tsx` | Multi-step registration wizard (6 steps) |
| `/forgot-password` | `app/forgot-password/page.tsx` | Request password reset email |
| `/reset-password` | `app/reset-password/page.tsx` | Set new password via token |
| `/verify-email` | `app/verify-email/page.tsx` | Email verification confirmation |
| `/status` | `app/status/page.tsx` | Health diagnostics |
| `/products` | `app/products/page.tsx` | Catalog browse with search/filter (Suspense boundary) |
| `/products/[id]` | `app/products/[id]/page.tsx` | Product detail (authed-only recommended-size fetch pre-selects size; `<RecommendedSizeHint/>` above `<SizeSelector/>`; product image passed as `previewImageUrl`) |

### Authenticated (any role)

| Route | File | Purpose |
|-------|------|---------|
| `/dashboard` | `app/dashboard/page.tsx` | Role-aware: social profile (buyer) or studio (designer) |
| `/cart` | `app/cart/page.tsx` | Shopping cart |
| `/checkout` | `app/checkout/page.tsx` | Payment |
| `/checkout/success` | `app/checkout/success/page.tsx` | Post-purchase confirmation |
| `/checkout/cancel` | `app/checkout/cancel/page.tsx` | Payment cancelled |
| `/chat` | `app/chat/page.tsx` | AI stylist conversation |
| `/outfits` | `app/outfits/page.tsx` | Generated recommendations |
| `/outfits/new` | `app/outfits/new/page.tsx` | Manual outfit builder (slot-based product picker) |
| `/outfits/[id]/view` | `app/outfits/[id]/view/page.tsx` | 3D outfit viewer |
| `/outfits/[id]/ar` | `app/outfits/[id]/ar/page.tsx` | AR try-on |
| `/ar-visualization` | `app/ar-visualization/page.tsx` | Demo AR |
| `/try-on` | `app/try-on/page.tsx` | Try-on hub |
| `/looks` | `app/looks/page.tsx` | Saved looks |
| `/orders` | `app/orders/page.tsx` | Order history |
| `/orders/[id]` | `app/orders/[id]/page.tsx` | Order detail |
| `/profile/body` | `app/profile/body/page.tsx` | Body measurements |
| `/profile/avatar` | `app/profile/avatar/page.tsx` | Avatar generation + one-tap "Delete my avatar & body data" |
| `/profile/preferences` | `app/profile/preferences/page.tsx` | Style preferences and settings |
| `/profile/[username]` | `app/profile/[username]/page.tsx` | Public user profile |
| `/community` | `app/community/page.tsx` | Community feed and discovery |
| `/style-lab` | `app/style-lab/page.tsx` | Style experimentation hub (AI tools launcher) |
| `/design` | `app/design/page.tsx` | Design hub |

### Designer only

| Route | File | Purpose |
|-------|------|---------|
| `/designer/products` | `app/designer/products/page.tsx` | Product list/manage |
| `/designer/products/new` | `app/designer/products/new/page.tsx` | Create product |
| `/designer/products/[id]/edit` | `app/designer/products/[id]/edit/page.tsx` | Edit product + 3D generation |
| `/designer/promotions` | `app/designer/promotions/page.tsx` | Promotion management |
| `/designer/studio` | `app/designer/studio/page.tsx` | Designer studio dashboard |

### Redirects

| Route | File | Purpose |
|-------|------|---------|
| `/reset` | `app/reset/page.tsx` | Redirects to `/reset-password` (for production email link compatibility) |

### Error Boundaries

| File | Purpose |
|------|---------|
| `app/not-found.tsx` | Custom 404 page with links to home and products |
| `app/error.tsx` | Global error boundary with "Try Again" reset button |

## Key Components

### App-Specific (root, 32)

| Component | Purpose |
|-----------|---------|
| NavBar | Top navigation with auth-aware menu, Community/Style Lab/Orders links, mobile hamburger Sheet |
| PageShell | Consistent page layout wrapper |
| ProductForm | Product creation/editing (designer); the per-size "Size chart (cm)" grid writes `product_size_measurements`, which now drives the PDP `MEASUREMENT_CHART` recommended-size hint via `SizeRecommendationService` |
| ProductListItem | Product catalog row. **The module survives for its exported `Product` type, which five call sites import; the `ProductListItem` component itself now has no importer** — its only consumer was `ProductList`, deleted 2026-10-10 as dead. The catalog renders `design-system/ProductCard`. |
| SearchFilterBar | Catalog search, dynamic category filtering (fetches from `/api/products/categories` via AbortController), and sort |
| ChatSidebar | Session list for AI chat |
| ChatMessageBubble | Individual chat message display |
| TypingIndicator | AI typing animation |
| OutfitCard | Outfit recommendation card; AI-chat outfit has an inline "Try on" toggle that lazy-mounts a `dynamic(ssr:false)` AvatarViewer (replaces the old "View in 3D" link-out); collapsed 2x2 grid stays default |
| ImageUploader | Image upload with drag-and-drop (JPEG, PNG, WebP; 10MB max) |
| GenerationStatusBadge | Inline 3D generation status |
| GenerationStatusCard | Expanded generation status with actions |
| RiggingStatusBadge | Inline garment rigging status indicator |
| RiggingStatusCard | Expanded rigging status with trigger/retry actions |
| FittingHelper | Fitting assistance for try-on: `applyLayeredAntiPenetration` (polygonOffset) + `fabricizeMaterial`/`fabricizeScene` (D2 — forces metalness=0/roughness=0.85 on untextured garment materials, sets castShadow/receiveShadow) + `applyGarmentNormalMap`/`applyGarmentNormalMapToScene` (C2 — tiled slot-keyed normal map on materials without an existing `normalMap`, memoized `TextureLoader`, config from `lib/fabric-textures.ts`) |
| SizeSelector | Cloth size selection buttons (aria-pressed, disabled state support) |
| RecommendedSizeHint | Presentational recommended-size hint ("Your recommended size: M"); renders nothing when basis is NONE; "based on your saved sizes" caption for SELF_REPORTED |
| Footer | Site footer |
| theme-provider | next-themes ThemeProvider wrapper (`attribute="class"`, `defaultTheme="system"`, `enableSystem`) |
| theme-toggle | Light/dark switch, mounted in `SiteHeader`. Reads `resolvedTheme`, not `theme` — with `enableSystem` the stored preference is the literal `"system"` until the user picks a side |
| floating-ai-stylist | Floating AI assistant chat widget (hidden on /login, /register, /chat) |
| PostDetailDialog | Community post detail modal with comments and replies |
| ViewerErrorBoundary | Error boundary for 3D viewer components |
| SuggestionChips | AI chat suggestion pill buttons (accessible, disableable) |
| SkeletonContext | React context sharing Three.js bone map between avatar and garment models |
| PoseSelector | Horizontal pose preset strip overlay for AvatarViewer (categories: stationary/movement/lifestyle) |
| ModelViewer | `@google/model-viewer` fallback (iOS AR Quick Look, Android Scene Viewer) |
| DemoOutfitModel | Demo mannequin when no GLB assets available (loads `public/models/demo-outfit.glb`) |
| AvatarViewer | R3F-based 3D avatar with GLB models; optional `previewImageUrl` prop renders an instant 2D product still (drei `<Html>`) as the `<Suspense>` fallback while the 3D avatar streams in; `<Canvas shadows>` + drei `<ContactShadows>` + `castShadow` key light ground the figure (D1); garment scenes run through `fabricizeScene` (D2) + `applyGarmentNormalMapToScene(scene, slot)` (C2 tiled relief); `<Canvas>` uses ACES Filmic tone mapping + `<Environment environmentIntensity={0.6}>` for a matte-fabric look (D3) |
| ARViewer | WebXR AR session with hit testing |
| SmartARViewer | Auto-detects device capability, routes to appropriate viewer; passes `previewImageUrl` through to the desktop AvatarViewer |

### Home (`components/home/`, 6)

`app/page.tsx` renders `ImmersiveHomepage`, which composes exactly
`HeroSection` + `AboutSection` + `LandingFooter`. The eleven sections of the
homepage it replaced (DesignersSection, HowItWorks, SustainabilitySection,
CTASection, CommunitySection, AIStylistSection, SocialProofSection, TrustBar,
TryOnSection, LifestyleGrid, PhotoStrip) plus TryOnViewer and MagneticCTALink
were deleted on 2026-10-10 — they had no importer anywhere in the tree. Recover
them from history if the sections are wanted back.

| Component | Purpose |
|-----------|---------|
| immersive-homepage | Full-screen landing page with editorial layout |
| HeroSection | Landing hero with animated headline and CTA |
| AboutSection | Editorial about block on the immersive homepage |
| LandingNav | Landing page dedicated navigation (used by `app/design`) |
| LandingFooter | Landing page dedicated footer |
| motion-presets | Shared motion presets: CTA_SPRING, SOFT_SPRING, EASE_OUT_EXPO, textStagger, textChild, fadeUp |

### Community (`components/community/`, 1)

| Component | Purpose |
|-----------|---------|
| PostMedia | Community post media rendering (images, video) |

### Profile (`components/profile/`, 9)

**Six of these nine have no importer** (marked UNWIRED below). Unlike the deleted
home sections they are not superseded by anything live — `app/profile/[username]`
and `app/dashboard` build their own headers and tab bars inline — so they read as
a profile redesign that was built and never mounted. They are kept deliberately;
decide whether to wire them up or drop them.

| Component | Purpose |
|-----------|---------|
| ProfileHeader | UNWIRED. User profile hero with avatar, banner, bio |
| ProfileStatsBar | UNWIRED. Posts/followers/following stats display; `onClickFollowers`/`onClickFollowing` are the intended entry point for StyleCircleDialog |
| ProfileActionBar | UNWIRED. Follow/message/settings action buttons |
| ProfileContentTabs | UNWIRED. Tab navigation for profile content (posts/saved/reposted/tagged/archives) |
| ProfilePostGrid | UNWIRED. Grid layout for profile post cards |
| ProfileSettingsDialog | Profile settings modal (3 tabs: edit profile, style preferences, body measurements); one-tap "Delete my avatar & body data" button (two-step confirm -> `avatar.delete()` -> toast -> refresh) |
| CreateFashionPostDialog | New fashion post creation dialog |
| StyleCircleDialog | UNWIRED. Followers/following dialog, reading the real graph from `GET /api/follows/{followers,following}` with optimistic follow write-through |
| LocalImagePicker | Client-side image picker for avatar/banner uploads |

### Outfit Builder (`components/outfits/`, 5)

| Component | Purpose |
|-----------|---------|
| ProductPickerDialog | Dialog for browsing and selecting products to fill outfit slots |
| ProductSelectCard | Compact product card used within ProductPickerDialog |
| OutfitDetailsForm | Occasion and note input form for outfit metadata |
| OutfitBuilderPreview | 3D preview panel with dynamic AvatarViewer import and ViewerErrorBoundary |
| OutfitSlotSidebarItem | Compact sidebar slot item with add/remove actions and product thumbnail |

### Designer (`components/designer/`, 2)

| Component | Purpose |
|-----------|---------|
| PromotionList | Promotion management list view |
| PromotionForm | Promotion create/edit form |

### Registration Wizard (`components/register/`, 7)

| Component | Purpose |
|-----------|---------|
| WizardProgress | Multi-step progress indicator |
| StepBasics | Basic info (name, email, password, username) |
| StepStylePrefs | Style aesthetics selection |
| StepColors | Favorite and avoided color preferences |
| StepMeasurements | Body measurement input |
| StepAvatar | Avatar mode and preset selection |
| StepComplete | Registration completion confirmation |

### shadcn/ui Primitives (19, do NOT edit manually)

button, card, input, label, select, badge, skeleton, tabs, dialog, checkbox, textarea, scroll-area, avatar, alert, separator, sheet, dropdown-menu, radio-group, sonner

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.4.0 | Framework (App Router) — bumped from 16.2.6, which carried an unauthenticated image-optimizer RCE |
| react / react-dom | 19.2.4 | UI library |
| @react-three/fiber | 9.6.1 | 3D rendering (R3F) |
| @react-three/drei | 10.7.7 | R3F helpers (OrbitControls, Environment, etc.) |
| @react-three/xr | 6.6.29 | WebXR AR |
| three | 0.184.0 | 3D engine |
| tailwindcss | 4.x | Styling |
| lucide-react | 1.16.0 | Icons |
| sonner | 2.0.7 | Toast notifications |
| next-themes | 0.4.6 | Theme provider (dark mode support) |
| class-variance-authority | 0.7.1 | Component variant styling |
| clsx + tailwind-merge | -- | Class name utilities |

### Dev Dependencies (testing)

| Package | Version | Purpose |
|---------|---------|---------|
| vitest | 4.1.6 | Test runner |
| @vitejs/plugin-react | 6.0.2 | React support for Vitest |
| @testing-library/react | 16.3.2 | Component testing utilities |
| @testing-library/jest-dom | 6.9.1 | DOM assertion matchers |
| @testing-library/user-event | 14.6.1 | User interaction simulation |
| jsdom | 29.1.1 | Browser environment for tests |
| @playwright/test | 1.60.0 | E2E testing framework |

## Configuration

| File | Purpose |
|------|---------|
| `next.config.ts` | API proxy rewrites (`/api/*` -> `$API_PROXY_TARGET`, default `:3001`), standalone output |
| `tsconfig.json` | TypeScript config (path alias `@/*`) |
| _(no `tailwind.config.ts`)_ | Tailwind v4 is CSS-first — the theme lives entirely in `app/globals.css`: raw values in `:root`/`.dark`, `@theme inline` mapping `--color-*` onto `var()` of them. Do not recreate a JS config, and do not put a colour literal in `@theme` (see the dark-mode gotcha) |
| `postcss.config.mjs` | PostCSS with Tailwind |
| `eslint.config.mjs` | ESLint config |
| `components.json` | shadcn/ui config (style: new-york, rsc: false, baseColor: stone) |
| `middleware.ts` | CSP headers (env-aware script-src) and camera permissions policy |
| `vitest.config.ts` | Vitest config (jsdom, globals, `@/` alias, `__tests__/**/*.test.{ts,tsx}`) |
| `playwright.config.ts` | Playwright config (chromium, baseURL `:3000`, html reporter, no webServer) |

## Middleware (CSP & Permissions-Policy)

`middleware.ts` runs on all routes except `_next/static`, `_next/image`, `favicon.ico`, and `api`. It sets:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'` (prod) or `+ 'unsafe-eval'` (dev); `style-src 'self' 'unsafe-inline' fonts.googleapis.com`; `font-src 'self' fonts.gstatic.com`; `img-src 'self' data: blob: https:`; `connect-src 'self' blob:`; `worker-src 'self' blob:`; `media-src 'self' blob:`; `frame-src 'none'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'` |
| `Permissions-Policy` | `camera=(self), microphone=()` on AR/try-on routes; `camera=(), microphone=()` elsewhere |

## Design System

| Token | Value | Usage |
|-------|-------|-------|
| Page background | `#ffffff` (white) `bg-background` | Primary canvas |
| Ink | `#171717` `text-foreground` | Headlines, dark blocks, body text |
| Text hierarchy | `text-foreground` / `text-muted-foreground` (`#6f6f6f`) tokens | Ink + neutral grey |
| Brand accent | Burgundy `bg-brand`/`text-brand` (`#8a0f2d`), hover `bg-brand-hover` (`#6d0b23`) | Interactive highlights (FORME Figma, WCAG 9.6:1 on white) |
| Status tokens | `success`/`warning`/`info`/`destructive` (+ `-foreground`) | Badges/banners (use `@/lib/status`) |
| Paper | `bg-paper`/`text-paper` (`#F5F0EB`, theme-invariant cream) | Light-on-dark surfaces in `home/` |
| Display font | Cormorant Garamond (`--font-cormorant`) | Headings; `--tracking-display` 0 (Figma serif tracking) |
| Body font | DM Sans (`--font-dm-sans`, `next/font/google`) | UI, body copy; body carries `--tracking-body` (0.01em) |
| Shape | `rounded-card` (12px) cards, `rounded-button` (24px) / `rounded-chip` (17px) capsules | FORME Figma editorial |
| Shadow | `shadow-soft` (0 4px 24px rgba(0,0,0,0.04)) | Card elevation |
| Shadow (hover) | `shadow-heavy` (0 12px 40px `var(--shadow-heavy-color)`) | Hover elevation; the colour half is theme-dependent |
| Motion | `editorial-float` (12s) / `editorial-drift` (16s) | Gated by `motion-safe:` |
| Page gradients | `--gradient-page-start/mid/end` | Full-page gradient backgrounds (with dark mode overrides) |
| Profile banner | `--gradient-profile-banner-start/end` | Profile page banner gradient |
| Landing colors | `--color-landing-surface/soft/contrast/tone/accent/highlight` | Landing page brand palette |

## Key Patterns

- **Auth guard**: Pages check `user` from `useAuth()` (AuthContext); redirect to `/login` if unauthenticated
- **Page shell**: Most pages wrap content in `<PageShell>` for consistent layout
- **API client**: `lib/api.ts` provides `api.get/post/put/delete` with typed responses; auto-injects JWT from `localStorage("iyae_token")`; supports `AbortSignal` via options parameter; 401 response -> clear token + redirect to `/login`; throws `ApiError` with `status` and `message` on non-ok responses. Also exports an `auth` helper object with `register()`, `login()`, `me()`, and `updateProfile()` methods, a `rigging` helper object with `getStatus()`, `trigger()`, and `retry()` methods, an `avatar` helper object with `getStatus()` (`GET /api/avatar/status`), `generate()` (`POST /api/avatar/generate`), `getAvatar()` (`GET /api/avatar`), and `delete()` (`DELETE /api/avatar`) methods, and a `sizing` helper object with `getRecommendedSize()` (`GET /api/products/{id}/recommended-size`), plus `RegisterRequest`, `UpdateProfileRequest`, `UserResponse` (includes `createdAt`), `ProfileVisibility`, `AvatarMode`, `RiggingStatusResponse`, `AvatarResponse`, `SizeRecommendationResponse`, `AvatarStatus` (re-exported as the single source of truth), `OutfitItem`, `OutfitDetail`, and `ManualOutfitRequest` types.
- **Demo cart**: Cart merges server-side items with client-side "demo" items (negative IDs in `localStorage["iyae_demo_cart_items"]`); cleared on logout
- **Toast notifications**: Via `sonner` (imported from `components/ui/sonner.tsx`)
- **3D dynamic import**: All R3F components use `dynamic(() => import(...), { ssr: false })` to avoid SSR issues
- **Suspense boundaries**: Pages that use `useSearchParams()` wrap the content component in `<Suspense>` to avoid the Next.js 16 hydration bailout (see `products/page.tsx` for reference pattern)
- **Error boundaries**: Global `error.tsx` catches runtime errors with a reset button; `not-found.tsx` provides a custom 404 page
- **Dynamic categories**: `SearchFilterBar` fetches categories from `/api/products/categories` on mount using `AbortController` for cleanup; falls back to hardcoded list on error
- **Community feed**: `community-feed.ts` manages social posts with immutable state updates (toggleLike, toggleSave, toggleRepost, addComment, addReply, requestDelete, pruneDeletedPosts, createPost, archivePost, restorePost, addPostToState); state persisted to localStorage per user; `social-graph.ts` provides static demo profiles; `profile-options.ts` exports style/color/brand/budget/goal/fit/avatar constants used by registration wizard and preferences page
- **Profile surface**: `profile-surface.ts` provides `useProfileSurface()` hook for cross-tab synchronized profile state (avatar, banner, bio) via CustomEvent + localStorage
- **Floating AI stylist**: `floating-ai-stylist.tsx` provides a persistent chat widget that creates/reuses AI chat sessions; hidden on /login, /register, /chat routes
- **Community state hook**: `useCommunityState` hook encapsulates community state management (load, save, cross-tab sync, post CRUD, follow toggle, archive/restore) for use by dashboard and community pages
- **Number formatting**: `humanizeNumber()` in `lib/utils.ts` formats large numbers compactly (e.g., 1500 -> "1.5k", 10000 -> "10k"); used by community feed, profile stats, and style circle components
- **Rigging status hook**: `useRiggingStatus` hook provides polling-based rigging status tracking for designer product edit pages, with AbortController-based cleanup
- **Outfit rigging status hook**: `useOutfitRiggingStatus` hook polls rigging status for all items in an outfit, syncing `riggedGlbUrl` as each item completes; stops polling when all items are resolved
- **Pose animation**: `usePoseAnimation` hook loads pose GLBs via `GLTFLoader`, extracts target bone quaternions, and smoothly interpolates via `useFrame` over 0.5s; `PoseSelector` renders a horizontal category-grouped preset strip; `pose-config.ts` defines 5 presets across 3 categories (stationary/movement/lifestyle) with bilingual labels
- **Outfit slot model**: `outfit-slots.ts` centralizes slot constants (`top`, `bottom`, `shoes`, `accessory`), labels, category hints, and the `SlotMap` type used by the outfit builder
- **Skeleton sharing**: `SkeletonContext` (React context) shares a `Map<string, Bone>` from the avatar model to garment models, enabling garment meshes to bind to the avatar's skeleton for fitted rendering
- **Suggestion chips**: `SuggestionChips` renders clickable pill buttons for AI chat guided responses with ARIA group labeling and disabled state support
- **Recommended size**: `app/products/[id]/page.tsx` fetches `sizing.getRecommendedSize()` on mount for authenticated users only (AbortController cleanup; guests skip to avoid a 401 bounce), pre-selects the recommended size, and renders `<RecommendedSizeHint/>` above `<SizeSelector/>`
- **Instant 2D preview**: `AvatarViewer`'s optional `previewImageUrl` prop renders a 2D product still (drei `<Html>`) as the `<Suspense>` fallback while the 3D avatar streams in; `SmartARViewer` forwards it and the PDP / `OutfitCard` pass the product image
- **One-tap avatar/body delete**: `ProfileSettingsDialog` and `app/profile/avatar/page.tsx` expose a two-step-confirm delete that calls `avatar.delete()` then toasts and refreshes; `useAvatarStatus` now exposes `refresh` so the avatar page resets after delete

## Test & Quality

- **Framework**: Vitest 4.1.6 + Testing Library (React + jest-dom + user-event) + jsdom
- **Config**: `vitest.config.ts` (globals enabled, jsdom environment, `@/` path alias, setup via `__tests__/setup.ts`)
- **Setup file**: `__tests__/setup.ts` imports `@testing-library/jest-dom` for DOM matchers
- **Test directory**: `__tests__/` (not `__tests__` inside `app/` or `lib/`)
- **Pattern**: `__tests__/**/*.test.{ts,tsx}`
- **Lint**: ESLint via `npm run lint`
- **Current state**: 48 test files, 529 test cases (measured — `npx vitest run`). The inventory below lists 22 of those files; it has never been complete, so treat a missing row as undocumented, not as a missing test.

### Test Inventory

| Test File | Tests | Covers |
|-----------|-------|--------|
| `__tests__/lib/api.test.ts` | 15 | API client: GET/POST/PUT/DELETE methods, JWT auto-injection from localStorage, no-token case, error handling (ApiError with status/message, fallback message), auth.register POST, auth.updateProfile PUT, auth.me GET, avatar.getStatus GET, avatar.delete DELETE, sizing.getRecommendedSize GET, exported type structure validation |
| `__tests__/lib/auth-context.test.tsx` | 12 | AuthContext: useAuth outside provider throws, initial state (no token/hydrate from token/clear expired token), login (success/invalid credentials), register (success/with full profile data including preferences and measurements), logout (clears token+demo cart), refreshUser (updates user data/no-op without token) |
| `__tests__/components/SizeSelector.test.tsx` | 5 | SizeSelector: renders size buttons, selection state toggle, aria-pressed attribute, disabled state, empty sizes returns null |
| `__tests__/components/ProductForm.test.tsx` | 4 | ProductForm size chart: grid renders one row per entered size (hidden until sizes exist), submit builds `measurements[]` with parsed numbers, all-blank size row dropped, `mode="edit"` pre-fills grid from `initialData.measurements` (mocks Radix Select as native `<select>`) |
| `__tests__/components/RecommendedSizeHint.test.tsx` | 5 | RecommendedSizeHint: renders recommended size, renders nothing when basis is NONE, SELF_REPORTED caption, MEASUREMENT_CHART basis, available sizes handling |
| `__tests__/lib/cart-context.test.tsx` | 16 | CartContext: useCart outside provider throws, demo items (load from localStorage/add/remove/update quantity/zero quantity removes/with size selection), totalCount (server+demo), server items (fetch on auth/404 handling), demo-cart persistence as a pure-updater mirror (no write on mount, one write per committed change under StrictMode, persisted list equals committed list, distinct ids under a frozen clock, new id below every existing id, removal persisted) |
| `__tests__/lib/community-feed.test.ts` | 65 | Community feed: toggleLike/Save/Repost (toggle + immutability), addComment (prepend + structure + immutability), addReply (target comment + isolation + immutability), toggleCommentLike (target + isolation), requestDelete (lifecycle state + timestamp + immutability), pruneDeletedPosts (within 30 days/past 30 days/active kept/no timestamp), getFeedByTab (for-you/following/saved/reposted filtering + excludes non-active), isPostActive (active/pending_delete/archived/undefined), buildOutfitGeneratorHref (shop/similar URLs, event/style/seedProductIds params, defaults), toggleFollow (add/remove/immutability), updatePostInState (replace matching/leave others/immutability), loadCommunityState (initial write/default follows/existing state/user post generation), saveCommunityState (write + overwrite), createPost/archivePost/restorePost |
| `__tests__/lib/profile-surface.test.ts` | 10 | Profile surface: cross-tab sync, localStorage persistence, avatar/banner/bio state management |
| `__tests__/lib/profile-dashboard.test.ts` | 16 | Profile dashboard: tab filtering, stats calculation, body measurement coverage |
| `__tests__/middleware.test.ts` | 10 | Middleware: CSP headers (script-src env-aware, wasm-unsafe-eval), X-Frame-Options, Permissions-Policy (camera on AR routes) |
| `__tests__/lib/hooks/useDebounce.test.ts` | 7 | useDebounce: delay behavior, value updates, cleanup on unmount |
| `__tests__/lib/hooks/useRequireAuth.test.ts` | 7 | useRequireAuth: redirect unauthenticated, role-based access, allow authenticated |
| `__tests__/lib/hooks/useGenerationStatus.test.ts` | 11 | useGenerationStatus: polling lifecycle, status transitions, error handling, cleanup |
| `__tests__/lib/hooks/useRedirectIfAuthenticated.test.ts` | 6 | useRedirectIfAuthenticated: redirect authenticated users away from auth pages |
| `__tests__/components/FittingHelper.test.ts` | 19 | FittingHelper: LAYER_MAP constants, applyLayeredAntiPenetration material offset, applyLayeredAntiPenetrationToScene scene traversal, fabricizeMaterial (metalness=0/roughness on untextured, leaves `.map` garments alone, castShadow), fabricizeScene traversal |
| `__tests__/lib/hooks/useOutfitRiggingStatus.test.ts` | 13 | useOutfitRiggingStatus: initial items passthrough, polling lifecycle, rigging status sync, AbortController cleanup |
| `__tests__/lib/pose-config.test.ts` | 14 | pose-config: POSE_PRESETS count and field validation, POSE_CATEGORIES structure, getPoseById lookup/miss, default pose flag |
| `__tests__/api/internal-mail-send.test.ts` | 11 | Internal mail send API route: auth secret validation, Resend integration (subjects from BRAND), error handling |
| `__tests__/app/verify-email.test.tsx` | 6 | Verify-email page: verifies and redirects after the 3s delay, no redirect once the page has been left, no redirect scheduled when it unmounts mid-`refreshUser`, one POST only when StrictMode replays the effect against the single-use token, failure reported without redirecting, missing token errors before any request |
| `__tests__/app/products.test.tsx` | 6 | Products page request races: first page renders + LOAD MORE appends, no append from a filter already left, LOAD MORE not stuck after a stale response lands, one live request under a StrictMode replay, in-flight request aborted on query change, grid kept when a superseded request rejects |
| `__tests__/lib/hooks/useCommunityState.test.tsx` | 6 | useCommunityState: seeds with the documented fallbacks (`""`/`""`/`Everyday`), passes name/username/first aesthetic through, feed present on the first render, persists under the viewer's key, no state or write while signed out, reloads on a value-signature change but not on a new user object identity |

### E2E Tests (Playwright)

| Spec File | Tests | Covers |
|-----------|-------|--------|
| `e2e/auth.spec.ts` | 6 | Buyer login + dashboard redirect, register form rendering, products page load without auth, login error on invalid credentials, login-to-register link, register-to-login link |
| `e2e/register-wizard.spec.ts` | 10 | Registration wizard: step 1 renders with required fields, Next button disabled without fields, Next enabled after fill, advances to step 2 (Style), Back button returns to previous step, step 3 shows Complete Later, Complete Later not visible on steps 1-2, full wizard flow through all 6 steps, submit creates account + redirects to dashboard, duplicate email shows error |
| `e2e/pose-selector.spec.ts` | 5 | Pose selector: login flow, pose strip renders on avatar page, pose button click changes active state, category filtering, pose animation trigger |
| `e2e/ai-stylist.spec.ts` | 6 | AI stylist chat interaction, suggestion chips, floating widget |
| `e2e/cart.spec.ts` | 10 | Cart add/remove/update, demo items, quantity limits, checkout link |
| `e2e/checkout-flow.spec.ts` | 8 | Checkout flow, order creation, success/cancel pages |
| `e2e/community.spec.ts` | 8 | Community feed, post interaction, likes, comments, profile navigation |
| `e2e/designer-crud.spec.ts` | 7 | Designer product create/edit/delete, image upload, 3D generation |

**Playwright config**: `playwright.config.ts` -- chromium only, `baseURL: http://localhost:3000`, HTML reporter, `trace: on-first-retry`, no `webServer` (assumes dev server already running).

### Untested Areas (coverage gaps)

- All page components (33 routes)
- All app-specific components (most -- FittingHelper, SizeSelector, RecommendedSizeHint, ProductForm now tested)
- Custom hooks (useARSupport, useCommunityState, useAvatarStatus, useReveal, useRiggingStatus, usePoseAnimation -- useRequireAuth, useDebounce, useGenerationStatus, useOutfitRiggingStatus, useRedirectIfAuthenticated now tested)
- 3D/AR components (AvatarViewer, ARViewer, SmartARViewer, ModelViewer, DemoOutfitModel)
- Community/profile lib modules (social-graph.ts, profile-options.ts, demo-looks.ts, email-templates.ts, brand.ts -- profile-surface.ts, profile-dashboard.ts, community-feed.ts now tested; middleware now tested)
- E2E: cart flow, checkout, chat, designer studio, 3D/AR features, community (registration wizard and pose selector now tested)

## Gotchas

- **Next.js 16 breaking changes**: Read `node_modules/next/dist/docs/` before using Next.js APIs -- conventions differ from training data. See `AGENTS.md`.
- **3D components must be dynamic-imported** with `ssr: false` (React Three Fiber does not work server-side)
- **API proxy**: `API_PROXY_TARGET` is a runtime env var for local `npm run dev` (proxies to `:3001`), but a build-time `ARG` in the Docker container (baked in at image build). `NEXT_PUBLIC_API_URL` defaults to `""` -- requests hit same origin, proxied to the server in dev
- **Token lifecycle**: 401 from API -> auto-clear token -> redirect to `/login` (handled in `lib/api.ts`)
- **shadcn/ui components** live in `components/ui/` -- generated by CLI, do not edit manually
- **Demo items** use negative IDs in localStorage key `clossette_demo_cart_items`, which lives in `lib/demo-cart.ts` along with its load/save/clear (the rebrand has not reached the storage keys — see the key gotcha further down)
- **An effect that starts something owns stopping it.** Two fixed instances to pattern-match against: `verify-email/page.tsx` left its 3s `router.push` timer uncleared (verify, navigate away, and the timer still yanks you to `/dashboard`), and `products/page.tsx` never cancelled its fetch, so a late response from a filter the user had already left appended its rows *and* wrote its own stale query into `loadedQuery` — with `loading` derived as `loadedQuery !== query`, LOAD MORE then sat on "LOADING…" with no further effect run to correct it. Derived loading flags make a missing cleanup permanent rather than transient.
- **A single-use endpoint cannot be called straight from an effect.** `POST /api/auth/verify-email` clears the token on first success, and dev StrictMode replays effects — so the second POST returned `Invalid verification token` and it was the *surviving* effect instance holding that failure, telling a verified user they had failed. Keep the request itself in a ref (`verification.current ??= api.post(...)`) so a replay attaches handlers to the same in-flight promise. Gating only the state commit is not enough when the call is what must not repeat.
- **Never persist from inside a `setState` updater.** `cart-context.tsx` used to call `saveDemoItems()` inside the `setDemoItems` updater; React double-invokes an updater under StrictMode and replays it whenever a pending queue is re-processed, so the write fired twice per change and could fire for a render React then discarded. Persist from an effect keyed on the committed value instead. **ESLint does not catch this** — a side effect in a callback handed to `setState` is not flagged by the `react-hooks` rules that gate CI, so it has to be caught by reading. Demo ids are derived from the list (`nextDemoId`), not the clock, for the same purity reason.
- **`catch { setItems([]) }` is a lie, not a fallback.** All four sections of `/admin` did exactly that, so a backend outage — or the 403 an expired admin session returns — rendered as "No posts." A moderator reads that as a clear queue and stops looking. Keep an `error` next to the list and render it instead; `useAdminList` in `app/admin/page.tsx` is the shape to copy. The same handler must also skip aborts, or cleanup blanks a list the surviving request filled (`StyleCircleDialog` had that too).
- **One storage entry needs one owner.** Three defects in a row came from two places writing the same key. `logout()` deleted the demo cart's storage key against its own copy of the string while `CartProvider` kept the list in state — the clear was invisible and the next add wrote the stale list back. `/profile/[username]` persisted on follow but not on a post update, so a like left from its detail dialog was the one interaction in the app that vanished on reload. And `useCommunityState` and `/community` carried the same four-argument seeding call verbatim. The fix is always the same: one module owns the key (`lib/demo-cart.ts`), one hook owns the mirroring (`useCommunityStatePersistence`), and callers stop remembering.
- **`loading` derived as "loaded ≠ wanted" needs cancellation to go with it.** The pattern is good — it keeps a fetch effect free of synchronous `setState` and so clears `react-hooks/set-state-in-effect` — but it turns a missing cleanup from transient into *permanent*: a superseded response writing its own key into the "loaded" slot leaves the flag stuck with no further effect run to correct it. Seen in `products/page.tsx` (LOAD MORE pinned on "LOADING…") and all four `/admin` sections. Gate the commit **and** the `finally` on `signal.aborted`.
- **`text-<token>/<alpha>` produces a colour no token defines and nothing was checking.** `__tests__/a11y/token-contrast.test.ts` scans for it and fails on any new sub-AA use. Nine are recorded as debt, each with the reason it is exempt (decorative glyph, or a disabled control); everything that carries text or is an icon-only control has been moved to the plain token. If you need de-emphasis beyond `text-muted-foreground`, add a token rather than an opacity modifier.
- **Fonts**: Display (Cormorant Garamond, `next/font/google`) and body (DM Sans, `next/font/google`) loaded in `layout.tsx`; body carries `--tracking-body` (0.01em), headings carry `--tracking-display` (0, per FORME Figma serif rule)
- **Suspense required for useSearchParams**: Any page calling `useSearchParams()` must wrap its content in a `<Suspense>` boundary or Next.js 16 will bail out to full client-side rendering
- **Vitest path alias**: Tests use `@/` alias resolved to project root (configured in `vitest.config.ts`)
- **AbortSignal on api.get**: The `api.get()` method accepts an options object with `signal` for cancellable requests; `SearchFilterBar` uses this for cleanup on unmount
- **CSP differs by environment**: `middleware.ts` adds `'unsafe-eval'` to `script-src` only in development (required by Next.js dev mode); production omits it. Both environments include `'wasm-unsafe-eval'` (required by Three.js Draco decoder for WASM-based mesh decompression)
- **Playwright assumes running servers**: E2E tests do not start dev/API servers automatically; run `npm run dev` and the API server before `npm run test:e2e`. Override the target with `PLAYWRIGHT_BASE_URL` (defaults to `http://localhost:3000`) and the API with `PLAYWRIGHT_API_URL` (defaults to `http://localhost:3001`) — e.g. to run axe against a host `next dev` server on another port while a stale container occupies `:3000`.
- **Two Playwright projects, run at different concurrency**: `regression` (everything except `button-smoke.spec.ts`) must stay effectively serial because its specs mutate state the seed accounts share; `audit` (`button-smoke.spec.ts` alone) parallelises safely and is **92% of the wall clock** — measured against a production build, 14m16s as one serial run vs ~6m split (`regression` 1.1m at 1 worker + `audit` 4.8m at 3). The split uses `testIgnore`, not a file list, so a newly added spec joins `regression` automatically instead of silently going unrun. `PLAYWRIGHT_CLICK_TIMEOUT` (default 15s) exists because the audit's original failure mode was click timeouts under worker contention — raise it on slow machines.
- **CI**: `.github/workflows/e2e.yml` (workflow name `CI`; the filename is historical) runs four parallel jobs on every PR — `Web (vitest + tsc + lint + build)`, `Server (JUnit)`, `Worker (pytest)` and `Playwright (chromium)`. The web job gates on **zero** ESLint errors, so a new `react-hooks/set-state-in-effect` now fails the build, and it ends with `npm run build` — `tsc --noEmit` is not a build, and the production build resolves things the typechecker never looks at (`next/font` loaders, the Turbopack import map, CSS). Before that step existed, the 16.4.0 bump passed this job and took the *Playwright* job down with `TypeError: fetch failed` in global-setup, because the web image had not built and there was no server to log into. The Playwright job It brings the stack up with the project's own `docker compose` (so CI and `./dev.sh start` cannot drift), which also sidesteps the fact that `gradle-wrapper.jar` is gitignored — `server/Dockerfile` builds with the `gradle:8.10-jdk22` image rather than `./gradlew`. Two CI-specific details worth knowing before editing it: `docker-compose.yml` declares `proxy` as an **external** network, so the workflow must `docker network create proxy` first; and `/api/health` answers before `DataSeeder` finishes, so readiness waits on a non-empty catalogue rather than liveness (polling the login endpoint would burn the rate-limit budget).
- **E2E seeded login**: credentials live in `e2e/seed-users.ts` only (from `DataSeeder`, domain = `app.brand.domain`, default `iyae.ca`; override with `PLAYWRIGHT_SEED_DOMAIN`). Specs do **not** drive the sign-in form — `POST /api/auth/login` is capped at **5 requests per minute per IP** (`RateLimitFilter.RULES`), so a suite that logs in per test 429s regardless of correctness. Use `signIn(page, role)` from `e2e/session.ts`, which seeds the JWT via `addInitScript`; `e2e/global-setup.ts` mints one token per role for the whole run (workers are separate processes, so a per-worker cache still costs one login each). `session.ts` also exports `signOut` (a later init script that removes the key — clearing `localStorage` by hand is undone on the next navigation) and `apiAs` for building server-side fixtures. Only `auth.spec.ts` and the invalid-credentials case in `a11y.spec.ts` use the real form, because the form *is* their subject.
- **The JWT localStorage key is `clossette_token`**, not `iyae_token` — the rebrand has not reached the storage keys (`clossette_demo_cart_items` and `clossette-community-state-<userId>` likewise). Writing the wrong key silently yields an unauthenticated page with no error.
- **E2E specs that share seed state must be serial**: the seed shopper owns one server-side cart, so `cart.spec.ts` and `checkout-flow.spec.ts` declare `test.describe.configure({ mode: 'serial' })`; run in parallel they delete each other's items. `community.spec.ts` seeds its own post through the API (unique caption per run, removed in `afterAll`) and resets the follow edge its follow test creates — `/community`'s default Discover tab is a server feed and `feedPosts ?? localPosts` does **not** fall back on a successful *empty* response, so without a seeded post the interaction tests silently skip.
- **Pose spec 3D tests are `test.fixme`**: the 5 canvas-dependent pose tests require a seeded outfit with a **rigged** garment (`riggedGlbUrl`) at `/outfits/[id]/view`, which `DataSeeder` does not create. Their roving-tabindex/arrow-key a11y is covered by `__tests__/components/PoseSelector.test.tsx`. Un-`fixme` once a rigged outfit is seeded.
- **`--color-muted-foreground` (light) is `#5f5f5f`** (was `#6f6f6f`) so muted text clears WCAG AA 4.5:1 on `bg-muted` (#f4f1ee); the dark-mode value is separate. Do not lighten it back below AA.
- **`--color-destructive` (light) is `#b91c1c`** (red-700, was `#dc2626`) so the `bg-destructive/10` + `text-destructive` error-banner pattern (27 files) clears WCAG AA 4.5:1; the dark-mode value (`#ef4444`) is separate. A CI guard (`__tests__/a11y/token-contrast.test.ts`) pins this + muted-foreground — do not lighten either below AA.
- **Community data is hybrid**: Community posts/follows are server-persisted via `/api/posts` and `/api/follows` endpoints (V8 migration); `community-feed.ts` and `social-graph.ts` still provide localStorage-based demo data for offline/unauthenticated browsing. Authenticated users interact with the server API.
- **Floating AI stylist**: Hidden on `/login`, `/register`, `/chat` paths; creates a new chat session via POST `/api/chat/sessions` on first message
- **A colour literal in `@theme` silently kills dark mode.** Tailwind 4.3 resolves a theme value into the utility it generates, so `@theme { --color-background: #ffffff }` compiles to `.bg-background { background-color: #ffffff }` — a literal no `.dark` override can reach. Dropping the `inline` keyword does **not** help (measured: both forms inline). This is how dark mode shipped non-functional from the day the tokens were written until 2026-10-10, with a source file that looked completely correct: a light block, a `.dark` block overriding every token, and components dutifully using `bg-background`. The shape that works is shadcn/ui's for v4 — raw values in `:root` and `.dark`, and `@theme inline { --color-background: var(--background) }` so the utility carries a reference. **A new colour token needs both halves**: a raw value in `:root` (+ `.dark`) and a mapping in `@theme`. `__tests__/a11y/dark-mode-plumbing.test.ts` compiles the real `globals.css` and fails on a literal, because the source is not where this bug is visible.
- **Dark mode colors**: All pages use semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-muted`, `shadow-heavy`). Do not introduce `stone-*`, `bg-white`, or `bg-[#hex]` hardcoded colors -- they break dark mode. Use `bg-foreground text-background` for inverted (dark-on-light / light-on-dark) elements. Brand + status colors (`bg-brand`/`text-brand`, `bg-success/warning/info/destructive`) resolve from `@theme` tokens and are already dark-mode-correct. Do NOT reintroduce `purple-*`, `rose-*`, or raw hex — a residue-scan gate rejects them (allowlist: `globals.css`, `components/ui`, R3F material files, email templates, color-swatch data).
- **`text-white` on `bg-brand` is unfixable by token choice — use `text-primary-foreground`.** In dark mode the constraints on `--brand` do not overlap: white-on-brand needs luminance ≤ 0.176, while `text-brand` on `bg-card` needs ≥ 0.240. No single value satisfies both, so a hardcoded white *cannot* be rescued by retuning the token. Ten call sites had it; they now use the token, whose dark value is ink (`#0f0d0c`) — the same pattern the dark `success`/`warning`/`info` tokens already use. The 18 remaining `text-white`/`bg-black` uses are on genuinely theme-invariant dark surfaces (`bg-landing-contrast` editorial panels, the AR camera overlay) and are correct.
- **`shadow-heavy` had no token behind it.** `globals.css` defined `--shadow-heavy-color` (with a `.dark` override) but no `--shadow-heavy`, so Tailwind emitted no such utility and the `hover:shadow-heavy` elevation in seven files did nothing — in either theme. The token now composes the colour through a var so the dark override applies; the plumbing test pins it.
- **CSS gradient variables**: Page backgrounds use `--gradient-page-start/mid/end` CSS variables (defined in `globals.css` with dark mode overrides). Profile banners use `--gradient-profile-banner-start/end`. Do not hardcode gradient colors in components -- use these variables for theme consistency.
- **Pose animation GLBs**: Pose presets reference GLB files in `public/models/poses/` (e.g., `a-pose.glb`, `walking.glb`); `usePoseAnimation` loads these via `GLTFLoader` and interpolates bone quaternions over 0.5s using `useFrame`
- **SkeletonContext must wrap garment models**: `SkeletonContext.Provider` in `AvatarModel` shares the avatar's bone map; garment components consume via `useSkeletonContext()` to bind to the avatar skeleton
- **Outfit slot types**: Import `Slot`, `SlotMap`, `SLOTS` from `lib/outfit-slots.ts` (not inline constants) to keep slot definitions centralized
- **Static assets**: `public/models/demo-outfit.glb` is loaded by DemoOutfitModel for the 3D outfit fallback; `public/models/default-avatar.glb` is the default avatar for guest/unauthenticated users; `public/assets/images/products/placeholder.svg` is the product image placeholder

## Related Files

| Path | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout (AuthProvider, fonts, metadata) |
| `app/globals.css` | Global styles, Tailwind directives, CSS gradient/color variables (light + dark) |
| `app/not-found.tsx` | Custom 404 page |
| `app/error.tsx` | Global error boundary |
| `lib/api.ts` | Typed API client with JWT injection, AbortSignal, auth/rigging/avatar/sizing helpers, outfit types |
| `lib/auth-context.tsx` | Authentication state management |
| `lib/cart-context.tsx` | Hybrid cart (server + demo) |
| `lib/utils.ts` | cn() class merging + humanizeNumber() number formatting |
| `lib/profile-surface.ts` | Profile surface state with cross-tab sync |
| `lib/social-graph.ts` | Static social profile data for community demo |
| `lib/profile-options.ts` | Style/color/brand/budget/goal/fit/avatar option constants |
| `lib/community-feed.ts` | Community feed state management (posts, likes, follows, comments, create/archive/restore) |
| `lib/profile-dashboard.ts` | Profile tab filtering, stats, body measurement coverage |
| `lib/demo-looks.ts` | Demo saved looks data for development |
| `lib/brand.ts` | Single source of brand values (`BRAND`: name, tagline, url, mailFrom) for wordmarks, document title/metadataBase, email subjects, and templates |
| `lib/email-templates.ts` | Email template utilities for Resend integration (reads copy/sender from `BRAND`) |
| `lib/hooks/useCommunityState.ts` | Community state management hook (load, save, CRUD, follow, archive/restore) |
| `lib/hooks/useRiggingStatus.ts` | Rigging status polling hook (AbortController-based, for designer product edit) |
| `lib/hooks/useOutfitRiggingStatus.ts` | Outfit-level rigging status polling (syncs riggedGlbUrl for all items) |
| `lib/hooks/usePoseAnimation.ts` | Pose animation hook (GLB loading, quaternion interpolation via useFrame) |
| `lib/hooks/useRedirectIfAuthenticated.ts` | Redirect hook for auth pages (login/register) |
| `lib/outfit-slots.ts` | Outfit slot constants, labels, category hints, SlotMap type |
| `lib/pose-config.ts` | Pose preset definitions (5 poses, 3 categories), PoseDef type, getPoseById() |
| `components/SkeletonContext.tsx` | React context for sharing Three.js bone map between avatar and garment |
| `components/SuggestionChips.tsx` | AI chat suggestion pill buttons |
| `components/PoseSelector.tsx` | Pose preset selector strip for AvatarViewer |
| `components/SizeSelector.tsx` | Cloth size selection button group |
| `components/RecommendedSizeHint.tsx` | Presentational recommended-size hint (renders nothing when basis is NONE) |
| `components/home/motion-presets.ts` | Shared spring/easing presets for landing animations |
| `lib/demo-cart.ts` | The demo cart's storage key + load/save/clear. Its own module because `cart-context` imports `auth-context` and both need the key |
| `middleware.ts` | CSP headers and camera permissions |
| `next.config.ts` | API proxy configuration |
| `vitest.config.ts` | Vitest test configuration |
| `playwright.config.ts` | Playwright E2E configuration |
| `public/models/demo-outfit.glb` | Demo 3D outfit model (GLB) for fallback viewer |
| `public/models/default-avatar.glb` | Default static 3D avatar for guest users |
| `public/assets/images/products/placeholder.svg` | Product image placeholder |
| `__tests__/setup.ts` | Test setup (jest-dom matchers) |
| `package.json` | Dependencies and scripts |
| `AGENTS.md` | Next.js 16 breaking changes warning |

## Changelog

| Date | Action |
|------|--------|
| 2026-10-10 | **Dark mode made functional.** It had never rendered: Tailwind 4.3 resolves a theme value into the utility it generates, so `@theme inline { --color-background: #ffffff }` compiled to `.bg-background { background-color: #ffffff }` — a literal the `.dark` block could not reach. Dropping `inline` does not change that (measured on 4.3.0; both forms inline). On top of that no toggle was mounted (`theme-toggle` was deleted as dead code earlier the same day) and `enableSystem` was false, so the `.dark` class could not be applied by anyone either. `globals.css` restructured to the shape shadcn ships for v4 — raw values in `:root`/`.dark`, `@theme inline` mapping `--color-*` onto `var()` — which also makes the 41 raw `var(--color-*)` inline-style call sites dark-correct, as they were not before. **Five AA failures that nobody could see** were fixed in the process: `#ffffff` on `bg-primary` (4.36), on `bg-destructive` (3.76), the `bg-destructive/10` error banner in 27 files (4.33), and `text-brand` on `bg-background`/`bg-card` (4.13 / 3.66). Dark `--brand`/`--primary`/`--ring` `#cb4d6d`→`#d46b86` with an ink foreground, `--destructive` `#ef4444`→`#f15858` likewise, `landing-tone`/`accent`/`highlight` tracking brand — because the token is used **both** as a surface and as a text colour, and in dark those constraints have no overlap, which is also why the ten `bg-brand text-white` sites had to become `text-primary-foreground`. Three gradient-tile icons on `/design` were white on a cream→rose gradient in dark; same fix. **`shadow-heavy` never existed**: `--shadow-heavy-color` was defined (with a dark override) but not `--shadow-heavy`, so seven files’ `hover:shadow-heavy` emitted nothing in either theme. Two `bg-paper` buttons hovered to `bg-landing-surface`, dark in dark mode, putting ink text at 1.3:1 — new theme-invariant `--color-paper-hover`. `theme-toggle` restored (reading `resolvedTheme`, not `theme`) and mounted in `SiteHeader`, reaching 37 surfaces; `/design` keeps its own `LandingNav` and has no toggle, though the choice persists into it. New `__tests__/a11y/dark-mode-plumbing.test.ts` compiles the real `globals.css` and asserts the output shape, since the source is not where the bug was visible; `token-contrast.test.ts` gains the whole dark palette. **36 of the 38 new cases were measured failing against the old `globals.css`.** `e2e/a11y.spec.ts` gains a dark axe pass over the authenticated routes plus a toggle test. Verified in a real browser: every themed utility responds to `.dark`, and a contrast sweep of 10 public routes found 0 text below AA in dark. Web tests 435→495 / 43→44 files. eslint 0 errors (15 warnings, unchanged). |
| 2026-10-10 | Effect-cleanup pass on the next three #40 carry-forward defects. `app/verify-email/page.tsx`: the 3s redirect timer now dies with the effect, and the verification POST is held in a ref — the token is single-use, so the dev StrictMode replay sent a second request that came back `Invalid verification token` and left the surviving effect instance showing "Verification failed" to a user who *was* verified. `app/products/page.tsx`: `AbortController` + cleanup, with every state commit gated on `signal.aborted`; previously a late page>0 response appended rows from an abandoned filter, its `finally` wrote a stale `loadedQuery` (permanently sticking LOAD MORE on "LOADING…", since `loading` is derived from it), and a superseded request's *rejection* blanked a grid that had loaded fine. `lib/hooks/useCommunityState.ts` now exports `loadCommunityStateFor` + `useCommunityStatePersistence`, which `app/community/page.tsx` uses instead of its verbatim copies of the seeding call and persist effect — the two surfaces share one `clossette-community-state-<userId>` entry, so the seeding fallbacks had to stop being two independent copies (the page's redundant `styleAesthetics` cast went with it). Tests 386->404; 8 of the 18 new cases verified to fail against the old implementations, the 6 `useCommunityState` ones being a characterization baseline that passes either side of the refactor |
| 2026-10-10 | `lib/cart-context.tsx` demo-cart persistence moved out of the `setDemoItems` updaters into an effect that mirrors committed state (identity-guarded, so neither mount nor StrictMode's double-invoked mount effect writes). An updater must be pure — React double-invokes it under StrictMode and replays it on a later render, so the old in-updater `saveDemoItems()` wrote twice per change and could write for a render React discarded. `generateDemoId()` (`-floor(Date.now() + random * 1000)`) replaced by `nextDemoId(prev)` = one below the lowest id in the list: the clock-based id changed on every re-invocation, and its random term spans a full second so two items added within a second could share an id — which is the React key *and* what `removeDemoItem` matches on. Tests 380->386 (3 of the 6 verified to fail against the old implementation) |
| 2026-10-10 | `lib/saved-products.ts` is server-backed: `/api/saved-products` (V21) is the source of truth when signed in and localStorage is demoted to a cache, so a tapped heart survives a change of device. Reads stay synchronous through `useSyncExternalStore` (the shop grid renders 20 hearts and cannot wait on a request); writes are optimistic with rollback to the *prior* set rather than the inverse of the optimistic change, so a concurrent write in another tab is not clobbered. `toggleSavedProduct` is async but never rejects and resolves to the settled state. Sign-in replays local-only ids up and never deletes in the other direction. Logout clears the cache (per-user). `lib/api.ts` gains a `savedProducts` client plus an exported `AUTH_TOKEN_KEY`/`hasAuthToken()`. Placeholder GOOGLE/APPLE sign-in buttons + the "or continue with" divider removed from `/login`. The home scroll cue uses `text-muted-foreground` instead of an ad-hoc ink opacity, and `__tests__/a11y/token-contrast.test.ts` now scans the source for `text-<token>/<alpha>` (recording 28 pre-existing sub-AA `text-muted-foreground/30..70` uses as pinned debt). `e2e/a11y.spec.ts` sets reduced motion via `contextOptions` — the top-level `test.use({ reducedMotion })` form is silently ignored on Playwright 1.60 — and asserts the setting arrived. All 53 ESLint errors fixed (47 `react-hooks/set-state-in-effect` across 35 files). Tests 357->380 |
| 2026-06-03 | Components 56->62 (SuggestionChips, SkeletonContext, PoseSelector, outfits/ expanded); hooks +2 (useOutfitRiggingStatus, usePoseAnimation); lib/ +outfit-slots.ts, pose-config.ts; tests 10->13 files / 159->195; E2E 2->3 specs / 16->21 |
| 2026-06-07 | Components 62->74 (+AIStylistSection, SocialProofSection, TrustBar, TryOnSection, PromotionForm, PromotionList, designer/ pages); hooks +1; tests 13->16 / 195->221; E2E 3->8 specs / 21->60; Resend email routes + templates |
| 2026-06-08 | Quality audit: fixed home/ count 9->13, component total 81->93, test count 13->16/195->221, trimmed changelog |
| 2026-06-14 | Doc sync: +SizeSelector component, +5 home components (LifestyleGrid, PhotoStrip, MagneticCTALink, TryOnViewer, motion-presets), +3 page routes (designer/promotions, designer/studio, reset redirect), default-avatar.glb; home/ 13->18, components 93->98, tests 16->17 / 221->227; cart size selection support |
| 2026-06-14 | Count audit: components 98->91 total (79->72 app-specific -- previous count inflated by 7; accurate recount from glob); hooks 10->11 (useRedirectIfAuthenticated was missing from count); lib domain modules documented: +demo-looks.ts, +email-templates.ts; designer/ (2) subdirectory explicitly listed; component sections restructured for accuracy |
| 2026-06-19 | Count fix: components 91->93 total (72->74 app-specific -- section sums 31+18+1+9+6+2+7=74 were correct; architecture header was understated by 2) |
| 2026-09-05 | Email consolidation: added `lib/brand.ts` (single source of brand values, read by wordmarks + email subjects + email-templates.ts); removed dead `app/api/internal/mail/password-reset` route + `internal-mail.test.ts`; tests 227->222 / 17->16 files |
| 2026-09-05 | Phase 4 Virtual Fitting web: RecommendedSizeHint component + PDP recommended-size (pre-select); AvatarViewer `previewImageUrl` instant 2D fallback; OutfitCard inline chat try-on (lazy dynamic ssr:false); one-tap avatar/body delete UI (ProfileSettingsDialog + avatar page); api.ts `avatar`/`sizing` helpers; tests 222->230 (+RecommendedSizeHint 5, +api 3) |
| 2026-09-05 | PR #8 follow-up: two-step delete confirm now moves focus to Cancel + wraps the Cancel/Confirm pair in `aria-live="polite"` (M10, ProfileSettingsDialog + avatar page); avatar page disables the Delete trigger while generating (L5); ProfileSettingsDialog.test.tsx grown with delete-flow, failure-toast, focus, and aria-live cases (M11) |
| 2026-09-06 | PR #8 post-merge hardening: PDP pre-select validates `recommendedSize ∈ product.sizes` before selecting (M5); `useAvatarStatus` threads an `AbortSignal` and aborts its status fetch/poll on unmount (M6); `AvatarStatus` canonical type moved into `lib/api.ts`, re-exported from the hook (M8); ProfileSettingsDialog gates its Delete trigger while an avatar is generating + adds `aria-expanded` (M7/L8); delete-failure toasts surface `ApiError.message` (L6). Added `useAvatarStatus.test.ts` (3, abort-on-unmount) |
| 2026-09-06 | Phase 4 size-chart authoring (PR-C/F1-F3): `ProductForm` per-size grid relabeled "Size chart (cm, optional)" with "powers your recommended size" helper + a heads-up when clearing a size drops its measurements. Designer measurements now reach the PDP `MEASUREMENT_CHART` hint (recommender fallback landed in PR-B). Added `ProductForm.test.tsx` (4); tests 17->18 files / 230->234 cases |
| 2026-09-08 | Phase 9 a11y closeout: light-mode `--color-destructive` `#dc2626→#b91c1c` (red-700) so the destructive error-banner pattern (27 files) clears WCAG AA 4.5:1 on the `bg-destructive/10` tint; added `__tests__/a11y/token-contrast.test.ts` (3, pins destructive + muted-foreground AA) + a deterministic invalid-login banner case in `e2e/a11y.spec.ts`; web unit 30->31 files / 301->304 cases |
| 2026-09-08 | Tech-debt cleanup: aligned the mocked `ApiError` in `__tests__/lib/hooks/useGenerationStatus.test.ts` to the real `(status, message)` constructor (was `(message, status)`) + swapped the two call-site args — clears the 2 pre-existing `TS2345` errors; `tsc --noEmit` now fully clean. No runtime/behavior change (hook 11/11, suite 301 green). |
| 2026-09-10 | Drape-realism Phase 2 (C2 slot normal maps + D3 tone mapping): new `lib/fabric-textures.ts` (`getFabricNormalConfig(slot)` → slot-keyed tileable normal-map url/repeat/normalScale; always returns a config) + tangent-space assets under `public/textures/fabric/` (`weave-normal.png`, `denim-normal.png`, procedurally generated, README provenance). `FittingHelper` gains `applyGarmentNormalMap`/`applyGarmentNormalMapToScene` (C2): assigns a tiled slot-keyed normal map to garment `MeshStandardMaterial`s **without** an existing `normalMap` (never clobbers a Meshy-PBR map), via a module-level memoized `TextureLoader` cache; mutated in place (SkinnedMesh binding preserved); relief needs UV (B1 garments + Meshy GLBs have it). `AvatarViewer` `GarmentModel`/`BoundGarmentModel` call it (threading `slot`); `<Canvas gl={{ toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.0 }}>` + `<Environment environmentIntensity={0.6}>` (D3) → matte fabric, plastic highlights gone. Tests: `FittingHelper.test.ts` +4, new `fabric-textures.test.ts` +7; web 33→34 files / 324→335. |
| 2026-09-10 | Drape-realism Phase 1 (D1 contact shadows + D2 fabric fallback): `AvatarViewer` gains `<Canvas shadows>`, `castShadow` on the key directional light, drei `<ContactShadows>` grounding the avatar at y=0, and `castShadow`/`receiveShadow` on avatar meshes — kills the "floating" read. `FittingHelper` gains `fabricizeMaterial`/`fabricizeScene` (D2): untextured `MeshStandardMaterial` (`.map==null`) forced to metalness=0/roughness=0.85 so pre-B1 / non-PBR garments read as matte fabric, not plastic; textured (B1) garments untouched; every garment mesh gets castShadow. `BoundGarmentModel` + `GarmentModel` run scenes through `fabricizeScene`. `FittingHelper.test.ts` 13→19. |
| 2026-10-10 | Last of the #40 carry-forward list, cleared in one pass. **`useRiggingStatus`** built an `AbortController` per load and never aborted it, so a status reply for a product the user had left overwrote the one on screen (PDP→PDP is the same route, so no unmount, and it polls every 3s while PENDING/RUNNING); each loader now takes the signal of whatever started it. **`/admin`** had four copies of `catch { setX([]) }`, rendering an outage or an expired-session 403 as "No posts." — plus the stuck-`loading` race from the product grid, four more times; now one `useAdminList` with an `AbortController` and a `role="alert"` + Try again. **`/community`** could not tell "fetch in flight" from "fell back to local" (both gave `feedPosts === null`), so Discover opened on fabricated demo posts and its own "Loading feed…" branch was unreachable for every signed-in viewer. **`/profile/[username]`** persisted a follow but not a post update, so a like from its detail dialog was the only interaction in the app that vanished on reload; it now goes through `useCommunityStatePersistence` like the other two surfaces. **Signing out** deleted the demo cart's storage key against a hardcoded second copy of it while `CartProvider` kept the list — invisible clear, and the next add wrote the stale list back; key + load/save/clear moved to `lib/demo-cart.ts`. **16 components nothing imports deleted** (-3278 lines): 11 sections of the homepage `ImmersiveHomepage` replaced, TryOnViewer, MagneticCTALink, OutfitSlotCard, ProductList, theme-toggle. Six unwired `profile/` components were kept and marked UNWIRED instead, since nothing live supersedes them. **The contrast debt was classified rather than deferred**: of the 28 recorded sub-AA `text-muted-foreground/*` uses, 15 carried real text and 3 were icon-only controls — all 18 moved to the plain token, which the guard already proves clears 4.5:1; the 9 that remain are decorative glyphs or a disabled state, each now recorded with its reason. A `react-reviewer` pass over the branch then turned up three more, all fixed here rather than deferred: `/profile/[username]` was keying its reseed on the `user` *object* (and `refreshUser` hands out a new one on every save, from a dialog this page's own header mounts) — it now just calls `useCommunityState(user)`, which supplies exactly what it needed plus the cross-tab listener; `useRiggingStatus` shared one AbortController across polling ticks, so two overlapping ticks at the same status could walk `attemptCount` backwards; and it did not drop `status` on a `productId` change, so the previous product's READY panel flashed against the new one — a gap my own regression test had, since it asserted only after both responses had settled. Web tests 404→435 / 39→43 files across 4 new files; **18 of the new cases were measured failing against the old implementations** (6 rigging-status, 7 admin, 1 community, 2 profile, 2 cart), the rest are baselines. The totals are not a clean sum: the contrast guard's `it.each` over non-exempt occurrences shrank as the sub-AA uses were fixed. eslint 0 errors (29→15 warnings). |
| 2026-10-11 | **Audit remediation (web half).** Checkout, cart and resale buy-now hide their entry points when payment is off (`usePublicConfig` + `CheckoutUnavailableNotice`) — a 503 behind a live-looking button is a support ticket, not a disabled feature. `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` **removed**, not re-plumbed: the production image had no build arg for it, so it could never be `true` and every new signup was bounced to a dashboard where nothing worked; the gate is now read at runtime from `GET /api/public/config`, so there is no second flag to keep in sync (`auth-config` is async and fails closed). New `/privacy` and `/terms`, written from what the code actually does and linked from the footer and the registration consent — the checkbox had been gating on documents that did not exist. Account deletion UI in `ProfileSettingsDialog` (type-DELETE confirm, distinct from the existing avatar-only delete). Community writes reach the server: comments and replies (`POST /api/posts/{id}/comments` — the UI had been appending them and discarding the write), the public-profile follow button, and the profile grid, which had been filtering the *viewer's* local cache and so rendered empty for every other account in production. `LocalImagePicker` is a real `<button>`: keyboard-only users could not create a post at all, since choosing an image is mandatory and the picker was a `<div onClick>` wrapping an `aria-hidden` input. `api.ts` only treats a 401 as session death when it actually sent a token, so an anonymous visitor probing a protected endpoint is no longer yanked to `/login`. **Review pass fixes**: the shared public-config promise took a caller's `AbortSignal`, so one consumer unmounting made every other consumer render an error over a request it never cancelled; `/checkout`'s Place Order was the one purchase affordance not disabled during the config load; four of the five `LocalImagePicker` call sites passed a `<Button>` as children, i.e. a button inside a button — two tab stops for one action, worse than the unreachable div (a source-scanning guard, `__tests__/a11y/image-picker-nesting.test.ts`, now fails on a reintroduction); the profile page's `onUpdate` wrote only to the local cache while the grid rendered server data, so dialog interactions changed nothing visible; follow had no in-flight guard; and a failed comment reverted to the snapshot captured when its request started, wiping a later successful one. Tests 495 → 516 across 47 files. 0 ESLint errors. |
| 2026-10-12 | **PR #47 second review pass (web).** The registration consent checkbox was decorative: `agreed` was `useState` inside `StepBasics` whose only readers were its own declaration and the `checked` prop, so it never reached `onChange` and `RegisterPage.canAdvance()` for step 0 checked only email/password/role. A user could leave it unticked and create an account — including the body measurements the wizard collects later — with no consent recorded. It is now owned by the wizard and passed down as its own prop rather than as a `RegisterRequest` field (that type is the API payload and the server has no consent column), and it is checked in `canAdvance` **and** again in `handleSubmit`, since "Complete Later" reaches submit without passing the CONTINUE gate. The links keep their click-forwarding fix and gained `rel="noopener noreferrer"`; the sentence is now one wrapping text flow with a single `<label htmlFor>` around the prose and `aria-describedby` pointing at the links, instead of two flex items that broke mid-sentence on a narrow viewport. **The ad-hoc-opacity contrast guard gained a dark-mode pass** — `ratioFor` read `lightToken` only, which is remarkable given the defect it was extended to catch (`text-background/55` at 3.73:1) was itself a dark-mode value — and it immediately found a new one: `text-primary-foreground/70` on `/try-on`, 5.05:1 in light and 3.77:1 in dark, carrying real descriptive text. Fixed rather than recorded; the nine exempt entries now have a dark sibling map with their own measured ratios. `--inverted-muted-foreground` also gained explicit pairing coverage in both themes, having been the replacement token that nothing checked. Three new test files (`register-consent`, `api-session-expiry`, `checkout-payment-off`) cover the three gaps the review named: the consent gate, the `401 && token` session-death branch (`api.test.ts` had no 401 case at all, so neither side of it was pinned), and the payment-off UI — which is the PR's headline client-side claim and which e2e **cannot** reach, since CI runs the dev profile with `stub-checkout-enabled: true` and so always sees `checkoutEnabled: true`. Tests 529 → 561 across 51 files; the consent-gate case was measured failing against the pre-fix `canAdvance`. `tsc` clean, eslint 0 errors (17 warnings), `npm run build` succeeds. |
| 2026-10-12 | **PR #47 review follow-up (web).** `/community` and `/profile/[username]` now patch the open post dialog only while it is still showing that same post. Both render it as `{selectedPost && <PostDetailDialog/>}` and set `selectedPost` unconditionally from `onUpdate`, so the asynchronous rollback of a failed comment write **re-opened a dialog the user had already dismissed** — showing them their comment being silently removed — or, if they had opened a different post meanwhile, swapped its content for the old one. The feed/store update still runs either way, so the unsaved comment is not left behind. `PostDetailDialog.handleAddReply` refuses, before the optimistic write, to persist a reply whose parent has no server id yet: `parentCommentId` came out `undefined` for a comment authored in the same session, and `POST /api/posts/{id}/comments` with no parent creates a new **top-level** comment, so the thread was flattened server-side and only surfaced on reload. The public-profile follow button stopped treating a failed *counts* refresh as a failed follow — the refresh was chained onto the same promise, so one `.catch` covered both and a transient counts failure reverted the button and reported an error for a follow the server had recorded. `followPending` is now tagged with the target user id, like `counts`/`postsResult` already were, because App Router reuses this component instance across `/profile/a` → `/profile/b` (one dynamic segment, no `key`) and a bare boolean left the second profile's button disabled until the first request settled. `LocalImagePicker`'s hidden `<input type="file">` is a sibling of its `<button>` rather than a child — `<button>` permits no interactive descendants, and the nesting only worked because the input is `display:none` and non-tabbable. Tests 516 → 529 across 48 files (+`__tests__/components/PostDetailDialog.test.tsx`, +4 cases on `profile-username`); **4 of the new cases measured failing against the pre-fix implementations** (counts-failure revert, cross-profile disabled button, dialog re-open, reply threading), the two counterparts being controls that the revert still fires on a real mutation failure and that a server-backed parent still threads correctly. `tsc` clean, eslint 0 errors (17 warnings), `npm run build` succeeds. |
| 2026-10-15 | **B-11 (web).** The operator ADMIN can reach the designer studio. "May manage the catalogue" had been written out as `role === "DESIGNER"` in eight places and had **already drifted**: `app/dashboard/page.tsx:435` was `DESIGNER || ADMIN` and rendered a "Designer Studio" link to `/designer/studio`, where `useRequireAuth("DESIGNER")` bounced the operator straight back to `/dashboard` — a dead link in their own sidebar, live before this change. New `lib/roles.ts` owns the rule (`CATALOG_MANAGER_ROLES`, `canManageCatalog`), mirroring the server's `Role.canManageCatalog()`. `useRequireAuth` now accepts a role **set** as well as a single role (`Role | readonly Role[]`, matched with `includes`); a lone role still means exactly that role, and all 20 existing call sites are untouched. The four hook-gated designer routes pass `CATALOG_MANAGER_ROLES`; `app/designer/products` — the one route that bypasses the hook — had **two** hand-rolled checks, one gating the fetch (`:72`) and one rendering the in-place "Designer area" dead end (`:150`), and both had to move: an ADMIN that passed only the render gate would have seen a permanently empty studio with no error, which reads as "you have no products". `SiteHeader`'s `isDesigner`/`isAdmin` stopped being mutually exclusive branches, so ADMIN gets Studio + Promotions *and* Admin; `LandingNav` and the dashboard sidebar read the same predicate. `__tests__/lib/roles.test.ts` parses `canManageCatalog()` out of the server's `Role.java` and fails if the two lists disagree — the `AssetExposureConsistencyTest` trick, applied here because this repo has already shipped a four-layer list that silently diverged and 404'd every 3D preview. Tests 561 → 575 across 53 files (+`roles`, +`app/designer-products`, +5 `useRequireAuth` cases); **4 measured failing against a narrowed predicate**, including the server-agreement guard. E2E 118 → 122 across 11 specs: `global-setup.ts` now mints a token for the seeded `admin` persona, which no spec had ever signed in as, and `admin-catalogue.spec.ts` drives the real UI (studio reachable, Studio link present, product created through the form) plus the promotions API — the only test covering the full chain of JWT → matcher → `resolveDesignerProfile` → `DesignerProfile`, every link of which the unit and WebMvc slices mock away. All four pass against a live stack, and the existing `designer-crud.spec.ts` "non-designer sees designer area gate" still passes for a shopper. `tsc` clean, eslint 0 errors (17 warnings, unchanged), `npm run build` succeeds. |
