<!-- Generated: 2026-05-27 | Updated: 2026-06-14 | Pages: 37 | Components: 98 (79 app + 19 shadcn) | Token estimate: ~1100 -->

# Frontend (Next.js 16 / TypeScript)

All pages are `"use client"` (no RSC). API calls proxy through `/api/*` → server.

## Page Tree (37 routes + 2 API routes)

```
app/
├── page.tsx                          # / (landing, immersive-homepage)
├── login/page.tsx                    # /login
├── register/page.tsx                 # /register (6-step wizard)
├── forgot-password/page.tsx          # /forgot-password
├── reset-password/page.tsx           # /reset-password (Suspense)
├── reset/page.tsx                    # /reset (alternate entry)
├── verify-email/page.tsx             # /verify-email (Suspense)
├── status/page.tsx                   # /status (health check)
├── products/page.tsx                 # /products (Suspense + useSearchParams)
├── products/[id]/page.tsx            # /products/:id (with SizeSelector)
├── dashboard/page.tsx                # /dashboard (role-aware)
├── cart/page.tsx                     # /cart (size display)
├── checkout/page.tsx                 # /checkout (size in line items)
├── checkout/success/page.tsx         # /checkout/success
├── checkout/cancel/page.tsx          # /checkout/cancel
├── chat/page.tsx                     # /chat (AI stylist)
├── outfits/page.tsx                  # /outfits
├── outfits/new/page.tsx              # /outfits/new (manual outfit builder)
├── outfits/[id]/view/page.tsx        # /outfits/:id/view (3D viewer)
├── outfits/[id]/ar/page.tsx          # /outfits/:id/ar (AR try-on)
├── ar-visualization/page.tsx         # /ar-visualization (demo)
├── try-on/page.tsx                   # /try-on (hub)
├── looks/page.tsx                    # /looks (saved)
├── orders/page.tsx                   # /orders
├── orders/[id]/page.tsx              # /orders/:id
├── profile/body/page.tsx             # /profile/body (measurements)
├── profile/avatar/page.tsx           # /profile/avatar
├── profile/preferences/page.tsx      # /profile/preferences
├── profile/[username]/page.tsx       # /profile/:username (public)
├── community/page.tsx                # /community (feed + discovery)
├── style-lab/page.tsx                # /style-lab
├── design/page.tsx                   # /design (hub)
├── designer/products/page.tsx        # /designer/products (manage)
├── designer/products/new/page.tsx    # /designer/products/new
├── designer/products/[id]/edit/page.tsx # /designer/products/:id/edit
├── designer/studio/page.tsx          # /designer/studio
└── designer/promotions/page.tsx      # /designer/promotions
```

### Internal API Routes (2)
```
app/api/internal/mail/send/route.ts          # Resend email delivery (server→web internal)
app/api/internal/mail/password-reset/route.ts # Resend password reset template
```

## Component Hierarchy

### Layout & Navigation
NavBar, PageShell, Footer, theme-provider, theme-toggle

### Product & Catalog
ProductList, ProductListItem, ProductForm, SearchFilterBar (AbortController categories), ImageUploader, SizeSelector

### Chat & AI
ChatSidebar, ChatMessageBubble, TypingIndicator, SuggestionChips (XSS-safe chip buttons), floating-ai-stylist (persistent widget)

### 3D/AR (all `dynamic(…, {ssr: false})`)
AvatarViewer (R3F), ARViewer (WebXR), SmartARViewer, ModelViewer (model-viewer), DemoOutfitModel, FittingHelper, PoseSelector (pose strip + category filter), SkeletonContext (shared skeleton state)

### Generation & Rigging Status
GenerationStatusBadge, GenerationStatusCard, RiggingStatusBadge, RiggingStatusCard

### Outfit Builder (split-screen layout + 3D preview)
OutfitCard, OutfitSlotCard, OutfitSlotSidebarItem, OutfitBuilderPreview, OutfitDetailsForm, ProductPickerDialog, ProductSelectCard

### Registration Wizard (7 components)
WizardProgress, StepBasics, StepStylePrefs, StepColors, StepMeasurements, StepAvatar, StepComplete

