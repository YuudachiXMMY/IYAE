# Plan: Apply the FORME Figma Redesign to the IYAE Web Frontend

## Summary
Restructure the IYAE Next.js web frontend's page layouts and shared components to match the new **"FORME — Website Prototype"** Figma design (a minimalist editorial fashion aesthetic: pure white, ink `#171717`, burgundy `#8A0F2D`, Cormorant Garamond + DM Sans). The Figma design tokens (palette, fonts, radii) **already match the codebase's existing `globals.css` tokens exactly** — so this is a *structural / component* redesign, not a palette swap: build a small shared design-system layer (unified nav, capsule buttons, filter pills, product card, dark panels, split-auth layout) and rebuild the 8 key screens to the Figma layouts.

## User Story
As a Gen-Z / young-millennial shopper visiting IYAE, I want a cohesive, editorial, minimalist interface across landing, auth, onboarding, profile, shop, AI stylist, and community, so that the brand feels premium and intentional and I can move from "nothing to wear" to "I feel great about this look" without visual friction.

## Problem → Solution
**Current:** The app works but its screens were built ad-hoc against the tokens — two parallel nav systems (`NavBar` vs `LandingNav`), CTAs hand-roll `rounded-full` pills instead of using the `Button` primitive, nav links are mixed-case (not the Figma uppercase), the `Button` primitive ignores the `--radius-button` capsule token, product/community cards and the AI-stylist/profile screens don't match the Figma editorial layouts, and icon libraries + file naming are inconsistent.
**Desired:** One shared, Figma-faithful design-system layer drives all 8 screens; every CTA routes through a capsule `Button`; nav is a single unified 82 px editorial header; the 8 Figma frames are reproduced route-by-route with the existing tokens.

## Metadata
- **Complexity**: XL (recommend implementing phase-by-phase; ~25–35 files touched)
- **Source PRD**: N/A (free-form design-application request)
- **PRD Phase**: N/A
- **Figma file**: `NpF8Onx7ztx9iCeAJ3nZKQ` — "FORME — Website Prototype" (page `0:1`)
- **Estimated Files**: ~30 (≈6 new shared components + 8 screen rebuilds + token/primitive tweaks)
- **Builds on**: `completed/design-system-and-core-reskin.plan.md` (already landed the tokens that match this Figma)

---

## CRITICAL GLOBAL RULES (read before any task)

1. **Brand text is IYAE, not "FORME".** The Figma frames render the wordmark as **"FORME"** (placeholder) — the landing frame already correctly uses **"IYAE"** (node `52:10`). The codebase centralizes the wordmark in `web/lib/brand.ts` → `BRAND.name = "IYAE"`. **Every place Figma shows "FORME", render `{BRAND.name}`.** Never hardcode "FORME" or "IYAE".
2. **Reuse existing tokens — do NOT introduce raw hex.** The palette/fonts/radii in `web/app/globals.css` already match Figma 1:1 (see token table below). Use semantic Tailwind utilities (`bg-background`, `text-foreground`, `bg-brand`/`text-brand`, `border-border`, `bg-primary`, `text-muted-foreground`, `rounded-chip`, `rounded-button`, `font-display`). A CLAUDE.md residue-scan gate rejects `purple-*`/`rose-*`/`stone-*`/raw hex outside the allowlist (`globals.css`, `components/ui`, R3F/email/swatch files).
3. **Tailwind v4, CSS-first.** There is **no `tailwind.config.*`**. Tokens live in `@theme inline` in `globals.css`. Add new tokens there if truly needed (prefer reuse).
4. **All pages/components are `"use client"`.** No RSC. Start every new component file with `"use client"`.
5. **Pull exact Figma context per screen at implementation time.** This plan captures the design system + layout intent; when implementing a given screen, call `get_design_context` on its node id (map below) to get exact spacing/copy. Load the `/figma-design-to-code` skill first (mandatory before `get_design_context`).
6. **Do not paste Figma's absolute-positioned Tailwind verbatim.** Figma returns `absolute left-[..] top-[..]` reference code — convert to responsive flex/grid layouts using the project's conventions.
7. **Icons:** the codebase mixes `@phosphor-icons/react` (17 files) and `lucide-react` (23 files). Figma uses simple glyphs (⌕ search, ♡ heart, ↗ share). Prefer **`lucide-react`** (`Search`, `Heart`, `ArrowUpRight`, `ChevronDown`) for new redesign work for consistency; do not add a third library.

---

## Figma Screen → Route Map (node ids for `get_design_context`, file `NpF8Onx7ztx9iCeAJ3nZKQ`)

| # | Figma frame | node id | Target route / file | Notes |
|---|---|---|---|---|
| 01 | Landing (IYAE Reveal + About IYAE) | `2:13` (viewports `52:3`, `52:14`) | `/` → `app/page.tsx` → `components/home/ImmersiveHomepage` | Full editorial landing; replaces current immersive homepage sections |
| 02 | Sign In | `2:53` | `/login` → `app/login/page.tsx` | Split layout: dark editorial left panel + white form right |
| 03 | Create Account | `2:78` | `/register` → step 1 (`StepBasics`) + `WizardProgress` | 3-step progress header (Account / Style Profile / Measurements) |
| 04 | Style Onboarding | `2:110` | `/register` → style-prefs step (`StepStylePrefs`) | Style tag pills + 4 moodboard tiles + silhouette pills |
| 05 | Personal Profile | `2:156` | `/dashboard` (buyer view) → `profile/*` | Dark 250px sidebar + profile card + style-note dark panel + saved grid |
| 06 | Shopping | `2:222` | `/products` → `app/products/page.tsx` | Filter pills + 4-col product grid + "recommended because…" + Load More |
| 07 | AI Stylist + Virtual Fitting | `2:279` | `/chat` (+ fitting room block) | Left occasion form + right dark fitting-room panel with garment swatches |
| 08 | Community | `2:326` | `/community` → `app/community/page.tsx` | Filter tabs + 3-col feed cards (avatar, image, engagement, caption) |

