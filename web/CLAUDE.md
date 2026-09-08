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
components/    (94 total)        --> 75 app-specific + 19 shadcn/ui primitives
components/register/ (7)         --> Multi-step registration wizard components
components/community/ (1)        --> PostMedia (community post media rendering)
components/profile/ (9)          --> Profile page components (header, stats, settings, posts, actions)
components/home/ (18)            --> Landing page sections + shared motion presets (hero, designers, how-it-works, sustainability, CTA, community, nav, footer, immersive-homepage, ai-stylist, social-proof, trust-bar, try-on, try-on-viewer, lifestyle-grid, photo-strip, magnetic-cta-link, motion-presets)
components/outfits/ (6)          --> Manual outfit builder (OutfitSlotCard, ProductPickerDialog, ProductSelectCard, OutfitDetailsForm, OutfitBuilderPreview, OutfitSlotSidebarItem)
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
| ProductList / ProductListItem | Product catalog display |
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
| FittingHelper | Fitting assistance component for try-on flows |
| SizeSelector | Cloth size selection buttons (aria-pressed, disabled state support) |
| RecommendedSizeHint | Presentational recommended-size hint ("Your recommended size: M"); renders nothing when basis is NONE; "based on your saved sizes" caption for SELF_REPORTED |
| Footer | Site footer |
| theme-provider | next-themes ThemeProvider wrapper |
| theme-toggle | Dark/light mode toggle button |
| floating-ai-stylist | Floating AI assistant chat widget (hidden on /login, /register, /chat) |
| PostDetailDialog | Community post detail modal with comments and replies |
| ViewerErrorBoundary | Error boundary for 3D viewer components |
| SuggestionChips | AI chat suggestion pill buttons (accessible, disableable) |
| SkeletonContext | React context sharing Three.js bone map between avatar and garment models |
| PoseSelector | Horizontal pose preset strip overlay for AvatarViewer (categories: stationary/movement/lifestyle) |
| ModelViewer | `@google/model-viewer` fallback (iOS AR Quick Look, Android Scene Viewer) |
| DemoOutfitModel | Demo mannequin when no GLB assets available (loads `public/models/demo-outfit.glb`) |
| AvatarViewer | R3F-based 3D avatar with GLB models; optional `previewImageUrl` prop renders an instant 2D product still (drei `<Html>`) as the `<Suspense>` fallback while the 3D avatar streams in |
| ARViewer | WebXR AR session with hit testing |
| SmartARViewer | Auto-detects device capability, routes to appropriate viewer; passes `previewImageUrl` through to the desktop AvatarViewer |

### Home (`components/home/`, 18)

| Component | Purpose |
|-----------|---------|
| immersive-homepage | Full-screen landing page with editorial layout |
| HeroSection | Landing hero with animated headline and CTA |
| DesignersSection | Featured designers showcase |
| HowItWorks | Step-by-step feature walkthrough |
| SustainabilitySection | Sustainability messaging block |
| CTASection | Call-to-action conversion block |
| CommunitySection | Community preview for landing |
| LandingNav | Landing page dedicated navigation |
| LandingFooter | Landing page dedicated footer |
| AIStylistSection | AI stylist iPhone mockup showcase with avatar flow |
| SocialProofSection | Social proof stats and testimonials |
| TrustBar | Trust badges and partner logos |
| TryOnSection | Interactive 3D try-on demo with scroll-driven parallax |
| TryOnViewer | Embedded 3D viewer for try-on section |
| LifestyleGrid | Masonry photo grid with motion animations |
| PhotoStrip | Infinite-scroll photo strip with CSS animation |
| MagneticCTALink | Spring-physics magnetic hover CTA button |
| motion-presets | Shared motion presets: CTA_SPRING, SOFT_SPRING, EASE_OUT_EXPO, textStagger, textChild, fadeUp |

### Community (`components/community/`, 1)

| Component | Purpose |
|-----------|---------|
| PostMedia | Community post media rendering (images, video) |

### Profile (`components/profile/`, 9)

| Component | Purpose |
|-----------|---------|
| ProfileHeader | User profile hero with avatar, banner, bio |
| ProfileStatsBar | Posts/followers/following stats display |
| ProfileActionBar | Follow/message/settings action buttons |
| ProfileContentTabs | Tab navigation for profile content (posts/saved/reposted/tagged/archives) |
| ProfilePostGrid | Grid layout for profile post cards |
| ProfileSettingsDialog | Profile settings modal (3 tabs: edit profile, style preferences, body measurements); one-tap "Delete my avatar & body data" button (two-step confirm -> `avatar.delete()` -> toast -> refresh) |
| CreateFashionPostDialog | New fashion post creation dialog |
| StyleCircleDialog | Style circle management dialog (followers/following with humanized counts) |
| LocalImagePicker | Client-side image picker for avatar/banner uploads |

