# Finding: Authed a11y re-verify — checkout error banner contrast

**Recorded**: 2026-09-08
**Context**: Carry-forward caveat from PR #22 (Phase 9 Live Validation) — re-verify the
3 authenticated a11y routes after a `docker compose build web`. Web image was rebuilt and
restarted; axe run against the live container on `:3000` (seeded buyer `emma@iyae.ca`).
**Decision**: **RESOLVED (2026-09-08)** — owner approved the global token darken via the
`phase9-authed-a11y-closeout` plan; fixed on branch `worktree-phase9-authed-a11y-closeout`.
See Resolution below.

## Result

| Route | axe (serious/critical) |
|---|---|
| `/cart` | Pass |
| `/try-on` | Pass |
| `/checkout` | **Fail — 1 serious** |

## The violation

- Element: `#checkout-error` (`role="alert"`), copy "Couldn't load delivery options. Please retry."
  (`app/checkout/page.tsx:142-144`).
- `text-destructive` (`#dc2626`) over `bg-destructive/10` (composited `#fce9e9`) →
  contrast **4.13:1**, below WCAG AA 4.5:1 (`wcag143`, `wcag2aa`).
- Not checkout-specific: the `bg-destructive/10 + text-destructive` error-banner pattern
  recurs across **27 files / 36 banners** (login/register/cart/orders/resale/designer/…). All
  hit the same global token, so any destructive error banner on a light tint fails AA.
  Phase 9 only verified home/products/product-detail (public), so this was never surfaced.

## Root cause

`app/globals.css:26` — light-mode `--color-destructive: #dc2626` (red-600). Same class of
global-token contrast issue as the Phase 9 `--color-muted-foreground` fix.

## Recommended fix (applied)

Darken light-mode `--color-destructive` `#dc2626` → `#b91c1c` (red-700): contrast rises to
**~5.5:1** on the `/10` tint (higher on white), one change clears all banners; leave the
dark-mode value `#ef4444` (`globals.css:103`) unchanged. This is an app-wide brand/status
color shift — needed owner/design sign-off (same as the muted-foreground precedent).

## Resolution (2026-09-08)

Fixed as recommended: light-mode `--color-destructive` `#dc2626 → #b91c1c` (red-700) in
`web/app/globals.css`. The `bg-destructive/10 + text-destructive` banner now composites to
~5.5:1 (≥ AA 4.5:1); the one token clears the banner pattern (measured: 27 files / 36
banners). Dark-mode `#ef4444` unchanged. Guarded by `web/__tests__/a11y/token-contrast.test.ts`
(pins destructive + muted-foreground light tokens ≥ AA; asserts the pre-fix red would fail)
and a deterministic invalid-login banner case in `web/e2e/a11y.spec.ts`. Web unit suite green
(31 files / 304 tests). Live docker axe re-verify of the 3 authed routes is the deploy-time
confirmation (see `.claude/PRPs/reports/phase9-authed-a11y-closeout-report.md`).

## Side observation (orthogonal to a11y)

The error banner only rendered because the fulfillment (delivery options) API returned a
failure in this run. Unrelated to the contrast bug (any destructive banner triggers it), but
worth a separate look if checkout delivery-option loading is genuinely flaky.
