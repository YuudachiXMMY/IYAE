# IYAE — Human-Centered Fashion Marketplace (Clossette Rebuild & Rebrand)

> **What this is:** The canonical product spec for rebuilding the existing Clossette platform into **IYAE** — a Toronto-focused, human-centered fashion marketplace fusing conversational AI styling, measurement-true 3D/AR virtual try-on, and a curated independent-designer marketplace. This is a **visual reskin + targeted refactor on the existing stack** (Next.js 16 + Spring Boot 3.4 + MySQL 8 + Python worker + Nginx), not a rewrite.

## Problem Statement

Gen Z shoppers (18–30) in Toronto face acute decision fatigue ("I have nothing to wear") and the highest apparel return rates of any cohort (~35%, with ~51% deliberately buying multiple sizes to return most) because online fashion can't tell them what suits them or whether it will actually fit. The existing product (Clossette) has the right feature thesis but an **outdated, non-human-centered design**, a codebase carrying rebrand/maintenance debt, and — following a co-founder's departure — must be **re-established as an independent company** under the new brand **IYAE**. Not solving this means launching the new company on a dated experience that fails to convert the exact cohort it targets and keeps returns (the single largest margin drain in apparel) high.

## Evidence

- **Owner-stated (validated):** Rebrand driven by co-founder departure + need for an independent company; current design is outdated; a new Figma design exists; a goal is to reduce old-codebase maintenance cost. Success is defined as improving **conversion rate, return rate, and retention**.
- **Market (researched, 2024–2026):** Fit/size drives **44–70% of apparel returns**; Gen Z returns ~35% and ~51% "bracket." Well-placed try-on shows **~15–30% conversion lift and ~20–40% return reduction** (vendor "up to 65%" claims treated as outliers).
- **Category proof:** Google launched a standalone try-on app (Doppl, Jun 2025) and **killed it in under a year** (Apr 2026), folding try-on into Search/Shopping — try-on must be an **embedded feature, not a destination**. Google's **single-selfie try-on has been live in Canada since Oct 2025**, setting the friction/quality bar.
- **Toronto supply vacuum:** SSENSE filed CCAA (Aug 2025, ~C$93M owed to vendors), Frank And Oak went bankrupt (Dec 2024), and the world-first **Toronto Fashion Incubator closed in 2025** with no replacement — freeing designer relationships and leaving a local support gap.
- **Codebase (verified this session):** Reskin is cheap where it matters — **108/134 `.tsx` files use semantic tokens**; backend/DB/worker tables contain **no `clossette` strings** (no schema rename). Strong regression net: **~338 server + 227 web + 292 worker tests**.
- **Assumption — needs validation:** No public Toronto/Canada indie-fashion baseline for conversion/return/retention exists. **Absolute KPI targets must be set from an internal baseline or a local survey** before we can define pass/fail thresholds.

## Proposed Solution

Rebrand and reskin the existing platform into IYAE's editorial, human-centered visual language (per the new Figma), keeping all current capabilities and the current stack, while making **fit the hero of the experience** (measurement-true try-on + explicit "your recommended size") and **anchoring the AI in real local designers and real bodies** to earn AI-skeptical Gen Z trust. We choose reskin-on-existing-stack over a rewrite because the core app is token-driven and the backend/worker contract is brand-agnostic and production-grade — the expensive surfaces are narrow (the ~3,575-LOC marketing/home layer that bypasses tokens, and the pure-Python rigging stack). The differentiator is the **four-way combination no competitor owns**: conversational AI styling + measurement-grounded 3D/AR try-on + curated Toronto indie marketplace + local community.

## Key Hypothesis

We believe that a **human-centered reskin + measurement-true virtual try-on with an explicit recommended size, embedded inline across PDP / AI chat / outfit builder** will **raise conversion and cut returns** for **Toronto Gen Z shoppers**.
We'll know we're right when, in same-period same-PDP cohorts, **try-on users convert materially higher and return materially less (and bracket less) than non-try-on users**, and **kept revenue (not gross conversion) rises** vs the pre-relaunch baseline.

## What We're NOT Building

