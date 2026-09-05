# Implementation Report: Design System + Core Reskin (Phase 2)

## Summary
Rewrote IYAE's single authoritative theme (`web/app/globals.css`) from the warm-linen + purple
palette to an editorial **White / Burgundy / Ink** token system, then migrated every hardcoded
color surface across `app/`, `components/`, and `lib/` onto semantic tokens. shadcn primitives
re-theme for free (token-driven, no CLI regen). Dark mode authored on every surface. A
residue-scan gate now rejects legacy color literals.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | XL | XL |
| Confidence | — | High (foundation + gate verified; palette provisional) |
| Files Changed | ~70 | 72 (69 code, 2 new, + docs) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 0 | Extract Figma tokens | ✅ (deviated) | No Figma export in repo + no URL → shipped the plan's PROVISIONAL editorial-burgundy palette; flagged in PR + PRD Open Questions for owner sign-off (plan-sanctioned) |
| 1 | Rewrite color token block | ✅ | Light + dark `@theme`: white bg, burgundy primary/ring/brand, ink fg, neutral muted |
| 2 | Add missing + status tokens | ✅ | `secondary(-foreground)`, `destructive-foreground`, `success/warning/info(-foreground)` + dark variants |
| 3 | Typography (serif + tracked sans) | ✅ | Kept Cormorant Garamond serif + Geist Sans body (code already Geist; docs said Inter — fixed); added `--tracking-display` on headings |
| 4 | Remap landing token layer | ✅ | 6 `--color-landing-*` → White/Burgundy/Ink |
| 5 | Register wizard + auth | ✅ | via parallel agent |
| 6 | Commerce routes | ✅ | via parallel agent |
| 7 | Status tokens + unify badge map | ✅ (deviated) | `lib/status.ts` (TONE_CLASS/STATUS_TONE/statusBadgeClass) created up-front by orchestrator; orders maps unified; also covered plan-missed status components (GenerationStatusBadge, RiggingStatusBadge/Card, ChatSidebar) |
| 8 | Hex-swatch surfaces + bg-white | ✅ | profile/[username], design/style-lab/ar; white-on-dark CTAs → `bg-paper` (theme-invariant cream) |
| 9 | text-white-on-brand batch | ✅ | 14 files → text-primary-foreground |
| 10 | Rebuild home/ | ✅ | 14 files; dark-section gradients → `--gradient-hero-*`; paper → `--color-paper`; 3D accent lights retoned |
| 11 | Residue-scan gate | ✅ | `web/scripts/residue-scan.sh` (passes, exit 0) |
| 12 | Docs + PRD sync | ✅ | web/CLAUDE.md tokens/config/fonts; PRD open-question; root CLAUDE.md had no stale brand prose |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Type check (`tsc --noEmit`) | ✅ Pass | Zero NEW errors. 2 pre-existing errors remain in untouched test/e2e files (`useGenerationStatus.test.ts`, `checkout-flow.spec.ts`) — out of scope |
| Build (`next build`) | ✅ Pass | All 37 routes compile/prerender — proves `@theme` token + font wiring resolves |
| Unit tests (`vitest`) | ⚠️ 209/222 pass | 13 in `useOutfitRiggingStatus.test.ts` don't report due to a PRE-EXISTING vitest fork-worker teardown timeout (reproduces in isolation; untouched polling-hook test; not an assertion failure) |
| Lint (`eslint`) | ⚠️ Pre-existing only | 55 errors (`no-explicit-any` 12, `set-state-in-effect` 42, `prefer-const` 1) — ALL pre-existing; **zero introduced by the color reskin** (verified: color className swaps cannot trigger these rules; JSON cross-check found no migration-caused error) |
| Residue-scan gate | ✅ Pass | purple/rose/stone/status/bg-white = 0; hex only in allowlist |

## Files Changed
72 files: 69 code (ts/tsx/css) + web/CLAUDE.md + PRD. New: `web/lib/status.ts`, `web/scripts/residue-scan.sh`.

Allowlisted hex exceptions (documented, intentional): `globals.css` (token home), `components/ui/*`
(shadcn), R3F material files (`TryOnViewer`, `ARViewer`, `DemoOutfitModel` — Three.js needs literal
color values), `lib/email-templates.ts` (email clients strip CSS vars), `lib/profile-options.ts`
(real fashion color-swatch data the user picks).

## Deviations from Plan
- **Task 0 (Figma)**: No Figma export/URL available → used the plan's PROVISIONAL editorial-burgundy
  palette; token NAMES stable, VALUES pending owner sign-off (flagged in PR + PRD). Plan-sanctioned.
- **Execution model**: Foundation (globals.css + lib/status.ts) done solo, then migration fanned
  out to a 12-group parallel workflow. 7 groups completed; 5 hit the **account monthly spend limit**
  mid-run (status-badges, home HeroSection/HowItWorks/AIStylist/TryOnSection). Those 5 (+ their
  partial edits) were completed solo in the main loop.
- **Scope beyond the plan's file list**: the residue gate covers all of `app/components/lib`, so
  plan-missed files that carried legacy literals were also migrated — ARViewer, PostDetailDialog,
  community/page, ChatSidebar, GenerationStatusBadge, RiggingStatusBadge/Card, social-graph.ts,
  email-templates.ts.
- **`--gradient-hero-*`** added to globals.css to hold the theme-invariant dark hero/immersive
  gradients (keeps hex out of home components).
- **`bg-paper`** (theme-invariant cream, `.dark` not overridden) used for white-on-fixed-dark CTAs
  and home glass overlays — passes the gate and is correct in both themes.

## Issues Encountered
- **Account monthly spend limit** hit during the parallel migration burst (~1.12M subagent tokens),
  failing 5 of 12 agents. Resolved by completing the remainder solo in the main loop and committing
  in checkpoints to protect progress.
- **Pre-existing lint/test-infra debt** (55 lint errors, 1 flaky vitest fork-worker) is unrelated to
  the reskin and left untouched to avoid scope creep.

## Tests Written
None. This is a visual reskin (colors only) — behavior, selectors, and asserted logic/text are
unchanged, so the existing 222-case suite is the regression net (color changes don't touch
assertions). `web/lib/status.ts` is exercised indirectly via the migrated status surfaces.

## Next Steps
- [ ] Owner: confirm/replace the PROVISIONAL burgundy/serif/tracking against Figma (swap values in `globals.css` only)
- [ ] Manual light+dark visual smoke on landing / register / commerce / profile / status surfaces
- [ ] (Separate PR) address pre-existing lint errors + the flaky `useOutfitRiggingStatus` worker teardown
- [ ] Phase 9 WCAG/contrast audit (owns a11y; do not regress contrast)