### Outfit Builder (`components/outfits/`, 6)

| Component | Purpose |
|-----------|---------|
| OutfitSlotCard | Slot card for manual outfit builder (displays selected product per slot) |
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
| next | 16.2.6 | Framework (App Router) |
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
| _(no `tailwind.config.ts`)_ | Tailwind v4 is CSS-first — the theme lives entirely in `app/globals.css` `@theme inline` (+ `.dark`); do not recreate a JS config |
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
- **Current state**: 18 test files, 234 test cases

### Test Inventory

| Test File | Tests | Covers |
|-----------|-------|--------|
| `__tests__/lib/api.test.ts` | 15 | API client: GET/POST/PUT/DELETE methods, JWT auto-injection from localStorage, no-token case, error handling (ApiError with status/message, fallback message), auth.register POST, auth.updateProfile PUT, auth.me GET, avatar.getStatus GET, avatar.delete DELETE, sizing.getRecommendedSize GET, exported type structure validation |
| `__tests__/lib/auth-context.test.tsx` | 12 | AuthContext: useAuth outside provider throws, initial state (no token/hydrate from token/clear expired token), login (success/invalid credentials), register (success/with full profile data including preferences and measurements), logout (clears token+demo cart), refreshUser (updates user data/no-op without token) |
| `__tests__/components/SizeSelector.test.tsx` | 5 | SizeSelector: renders size buttons, selection state toggle, aria-pressed attribute, disabled state, empty sizes returns null |
| `__tests__/components/ProductForm.test.tsx` | 4 | ProductForm size chart: grid renders one row per entered size (hidden until sizes exist), submit builds `measurements[]` with parsed numbers, all-blank size row dropped, `mode="edit"` pre-fills grid from `initialData.measurements` (mocks Radix Select as native `<select>`) |
| `__tests__/components/RecommendedSizeHint.test.tsx` | 5 | RecommendedSizeHint: renders recommended size, renders nothing when basis is NONE, SELF_REPORTED caption, MEASUREMENT_CHART basis, available sizes handling |
| `__tests__/lib/cart-context.test.tsx` | 10 | CartContext: useCart outside provider throws, demo items (load from localStorage/add/remove/update quantity/zero quantity removes/with size selection), totalCount (server+demo), server items (fetch on auth/404 handling) |
| `__tests__/lib/community-feed.test.ts` | 65 | Community feed: toggleLike/Save/Repost (toggle + immutability), addComment (prepend + structure + immutability), addReply (target comment + isolation + immutability), toggleCommentLike (target + isolation), requestDelete (lifecycle state + timestamp + immutability), pruneDeletedPosts (within 30 days/past 30 days/active kept/no timestamp), getFeedByTab (for-you/following/saved/reposted filtering + excludes non-active), isPostActive (active/pending_delete/archived/undefined), buildOutfitGeneratorHref (shop/similar URLs, event/style/seedProductIds params, defaults), toggleFollow (add/remove/immutability), updatePostInState (replace matching/leave others/immutability), loadCommunityState (initial write/default follows/existing state/user post generation), saveCommunityState (write + overwrite), createPost/archivePost/restorePost |
| `__tests__/lib/profile-surface.test.ts` | 10 | Profile surface: cross-tab sync, localStorage persistence, avatar/banner/bio state management |
| `__tests__/lib/profile-dashboard.test.ts` | 16 | Profile dashboard: tab filtering, stats calculation, body measurement coverage |
| `__tests__/middleware.test.ts` | 10 | Middleware: CSP headers (script-src env-aware, wasm-unsafe-eval), X-Frame-Options, Permissions-Policy (camera on AR routes) |
| `__tests__/lib/hooks/useDebounce.test.ts` | 7 | useDebounce: delay behavior, value updates, cleanup on unmount |
| `__tests__/lib/hooks/useRequireAuth.test.ts` | 7 | useRequireAuth: redirect unauthenticated, role-based access, allow authenticated |
| `__tests__/lib/hooks/useGenerationStatus.test.ts` | 11 | useGenerationStatus: polling lifecycle, status transitions, error handling, cleanup |
| `__tests__/lib/hooks/useRedirectIfAuthenticated.test.ts` | 6 | useRedirectIfAuthenticated: redirect authenticated users away from auth pages |
| `__tests__/components/FittingHelper.test.ts` | 13 | FittingHelper: LAYER_MAP constants, applyLayeredAntiPenetration material offset, applyLayeredAntiPenetrationToScene scene traversal |
| `__tests__/lib/hooks/useOutfitRiggingStatus.test.ts` | 13 | useOutfitRiggingStatus: initial items passthrough, polling lifecycle, rigging status sync, AbortController cleanup |
| `__tests__/lib/pose-config.test.ts` | 14 | pose-config: POSE_PRESETS count and field validation, POSE_CATEGORIES structure, getPoseById lookup/miss, default pose flag |
| `__tests__/api/internal-mail-send.test.ts` | 11 | Internal mail send API route: auth secret validation, Resend integration (subjects from BRAND), error handling |

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
- **Demo items** use negative IDs in localStorage key `iyae_demo_cart_items`
- **Fonts**: Display (Cormorant Garamond, `next/font/google`) and body (DM Sans, `next/font/google`) loaded in `layout.tsx`; body carries `--tracking-body` (0.01em), headings carry `--tracking-display` (0, per FORME Figma serif rule)
- **Suspense required for useSearchParams**: Any page calling `useSearchParams()` must wrap its content in a `<Suspense>` boundary or Next.js 16 will bail out to full client-side rendering
- **Vitest path alias**: Tests use `@/` alias resolved to project root (configured in `vitest.config.ts`)
- **AbortSignal on api.get**: The `api.get()` method accepts an options object with `signal` for cancellable requests; `SearchFilterBar` uses this for cleanup on unmount
- **CSP differs by environment**: `middleware.ts` adds `'unsafe-eval'` to `script-src` only in development (required by Next.js dev mode); production omits it. Both environments include `'wasm-unsafe-eval'` (required by Three.js Draco decoder for WASM-based mesh decompression)
- **Playwright assumes running servers**: E2E tests do not start dev/API servers automatically; run `npm run dev` and the API server before `npm run test:e2e`. Override the target with `PLAYWRIGHT_BASE_URL` (defaults to `http://localhost:3000`) — e.g. to run axe against a host `next dev` server on another port while a stale container occupies `:3000`.
- **E2E seeded login**: `a11y.spec.ts` and `pose-selector.spec.ts` log in as the seeded buyer `emma@iyae.ca` / `password123` (from `DataSeeder`, domain = `app.brand.domain`, default `iyae.ca`). The other e2e specs still hardcode `emma@example.com`, which only works if the server runs with `BRAND_DOMAIN=example.com`.
- **Pose spec 3D tests are `test.fixme`**: the 5 canvas-dependent pose tests require a seeded outfit with a **rigged** garment (`riggedGlbUrl`) at `/outfits/[id]/view`, which `DataSeeder` does not create. Their roving-tabindex/arrow-key a11y is covered by `__tests__/components/PoseSelector.test.tsx`. Un-`fixme` once a rigged outfit is seeded.
- **`--color-muted-foreground` (light) is `#5f5f5f`** (was `#6f6f6f`) so muted text clears WCAG AA 4.5:1 on `bg-muted` (#f4f1ee); the dark-mode value is separate. Do not lighten it back below AA.
- **Community data is hybrid**: Community posts/follows are server-persisted via `/api/posts` and `/api/follows` endpoints (V8 migration); `community-feed.ts` and `social-graph.ts` still provide localStorage-based demo data for offline/unauthenticated browsing. Authenticated users interact with the server API.
- **Floating AI stylist**: Hidden on `/login`, `/register`, `/chat` paths; creates a new chat session via POST `/api/chat/sessions` on first message
- **Dark mode colors**: All pages use semantic tokens (`bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-muted`, `shadow-heavy`). Do not introduce `stone-*`, `bg-white`, or `bg-[#hex]` hardcoded colors -- they break dark mode. Use `bg-foreground text-background` for inverted (dark-on-light / light-on-dark) elements. Brand + status colors (`bg-brand`/`text-brand`, `bg-success/warning/info/destructive`) resolve from `@theme` tokens and are already dark-mode-correct. Do NOT reintroduce `purple-*`, `rose-*`, or raw hex — a residue-scan gate rejects them (allowlist: `globals.css`, `components/ui`, R3F material files, email templates, color-swatch data).
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
| `components/home/LifestyleGrid.tsx` | Masonry photo grid with motion animations |
| `components/home/PhotoStrip.tsx` | Infinite-scroll photo strip |
| `components/home/MagneticCTALink.tsx` | Spring-physics magnetic hover CTA |
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