### Community & Profile
PostDetailDialog, PostMedia (community/), ProfileHeader, ProfileStatsBar, ProfileActionBar, ProfileContentTabs, ProfilePostGrid, ProfileSettingsDialog, CreateFashionPostDialog, StyleCircleDialog, LocalImagePicker

### Home / Landing (17 components)
immersive-homepage, HeroSection, DesignersSection, HowItWorks, SustainabilitySection, CTASection, CommunitySection, LandingNav, LandingFooter, AIStylistSection, LifestyleGrid, MagneticCTALink, PhotoStrip, SocialProofSection, TrustBar, TryOnSection, TryOnViewer

### Designer
PromotionList, PromotionForm

### Other
ViewerErrorBoundary

### shadcn/ui (19 primitives, DO NOT EDIT)
button, card, input, label, select, badge, skeleton, tabs, dialog, checkbox, textarea, scroll-area, avatar, alert, separator, sheet, dropdown-menu, radio-group, sonner

## State Management

### React Context
```
AuthProvider (layout.tsx)
  └── CartProvider
        └── App routes
```

**AuthContext** — `useAuth()`: user, loading, login(), register(), updateProfile(), logout(), refreshUser()
  - Hydrates from `localStorage.iyae_token`, calls GET /api/auth/me
  - On 401: auto-clears token + redirects /login

**CartContext** — `useCart()`: serverItems, demoItems, totalCount, add/update/remove operations
  - Hybrid: server items (API) + demo items (negative IDs, localStorage)
  - Cart items include `selectedSize` field

### Client-Side Modules (localStorage, immutable updates)
- `community-feed.ts` — posts, likes, saves, reposts, comments, create/archive/restore (key: `iyae-community-state-{userId}`)
- `profile-surface.ts` — cross-tab profile sync via CustomEvent
- `social-graph.ts` — static demo social profiles
- `profile-options.ts` — constants for style/color/brand/fit/price options
- `profile-dashboard.ts` — profile tab filtering, stats, body measurement coverage
- `pose-config.ts` — POSE_PRESETS, POSE_CATEGORIES, getPoseById() for avatar pose system
- `outfit-slots.ts` — outfit slot configuration and constants
- `demo-looks.ts` — demo saved looks data
- `email-templates.ts` — email template utilities for Resend integration

## Custom Hooks (`lib/hooks/`)
- `useRequireAuth(role?)` — auth guard, redirects to /login or /dashboard
- `useRedirectIfAuthenticated()` — redirect authenticated users away from auth pages
- `useDebounce(value, delay)` — generic debounce (300ms default)
- `useARSupport()` — detects WebXR, AR Quick Look, Scene Viewer
- `useGenerationStatus(productId)` — polls 3D generation status
- `useAvatarStatus()` — polls avatar generation status
- `useCommunityState()` — community state management (load, save, CRUD, follow, archive)
- `useReveal()` — scroll-triggered reveal animations
- `useRiggingStatus()` — polls garment rigging task status
- `useOutfitRiggingStatus(items)` — polls rigging status for all items in an outfit
- `usePoseAnimation(skeletonRef)` — animates avatar skeleton to selected pose

## API Client (`lib/api.ts`)
```
request<T>(path, options) → auto JWT injection, AbortSignal, 401 redirect
api.get/post/put/delete<T>()
auth.register/login/me/updateProfile()
rigging.getStatus/trigger/retry()
```

## Middleware (`middleware.ts`)
CSP headers (env-aware script-src + wasm-unsafe-eval for Three.js Draco), X-Frame-Options: DENY, Permissions-Policy (camera on AR routes only)

## Static Assets (`public/`)
- `public/assets/images/products/placeholder.svg` — product image fallback
- `public/models/demo-outfit.glb` — demo 3D mannequin (436 bytes)

## Tests
- Vitest: 17 files, 227 cases (api, auth-context, cart-context w/ size, community-feed, profile-dashboard, profile-surface, middleware, useDebounce, useRequireAuth, useGenerationStatus, useRedirectIfAuthenticated, FittingHelper, SizeSelector, useOutfitRiggingStatus, pose-config, internal-mail-send, internal-mail)
- Playwright E2E: 8 specs, 60 tests (auth flows, registration wizard, pose selector, AI stylist, cart w/ size, checkout flow, community, designer CRUD)