- **Autonomous/agentic auto-checkout** — the buy button stays with the shopper (OpenAI killed in-chat Instant Checkout in ~6 months; only ~34% will let AI buy for them). AI curates and pre-fills the cart only.
- **A standalone try-on destination / "open the try-on app" pattern** — try-on is embedded only (Doppl lesson).
- **Fabricated social proof or dark patterns** — like/follow counts must be real; pricing all-in before checkout; one-click cancel. (Gen Z hostility + EU DSA / consumer-protection risk.)
- **Inventory-heavy DTC** — asset-light, no-inventory, managed marketplace only.
- **Multi-region launch** — Toronto-first; users outside Toronto are not a launch target.
- **The empty "IYAE INTRO" landing variant** — deferred to a later iteration (owner decision).
- **Diffusion "flattery" try-on that prioritizes looking good over accuracy** — accuracy-first, because flattery can *increase* returns.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Conversion rate | Lift vs pre-relaunch baseline; **try-on cohort > non-try-on** (research range +15–30% on try-on SKUs) | A/B cohort, same-period same-PDP; funnel analytics from day one |
| Return rate | **−20–40% on try-on SKUs** vs baseline | Returns tagged by try-on exposure; measure **kept revenue**, same-period same-PDP cohorts |
| Retention | Repeat-purchase rate + 30/60/90-day return-visit rate; target TBD post-baseline | Cohort retention analytics |
| **Guardrail: bracketing rate** | Decrease vs baseline | Orders with multiple sizes of same SKU, later returned |
| **Guardrail: try-on time-to-first-preview** | Instant 2D preview; high-fidelity within an acceptable async window | Client timing on avatar/try-on pipeline |

> Absolute pass/fail thresholds are **open** until an internal baseline is captured (see Open Questions).

## Open Questions

- [ ] **KPI baselines & absolute targets** — capture from the relaunch's first weeks or a local survey before locking thresholds.
- [ ] **Designer commission/revenue model** — deferred (TBD); buyer-side built first. Must be defined before designer onboarding.
- [ ] **Designer payout terms & who bears return/refund cost** — the central trust lever vs the SSENSE anti-pattern.
- [ ] **Production AI provider (claude / deepseek / minimax) + budget** — cost-to-serve ties directly to the maintenance-cost goal.
- [ ] **Resale/circular/trade-in depth** — full listing lifecycle vs lightweight in v1 (affects data model & partnerships).
- [ ] **Toronto physical touchpoint model** — pickup / same-day / pop-up / market partnership (e.g., Inland, Toronto Designers Market) specifics.
- [ ] **Brand constants** — confirm domain (**default `iyae.ca`**), verified sender (**default `noreply@iyae.ca`**), social handles.
- [ ] **Competitor comparables** — confirm "Bad Bird" (unverified) and "The Canvas by Querencia" (thin economics) as intended references.
- [ ] **Single-owner capacity** — v1 spans full-3D try-on + AI + community + resale + physical touchpoints; confirm sequencing given limited team.

---

## Users & Context

**Primary User**
- **Who**: Toronto Gen Z / young-millennial (18–30), style-curious but decision-fatigued and return-weary; values authenticity and sustainability; AI-skeptical (61% prefer UGC over AI-generated content); mobile-first; wants to support local/Canadian designers.
- **Current behavior**: Scrolls large SKU grids across generic sites, guesses sizes, brackets (buys multiple sizes), returns most, and distrusts polished AI/branded content.
- **Trigger**: An occasion + "nothing to wear," or discovering a local designer piece and wondering "will this actually fit / suit me?"
- **Success state**: Confidently buys **one** piece they keep and love — right fit, right style, feels like them — with minimal friction and no bracketing.

**Job to Be Done**
When I have an occasion and "nothing to wear," and I'm tired of guessing my size and returning things, I want guided styling plus a preview that's true to my body, so I can confidently buy one piece I'll actually keep and love.

