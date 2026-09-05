# Plan: Design System + Core Reskin (Phase 2)

## Summary
Rewrite IYAE's single authoritative theme in `web/app/globals.css` from the current **warm-linen + purple (`#9333ea`)** palette to an editorial **White + Burgundy + Ink** system with a **serif display + tracked sans** type treatment, then migrate every hardcoded-color surface — **43 `purple-*` sites, 79 stray hex, 19 `bg-white`, 7 `rose-*`, and the ~60-usage landing-token layer** — onto semantic tokens, and **rebuild `web/components/home/` (18 files, 266 color literals) from the new Figma** component-by-component. Tailwind v4 is CSS-first (no `tailwind.config.ts`; deleted in Phase 1), so the token rewrite is confined to `globals.css` + `layout.tsx`, and the **19 shadcn primitives re-theme for free** — they are already 100% token-driven, so "regen" is a token swap, not a CLI regeneration.

## User Story
As a **Toronto Gen Z shopper landing on the relaunched IYAE**, I want the whole experience — landing, auth, onboarding, shop/PDP/cart/checkout, profile — to render in one coherent, human-centered editorial visual language, so that the product feels like a trustworthy independent brand rather than a dated template, and I stay long enough to try on and buy.

## Problem → Solution
**Current state:** The app still ships Clossette's warm-linen/purple theme. `--color-primary/ring/brand/brand-hover` are purple (`#9333ea`/`#7e22ce`), the landing layer is terracotta (`#C4654A`), 49 of 69 audited routes/components carry raw `purple-*`/hex/`bg-white`/status-color literals (many break dark mode), and `home/` bypasses the token system entirely with 266 inline literals. There is no White/Burgundy/Ink palette, no status-color tokens, and no guard preventing new legacy colors.
**Desired state:** One editorial White/Burgundy/Ink token set in `globals.css` (light + dark), a serif-display/tracked-sans type scale, complete semantic-token status coverage (success/warning/info), zero hardcoded legacy colors in `app/`/`components/`/`lib/` (enforced by a residue-scan gate), a Figma-faithful `home/`, and dark mode intact everywhere — with the full test suite (web vitest 222 / build / tsc / lint) green.

## Metadata
- **Complexity**: XL (≈70 files: `globals.css` + `layout.tsx` + 49 dirty routes/components + 14 `home/` files + 3 doc/PRD files). Internally sequenced into 7 surfaces (A–G); safe to land as one branch or split by surface.
- **Source PRD**: `.claude/PRPs/prds/iyae.prd.md`
- **PRD Phase**: Phase 2 — Design System + Core Reskin (depends on Phase 1 ✅ landed; runs alongside Phase 9)
- **Estimated Files**: ~70 changed, 0 new (all edits; optional new `lib/status.ts` badge helper)
- **Delivery unit**: one feature branch, surface-by-surface commits; token surface (A/B/C) first so downstream surfaces validate against the final palette.

---

## UX Design

### Before
```
┌──────────────────────────────────────────────┐
│  ☰  clossette-era chrome · purple #9333ea CTA  │
│                                                │
│   Warm-linen canvas (#f5efe8), cream cards      │
│   Terracotta landing accents (#C4654A)          │
│   Purple selected-states in the register wizard │
│   Status badges: raw green/amber/blue/red       │
│   home/: inline hex + white overlays, off-token │
│   Dark mode: broken on hex-swatch surfaces      │
└──────────────────────────────────────────────┘
```

### After
```
┌──────────────────────────────────────────────┐
│  ☰  IYAE · serif wordmark · Burgundy CTA        │
│                                                │
│   White canvas · ink text · burgundy accent     │
│   Editorial serif display + tracked sans        │
│   Burgundy selected-states, tokenized wizard    │
│   Status badges: success/warning/info tokens    │
│   home/: Figma-faithful, fully tokenized        │
│   Dark mode: correct on every surface           │
└──────────────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Primary CTA / brand accent | Purple `#9333ea` | Burgundy (Figma value) | `bg-brand`/`bg-primary`, hover `bg-brand-hover` |
| Page canvas | Warm linen `#f5efe8` | White | `--color-background` → white; gradients re-toned |
| Landing sections | Terracotta `#C4654A` | Burgundy/ink/white | 6 `--color-landing-*` vars remapped centrally |
| Register wizard selection | `border-purple-600 bg-purple-50` | `border-brand bg-brand/10` | ~22 purple sites in `register/` |
| Status badges (orders/status/designer) | Raw `green/amber/blue/red-*` | `success/warning/info/destructive` tokens | New tokens; dark-mode-correct |
| Headings | Cormorant, no tracking | Serif display + `tracking-*` | Figma type scale; body stays Geist Sans |
| Dark mode on profile surfaces | Broken (hex swatches) | Correct | Hex swatches → semantic tokens |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `web/app/globals.css` | 1–171 | The **only** theme surface (Tailwind v4 `@theme inline` 3–55, `.dark` 58–87). Every token edit lands here. |
| P0 | `web/app/layout.tsx` | 1–45 | Font wiring (Cormorant `next/font/google` L2/12–17; GeistSans L3; `<html>` className L31); the serif/tracked-sans swap point. Provider order + `suppressHydrationWarning` are load-bearing. |
| P0 | `.claude/PRPs/plans/rebrand-and-foundation.plan.md` | all | **Format to mirror** — section order, task-block shape, Residue-Scan style. Phase 1 precedent. |
| P1 | `web/components/ui/button.tsx` | 1–60 | shadcn token consumer; references **undefined** tokens `secondary`/`secondary-foreground`/`destructive-foreground` — must add. |
| P1 | `web/components/ui/card.tsx` / `input.tsx` | all | Confirm token-driven (no regen); mirror for any new primitive usage. |
| P1 | `web/components/NavBar.tsx` | 54–72, 119–129, 265 | Canonical semantic-token usage + `BRAND` consumption; global chrome. |
| P1 | `web/components/ProductList.tsx` + `web/app/products/page.tsx` | all | **Exemplar clean components** (0 literals) — the pattern every reskinned surface must match. |
| P1 | `web/components/home/TryOnSection.tsx` | 1–1236 | The 130-literal monster; reskin LAST, budget a dedicated pass. |
| P2 | `web/app/profile/[username]/page.tsx` | 81–125, 191, 368 | Worst route (27 literals): hex avatar/banner swatches + duplicated inline page gradient; break dark mode. |
| P2 | `web/lib/utils.ts` | 1–6 | `cn()` merge helper; `className` merged last. |
| P2 | `web/__tests__/middleware.test.ts` | all | CSP guard (10 cases); does NOT pin `font-src`/`style-src`, so a Google-Fonts host won't break it. |
| P2 | `web/CLAUDE.md` | 303–318, 279–289 | Design-System + Configuration tables to reconcile (stale: says "Inter", lists deleted `tailwind.config.ts`). |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Figma — IYAE design (8 screens) | Figma MCP (`get_design_context`, `get_variable_defs`, `get_screenshot`) | **Not in repo.** Exact burgundy/ink/white hex, serif family, tracking, spacing MUST be pulled from Figma at Task 0. Provisional values below are placeholders. |
| Tailwind v4 `@theme inline` | Context7 `tailwindcss` v4 docs | `inline` resolves the var at point-of-use, so `.dark` overriding the same `--color-*` names re-themes without regenerating utilities. **Never rename a token** — it breaks every generated utility. |
| Next.js 16 `next/font` | `web/AGENTS.md` + `node_modules/next/dist/docs/` | Read before touching font APIs — Next 16 conventions differ from training data. |
| shadcn/ui theming (CSS vars) | Context7 `shadcn/ui` | Primitives consume `bg-primary`/`text-foreground`/`ring-ring` etc.; a CSS-var swap re-themes all of them. `components.json` `config:""` confirms configless v4. |

