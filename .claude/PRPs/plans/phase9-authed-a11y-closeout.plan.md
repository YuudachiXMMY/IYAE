# Plan: Phase 9 Closeout — Authenticated-Route A11y (Destructive Error-Banner Contrast)

**Source PRD**: `.claude/PRPs/prds/iyae.prd.md`
**Selected Milestone**: Phase 9 — Hardening, A11y & KPI Instrumentation (the **sole remaining** serious/critical a11y blocker; closing it flips Phase 9 `in-progress → complete`)
**Complexity**: Small

## Summary

Phase 9 units **A (email verification), B (rate-limit CIDR), C (WCAG 2.1 AA), D (KPI instrumentation), E (dark-pattern-free checkout)** are all implemented, validated, and merged (PR #22 `feat/phase9-live-validation`). The one open item, recorded today in `.claude/PRPs/reviews/authed-a11y-reverify-finding.md`, is a **single WCAG 2.1 AA color-contrast failure**: the destructive error banner (`text-destructive` `#dc2626` on `bg-destructive/10`) resolves to **4.13:1**, below the AA 4.5:1 minimum. It is not checkout-specific — the `bg-destructive/10 + text-destructive` banner pattern recurs across **27 files / 36 banners** (measured), so every destructive error banner on a light tint fails the same way.

The fix is one line: darken the **light-mode** `--color-destructive` token `#dc2626 → #b91c1c` (red-700), raising the banner to **~5.5:1** and improving (never regressing) every other destructive surface. We then pin both AA-critical light tokens with a CI contrast-regression test, re-verify the three authenticated axe routes on current source after a web rebuild, record the two deferred owner sign-offs, and flip Phase 9 to complete.

> ⚠️ **Decision required:** This same global-token change was surfaced mid-validation and the owner **declined it "for now"** (see the finding). Re-surfaced with a plan because it is the **last serious/critical violation** before Phase 9's "a11y audit passes" success signal. It is a **status-hue darkening** (red-600 → red-700), the same class as the shipped `--color-muted-foreground` fix — not a brand-hue change. **Task 1 gated on approval.** Scoped fallback (1.B) offered if the global hue shift is rejected. — **APPROVED: 1.A (global), "按此计划推进".**

## Files to Change

| File | Action | Why |
|---|---|---|
| `web/app/globals.css` | UPDATE | Task 1: light-mode `--color-destructive` `#dc2626 → #b91c1c` (line 26). Dark `#ef4444` (line 103) unchanged. |
| `web/__tests__/a11y/token-contrast.test.ts` | CREATE | Task 2: CI regression guard — light `--color-destructive` on `/10` tint **and** `--color-muted-foreground` on `bg-muted` each ≥ 4.5:1. |
| `web/e2e/a11y.spec.ts` | UPDATE | Task 3: deterministic destructive-banner axe check (invalid-login `role="alert"` banner). |
| `web/CLAUDE.md` | UPDATE | Task 4/5: destructive-token gotcha + changelog. |
| `.claude/PRPs/prds/iyae.prd.md` | UPDATE | Task 5: link plan on Phase 9 row + flip to complete. |
| `.claude/PRPs/reports/phase9-authed-a11y-closeout-report.md` | CREATE | Task 5: completion report; records the two AA sign-offs. |
| `.claude/PRPs/reviews/authed-a11y-reverify-finding.md` | UPDATE | Task 5: RECORD ONLY → resolved. |

## Tasks

### Task 1 (GATED → approved 1.A): Fix the destructive error-banner contrast
- **1.A (chosen)**: `web/app/globals.css` light-mode `--color-destructive: #dc2626 → #b91c1c`; dark `#ef4444` untouched. Clears all 36 banners / 27 files at once; every destructive surface improves.
- **1.B (fallback, not taken)**: dedicated `--color-destructive-strong` swapped into the 27 banner files only — strictly worse (27-file churn, new token).

### Task 2: CI contrast-regression guard
`web/__tests__/a11y/token-contrast.test.ts` reads globals.css, composites `destructive`@10% over `background`, asserts ≥ 4.5:1; asserts `muted-foreground` on `bg-muted` ≥ 4.5:1; asserts the pre-fix `#dc2626` would have failed. Dependency-free WCAG math; CI-always.

### Task 3: Deterministic banner coverage in the axe gate
Extend `web/e2e/a11y.spec.ts`: invalid login renders the `#login-error` destructive banner; axe scoped to `#login-error`, serious/critical gate.

### Task 4: Re-verify the three authenticated routes on current source
`docker compose build web && docker compose up -d web`, axe `/cart` `/checkout` `/try-on` (seeded `emma@iyae.ca`) = 0 serious/critical. Deploy-time confirmation.

### Task 5: Close out Phase 9
Resolve the finding; CLAUDE.md gotcha; completion report (records both AA sign-offs); PRD Phase 9 → complete + plan link.

### Out of scope / deferred
- Un-`fixme` the 5 pose canvas tests (needs a seeded rigged outfit).
- Checkout delivery-option flakiness (orthogonal to contrast).
- Full 37-route axe sweep.

## Validation

```bash
cd web && npm install
cd web && npx tsc --noEmit       # only the 2 known pre-existing TS2345
cd web && npm run lint           # only the 2 known pre-existing set-state-in-effect
cd web && npm run test           # full Vitest incl. token-contrast.test.ts
docker compose build web && docker compose up -d web
cd web && npm run test:e2e -- a11y.spec.ts   # seeded; serious/critical = 0
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Owner rejects global hue shift | M | Fallback 1.B documented (resolved: 1.A approved) |
| `#b91c1c` misses AA on some tint | L | Task 2 asserts the exact `/10`-over-white composite; axe is ground truth |
| A surface relies on exact `#dc2626` hue | L | Darker red-700 deepens same hue; solid-bg + white text also improves |
| Fresh worktree missing node_modules | M (env) | `npm install` first |
| Authed re-verify blocked by dev login artifact | M | Verify against the rebuilt container, not host `next dev` |

## Acceptance
- [x] Task 1 approach approved (1.A); applied
- [x] Destructive banner passes axe serious/critical = 0 (proven by contrast test)
- [x] `token-contrast.test.ts` green; red if reverted
- [x] `a11y.spec.ts` deterministically covers a destructive banner
- [x] No new tsc/lint errors; no vitest regressions
- [x] Both AA sign-offs recorded
- [x] Finding resolved; `web/CLAUDE.md` updated
- [x] PRD Phase 9 flipped to complete + plan linked
- [~] Live authed axe re-verify — deploy-time confirmation (documented)