Optional intro frame `35:2` ("IYAE INTRO — optional") is empty — skip.

---

## The Figma Design System (captured — this is the source of truth)

### Palette (already in `globals.css` — REUSE, do not redefine)
| Figma value | Meaning | Existing token | Utility |
|---|---|---|---|
| `#FFFFFF` | page background | `--color-background` | `bg-background` |
| `#171717` | ink text / filled buttons / dark panels | `--color-foreground` | `text-foreground`, and `bg-foreground` for dark panels/pills |
| `#8A0F2D` | burgundy accent | `--color-brand` / `--color-primary` | `bg-brand`, `text-brand`, `bg-primary` |
| `rgba(23,23,23,0.18)` | borders / dividers | `--color-border` | `border-border` |
| `rgba(23,23,23,0.16)` | header/section hairline | ~`--color-border` | `border-border` (0.16≈0.18, acceptable) |
| `rgba(23,23,23,0.62)` | muted text | `--color-muted-foreground` is `#6f6f6f` (≈0.56 ink) | `text-muted-foreground` |
| `rgba(138,15,45,0.1 / .25 / .48 / .7)` | product/abstract image placeholders | — | inline `bg-[color-mix(in_srgb,var(--color-brand)_10%,transparent)]` via the `AbstractForm` component |

### Typography (already loaded via `next/font` in `app/layout.tsx` — REUSE)
- **Display / editorial headlines + wordmark** → **Cormorant Garamond** = `--font-display`. Apply with `font-display`. Figma sizes: header wordmark 29 px SemiBold; section headlines 48 px Medium (`h1`/`h2` already default to `font-display`).
- **Body / UI / nav / labels / buttons / prices** → **DM Sans** = `--font-body` (global `body` default; `letter-spacing: 0.01em`). Figma nav/labels: 11–12 px, **UPPERCASE**, `tracking-[0.12px]`, `font-medium`/`font-semibold`.
- **Landing hero "IYAE"** (node `52:10`): Figma reference reports `Inter Medium 112px`, but the project does not load Inter and the persistent wordmark is Cormorant. **Decision: render the hero wordmark with `font-display` (Cormorant) at ~`text-[112px]`/responsive, letter-spaced, `text-brand`.** (Documented deviation — keeps one type system; if a pixel-exact Inter match is later required, add Inter via `next/font` and a `--font-hero` token.)

### Radii (already in `globals.css` — REUSE)
- Filter/choice pills 34 px tall, `rounded-[17px]` → `--radius-chip` (17px) → `rounded-chip`.
- Buttons 48 px `rounded-[24px]` capsule → `--radius-button` (24px) → `rounded-button` (or `rounded-full`).
- Product card `rounded-[2px]` (near-square) → Figma-specific; use `rounded-[2px]` inline (do NOT use `rounded-card`=12px here). Feed cards use larger radius.

### Reusable components implied by the design (build these in Phase 1)
1. **`SiteHeader`** (unified 82 px nav) — white bg, 1 px bottom `border-border`. Left: wordmark `{BRAND.name}` `font-display text-[29px] font-semibold` → links to `/`. Center: uppercase DM Sans links (`SHOP`→/products, `AI STYLIST`→/chat, `VIRTUAL FITTING`→/try-on, `COMMUNITY`→/community), active = `text-brand`. Right cluster: `Search` (⌕ ~24px), `Heart` (♡), `BAG (n)` (DM Sans 11px, cart count), and when authed a burgundy avatar chip (`bg-brand size-[34px] rounded-full` + initial in white). Landing variant (`52:3`) differs: left nav = SHOP/DISCOVER/VIRTUAL FIT, right = ACCOUNT + BAG, **no wordmark** (hero IS the wordmark).
2. **`FilterPill`** — `rounded-chip` 34px; active `bg-foreground text-background`; inactive `bg-background border border-border text-muted-foreground`. Used in Shop filters, onboarding style/silhouette tags, community tabs, profile style tags.
3. **`ProductCard`** — 276×360 ratio, `rounded-[2px]`, burgundy-tint placeholder image area, `Heart` top-right, title `font-body font-medium text-[15px]`, price `text-[13px] text-muted-foreground`.
4. **`SectionKicker`** — `font-body font-semibold text-[12px] uppercase tracking-[0.12px] text-brand`.
5. **`EditorialHeading`** — `font-display text-[48px]` (responsive) `text-foreground`.
6. **`DarkPanel`** — `bg-foreground text-background rounded-[…]` container (profile sidebar, AI fitting room, style-note card, sign-in left panel).
7. **`UnderlineField`** — label above (DM Sans 12–14px) + input styled as bottom-border-only (`border-0 border-b border-foreground bg-transparent rounded-none px-0`), no box. Used in login, register, AI-stylist form.
8. **`AbstractForm`** — decorative rounded blob/pill in burgundy tints (`bg-[color-mix(...)]`), the pervasive placeholder motif replacing photography (sign-in blobs, product/feed image placeholders, fitting-room silhouette).
9. **Button primitive upgrade** — add capsule variants so CTAs stop hand-rolling pills (see Patterns to Mirror).

---

## UX Design