---

## Patterns to Mirror

### THEME_TOKEN_BLOCK (SOURCE: web/app/globals.css:3-55)
```css
/* Tailwind v4 CSS-first theme. Every --color-* auto-generates bg-*/text-*/border-* utilities.
   Light defaults live in @theme inline; dark overrides in .dark { } re-point the SAME names. */
@theme inline {
  --color-background: #f5efe8;   /* → white  */
  --color-foreground: #171311;   /* ink (keep) */
  --color-primary: #9333ea;      /* → burgundy */
  --color-ring: #9333ea;         /* → burgundy */
  --color-brand: #9333ea;        /* → burgundy */
  --color-brand-hover: #7e22ce;  /* → darker burgundy */
  /* ...card, muted, popover, accent, destructive, gradients, landing, radius, shadows, fonts... */
}
.dark { --color-primary: #a855f7; /* → burgundy(dark) */ }
```
> Keep exact token NAMES; change only VALUES. Add missing tokens here (never in a JS config — none exists).

### SEMANTIC_TOKEN_USAGE (SOURCE: web/components/NavBar.tsx:54,119,265 · web/components/ProductList.tsx)
```tsx
// Surfaces → bg-card / bg-background ; text → text-foreground / text-muted-foreground
// Chips → bg-muted ; dividers → border-border ; accent → bg-brand / text-brand / bg-brand-hover
<header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-sm" />
<a className={active ? "font-medium text-brand" : "text-muted-foreground hover:text-foreground"} />
<button className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-hover transition-colors" />
<h3 className="font-display text-xl font-semibold text-foreground">{title}</h3>
<p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
// NEVER a raw hex, purple-*, rose-*, stone-*, or bg-white.
```

### SHADCN_TOKEN_CONSUMER (SOURCE: web/components/ui/button.tsx:13-21, card.tsx:13, input.tsx:11)
```tsx
// button.tsx — already token-driven; recolors automatically on a var swap:
default:  "bg-primary text-primary-foreground shadow hover:bg-primary/90",
outline:  "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
secondary:"bg-secondary text-secondary-foreground hover:bg-secondary/80",   // ⚠ tokens UNDEFINED today
link:     "text-primary underline-offset-4 hover:underline",
// card.tsx:13  "rounded-xl border bg-card text-card-foreground shadow"
// input.tsx:11 "... border border-input bg-transparent ... placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
```
> Do NOT re-run the shadcn CLI. Fix by DEFINING `--color-secondary`, `--color-secondary-foreground`, `--color-destructive-foreground` in `@theme` + `.dark`.

### STATUS_BADGE_TOKENIZED (NEW — replaces raw green/amber/blue/red across orders/status/designer/profile)
```tsx
// No success/warning/info token exists today. After defining them in globals.css, use:
// success:  bg-success/10  text-success   (was bg-green-50 text-green-700 + a manual dark pair)
// warning:  bg-warning/10  text-warning   (was amber-*)
// info:     bg-info/10     text-info       (was blue-*)
// error:    bg-destructive/10 text-destructive (was red-*)
const STATUS_TONE = { paid:"success", pending:"warning", shipped:"info", cancelled:"destructive" } as const;
// Use an EXPLICIT class map — Tailwind JIT cannot see runtime-built `bg-${tone}`:
const TONE_CLASS = { success:"bg-success/10 text-success", warning:"bg-warning/10 text-warning",
                     info:"bg-info/10 text-info", destructive:"bg-destructive/10 text-destructive" } as const;
<span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TONE_CLASS[STATUS_TONE[status]])} />
```

