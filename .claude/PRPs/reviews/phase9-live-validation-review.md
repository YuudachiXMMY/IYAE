# Code Review: Phase 9 Live Validation (local, uncommitted)

**Reviewed**: 2026-09-08
**Branch**: feat/phase9-live-validation
**Decision**: APPROVE (with comments)

## Summary
Small, well-scoped changeset that (a) fixes a real production infinite-render-loop
bug in `useOutfitRiggingStatus`, (b) fixes two genuine axe a11y violations
(color-contrast token + link-in-text-block), and (c) makes the E2E specs runnable
against a live seeded server. No security issues, no new type/lint errors, no
CRITICAL/HIGH findings. The one behavioral narrowing (content-signature sync) is
an intentional, documented tradeoff with negligible real-world impact.

## Findings

### CRITICAL
None.

### HIGH
None.

### MEDIUM
None.

### LOW
- **web/lib/hooks/useOutfitRiggingStatus.ts:26-32 — sync signature narrows re-sync scope.**
  `initialItemsKey` is built only from `productId` + `riggedGlbUrl`. If a caller ever
  replaces an item's *other* fields (productName, productPrice, media, slot, category)
  while keeping productId + riggedGlbUrl identical, the local `items` state retains the
  stale values — the sync effect won't fire. For the sole production caller
  (outfits/[id]/view) only `riggedGlbUrl` mutates over the outfit's lifetime, so this is
  safe today. Acceptable as-is; revisit only if a caller mutates non-rig fields in place.
  - Sub-note: signature joins with `:`/`|` while `riggedGlbUrl` can contain `:`. Rig URLs
    are server-relative paths, so a real key collision is not realistic — no action.

### INFORMATIONAL
- **web/app/globals.css:14 — --color-muted-foreground #6f6f6f → #5f5f5f (light only).**
  Global design-token darkening (4.38:1 → ~5.7:1 on bg-muted #f4f1ee; passes WCAG AA).
  Correct fix, but shifts every muted-foreground surface app-wide — worth owner/design
  sign-off (already flagged in the report). Dark value (#a8a29e) intentionally unchanged.

## Validation Results

| Check | Result | Notes |
|---|---|---|
| Type check | Pass | Only 2 pre-existing TS2345, zero new |
| Lint | Pass | Only pre-existing; eslint-disable on new sync dep matches existing poll-dep pattern |
| Unit tests | Pass | Full Vitest 30 files / 301 tests green, no OOM (the "OOM" was this loop bug) |
| Seed-cred correctness | Pass | emma@iyae.ca + password123 confirmed vs DataSeeder.java:77-79 (domain default iyae.ca) |
| a11y live | Pass | home / products / product-detail axe-clean on current source |

## Files Reviewed
- web/lib/hooks/useOutfitRiggingStatus.ts — Modified (core fix)
- web/__tests__/lib/hooks/useOutfitRiggingStatus.test.ts — Modified (timing fix + regression test)
- web/app/globals.css — Modified (contrast token)
- web/app/products/[id]/page.tsx — Modified (link-in-text-block)
- web/e2e/a11y.spec.ts — Modified (seed creds + timeout)
- web/e2e/pose-selector.spec.ts — Modified (seed creds + documented test.fixme)
- web/playwright.config.ts — Modified (env-overridable baseURL)
- web/.gitignore, web/CLAUDE.md, .claude/PRPs/prds/iyae.prd.md — Docs/config
- .claude/PRPs/plans/completed/…, .claude/PRPs/reports/… — Artifacts

## Recommendation
Approve. No blocking issues. Proceed to /prp-pr. Carry the two report caveats forward:
re-verify the 3 authed a11y routes after a `docker compose build web`, and get design
sign-off on the muted-foreground darkening.