**Non-Users** (explicitly ignored at launch)
- Fast-fashion bargain-hunters who bracket-buy by design.
- Shoppers outside Toronto (launch scope).
- Users who want a pure marketplace with no AI/personalization.
- Luxury-only shoppers.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Full brand cutover **FORME/Clossette → IYAE** (package `com.clossette`→`com.iyae`, DB, asset paths, emails, SSL, UI copy) | New independent company; FORME is a legacy working name that must be fully removed |
| Must | **Editorial reskin** (White + Burgundy + Ink; serif display + tracked sans) across all 8 Figma screens + 30+ core routes | The core reason for the rebuild; human-centered design |
| Must | **CAD as single currency source of truth** (display `$`, currency CAD; fix `CheckoutService.java:85`) | Toronto localization; existing USD/CAD bug |
| Must | Auth + multi-step registration (Account / Style Profile / Measurements) reskinned | Existing feature; onboarding is the #1 conversion leak — must be low-friction |
| Must | Shop + PDP + cart + Stripe checkout (CAD) reskinned; browse defaults to **complete outfits**, not SKU grids | Cuts decision fatigue, lifts AOV |
| Must | **Full 3D measurement-true virtual try-on** (SMPL-X avatar + weight-transfer rigging), embedded inline (PDP / chat / outfit builder), with **explicit "your recommended size"** and **instant 2D preview while high-fidelity generates async** | Owner-selected hero feature; fit is the KPI driver; must clear Google's zero-friction bar |
| Must | **AI Stylist** (occasion/mood/weather → outfit) with new human-centered voice; suggestions render inline/on avatar via `[GENERATE_OUTFIT]`/`[SUGGESTIONS]` | Core differentiator; grounds AI in real pieces |
| Must | **Curated Toronto indie-designer marketplace** — Local Designers filter, designer studio/upload, asset-light no-inventory; **normalize designer measurements to the SMPL-X body model** | The moat; consistent "your size" across the marketplace |
| Must | **ADMIN role + moderation endpoints** (catalog, community, promotions) | Marketplace governance for a single-owner company (currently only BUYER/DESIGNER) |
| Must | **KPI instrumentation** (conversion / return / retention / bracketing as A/B cohorts) from day one | The owner's north star; no public baseline exists |
| Must | Privacy-forward try-on (**face optional, one-tap delete, no training on your body**), PIPEDA-aligned | Real differentiator vs US-first rivals; brand-trust asset |
| Should | **Community** (Following / Discover / Toronto / Body-confidence feeds; posts, likes, comments, Share a Look) with **real** social-proof counts | Selected for v1; authentic UGC counters AI skepticism |
| Should | **Resale / circular / trade-in layer** | Selected for v1; Gen Z affordability + sustainability (data-model impact — scope depth open) |
| Should | **Toronto physical touchpoints** (in-city pickup / same-day) + **multi-carrier shipping (never Canada-Post-only)** | Selected for v1; 65%+ Canadian Gen Z prefer hybrid retail; Canada Post strike risk |
| Should | Guest-avatar path as the **front door**; zero-upload default (diverse pre-built models) with photo/measurements as opt-in upgrade | Kills onboarding friction (Doji anti-pattern) |
| Could | Fit-education content; designer stories; complete-outfit editorials | Human-centered depth; SEO |
| Could | "IYAE INTRO" cinematic landing variant | Owner deferred to later iteration |
| Won't (v1) | Designer commission/billing system | Model is TBD; buyer-side first |
| Won't (v1) | Agentic auto-checkout; multi-region; diffusion flattery try-on | Explicitly out of scope (see above) |

### MVP Scope

The **relaunch is the MVP**: IYAE-branded, fully reskinned, CAD, on a fresh database, with the full existing feature surface modernized — **full 3D try-on with recommended size**, AI stylist, marketplace with Local Designers, community, plus the v1-selected resale layer and Toronto physical touchpoints. Descoped: designer commission/billing (buyer-side first), the empty INTRO landing, and any agentic checkout. KPI instrumentation ships with it so the hypothesis is testable immediately.

### User Flow (critical path to value)

1. Land on IYAE (editorial hero) → **Shop** or **AI Stylist**.
2. (Optional, low-friction) sign up → pick a **pre-built diverse model** or add photo/measurements (opt-in).
3. AI Stylist: enter occasion/mood/weather → get **few, decisive, context-aware** outfit picks (own wardrobe + Toronto weather).
4. Any suggestion/PDP → **try it on inline** (instant 2D preview; high-fidelity rigged avatar streams in) with **"your recommended size"** shown.
5. Add to cart (CAD, all-in pricing) → checkout → choose delivery or **Toronto pickup**.
6. Post-purchase → Share a Look to Community; keep (low returns) → retention loop.

---

## Technical Approach

**Feasibility**: **HIGH** — verified reskin-not-rewrite. Core app is token-driven; backend/DB/worker are brand-agnostic and production-grade; the regression test net is strong enough to green-light a scripted package rename.