### FONT_WIRING (SOURCE: web/app/layout.tsx:2-31 + web/app/globals.css:27-28)
```tsx
// layout.tsx — two mechanisms, must move in lockstep with globals.css:
import { Cormorant_Garamond } from "next/font/google";      // serif display (already serif)
import { GeistSans } from "geist/font/sans";                // body sans (NOT Inter — docs are stale)
const cormorant = Cormorant_Garamond({ subsets:["latin"], weight:["400","500","600","700"], variable:"--font-cormorant", display:"swap" });
<html className={`${cormorant.variable} ${GeistSans.variable}`} suppressHydrationWarning>
// globals.css consumes:  --font-display: var(--font-cormorant), serif;  --font-body: var(--font-geist-sans), sans-serif;
```
> `suppressHydrationWarning` is required by `next-themes`. To swap the serif, change the import + `variable` name here AND the `--font-display` mapping — or `font-display`/`font-body` utilities break.

### CN_HELPER (SOURCE: web/lib/utils.ts:1-6 · web/components/PageShell.tsx)
```ts
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
// Every reusable component takes optional className and merges it LAST: cn("<base>", className)
```

### RESIDUE_SCAN (SOURCE: rebrand-and-foundation.plan.md:398-406 — the acceptance-gate style)
```bash
# Each ! grep "succeeds" only when there are ZERO matches (the acceptance gate).
cd /Users/jadyn/Development/IYAE/web
! grep -rnE 'purple-[0-9]' app components lib --include='*.tsx' --include='*.ts'
! grep -rnE '#[0-9a-fA-F]{3,8}' app components lib --include='*.tsx' --include='*.ts' | grep -v 'globals.css'
```

---

## Files to Change

### Surface A — Design tokens (`globals.css`)
| File | Action | Justification |
|---|---|---|
| `web/app/globals.css` | UPDATE | Rewrite `@theme inline` + `.dark` to White/Burgundy/Ink; remap 6 `--color-landing-*`; re-tone `--gradient-page-*` + `--gradient-profile-banner-*`; ADD `--color-secondary(-foreground)`, `--color-destructive-foreground`, `--color-success(-foreground)`, `--color-warning(-foreground)`, `--color-info(-foreground)`, a `--tracking-*` token; centralize `--color-paper` (`#F5F0EB`) + a brand-alpha for the inlined accent. |

### Surface B — Typography (`layout.tsx` + `globals.css`)
| File | Action | Justification |
|---|---|---|
| `web/app/layout.tsx` | UPDATE | Confirm/swap serif family per Figma; keep GeistSans body; apply tracking to display. |
| `web/app/globals.css` | UPDATE | `@layer base` heading rules + `--font-display`/`--font-body` mapping; add heading `letter-spacing`. |

### Surface C — shadcn primitives (token defs only, NO regen)
| File | Action | Justification |
|---|---|---|
| `web/components/ui/*.tsx` | VERIFY | Confirm all 19 are token-driven (button/card/input confirmed). No edits expected; spot-check the other 16 for stray literals. |
| _(tokens added in Surface A)_ | — | Defining `secondary`/`secondary-foreground`/`destructive-foreground` makes the `secondary` + destructive button variants resolve. |

### Surface D — Core routes: purple→brand, status→tokens, surfaces, text-white (49 files)
| File group | Action | Justification |
|---|---|---|
| `components/register/*` (7) + `app/register/page.tsx` | UPDATE | Biggest purple cluster (~22): `purple-*` → `brand`; `WizardProgress.tsx` reskins the whole progress bar. |
| Auth: `reset-password`, `verify-email`, `forgot-password`, `login`, `reset` | UPDATE | `purple` links → `text-brand`; red/green banners → `destructive`/`success` (drop manual `-50/-950` pairs). |
| Commerce: `cart`, `checkout`, `checkout/success`, `checkout/cancel`, `products/[id]` | UPDATE | Purple CTAs → `bg-brand/brand-hover`; status → tokens; `text-white` → `text-primary-foreground`. |
| Status maps: `orders/page`, `orders/[id]`, `status`, `designer/products`, `designer/PromotionList`, `profile/body`, `profile/avatar`, `try-on` | UPDATE | Raw green/amber/blue/red → success/warning/info/destructive tokens; **unify the duplicated order-status badge map**. |
| Surfaces: `profile/[username]` (27), `design`, `style-lab`, `ar-visualization`, `ImageUploader` | UPDATE | Hex swatches + `bg-white` → `bg-card`/`bg-background`/`bg-muted`; fixes dark mode. |
| Batch `text-white`-only (~11): `dashboard`, `chat`, `NavBar`, `OutfitCard`, `outfits/*`, `looks`, `designer/*`, `profile/preferences`, `ProductSelectCard`, `OutfitSlot*` | UPDATE | `text-white` on `bg-brand` → `text-primary-foreground` (opportunistic; leave where strictly over imagery). |
| `components/profile/ProfileHeader.tsx`, `ProfilePostGrid.tsx`, `StyleCircleDialog.tsx` | UPDATE | Gradient hex fallbacks + rose/purple accents → tokens. |