### Before
```
┌───────────────────────────────────────────────┐
│ Two headers (NavBar / LandingNav), mixed-case  │
│ nav, hand-rolled pill CTAs, immersive homepage │
│ with gradient hero, ad-hoc product/community   │
│ cards. Tokens correct but layouts not editorial│
└───────────────────────────────────────────────┘
```
### After
```
┌───────────────────────────────────────────────┐
│ One 82px editorial header · UPPERCASE nav ·    │
│ wordmark IYAE. Landing = full-bleed "IYAE"     │
│ reveal + About/pillars. Capsule Button system. │
│ Shop/Community/Profile/AI-Stylist rebuilt to   │
│ Figma: filter pills, product/feed cards, dark  │
│ panels, underline forms, abstract-form motifs. │
└───────────────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Global nav | 2 systems, mixed-case, backdrop-blur | 1 `SiteHeader`, uppercase, 82px, hairline divider | Reconcile `NavBar`+`LandingNav` |
| CTAs | hand-rolled `rounded-full` pills | `Button` capsule variants (`brand-pill` filled ink / `outline-pill`) | Route all CTAs through primitive |
| Landing hero | gradient immersive hero | minimalist full-bleed "IYAE" wordmark + scroll cue | node `52:3` |
| Auth | shadcn Card form | split dark-panel + underline form | nodes `2:53`, `2:78` |
| Shop filters | `SearchFilterBar` | `FilterPill` row + underline search | node `2:222` |
| Product card | ad-hoc | `ProductCard` 276×360 editorial | node `2:222` |
| Community | lucide feed | `FilterPill` tabs + feed cards w/ engagement row | node `2:326` |
| Profile | dashboard | dark 250px sidebar + style-note dark panel | node `2:156` |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `web/app/globals.css` | 1–211 | All tokens, `@theme inline`, `.dark`, radii, animations, base font layer. Everything you style with lives here. |
| P0 | `web/lib/brand.ts` | 1–22 | `BRAND.name` — the wordmark. Never hardcode "FORME". |
| P0 | `web/components/ui/button.tsx` | 1–57 | `cva` variants to extend with capsule/pill variants. |
| P0 | `web/app/layout.tsx` | 1–55 | Font wiring (`--font-cormorant`, `--font-dm-sans`), provider nesting, where a global header would mount. |
| P0 | `web/components/NavBar.tsx` | 1–413 | App-shell header + profile dropdown logic to fold into `SiteHeader`. |
| P0 | `web/components/home/LandingNav.tsx` | 1–352 | Marketing header (fixed, blur, anchor nav) — the other nav to reconcile. |
| P1 | `web/components/home/HeroSection.tsx` | 1–159 | Pattern for full-viewport hero, inline gradient vars, motion + `useReducedMotion`, uppercase tracked subhead. |
| P1 | `web/components/home/immersive-homepage.tsx` | all | Current landing composition being replaced/restructured. |
| P1 | `web/app/login/page.tsx` | all | Current auth form to restyle to split layout. |
| P1 | `web/app/register/page.tsx` + `web/components/register/*` | all | Wizard + `WizardProgress`, `StepBasics`, `StepStylePrefs` for screens 03/04. |
| P1 | `web/app/products/page.tsx` + `web/components/SearchFilterBar.tsx` + `ProductList`/product card | all | Shop rebuild (screen 06). |
| P1 | `web/app/community/page.tsx` | all | Community rebuild (screen 08); note it uses lucide. |
| P1 | `web/app/dashboard/page.tsx` + `web/components/profile/*` | all | Profile rebuild (screen 05). |
| P1 | `web/app/chat/page.tsx` + `web/components/ChatSidebar`,`SuggestionChips` | all | AI-stylist rebuild (screen 07). |
| P2 | `web/components/OutfitCard.tsx` | all | Representative app-component conventions (named export, dynamic import, typed props). |
| P2 | `web/components/PageShell.tsx` | 1–15 | Standard content wrapper (`max-w-7xl` gutters). |
| P2 | `web/components.json` | all | shadcn config (new-york, rsc:false, aliases). |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Figma design-to-code workflow | `/figma-design-to-code` skill (load before `get_design_context`) | Treat Figma output as reference; adapt to project stack/tokens; reuse existing components. |
| Figma MCP `get_design_context` | tool description | Extract exact per-screen spacing/copy at impl time via node ids in the map above. |
| Tailwind v4 CSS-first tokens | Context7 `tailwindcss` (if needed) | `@theme inline` defines tokens as CSS vars → utilities; no JS config. |
| `next/font/google` | already wired in `layout.tsx` | Add a font (only if pixel-exact Inter hero is required) via `variable` + html class. |

---

## Patterns to Mirror

### NAMING_CONVENTION
```tsx
// SOURCE: web/components/OutfitCard.tsx:1,23-29  (app component)
"use client";
interface OutfitCardProps { /* typed props */ }
export function OutfitCard({ ... }: OutfitCardProps) { ... }   // named export, PascalCase file
// SOURCE: web/app/login/page.tsx  (route)
export default function LoginPage() { ... }                    // default export for pages
```
New shared design-system components → PascalCase file + named export (e.g. `components/design-system/FilterPill.tsx` → `export function FilterPill`).

### DESIGN_TOKENS (already match Figma — reuse)
```css
/* SOURCE: web/app/globals.css:9-54 */
--color-background:#ffffff; --color-foreground:#171717;
--color-brand:#8a0f2d; --color-primary:#8a0f2d; --color-border:rgba(23,23,23,0.18);
--font-display: var(--font-cormorant), serif;  --font-body: var(--font-dm-sans), sans-serif;
--radius-chip:17px; --radius-button:24px; --radius-card:12px;
/* h1-h6 already default to font-display (globals.css:178-181); body → font-body */
```

### BUTTON_VARIANTS (extend — this is the key primitive change)
```tsx
// SOURCE: web/components/ui/button.tsx:11-33  (cva)
// EXISTING variants: default/destructive/outline/secondary/ghost/link ; sizes default/sm/lg/icon
// ADD Figma capsule variants + a pill size:
variant: {
  // ...existing...
  "brand-pill": "bg-foreground text-background rounded-button hover:bg-foreground/90 uppercase tracking-[0.12px] font-semibold",
  "outline-pill": "bg-background text-foreground border border-border rounded-button hover:bg-muted uppercase tracking-[0.12px] font-semibold",
},
size: {
  // ...existing...
  pill: "h-12 px-6 rounded-button text-[13px]",   // 48px tall Figma CTA
}
// GOTCHA: base has rounded-md; capsule variants override with rounded-button. Keep cn() merge order.
```
Then replace hand-rolled pills (`HeroSection.tsx:126-136`, `LandingNav.tsx:274-279`) and all screen CTAs (SIGN IN, CONTINUE, BUILD MY PROFILE, CREATE MY EDIT, SHARE A LOOK, TRY ON, SAVE LOOK, LOAD MORE, EDIT PROFILE) with `<Button variant="brand-pill" size="pill">` / `<Button variant="outline-pill" size="pill">`.

### FULL_BLEED_HERO (mirror for landing)
```tsx
// SOURCE: web/components/home/HeroSection.tsx:7-22,28,106-120
import { motion, useReducedMotion } from "motion/react";
// full-viewport section min-h-[100dvh]; motion stagger/fadeUp variants gated by useReducedMotion();
// uppercase tracked-wide subhead already demonstrated at :114-120 → reuse for "PERSONAL STYLE · INTELLIGENT FIT · CURATED SHOPPING"
```
Landing already has `--animate-landing-fade-up` / `landingFloat` keyframes (`globals.css:77-166`) — use for the IYAE reveal + scroll cue.

### SEMANTIC_COLOR_USAGE
```tsx
// SOURCE: NavBar active link  web/components/NavBar.tsx:56
"font-medium text-brand"          // active nav = burgundy
// dark panel: bg-foreground text-background  (ink panel, white text)
// muted: text-muted-foreground ; hairline: border-b border-border
```

### WORDMARK (never hardcode)
```tsx
// SOURCE: web/components/NavBar.tsx:127-132 / LandingNav.tsx:150-155
import { BRAND } from "@/lib/brand";
<Link href="/" className="font-display text-2xl font-semibold">{BRAND.name}</Link>
```

### CLIENT_COMPONENT + DYNAMIC 3D
```tsx
// SOURCE: web/components/OutfitCard.tsx:1,14-21
"use client";
const AvatarViewer = dynamic(() => import("./AvatarViewer"), { ssr: false, loading: () => <Spinner/> });
// Keep the fitting-room 3D/try-on viewers lazy + ssr:false when rebuilding screen 07.
```

### TEST_STRUCTURE
```tsx
// SOURCE: web/__tests__/components/SizeSelector.test.tsx (Vitest + Testing Library + jsdom)
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
// render component, assert roles/text/aria-pressed; new shared DS components (FilterPill, ProductCard, Button pills) get a sibling test file under web/__tests__/components/.
```

---

## Files to Change

### New (Phase 1 — shared design system)
| File | Action | Justification |
|---|---|---|
| `web/components/design-system/SiteHeader.tsx` | CREATE | Unified 82px editorial nav (+ optional `variant="landing"`) |
| `web/components/design-system/FilterPill.tsx` | CREATE | Shop/community/onboarding/profile pills |
| `web/components/design-system/ProductCard.tsx` | CREATE | Editorial 276×360 product card |
| `web/components/design-system/SectionKicker.tsx` | CREATE | Uppercase burgundy kicker |
| `web/components/design-system/EditorialHeading.tsx` | CREATE | Cormorant 48px headline |
| `web/components/design-system/DarkPanel.tsx` | CREATE | Ink panel w/ white text |
| `web/components/design-system/UnderlineField.tsx` | CREATE | Underline-only form field |
| `web/components/design-system/AbstractForm.tsx` | CREATE | Burgundy-tint decorative blob/placeholder |
| `web/__tests__/components/FilterPill.test.tsx` | CREATE | Active/inactive state + aria-pressed |
| `web/__tests__/components/ProductCard.test.tsx` | CREATE | Renders title/price/heart |
| `web/__tests__/components/button.test.tsx` | CREATE/UPDATE | New capsule variants render correct classes |

### Update
| File | Action | Justification |
|---|---|---|
| `web/components/ui/button.tsx` | UPDATE | Add `brand-pill`/`outline-pill` variants + `pill` size |
| `web/app/globals.css` | UPDATE (minimal) | Only if a tint helper/token is genuinely needed; otherwise no change |
| `web/app/layout.tsx` | UPDATE (maybe) | If mounting a global `SiteHeader` here instead of per-page |
| `web/components/NavBar.tsx` | UPDATE/REPLACE | Fold into `SiteHeader` (keep profile-dropdown logic) |
| `web/components/home/LandingNav.tsx` | UPDATE/REPLACE | Reconcile with `SiteHeader` landing variant |
| `web/components/home/immersive-homepage.tsx` + `home/HeroSection.tsx` | UPDATE | Rebuild landing to `52:3`+`52:14` (IYAE reveal + About/pillars/commerce banner) |
| `web/app/login/page.tsx` | UPDATE | Split dark-panel + underline form (`2:53`) |
| `web/app/register/page.tsx` + `components/register/WizardProgress.tsx`,`StepBasics.tsx`,`StepStylePrefs.tsx` | UPDATE | 3-step progress header + create-account (`2:78`) + style onboarding (`2:110`) |
| `web/app/products/page.tsx` + `components/SearchFilterBar.tsx` + product card usage | UPDATE | Shop grid + filter pills + underline search (`2:222`) |
| `web/app/community/page.tsx` | UPDATE | Feed cards + filter tabs + engagement row (`2:326`); prefer lucide already present |
| `web/app/dashboard/page.tsx` + `components/profile/*` | UPDATE | Dark sidebar + profile card + style-note panel + saved grid (`2:156`) |
| `web/app/chat/page.tsx` + fitting-room block | UPDATE | Occasion form + dark fitting-room panel w/ garment swatches (`2:279`) |

## NOT Building
- **No backend/API/schema/worker changes.** Purely web presentation. Do not touch `server/`, `worker/`, migrations, or `web/lib/api.ts` contracts.
- **No new palette/tokens** beyond an optional tint helper — tokens already match Figma.
- **No dark-mode redesign.** The Figma is light-only ("White Burgundy Ink"). Keep existing `.dark` overrides working (don't regress them); do not design new dark screens.
- **No functional/behavioral changes** (auth, cart, checkout, chat protocol, follow/like logic stay as-is — only their presentation changes).
- **No real photography.** Reproduce the Figma's abstract-form placeholders; wire real images only where the app already has them (`next/image` + existing data).
- **No Inter font** unless a pixel-exact hero is explicitly requested later.
- **No third icon library.** Consolidating phosphor↔lucide fully is out of scope; only use one (prefer lucide) within new redesign code.
- **No E2E rewrite** — keep existing Playwright specs green; update selectors only where markup changes break them.

---

## Step-by-Step Tasks

> Implement in phase order. Each screen task begins by loading `/figma-design-to-code` then calling `get_design_context` on the node id to pull exact copy/spacing. Run `npm run lint` + `npm run test` + `npx tsc --noEmit` after each phase.

### Phase 1 — Design-system foundation

#### Task 1.1: Extend the Button primitive with capsule variants
- **ACTION**: Add `brand-pill` + `outline-pill` variants and a `pill` size to `buttonVariants`.
- **IMPLEMENT**: See BUTTON_VARIANTS pattern. Keep `cva` structure, `forwardRef`, `asChild`, named exports `{ Button, buttonVariants }`.
- **MIRROR**: `web/components/ui/button.tsx:11-33`.
- **IMPORTS**: none new.
- **GOTCHA**: base class has `rounded-md`; capsule variants must override with `rounded-button`; verify `cn()` merge keeps the override (Tailwind-merge dedupes radius — put variant class after base).
- **VALIDATE**: `web/__tests__/components/button.test.tsx` asserts `<Button variant="brand-pill">` renders `bg-foreground` + `rounded-button`; `npx tsc --noEmit`.

#### Task 1.2: Build primitive DS components
- **ACTION**: Create `SectionKicker`, `EditorialHeading`, `FilterPill`, `DarkPanel`, `UnderlineField`, `AbstractForm`, `ProductCard` under `web/components/design-system/`.
- **IMPLEMENT**: Each `"use client"`, named export, typed props, semantic tokens only. `FilterPill` takes `active`/`onClick`/`children` → active `bg-foreground text-background`, else `bg-background border border-border text-muted-foreground`, `rounded-chip h-[34px] px-4 text-[12px] font-medium`, `aria-pressed={active}`. `ProductCard` takes `{name, price, imageUrl?, href, onToggleSave?, saved?}` → `rounded-[2px]`, image area with `AbstractForm` fallback, `Heart` top-right, title `font-body font-medium text-[15px]`, price `text-[13px] text-muted-foreground`. `AbstractForm` renders a rounded blob via `bg-[color-mix(in_srgb,var(--color-brand)_var(--tint),transparent)]` (prop `tint` default 10%).
- **MIRROR**: OutfitCard conventions; NavBar semantic-color usage.
- **IMPORTS**: `import { cn } from "@/lib/utils"`; `import { Heart } from "lucide-react"`; `import Link from "next/link"`; `import Image from "next/image"` (ProductCard).
- **GOTCHA**: no raw `stone-*`/hex (residue gate). Icons square-sized with explicit w/h. `color-mix` needs a modern-browser target — fine for this app.
- **VALIDATE**: `FilterPill.test.tsx` + `ProductCard.test.tsx` pass; render in isolation.

#### Task 1.3: Build the unified `SiteHeader`
- **ACTION**: Create `web/components/design-system/SiteHeader.tsx` consolidating `NavBar` + `LandingNav`. Support `variant="app" | "landing"`.
- **IMPLEMENT**: 82px (`h-[82px]`) white, `border-b border-border`. Wordmark `{BRAND.name}` `font-display text-[29px] font-semibold` → `/`. Center nav: `SHOP`→/products, `AI STYLIST`→/chat, `VIRTUAL FITTING`→/try-on, `COMMUNITY`→/community; `font-body font-medium text-[12px] uppercase tracking-[0.12px]`, active = `text-brand` (usePathname). Right: `Search`, `Heart`, `BAG (n)` (cart count from `CartContext`), authed → avatar chip `bg-brand size-[34px] rounded-full` + initial (keep the existing profile `DropdownMenu` from `NavBar.tsx` for menu items). Landing variant: left = SHOP/DISCOVER/VIRTUAL FIT, right = ACCOUNT + BAG, hide wordmark. Preserve mobile `Sheet` hamburger + `SkipLink` behavior.
- **MIRROR**: `NavBar.tsx` (dropdown, cart, mobile sheet, active-link) + `LandingNav.tsx` (scroll behavior). Wordmark pattern.
- **IMPORTS**: `usePathname` from `next/navigation`; `BRAND`; `useCart`/`useAuth` contexts; lucide icons; existing `DropdownMenu`, `Sheet` from `components/ui`.
- **GOTCHA**: Two nav paradigms today — migrate call sites incrementally (Task 1.4). Keep `id="main-content"` skip target intact. Don't break `ThemeToggle` (Figma is light-only but dark mode must keep working).
- **VALIDATE**: mount on one app page + landing; nav links resolve; active state correct; cart count shows; `npm run test` (existing NavBar-dependent tests still pass or are updated).

#### Task 1.4: Swap headers app-wide
- **ACTION**: Replace `<NavBar/>` / `<LandingNav/>` usages with `<SiteHeader/>` (correct variant). Delete/deprecate old files once no imports remain.
- **VALIDATE**: `grep -r "NavBar\|LandingNav" web/app web/components` → only `SiteHeader` internals; app builds.

### Phase 2 — Landing (screen 01, node `2:13`)
#### Task 2.1: Rebuild landing
- **ACTION**: Rebuild `app/page.tsx`→`immersive-homepage.tsx` to the two viewports: (a) `52:3` IYAE reveal — full-bleed, centered `{BRAND.name}` `font-display ~text-[112px] text-brand`, uppercase tracked subhead "PERSONAL STYLE · INTELLIGENT FIT · CURATED SHOPPING", "SCROLL TO DISCOVER" cue + burgundy scroll accent; (b) `52:14` About IYAE — kicker + editorial title + copy + `brand-pill` "Shop IYAE" CTA + 3 numbered pillars w/ dividers + commerce banner with `AbstractForm` shapes.
- **MIRROR**: HeroSection full-viewport + motion + `useReducedMotion`; landing keyframes in `globals.css`.
- **GOTCHA**: hero wordmark font decision (Cormorant, documented). Keep motion reduced-motion-safe.
- **VALIDATE**: browser at `/` matches Figma; CLS sane; existing landing tests updated.

### Phase 3 — Auth (screens 02–04)
#### Task 3.1: Sign In (`2:53`) — `app/login/page.tsx`
- **ACTION**: Split layout — left `DarkPanel` with Cormorant "Come back to your form." + subcopy + `AbstractForm` blobs; right white form: `SectionKicker` "SIGN IN", `EditorialHeading` "Welcome back.", `UnderlineField` email/password, "Forgot password?" (burgundy link → /forgot-password), `Button brand-pill` "SIGN IN", divider "or continue with", `outline-pill` GOOGLE/APPLE, "New to {BRAND.name}? Create an account" link.
- **MIRROR**: existing login form logic (keep `useRedirectIfAuthenticated`, submit handler, api call) — only restyle.
- **GOTCHA**: keep form validation + auth behavior unchanged; Google/Apple buttons are visual only unless OAuth already wired (it is not — render as styled placeholders or hide if no handler; do not fake auth).
- **VALIDATE**: login still authenticates; `e2e/auth.spec.ts` selectors updated if needed.

#### Task 3.2: Create Account (`2:78`) — `register` step 1 + `WizardProgress`
- **ACTION**: Restyle `WizardProgress` to the "01 ── ACCOUNT · 02 STYLE PROFILE · 03 MEASUREMENTS" numbered header (active = burgundy number + line). Restyle `StepBasics`: `EditorialHeading` "Create your account.", `UnderlineField` first/last/email/password, checkbox "I agree to {BRAND.name}'s Terms and Privacy Policy.", `brand-pill` CONTINUE, right-side `AbstractForm` panel + "MADE TO FIT REAL LIVES." Cormorant caption.
- **GOTCHA**: existing wizard has 6 steps (Basics/StylePrefs/Colors/Measurements/Avatar/Complete); Figma shows 3 progress labels. Map: collapse the progress display to the 3 Figma labels (Account→Basics, Style Profile→StylePrefs+Colors, Measurements→Measurements) without deleting existing steps/data. Keep all registration fields/logic.
- **VALIDATE**: `e2e/register-wizard.spec.ts` passes (update selectors); full registration flow works.

#### Task 3.3: Style Onboarding (`2:110`) — `StepStylePrefs`
- **ACTION**: `SectionKicker` "STYLE PROFILE", `EditorialHeading` "What feels most like you?", multi-select `FilterPill` style tags (Minimal/Romantic/Street/Vintage/Tailored/Experimental), 4 moodboard tiles (`AbstractForm` tints + labels QUIET LUXURY/OFF-DUTY/AFTER DARK/ART SCHOOL), "Your preferred silhouettes" + `FilterPill` (Fitted/Relaxed/Oversized/Structured), `brand-pill` "BUILD MY PROFILE", "2 of 3" progress.
- **MIRROR**: FilterPill multi-select; existing StylePrefs state/persistence.
- **VALIDATE**: selections persist into registration payload as before; `e2e` pose/register specs green.

### Phase 4 — Shop (screen 06, node `2:222`) — `app/products/page.tsx`
#### Task 4.1: Rebuild shop
- **ACTION**: `SectionKicker` "SHOP" + `EditorialHeading` "Pieces, considered for you." + right underline search "Search designers, pieces, colours…". `FilterPill` row (For You/New In/Local Designers/Clothing/Accessories) + "N pieces" + "SORT: RELEVANCE⌄". 4-col `ProductCard` grid (real products via existing `ProductList` data), "Recommended because you liked structured silhouettes" burgundy line, hairline divider, `outline-pill` LOAD MORE.
- **MIRROR**: existing `products/page.tsx` Suspense + data fetching + pagination; `SearchFilterBar` filter state → re-skin with `FilterPill`.
- **GOTCHA**: keep `SizeSelector`/`RecommendedSizeHint` on PDP untouched; this task is the listing page. Preserve `localOnly`/"Local Designers" filter wiring.
- **VALIDATE**: products load, filters/sort/pagination work; `e2e/*` product specs green.

### Phase 5 — Community (screen 08, node `2:326`) — `app/community/page.tsx`
#### Task 5.1: Rebuild community feed
- **ACTION**: `SectionKicker` "COMMUNITY" + `EditorialHeading` "Style, in real life." + `brand-pill` "SHARE A LOOK". `FilterPill` tabs (Following/Discover/Toronto/Occasion/Body confidence). 3-col feed cards: light burgundy-tint bg, avatar chip + name + location, image w/ white rounded frame (`AbstractForm` placeholder), engagement row (`Heart` 128 · comment 24 · `ArrowUpRight` share), caption. Footer note "{BRAND.name} is a judgment-free space. Celebrate style; never bodies."
- **MIRROR**: existing `community-feed.ts` data + like/save/repost/follow handlers — re-skin only.
- **GOTCHA**: page already uses lucide — keep it. Preserve tab-filtering logic.
- **VALIDATE**: `e2e/community.spec.ts` green; like/comment/share still fire.

### Phase 6 — Profile (screen 05, node `2:156`) — `app/dashboard/page.tsx` (buyer view)
#### Task 6.1: Rebuild buyer profile
- **ACTION**: `DarkPanel` 250px left sidebar (user name + "Style profile · N% complete" + nav Overview/My Profile/Saved Pieces/Orders/Measurements + divider + Settings/Sign out, active row = `bg-brand`). Main: `SectionKicker` "MY {BRAND.name}", `EditorialHeading` "A profile that evolves with you." + `outline-pill` EDIT PROFILE, profile card (avatar chip, name, "Toronto · Member since …", style `FilterPill`s, STYLE PROFILE progress bar w/ burgundy fill), `DarkPanel` "THIS WEEK'S STYLE NOTE" card, "Saved for you" `ProductCard` grid.
- **MIRROR**: existing `profile/*` components + dashboard role gating (buyer vs designer) — only buyer view is redesigned here; keep designer studio path working.
- **GOTCHA**: dashboard is role-aware; don't break the designer branch. Real data from profile hooks.
- **VALIDATE**: dashboard loads for buyer; sidebar nav routes; `__tests__/lib/profile-dashboard.test.ts` still green.

### Phase 7 — AI Stylist + Virtual Fitting (screen 07, node `2:279`) — `app/chat/page.tsx`
#### Task 7.1: Rebuild AI stylist + fitting room
- **ACTION**: Left: `SectionKicker` "AI STYLIST" + `EditorialHeading` "Dress for the feeling." + subcopy + card "WHAT'S THE OCCASION?" with `UnderlineField`s (Occasion/Mood/Weather) + `brand-pill` "CREATE MY EDIT". Right: `DarkPanel` "VIRTUAL FITTING ROOM" — "Look 01" Cormorant white, avatar silhouette (`AbstractForm` / lazy 3D viewer), garment swatch cards (BLAZER "Soft Tailoring", TROUSER "Fluid Wide Leg"), `outline-pill` TRY ON + SAVE LOOK, privacy note.
- **MIRROR**: existing chat logic (`ChatService` `[GENERATE_OUTFIT]` protocol, `SuggestionChips`, `useOutfitRiggingStatus`) — restyle; keep lazy `ssr:false` for any 3D viewer (OutfitCard pattern).
- **GOTCHA**: Figma merges "AI Stylist" + "Virtual Fitting" onto one screen; the app splits chat (`/chat`) and try-on (`/try-on`). Implement the Figma composite on `/chat` while keeping `/try-on` functional; wire "TRY ON" to existing try-on flow. Preserve weather context + chat streaming behavior.
- **VALIDATE**: `e2e/ai-stylist.spec.ts` green; suggestion chips + outfit generation still work.

### Phase 8 — Polish & consistency sweep
#### Task 8.1: CTA + nav audit
- **ACTION**: grep for remaining hand-rolled `rounded-full` pill CTAs and mixed-case nav; route through `Button` capsule variants + uppercase nav. Confirm every "FORME" literal is gone (`grep -rn "FORME" web/` → only Figma-doc references, none in JSX).
- **VALIDATE**: `grep -rn "FORME" web/app web/components` returns nothing; visual pass across all 8 routes; `npm run test` + `npx tsc --noEmit` + `npm run lint` clean.

---

## Testing Strategy

### Unit Tests (Vitest + Testing Library)
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `button.test.tsx` | `<Button variant="brand-pill" size="pill">GO` | classes include `bg-foreground`, `rounded-button`, `uppercase`, `h-12` | no |
| `FilterPill.test.tsx` | `active={true}` | `bg-foreground text-background`, `aria-pressed="true"` | active vs inactive |
| `FilterPill.test.tsx` | `active={false}` | `border-border text-muted-foreground`, `aria-pressed="false"` | yes |
| `ProductCard.test.tsx` | `{name:"Draped Wool Coat", price:"$420"}` | renders name + price + heart button | missing imageUrl → AbstractForm fallback |
| `SiteHeader` (RTL) | authed user, pathname `/products` | SHOP link `text-brand`, avatar chip visible, BAG count | unauth → ACCOUNT/no chip |
| `SiteHeader` | `variant="landing"` | no wordmark; SHOP/DISCOVER/VIRTUAL FIT + ACCOUNT/BAG | landing vs app |

### Edge Cases Checklist
- [ ] Empty cart → `BAG (0)`; non-empty → correct count.
- [ ] Unauthenticated header (no avatar chip; ACCOUNT link).
- [ ] Long product/user names truncate gracefully in cards.
- [ ] `prefers-reduced-motion` → landing animations disabled (reuse `useReducedMotion`).
- [ ] Dark mode still renders (light-only design but `.dark` must not crash/regress).
- [ ] Mobile: `SiteHeader` collapses to `Sheet`; grids reflow (Figma is 1440px desktop — define responsive breakpoints).
- [ ] Multi-select pills (onboarding) toggle independently; single-select (shop/community tabs) are exclusive.

---

## Validation Commands

### Static Analysis
```bash
cd web && npx tsc --noEmit
```
EXPECT: Zero type errors

### Lint
```bash
cd web && npm run lint
```
EXPECT: Clean (no residue-scan violations: no `purple-*`/`rose-*`/`stone-*`/raw hex outside allowlist)

### Unit Tests
```bash
cd web && npm run test
```
EXPECT: All pass (existing 222 cases + new DS component tests)

### E2E (requires dev server + API)
```bash
cd web && npm run test:e2e
```
EXPECT: auth / register-wizard / ai-stylist / cart / checkout / community / designer specs pass (update selectors where markup changed)

### Browser Validation
```bash
cd web && npm run dev    # or ./dev.sh web
```
EXPECT: `/`, `/login`, `/register`, `/products`, `/chat`, `/community`, `/dashboard` each visually match their Figma frame

### Wordmark Sweep
```bash
grep -rn "FORME" web/app web/components
```
EXPECT: no results (all wordmarks use `BRAND.name`)

### Manual Validation
- [ ] Every CTA is a capsule `Button` (no hand-rolled pills remain)
- [ ] Single 82px `SiteHeader` on every route; uppercase nav; active = burgundy
- [ ] Product/feed/profile cards match Figma proportions
- [ ] Dark panels (sidebar, fitting room, style note, sign-in) render ink `#171717` + white text
- [ ] Underline form fields on login/register/AI-stylist
- [ ] No dark-mode regressions

---

## Acceptance Criteria
- [ ] All 8 Figma screens reproduced on their routes (map above)
- [ ] Shared DS layer built (`SiteHeader`, `FilterPill`, `ProductCard`, `SectionKicker`, `EditorialHeading`, `DarkPanel`, `UnderlineField`, `AbstractForm`) + Button capsule variants
- [ ] All validation commands pass; new DS unit tests written
- [ ] Zero type/lint errors; no wordmark literals ("FORME") in JSX
- [ ] No backend/behavioral changes; existing flows (auth/cart/checkout/chat/community/follow) still work
- [ ] Matches Figma visually per screen

## Completion Checklist
- [ ] Code follows discovered patterns (named exports, `"use client"`, semantic tokens, `cn()`)
- [ ] Error handling / data flow unchanged (presentation-only)
- [ ] Tests follow Vitest + Testing Library patterns
- [ ] No hardcoded colors/hex; tokens reused
- [ ] No dark-mode regression
- [ ] CLAUDE.md web-module docs updated if component inventory changes materially (route count already stale at 37→42 — optionally correct)
- [ ] No unnecessary scope additions (backend untouched)

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Two nav systems + duplicated dropdown logic hard to merge | High | Med | Build `SiteHeader` to wrap existing dropdown/cart/sheet logic; migrate call sites incrementally (Task 1.4) |
| Figma frames are 1440px desktop-only; no mobile specs | High | Med | Define responsive breakpoints from existing patterns (`PageShell` max-w, HeroSection responsive text); Figma = large-screen target |
| `Button` capsule variant radius clobbered by Tailwind-merge | Med | Low | Put `rounded-button` in variant (after base `rounded-md`); assert in test |
| Registration 6-step wizard vs Figma 3-label progress | Med | Med | Map 3 labels onto existing steps; keep all fields/data — display change only |
| Regressing dark mode (design is light-only) | Med | Med | Keep `.dark` overrides; manual dark pass; don't remove `ThemeToggle` |
| E2E selectors break on markup changes | High | Low | Update selectors per phase; run `test:e2e` after each screen |
| Google/Apple OAuth shown in Figma but not implemented | Med | Low | Render as styled placeholders or omit — never fake auth |
| Hero wordmark font (Inter in Figma ref vs Cormorant in project) | Low | Low | Documented decision: use `font-display`; add Inter only if pixel-match later required |

## Notes
- **Biggest insight:** the design tokens already match Figma exactly (`#8a0f2d`, `#171717`, `#ffffff`, Cormorant+DM Sans, chip 17px / button 24px radii) — this Figma is where they came from (see `completed/design-system-and-core-reskin.plan.md`). This is a *layout/component* redesign, not a reskin. Lean hard on existing tokens; the work is structural.
- **"FORME" vs "IYAE":** Figma is a shared prototype still labeled FORME; the landing already uses IYAE (`52:10`). Always use `BRAND.name`.
- **Design motif:** the pervasive burgundy-tint rounded "abstract forms" replace photography throughout — build `AbstractForm` once and reuse as image placeholder + decoration.
- **Per-screen exactness:** re-pull `get_design_context` on each node id during implementation for precise copy/spacing; this plan intentionally captures the *system* + *layout intent*, not every pixel.
- **Sequence:** Phase 1 (foundation) unblocks everything; then screens can be parallelized, but do landing (Phase 2) early as the brand statement. Run lint+test+tsc after every phase.