**Architecture Notes**
- **Keep the 5-service stack** (Next.js 16 web · Spring Boot 3.4 server · MySQL 8 · Python worker · Nginx). Shared server↔worker contract (3 MySQL task tables, `FOR UPDATE SKIP LOCKED`, PENDING/RUNNING/READY) is reused verbatim.
- **Reskin via one authoritative theme**: IYAE tokens in `web/app/globals.css` Tailwind v4 `@theme` block; regenerate the 19 CLI-generated shadcn primitives; **delete dead `web/tailwind.config.ts`** (not loaded under v4; hardcodes old brand `#9333ea`).
- **Rebuild `web/components/home/` from Figma** (~3,575 LOC, 187 inline color literals, `TryOnSection.tsx` 1,236 LOC) — the one surface that bypasses tokens; component-by-component.
- **Centralize a `BrandConfig`** (app name, colors, `MAIL_FROM`, guest-account email, domains) to end current `.com`/`.ca` and font/name drift; consolidate email templates onto the **web/Resend** path (remove the duplicate Java `AuthMailService` HTML).
- **Fresh relaunch**: new MySQL DB/user (drop `clossette` naming), Flyway rebuilds V1–V10 clean; **atomically** change DB name + `/var/clossette/assets` path across compose (dev+prod), `application.yml`, `worker/main.py`, `dev.sh`, and Nginx; re-issue SSL under the IYAE cert name.
- **AI seam**: inject the human-centered voice via `AIProviderFactory` prompts + `ChatService` `[GENERATE_OUTFIT]`/`[SUGGESTIONS]` protocol.
- **Try-on hardening (because full 3D is the launch bet)**: validate/replace `measurements_to_betas` (author-flagged non-production), fix `Meshy` metadata no-op validation (constant `triangle_count=30000`, `bbox=None` lets bad GLBs reach the Three.js viewer), instant 2D preview + async high-fidelity, guest-avatar front door.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Full 3D try-on can't clear Google's free single-selfie bar (latency / "doesn't look like me") | **H** | Instant 2D preview; async high-fidelity with visible progress; zero-upload pre-built models; measure adoption; keep a size-finder fallback that already matches full body scans in studies |
| `measurements_to_betas` inaccuracy corrupts the fit → return-rate KPI | **H** | Validate against ground-truth measurements before launch; bundle explicit recommended size; treat as a tracked accuracy metric |
| Optimizing conversion while returns quietly rise (flattery effect) | **M** | Measure **kept revenue** same-period same-PDP; accuracy-first try-on; guardrail on bracketing |
| Atomic DB name + asset-path change breaks 3D assets/uploads (404s) across ~15 hardcoded sites | **M** | Single coordinated change guarded by tests; introduce a shared asset-path constant; fix `FileStorageService.java:19` literal vs `worker.output-dir` |
| `com.clossette`→`com.iyae` (220 files / 861 occurrences) regression | **L (logic) / M (blast)** | One scripted/IDE commit guarded by the ~338-method suite |
| Rate limiting ineffective behind Nginx (in-memory map, unset trusted-proxies) | **M** | Configure `app.rate-limit.trusted-proxies` for the Nginx topology (Redis deferred) |
| Pure-Python rigging maintenance burden (libigl/robust-laplacian/SMPL-X via Git LFS) stays in scope | **M** | Owner accepted; contain via stub fallback for CI/dev, Dockerfile.rigging isolation, and hardened validation; revisit if maintenance cost exceeds value |
| Single-owner capacity vs broad v1 | **M** | Sequence phases so the branded relaunch ships first; resale & physical touchpoints as later phases within the program |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently
  DEPENDS: phases that must complete first
  PRP: link to generated plan file once created