### Surface E — `home/` rebuild from Figma (14 dirty of 18)
| File group | Action | Justification |
|---|---|---|
| `globals.css` landing vars (6) | UPDATE | Remap `--color-landing-*` → White/Burgundy/Ink; **instantly reskins ~60 usages** (LandingNav/Footer/PhotoStrip/MagneticCTALink/Designers + most of Community/Sustainability). |
| Trivial single-token: `PhotoStrip`, `MagneticCTALink`, `DesignersSection`, `LandingNav`, `LandingFooter` | UPDATE | Reskin centrally via landing vars; near-zero per-file work. |
| Mostly-token: `CommunitySection`, `SustainabilitySection` | UPDATE | Landing tokens + a few `text-white/NN` overlays. |
| Hex-gradient trio: `CTASection`, `SocialProofSection`, `HeroSection` | UPDATE | Each is one inline `linear-gradient` + `#F5F0EB` paper text → paper/brand-to-ink tokens. |
| 3D: `TryOnViewer` | UPDATE | 6 Three.js material/light hex; `#d4785e`/`#c4654a` → burgundy in the mesh material; **render-test**. |
| Heavy: `HowItWorks` (17), `AIStylistSection` (38) | UPDATE | Mixed rgba/hex + glass/dark overlays. |
| Monster: `TryOnSection` (130) | UPDATE | Dedicated pass: 38 rgba shadows + 56 `text-white/NN` overlays + hex + gradients. **LAST.** |
| Clean (QA only): `TrustBar`, `motion-presets`, `LifestyleGrid`, `immersive-homepage` | VERIFY | 0 literals; dark-mode visual QA only. |

### Surface F — Residue-scan gate
| File | Action | Justification |
|---|---|---|
| _(plan only / optional CI)_ | ADD | Per-pattern `! grep` negations with allowlist (`components/ui/`, `public/`, `globals.css`). Run as the acceptance gate; optionally wire into CI/pre-commit. |

### Surface G — Docs + PRD sync
| File | Action | Justification |
|---|---|---|
| `web/CLAUDE.md` | UPDATE | Design-System table (purple→burgundy, warm-linen→white); Configuration table (remove `tailwind.config.ts`, Inter→Geist Sans); Gotchas (retire "purple is theme-invariant"). |
| `CLAUDE.md` (root) | UPDATE | Reconcile any brand-color/font prose. |
| `.claude/PRPs/prds/iyae.prd.md` | UPDATE | Phase 2 status `pending` → `in-progress`; add PRP plan link. |