-->

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Rebrand & Foundation | Package rename, fresh DB relaunch, atomic asset-path/DB/domain cutover, CAD single-currency fix, BrandConfig, email consolidation, SSL re-issue, delete dead config | complete (merged PR #1/#2/#3; server 338/338 · web tsc+vitest+build · worker py_compile); 2 Java centralizations (BrandConfig DI, email Option-A) deferred as literal swaps | - | - | [plan](../plans/rebrand-and-foundation.plan.md) · [report](../reports/rebrand-and-foundation-report.md) |
| 2 | Design System + Core Reskin | IYAE `@theme` tokens, shadcn regen, reskin 30+ core routes + rebuild `home/` from Figma (landing, auth, onboarding, profile, shop/PDP/cart/checkout) | complete (merged PR #4; White/Burgundy/Ink `@theme` + core-route migration + `home/` rebuild + residue-scan gate; brand colors signed off against FORME Figma in 57f714a/8287847) | with 9 | 1 | [plan](../plans/completed/design-system-and-core-reskin.plan.md) · [report](../reports/design-system-and-core-reskin-report.md) |
| 3 | AI Stylist + Inline Suggestions | Human-centered voice via AIProvider prompts; occasion/mood/weather → outfit; render inline/on avatar | complete (shipped 83a09db + PR#9 fixes; server 41/41 + web 7/7 re-verified) | with 4, 5 | 2 | [report](../reports/ai-stylist-inline-suggestions-report.md) |
| 4 | Virtual Fitting (Full 3D) + Fit/Size | SMPL-X + weight-transfer kept & hardened; instant 2D preview + async high-fidelity; recommended size; inline embed; validation fixes; privacy controls | complete (merged PR #8; post-merge hardening PR #13; all Critical/High/Medium phase3+phase4 review findings fixed in PR #14) | with 3, 5 | 2 | [plan](../plans/completed/virtual-fitting-3d-fit-size.plan.md) · [report](../reports/virtual-fitting-3d-fit-size-report.md) |
| 5 | Marketplace + Local Designers + ADMIN | Local Designers filter, designer studio/upload, asset-light no-inventory, measurement normalization to SMPL-X, ADMIN role + moderation | complete (merged PR #10; PR #11 review follow-up on measurements) | with 3, 4 | 2 | [report](../reports/marketplace-local-designers-admin-report.md) |
| 6 | Community | Following/Discover/Toronto/Body-confidence feeds; posts/likes/comments; Share a Look; real social-proof counts; moderation | complete (merged PR #15; F2–F9 web + 8 adversarial-review findings fixed & re-verified) | with 7 | 5 | [plan](../plans/completed/community.plan.md) · [report](../reports/community-report.md) |
| 7 | Resale / Circular / Trade-in | Data-model additions + listing lifecycle (depth per Open Questions) | complete (lightweight v1 — buyer resale of owned items; V16 + ResaleService/Controller + web; server 517 + web api 31 green; no trade-in credit / authentication / logistics) | with 6 | 2, 5 | [plan](../plans/completed/resale-circular-tradein.plan.md) · [report](../reports/resale-circular-tradein-report.md) |
| 8 | Toronto Physical Touchpoints + Shipping | In-city pickup / same-day; multi-carrier shipping (never Canada-Post-only) | complete (lightweight v1 — Ship/Pickup choice at checkout; V17 + FulfillmentService/Controller + web; multi-carrier flat-rate never Canada-Post-only + seeded Toronto pickup; server 528 green; no live rates / labels / tracking) | - | 5 | [plan](../plans/completed/toronto-physical-touchpoints-shipping.plan.md) · [report](../reports/toronto-physical-touchpoints-shipping-report.md) |
| 9 | Hardening, A11y & KPI Instrumentation | Email verification on; rate-limit trusted-proxies; WCAG 2.1 AA incl. 3D viewer; conversion/return/retention/bracketing A/B cohorts; dark-pattern-free checkout | in-progress (A/B/D/E landed; C foundation only — completion plan drafted for remaining a11y + KPI wiring) | with 2 | 1 | [plan](../plans/hardening-a11y-kpi-instrumentation.plan.md) · [completion plan](../plans/phase9-hardening-a11y-completion.plan.md) · [report](../reports/hardening-a11y-kpi-instrumentation-report.md) |

### Phase Details

**Phase 1: Rebrand & Foundation**
- **Goal**: A clean IYAE-branded foundation on a fresh database with no `clossette`/`FORME` residue and correct CAD.
- **Scope**: `com.clossette`→`com.iyae`; new MySQL DB/user + Flyway rebuild; atomic asset-path/DB/domain change across compose/yml/worker/nginx/dev.sh; CAD fix (`CheckoutService.java:85`); `BrandConfig`; email templates onto Resend; SSL re-issue; delete `tailwind.config.ts`.
- **Success signal**: Full test suite green; app boots as "IYAE"; a test checkout charges CAD; 3D assets/uploads serve correctly under new paths.

**Phase 2: Design System + Core Reskin**
- **Goal**: The 8 Figma screens and all token-driven routes render in IYAE's editorial language.
- **Scope**: `@theme` tokens (White/Burgundy/Ink, serif+sans); shadcn regen; reskin shop/PDP/cart/checkout/profile/auth/onboarding; rebuild `home/` from Figma.
- **Success signal**: Visual parity with Figma; zero hardcoded legacy colors; dark mode intact.
- **Open question (Brand constants)**: The exact burgundy/serif/tracking are Figma-only (no export in repo). The initial reskin shipped a PROVISIONAL editorial-burgundy palette in `web/app/globals.css` — primary/brand `#7a2e3a` (hover `#5e1f2b`, dark `#c15563`), status success `#2f7d5b` / warning `#b8791f` / info `#2563eb`, serif = Cormorant Garamond with `--tracking-display: -0.015em`. Token **names are stable**; **values need owner sign-off against Figma** (swap in `globals.css` only).

**Phase 3: AI Stylist + Inline Suggestions**
- **Status**: ✅ complete — shipped in `83a09db` (`feat(phase3): weather-aware AI stylist voice + inline avatar try-on`) and hardened via PR #9 (`1538e6f`, `a47a291`), all on `main`. See report `.claude/PRPs/reports/ai-stylist-inline-suggestions-report.md`. Re-verified this session: server 41/41 (ChatService/Weather/Outfit/ChatController) + web 7/7 (weather + chat-api).
- **Goal**: A trustworthy, human-centered stylist that returns few, decisive, context-aware picks rendered inline.
- **Scope**: New prompt voice; occasion/mood/weather inputs; `[GENERATE_OUTFIT]`/`[SUGGESTIONS]`; render on avatar.
- **Success signal**: Suggestions render on the user's avatar; picks reference real catalog pieces + Toronto weather. **Met on `/chat`** (`OutfitCard` → `AvatarViewer`). Known follow-ups (non-blocking): the floating widget still renders text-only (discards `outfit`); no Vitest component tests for `OutfitCard`/`ChatMessageBubble` (E2E-only).

**Phase 4: Virtual Fitting (Full 3D) + Fit/Size**
- **Status**: ✅ complete — merged via PR #8 (`worktree-iyae-phase4-prp-plan`), hardened in PR #13, and all Critical/High/Medium phase3+phase4 review findings resolved in PR #14. See plan `.claude/PRPs/plans/completed/virtual-fitting-3d-fit-size.plan.md` and report `.claude/PRPs/reports/virtual-fitting-3d-fit-size-report.md` (worker hardening + recommended-size + one-tap delete + 2D preview + inline chat try-on).
- **Goal**: Measurement-true try-on that clears the zero-friction bar and drives the fit KPI.
- **Scope**: Harden SMPL-X + rigging; instant 2D preview + async high-fidelity; recommended size; inline embed; fix `measurements_to_betas` + Meshy validation; privacy (face optional / one-tap delete).
- **Success signal**: First preview is instant; recommended size shows on every try-on; validated fit accuracy metric.

**Phase 5: Marketplace + Local Designers + ADMIN**
- **Goal**: A curated Toronto indie marketplace with consistent cross-brand sizing and governance.
- **Scope**: Local Designers filter; designer studio/upload; asset-light no-inventory; normalize designer measurements to SMPL-X; ADMIN role + moderation endpoints.
- **Success signal**: A local designer can be onboarded and their pieces get a consistent "your size"; admin can moderate.

**Phase 6: Community**
- **Goal**: Authentic UGC that counters AI skepticism.
- **Scope**: Feeds (Following/Discover/Toronto/Body-confidence); posts/likes/comments; Share a Look; real counts; moderation.
- **Success signal**: Real users post looks; counts are non-fabricated; moderation works.

**Phase 7: Resale / Circular / Trade-in**
- **Goal**: A sustainability/affordability layer for Gen Z.
- **Scope**: Data-model additions + listing lifecycle (depth TBD).
- **Success signal**: A user can list/relist a piece; flows integrate with catalog.

**Phase 8: Toronto Physical Touchpoints + Shipping**
- **Goal**: Hybrid retail + resilient logistics.
- **Scope**: In-city pickup / same-day; multi-carrier shipping.
- **Success signal**: A Toronto order can be picked up in-city; no single-carrier dependency.

**Phase 9: Hardening, A11y & KPI Instrumentation** (cross-cutting)
- **Goal**: Production-grade, accessible, measurable relaunch.
- **Scope**: Email verification on; rate-limit trusted-proxies; WCAG 2.1 AA incl. 3D viewer; A/B cohort instrumentation (conversion/return/retention/bracketing); dark-pattern-free checkout.
- **Success signal**: KPIs are queryable by cohort from launch; a11y audit passes; verification/gating live.

### Parallelism Notes

Phase 1 is the gate for everything. Phase 9 (instrumentation/a11y) **runs alongside Phase 2** so KPIs exist from day one. Once Phase 2 lands, **Phases 3, 4, 5 run in parallel** (AI, try-on, marketplace are independent surfaces sharing only the theme). Phase 6 (Community) needs the ADMIN role from Phase 5; Phase 6 and Phase 7 (Resale) can run together. Phase 8 needs the marketplace (Phase 5). For a single-owner team, a realistic serial-ish order is **1 → 2(+9) → 4 → 3 → 5 → 6 → 7 → 8**, front-loading the hero try-on after the branded reskin.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Rebuild strategy | Reskin + targeted refactor on existing stack | Full rewrite; framework migration | Core app is token-driven; backend/worker brand-agnostic & production-grade; strong test net |
| Brand name | **IYAE** (remove all FORME/Clossette) | Keep FORME | FORME is a legacy working name; new independent company |
| Data | **Fresh relaunch** (new DB, discard old users/orders/assets) | Migrate; migrate catalog only | Cleanest, lowest effort; fits new independent company |
| Virtual try-on (MVP) | **Full 3D measurement-true, launch hero** | Lightweight 2D + size (recommended); two-stage rollout | Owner decision — accepts maintenance/latency risk for visual differentiation; risks logged & mitigated |
| Currency | **CAD single source of truth**, display `$` | Keep USD; multi-currency | Toronto localization; fixes existing USD/CAD checkout bug |
| Designer economics | **Deferred (TBD)**, buyer-side first | Low commission; subscription; hybrid | Not needed for buyer-side MVP; must be set before onboarding |
| v1 breadth | Include AI stylist + community + resale + physical touchpoints | Narrow to core commerce | Owner selection; sequenced across phases with capacity flagged |
| INTRO landing | Deferred to later iteration | Build in v1 | Owner decision; empty in Figma |
| Rigging maintenance | Keep in scope (full 3D chosen) with stub fallback for CI/dev | Descope to stub for MVP | Consequence of full-3D decision; contained via isolation + validation |
| Infra defaults | Email verification ON; add ADMIN role; rate-limit trusted-proxies; `iyae.ca`/`noreply@iyae.ca` | Inherit current (verification off; no ADMIN) | New independent company needs governance & correct security posture |

---

## Research Summary

**Market Context**
No competitor owns IYAE's four-way combination. Closest: **Alta** (AI closet + avatar try-on; no marketplace/local), **Daydream** (chat discovery; no try-on/closet), **Pronti** (Toronto AI stylist; no try-on/marketplace), **Garmentory/Common Goods** (Canadian marketplaces; no AI/try-on). Benchmarks: **Wolf & Badger** (~33–38% opaque commission — undercut with transparency), **NJAL** (subscription/zero-commission), **SSENSE** (90–120-day payment terms → the designer-economics anti-pattern to invert with prompt payouts). Category truths: try-on is a **feature not a destination** (Doppl shutdown); **fit > spectacle** (flattery raises returns); onboarding friction is the #1 conversion leak; Gen Z is AI-skeptical and values-driven; Canada tailwinds are real ("Buy Canadian," AI-for-research adoption) but **never rely on Canada Post alone**. Toronto supply is opening up (SSENSE CCAA, Frank And Oak, TFI closure).

**Technical Context**
Reskin-not-rewrite confirmed: 108/134 web `.tsx` use semantic tokens; one `@theme` block governs the theme; shadcn primitives regenerable; backend/DB/worker tables are unbranded (no schema rename); auth/security stack is production-grade; server↔worker task-queue contract is clean and reusable. Costs concentrate in: the `home/` marketing layer (~3,575 LOC, bypasses tokens), the pure-Python rigging stack (libigl/robust-laplacian/SMPL-X-via-LFS — the top maintenance liability, kept because full-3D was chosen), the `com.clossette` rename (220 files / 861 occurrences, low logic risk), the hardcoded `/var/clossette/assets` path (~15 sites), the **CAD/USD checkout bug** (`CheckoutService.java:85`), duplicated email templates, dead `tailwind.config.ts`, ineffective Nginx-topology rate limiting, prod email-verification disabled, and no ADMIN role. Regression net (~338 server / 227 web / 292 worker tests) makes the refactor safe.

---

*Generated: 2026-09-04*
*Status: DRAFT — needs validation (KPI baselines, designer economics, brand constants)*