## NOT Building
- **No new pages, routes, or features** — this is a visual reskin + tokenization only. Behavior, data flow, API contracts unchanged.
- **No shadcn CLI regeneration** — primitives are token-driven; a var swap re-themes them. (PRD's "shadcn regen" is reinterpreted as a token swap + 3 missing token definitions.)
- **No `tailwind.config.ts`** — it was deleted in Phase 1; Tailwind v4 is CSS-first. Do NOT recreate it.
- **No visual-regression harness** — out of scope (noted as a Risk). Guards are build/tsc/vitest/lint + residue-scan + manual smoke.
- **No AI-stylist voice, 3D-fitting logic, marketplace, or community feature work** — those are Phases 3/4/5/6.
- **No `brand.ts` rewrite into a theme config** — `BRAND` stays brand strings (name/tagline/url/mailFrom); colors live in `globals.css`. Do not move colors into `brand.ts`.
- **No copy rewrite** — inline prose brand literals (ChatService prompt, MockAIProvider) are intentionally left; not a theme surface.
- **No dark-mode redesign** — keep both palettes authored (theme-provider `enableSystem={false}`); just make dark correct.

---

## Step-by-Step Tasks

### Task 0: Extract exact design tokens from Figma
- **ACTION**: Pull the authoritative palette, type scale, radii, spacing, and shadows from the IYAE Figma before editing any code.
- **IMPLEMENT**: Use Figma MCP (`mcp__plugin_figma_figma__get_variable_defs`, `get_design_context`, `get_screenshot`) across the 8 screens. Record exact **burgundy** hex (+ hover/dark), **ink** hex, **white/paper** hexes, **serif family** + weights, heading **tracking**, card **radius**, and status colors. Write them into the Surface-A token edits, replacing the PROVISIONAL values in Notes.
- **GOTCHA**: The repo has NO Figma export — do not invent brand hex silently. If Figma is unreachable, use the PROVISIONAL palette in Notes and flag it in the PR description + PRD Open Questions ("Brand constants") for owner confirmation. Do NOT block the whole reskin on this — token names are stable; only values change.
- **VALIDATE**: A filled token list with no remaining "PROVISIONAL" markers, or an explicit note that provisional values are pending owner sign-off.

### Task 1: Rewrite the color token block (White/Burgundy/Ink)
- **ACTION**: Replace the light `@theme inline` and `.dark` color values in `globals.css` with the Figma palette.
- **IMPLEMENT**: In `web/app/globals.css` `@theme inline` (lines 5–23): `--color-background` `#f5efe8`→white; `--color-card` `#fdf8f3`→white/paper; `--color-popover` `#fdf8f3`→white; `--color-muted` `#ede4d9`→neutral grey; `--color-muted-foreground` `#78716c`→neutral; `--color-primary`/`--color-ring` `#9333ea`→burgundy; `--color-brand` `#9333ea`→burgundy; `--color-brand-hover` `#7e22ce`→darker burgundy; `--color-accent` `#ede4d9`→neutral; keep `--color-foreground` `#171311` (ink) and `--color-destructive` `#dc2626`. Mirror in `.dark` (lines 59–74): `--color-primary`/`--color-ring` `#a855f7`→burgundy(dark); background/card/muted stay near-black.
- **MIRROR**: THEME_TOKEN_BLOCK.
- **IMPORTS**: none.
- **GOTCHA**: Change VALUES only, never token NAMES (`@theme inline` regenerates utilities from names). `--color-brand`/`--color-brand-hover` have NO `.dark` override today — decide if burgundy needs a dark variant; if yes, add it in `.dark`.
- **VALIDATE**: `cd web && npm run build` green; `grep -nE '#9333ea|#7e22ce|#a855f7' app/globals.css` → 0.

### Task 2: Add missing + status semantic tokens
- **ACTION**: Define the tokens referenced-but-undefined by shadcn, plus a status-color set.
- **IMPLEMENT**: In `globals.css` `@theme` + `.dark` add: `--color-secondary`, `--color-secondary-foreground`, `--color-destructive-foreground`, `--color-success`, `--color-success-foreground`, `--color-warning`, `--color-warning-foreground`, `--color-info`, `--color-info-foreground`. Provisional: success `#2f7d5b`, warning `#b8791f`, info `#2563eb`; secondary = muted grey; all `*-foreground` `#ffffff`/ink as contrast dictates; add dark-mode lighter variants.
- **MIRROR**: THEME_TOKEN_BLOCK, STATUS_BADGE_TOKENIZED.
- **GOTCHA**: `button.tsx:15,19` already reference `secondary`/`destructive-foreground` — these silently resolved to nothing before; defining them changes the `secondary` variant's appearance. Verify no page relied on the broken look. Tailwind can't see runtime-built `bg-${tone}` — use an explicit class map, not string interpolation, when tokenizing badges.
- **VALIDATE**: `cd web && npx tsc --noEmit`; render a `<Button variant="secondary">` and a destructive button; `npm run build` green.

### Task 3: Typography — serif display + tracked sans
- **ACTION**: Wire the Figma serif display and apply tracking; keep Geist Sans body; reconcile the Inter→Geist doc drift.
- **IMPLEMENT**: In `web/app/layout.tsx`: keep or swap `Cormorant_Garamond` (L2/12–17) to the Figma serif via `next/font/google`, updating the `variable` name and the `<html>` className (L31); keep `GeistSans` (L3) as body. In `globals.css`: update `--font-display`/`--font-body` (L27–28) to match; in `@layer base` (L139–141) add heading `letter-spacing` (a `--tracking-display` token or `tracking-*` utilities) per Figma.
- **MIRROR**: FONT_WIRING.
- **IMPORTS**: new `next/font/google` import only if the serif family changes.
- **GOTCHA**: `layout.tsx` is a Server Component — keep it that way; keep `suppressHydrationWarning` (next-themes). Font `variable` name in `layout.tsx` and the `var(--font-…)` in `globals.css` MUST match or utilities break. Do NOT reintroduce Inter.
- **VALIDATE**: `npm run build`; headings render in the serif with tracking in the browser; `grep -rni 'inter' app/layout.tsx` → 0.

### Task 4: Remap the landing token layer (highest-leverage `home/` win)
- **ACTION**: Re-point the 6 `--color-landing-*` vars to White/Burgundy/Ink, reskinning ~60 usages centrally.
- **IMPLEMENT**: In `globals.css` (lines 43–48 light, 81–86 dark): `--color-landing-surface` `#F3E8E2`→white; `--color-landing-soft` `#E8DDD4`→off-white/muted; keep `--color-landing-contrast` `#1A1A1A` (ink); `--color-landing-tone`/`-accent`/`-highlight` all `#C4654A`→burgundy (dark: `#D4785E`→burgundy-dark).
- **MIRROR**: THEME_TOKEN_BLOCK.
- **GOTCHA**: This alone reskins LandingNav, LandingFooter, PhotoStrip, MagneticCTALink, DesignersSection and most of CommunitySection/SustainabilitySection — verify those visually BEFORE hand-editing them (avoid double work).
- **VALIDATE**: `npm run build`; visually check the landing sections light+dark; `grep -n '#C4654A\|#F3E8E2' app/globals.css` → 0.

### Task 5: Migrate the register wizard + auth surfaces (purple→brand)
- **ACTION**: Replace `purple-*` with brand tokens across onboarding + auth (the densest brand-purple cluster).
- **IMPLEMENT**: In `components/register/*` (StepAvatar 9, StepStylePrefs 8, WizardProgress 7, StepComplete 6, StepBasics 5, StepMeasurements 4, StepColors 3) + `app/register/page.tsx` (8): selected → `border-brand bg-brand/10 text-brand`; CTA `bg-purple-600 hover:bg-purple-700` → `bg-brand hover:bg-brand-hover`; `text-white` on brand → `text-primary-foreground`. Auth: `reset-password`, `verify-email`, `forgot-password`, `login`, `reset` — purple links → `text-brand`; red/green banners → `destructive`/`success` tokens (collapse manual `-50/-950` dark pairs).
- **MIRROR**: SEMANTIC_TOKEN_USAGE, STATUS_BADGE_TOKENIZED.
- **GOTCHA**: `WizardProgress.tsx` is shared across all steps — reskin it once. `purple-*` are Tailwind built-ins (not tokens) — they will NOT follow the var swap; each must be hand-migrated.
- **VALIDATE**: `! grep -rnE 'purple-[0-9]' app/register components/register app/reset-password app/verify-email app/forgot-password app/login`; `npm run test` (register-wizard vitest/e2e still green).

### Task 6: Migrate commerce routes (PDP / cart / checkout)
- **ACTION**: Tokenize the buy funnel.
- **IMPLEMENT**: `products/[id]/page.tsx` (6): purple accents → brand; green in-stock/red out-of-stock/amber rating → success/destructive/warning. `cart/page.tsx` (7): purple CTA → brand, `text-red-400` remove → `text-destructive`, `text-white`→`text-primary-foreground`. `checkout/page.tsx` (3), `checkout/success` (3), `checkout/cancel` (1): success checkmarks → success token, brand CTAs → `text-primary-foreground`.
- **MIRROR**: SEMANTIC_TOKEN_USAGE, STATUS_BADGE_TOKENIZED.
- **GOTCHA**: Do not alter CAD currency formatting (Phase-1 `en-CA`/`CAD`) — colors only. Preserve all cart/checkout behavior and E2E selectors.
- **VALIDATE**: `! grep -rnE 'purple-[0-9]' app/products app/cart app/checkout`; `npm run test` (cart-context 10 cases green); e2e cart/checkout smoke.

### Task 7: Introduce status tokens + unify the badge map
- **ACTION**: Replace raw status colors across orders/status/designer/profile with the new tokens, deduping the order-status map.
- **IMPLEMENT**: Create a single status→tone lookup (optionally `web/lib/status.ts`): `{ pending:"warning", paid:"success", shipped:"info", cancelled:"destructive", active:"success", draft:"warning" }` plus the explicit `TONE_CLASS` map. Apply in `orders/page.tsx` + `orders/[id]/page.tsx` (identical maps — unify), `status/page.tsx`, `designer/products/page.tsx`, `designer/PromotionList.tsx`, `profile/body/page.tsx`, `profile/avatar/page.tsx`, `try-on/page.tsx`.
- **MIRROR**: STATUS_BADGE_TOKENIZED.
- **IMPORTS**: `import { cn } from "@/lib/utils"`; optional `import { STATUS_TONE, TONE_CLASS } from "@/lib/status"`.
- **GOTCHA**: Tailwind's JIT cannot see runtime-concatenated class names — enumerate the full classes in a static map or they won't be generated. `profile/body` hand-rolls `bg-red-50`/`bg-red-950` light+dark pairs — the token absorbs both; remove the manual dark variant.
- **VALIDATE**: `! grep -rnE '(green|amber|blue|yellow|emerald)-[0-9]{2,3}' app/orders app/status app/designer components/designer app/profile/body`; `npm run build`.

### Task 8: Fix hex-swatch surfaces + `bg-white` (dark-mode breakers)
- **ACTION**: Replace raw hex surfaces and `bg-white` with semantic tokens.
- **IMPLEMENT**: `profile/[username]/page.tsx` (27): `avatarTone`/`bannerTone` hex arrays (L81–125) → token-derived tints or `bg-muted`/`bg-card`; inline page gradient (L191) → `--gradient-page-*` vars; `#f5efe8` (L368) → `bg-background`; `bg-black`/`from-black` overlays → `bg-foreground`/token. Then `design` (2), `style-lab` (1), `ar-visualization` (2), `ImageUploader` (1), `register/page` (1): `bg-white` → `bg-card`. `ProfileHeader.tsx` (L53): drop `#c4b5fd`/`#9333ea` gradient fallbacks (vars already defined).
- **MIRROR**: SEMANTIC_TOKEN_USAGE.
- **GOTCHA**: Some `bg-white`/`text-white` in `ar-visualization`/`design`/`style-lab` sit over live media/3D canvas — those may legitimately stay white; audit visually rather than blind-replace. The hex swatches are literal copies of old light-mode token values → they break entirely in dark mode, which is the bug being fixed.
- **VALIDATE**: `! grep -rnE '#[0-9a-fA-F]{3,8}' app components lib --include='*.tsx' | grep -v globals.css`; toggle dark mode on `/profile/[username]` and confirm surfaces adapt.

### Task 9: Batch `text-white`-on-brand → `text-primary-foreground`
- **ACTION**: Opportunistically tokenize the ~11 single-`text-white` files.
- **IMPLEMENT**: `dashboard`, `chat`, `NavBar`, `OutfitCard`, `outfits/new`, `outfits/[id]/view`, `looks`, `profile/preferences`, `designer/studio`, `designer/promotions`, `ProductSelectCard`, `OutfitSlotCard`, `OutfitSlotSidebarItem`, `PromotionForm`: `text-white` on `bg-brand`/brand buttons → `text-primary-foreground`. Leave `text-white` that sits over imagery/3D.
- **MIRROR**: SEMANTIC_TOKEN_USAGE.
- **GOTCHA**: Low-severity; don't over-reach into media overlays. `NavBar` is high-visibility global chrome — verify the CTA against `bg-brand`.
- **VALIDATE**: `npm run build`; `npm run test` (no regressions).

### Task 10: Rebuild `home/` from Figma (component-by-component)
- **ACTION**: Reskin the 14 dirty `home/` files in lowest-risk-first order, monster last.
- **IMPLEMENT**: Centralize cross-file constants in `globals.css` first: `--color-paper` (`#F5F0EB` + `rgba(245,240,235,x)` used in Hero/CTA/SocialProof/HowItWorks) and a brand-alpha for the inlined accent `rgba(196,101,74,x)` (== `#C4654A`). Then, in order: (a) trivial `PhotoStrip`, `MagneticCTALink`, `DesignersSection`, `LandingNav`, `LandingFooter` (mostly done by Task 4); (b) `CommunitySection`, `SustainabilitySection` (`text-white/NN` overlays → `text-primary-foreground/NN`); (c) hex-gradient trio `CTASection` → `SocialProofSection` → `HeroSection` (swap the one inline `linear-gradient` + paper text per file); (d) `TryOnViewer` — Three.js material colors `#d4785e`/`#c4654a` → burgundy, **render-test**; (e) `HowItWorks` (17 mixed rgba/hex); (f) `AIStylistSection` (38 glass/dark overlays); (g) `TryOnSection` (130) LAST — a dedicated pass over its 38 rgba shadows + 56 `text-white/NN` overlays + 8 hex + gradients.
- **MIRROR**: THEME_TOKEN_BLOCK, SEMANTIC_TOKEN_USAGE.
- **GOTCHA**: `TryOnViewer`/`TryOnSection` render R3F — preserve any `dynamic(..., { ssr:false })` wrappers and the 3D material intent; the accent mesh colors are visually load-bearing (verify the 3D preview after change). `TryOnSection` is 1,236 LOC — commit it separately. The 4 clean files (`TrustBar`, `motion-presets`, `LifestyleGrid`, `immersive-homepage`) need only QA.
- **VALIDATE**: per-file `npm run build`; `! grep -rnE '#[0-9a-fA-F]{3,8}|rgba\(' components/home --include='*.tsx' | grep -vE 'TryOnViewer'` trending to 0 (TryOnViewer 3D colors may remain as intentional material props — document any exceptions); visual smoke of the full landing page light+dark.

### Task 11: Residue-scan gate + verify shadcn primitives
- **ACTION**: Add the legacy-color acceptance gate and confirm no primitive regen is needed.
- **IMPLEMENT**: Author the per-pattern `! grep` gate (see Validation Commands) with allowlist. Spot-check the 16 unread `components/ui/*.tsx` for stray literals (`grep -rnE '#[0-9a-fA-F]{3,8}|purple-|stone-|bg-white' components/ui`).
- **MIRROR**: RESIDUE_SCAN.
- **GOTCHA**: Allowlist `components/ui/` (shadcn CLI-generated), `public/**` SVGs, and `globals.css` (legitimate token home). Keep `bg-brand` (a defined token) — the gate targets raw `purple-*`/hex/`bg-white`/`rose-*`, not token utilities.
- **VALIDATE**: the full Residue-Scan block exits 0; `components/ui` grep → 0 (or only allowlisted).

### Task 12: Docs + PRD sync
- **ACTION**: Reconcile stale docs and advance the PRD phase.
- **IMPLEMENT**: `web/CLAUDE.md` — Design-System table (purple→burgundy, warm-linen→white, add status tokens), Configuration table (remove `tailwind.config.ts` row, Inter→Geist Sans), Gotchas (retire "`bg-purple-600` theme-invariant" guidance; document status tokens). `CLAUDE.md` (root) — any brand-color/font prose. `.claude/PRPs/prds/iyae.prd.md` — Phase 2 row status `pending`→`in-progress`, add `[plan](../plans/design-system-and-core-reskin.plan.md)`.
- **GOTCHA**: Docs currently say "Inter"/list `tailwind.config.ts` — both are wrong post-Phase-1; fix, don't propagate.
- **VALIDATE**: `grep -rni 'tailwind.config\|Inter\b' web/CLAUDE.md` → 0 (or only historical changelog); PRD Phase 2 shows `in-progress` + plan link.

---

## Testing Strategy

### Unit / Integration Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `npm run test` (vitest, 222 cases / 16 files) | Existing suite unchanged | All pass (logic/text assertions unaffected by color changes) | No |
| `middleware.test.ts` (10 cases) | If CSP touched for a font host | Still passes; add `font-src`/`style-src` assertion if a Google-Fonts host is added | Yes — only if font source changes CSP |
| `SizeSelector`/`FittingHelper`/hooks tests | Unchanged | Pass — assert behavior, not styles | No |
| Register-wizard e2e | Reskinned wizard | Step nav/validation/submit still pass (selectors are text/role-based, not color) | Yes — verify no selector depended on a purple class |
| Cart / checkout e2e | Reskinned funnel | Add/remove/checkout flows pass | Yes |

### Edge Cases Checklist
- [ ] Dark mode correct on every reskinned surface (esp. `profile/[username]` hex swatches, `profile/body` red/green pairs)
- [ ] `secondary` + destructive button variants now resolve (were undefined tokens)
- [ ] Status badges render with sufficient contrast in both themes (WCAG — Phase 9 will audit; don't regress)
- [ ] `text-white` left only where it sits over imagery/3D
- [ ] `TryOnViewer`/`TryOnSection` 3D render intact after material-color change
- [ ] Reduced-motion still honored (globals.css L164–170 untouched)
- [ ] Fonts load (serif display, Geist body) with `display:"swap"`; no FOUT regression
- [ ] No E2E selector relied on a `purple-*`/`bg-white` class

---

## Validation Commands

### Static Analysis
```bash
cd /Users/jadyn/Development/IYAE/web
npm run lint
npx tsc --noEmit
```
EXPECT: Zero lint errors, zero type errors. (There is no `typecheck` npm script — use `npx tsc --noEmit`.)

### Build (the real theme-wiring guard)
```bash
cd /Users/jadyn/Development/IYAE/web
npm run build
```
EXPECT: `next build` succeeds — proves the `@theme` token wiring, font vars, and CSS-first config resolve.

### Unit Tests
```bash
cd /Users/jadyn/Development/IYAE/web
npm run test          # vitest run — ~222 cases / 16 files
```
EXPECT: All pass (no regressions; color changes don't touch asserted logic/text).

### Residue Scan (acceptance gate)
```bash
cd /Users/jadyn/Development/IYAE/web
# Each ! grep succeeds only with ZERO matches. Allowlist: globals.css (token home), components/ui (shadcn), public/**.
! grep -rnE 'purple-[0-9]'  app components lib --include='*.tsx' --include='*.ts'
! grep -rnE 'rose-[0-9]'    app components lib --include='*.tsx' --include='*.ts'
! grep -rnE 'stone-[0-9]'   app components lib --include='*.tsx' --include='*.ts'
! grep -rn  'bg-white'       app components lib --include='*.tsx' --include='*.ts' | grep -viE 'over (image|media)|components/ui'
! grep -rnE '#[0-9a-fA-F]{3,8}' app components lib --include='*.tsx' --include='*.ts' \
    | grep -viE 'globals.css|components/ui|components/home/TryOnViewer'
! grep -rnE '(green|amber|blue|yellow|emerald)-[0-9]{2,3}' app components lib --include='*.tsx' \
    | grep -viE 'globals.css'
```
EXPECT: All negations pass (no legacy literals outside the allowlist). Baseline before work: 43 purple, 79 hex, 19 bg-white, 7 rose, 0 stone.

### E2E Smoke (requires running servers)
```bash
cd /Users/jadyn/Development/IYAE/web
npm run dev            # terminal 1 (:3000) — plus API on :3001
npm run test:e2e       # terminal 2 — npx playwright test (chromium)
```
EXPECT: auth/register-wizard/cart/checkout/community specs pass (behavioral; not color-dependent).

### Manual / Browser Validation
- [ ] Landing page (`/`) renders Figma-faithful in **light AND dark** (Hero/CTA/SocialProof gradients, TryOnSection, AIStylistSection)
- [ ] Register wizard, cart, checkout, PDP, profile — burgundy accents, no purple, dark mode correct
- [ ] Status badges (orders, `/status`, designer products) use the new tokens
- [ ] Serif display + tracked headings match Figma; body is Geist Sans
- [ ] `<Button variant="secondary">` and destructive buttons look intentional
- [ ] 3D try-on preview colors look right after the material swap

---

## Acceptance Criteria
- [ ] All 13 tasks completed
- [ ] `globals.css` holds a complete White/Burgundy/Ink token set (light + dark) incl. secondary/destructive-foreground/success/warning/info + tracking
- [ ] Residue-Scan gate passes (zero legacy literals outside allowlist)
- [ ] `npm run build`, `npx tsc --noEmit`, `npm run lint`, `npm run test` all green
- [ ] Dark mode correct on all reskinned surfaces
- [ ] `home/` matches Figma; shadcn primitives re-themed without regen
- [ ] Docs (`web/CLAUDE.md`, root `CLAUDE.md`) reconciled; PRD Phase 2 = `in-progress` with plan link

## Completion Checklist
- [ ] Code follows discovered patterns (SEMANTIC_TOKEN_USAGE, THEME_TOKEN_BLOCK, CN_HELPER)
- [ ] Error/status handling uses tokens, not raw colors
- [ ] No hardcoded hex/`purple`/`rose`/`stone`/`bg-white` outside the allowlist
- [ ] Tests follow existing patterns; no new flakiness
- [ ] No `tailwind.config.ts` recreated; no shadcn CLI regen
- [ ] Font drift (Inter→Geist) reconciled in code + docs
- [ ] No scope creep into Phases 3/4/5/6
- [ ] Self-contained — no codebase re-search needed during implementation

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Exact burgundy/serif not in repo (Figma-only) | **H** | M | Task 0 extracts from Figma; PROVISIONAL palette + owner sign-off flag if unreachable; token names stable so values swap late |
| No visual-regression net — subtle dark-mode/contrast breaks slip through | **M** | M | Manual light+dark smoke on every surface; Phase 9 WCAG audit; residue-scan catches literal leakage, not contrast |
| `TryOnSection` (1,236 LOC, 130 literals) reskin introduces regressions | **M** | M | Reskin LAST, separate commit, dedicated pass; preserve R3F `dynamic ssr:false`; render-test |
| Defining `secondary`/destructive-foreground changes an already-shipped (broken) button look | **L** | L | Audit `variant="secondary"`/destructive usages before/after; visual check |
| Dynamic `bg-${tone}` classes purged by Tailwind JIT | **M** | M | Use explicit static class maps for status badges, never string interpolation |
| E2E/vitest selector coupled to a legacy color class | **L** | M | Selectors are text/role-based (verified); run full e2e after Surfaces D/E |
| Reskinning landing files already fixed centrally by Task 4 = double work | **L** | L | Do Task 4 first, verify visually, then only hand-edit residual overlays |

## Notes
- **PRD reinterpretation — "shadcn regen":** The 19 `components/ui/*` primitives are 100% token-driven (`bg-primary`/`text-foreground`/`ring-ring`); a CSS-var swap re-themes them. "Regen" is reinterpreted as (a) token swap + (b) defining 3 tokens `button.tsx` references but that were never defined (`--color-secondary`, `--color-secondary-foreground`, `--color-destructive-foreground`). No CLI regeneration.
- **Count reconciliation:** PRD "~187 home literals" ≈ inventory's hex+rgb+named+gradient (excludes ~89 white/black opacity overlays + the landing-token layer); full occurrence count is 266 across 14 dirty of 18 files. Routes/components: 258 literals across 49 dirty of 69 files. Global clean rate ≈ 81% (100/132 tsx under a lenient definition) — consistent with the PRD's 108/134.
- **Highest-leverage single edit:** the 6 `--color-landing-*` vars drive ~60 `home/` usages — remap them (Task 4) before touching landing components.
- **Font drift is real:** code uses **Geist Sans** (`geist/font/sans`), not Inter; docs are stale. Fix code intent AND docs.
- **No `:root`, no `tailwind.config.ts`:** Tailwind v4 CSS-first; all theming in `globals.css` `@theme inline`. `components.json` `config:""` confirms. Do not recreate a JS config.
- **theme-provider:** `attribute="class"`, `defaultTheme="light"`, `enableSystem={false}` — both palettes must be authored explicitly (no system fallback).
- **Parallelism:** Phase 2 runs alongside Phase 9 (KPI/a11y). Do NOT do the WCAG audit here — Phase 9 owns it; just avoid regressing contrast.
- **Provisional palette (REPLACE from Figma at Task 0):** background `#ffffff`; paper/card `#faf7f5`; muted `#f4f1ee`; ink foreground `#1c1917`; muted-foreground `#6b625c`; **burgundy** primary/brand/ring `#7a2e3a`, hover `#5e1f2b`, dark `#c15563`; success `#2f7d5b`; warning `#b8791f`; info `#2563eb`. These are defensible editorial-burgundy defaults, NOT owner-confirmed.
