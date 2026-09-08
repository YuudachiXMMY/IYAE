# Implementation Report: Phase 9 Live Authed-Route Axe Re-Verify

## Summary
Executed the sole remaining Phase 9 carry-forward item — the **live axe-core re-verification** of the three authenticated routes (`/cart`, `/checkout`, `/try-on`) plus the destructive-banner cases — against a **freshly rebuilt web container** serving the `--color-destructive #b91c1c` (red-700) fix. **All 7 axe tests passed with 0 serious/critical violations.** This is the deploy-time confirmation the closeout report tracked as its last open box.

## Assessment vs Reality
| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Small (verification-only) | Small — no product-code change |
| Confidence | 9/10 | Confirmed; the one variable (environment) required the plan's *primary* rebuild path after the alt path hit server CORS |
| Files Changed | 0 code / 2–3 docs | 0 code / 4 docs (this report + closeout `[x]` + finding + archived plan) |

## Environment
| Item | Value |
|---|---|
| Date | 2026-09-08 15:08 EDT |
| Source HEAD | `5adac07` (main; `web/app/globals.css:26` = `--color-destructive: #b91c1c`) |
| Rebuilt web image | `iyae-web` created `2026-09-08T19:07:02Z` — replaced the stale pre-fix image (`05:48:58Z`, which served `#dc2626`) |
| Served token proof | built CSS chunk contains `b91c1c`; **no `dc2626`** anywhere in the served CSS |
| Login origin | `http://localhost:3000` (in server `CORS_ORIGINS`) → `POST /api/auth/login` = 200 |
| Runner | `PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test a11y.spec.ts --workers=1` |
| Seed buyer | `emma@iyae.ca` / `password123` (DataSeeder, `app.brand.domain` = `iyae.ca`) |

## Live Axe Results
| Route / Case | Result (serious/critical) | Advisory (moderate, non-blocking) |
|---|---|---|
| home `/` | ✅ 0 | landmark-one-main, region, skip-link |
| catalog `/products` | ✅ 0 | region, skip-link |
| product detail `/products/[id]` | ✅ 0 | — |
| **login error banner `/login`** (destructive banner, deterministic) | ✅ 0 | — |
| **cart `/cart`** (authed) | ✅ 0 | — |
| **checkout `/checkout`** (authed) | ✅ 0 | — |
| **try-on `/try-on`** (authed) | ✅ 0 | landmark-one-main, region, skip-link |

**7/7 passed (23.9s).** The `login error banner` case deterministically renders the `text-destructive` on `bg-destructive/10` pattern and passed — the direct live proof that `#b91c1c` clears WCAG AA on the tint.

## Tasks Completed
| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Bring up a clean, rebuilt stack | ✅ | Rebuilt `iyae-web` from main; `docker compose up -d --no-deps web` (mysql/server/worker untouched) |
| 2 | Confirm seed buyer | ✅ | `emma@iyae.ca` login = 200 on running :3001 |
| 3 | Run the live axe gate | ✅ | 7/7 pass, workers=1 |
| 4 | Handle `/checkout` banner path | ✅ | `/checkout` passed; destructive pattern independently proven by the invalid-login banner case |
| 5 | Record + close the box | ✅ | This report; closeout `[~]`→`[x]`; finding updated; plan archived |

## Validation Results
| Level | Status | Notes |
|---|---|---|
| Pre-flight unit (`token-contrast.test.ts`) | ✅ Pass | 3/3 (destructive ≥ AA, muted-foreground ≥ AA, pre-fix `#dc2626` would fail) |
| Live axe gate | ✅ Pass | 7/7, 0 serious/critical on the 3 authed routes + banner + public routes |
| Served-token proof | ✅ Pass | `b91c1c` present, `dc2626` absent in built CSS |
| Product code | N/A | No change — verification only |

## Files Changed
| File | Action | Notes |
|---|---|---|
| `.claude/PRPs/reports/phase9-live-authed-axe-reverify-report.md` | CREATED | this report |
| `.claude/PRPs/reports/phase9-authed-a11y-closeout-report.md` | UPDATED | `[~] Live authed axe re-verify` → `[x]` + pointer here |
| `.claude/PRPs/reviews/authed-a11y-reverify-finding.md` | UPDATED | "Live re-verify confirmed (2026-09-08)" under Resolution |
| `.claude/PRPs/plans/phase9-live-authed-axe-reverify.plan.md` | ARCHIVED | moved to `plans/completed/` |

## Deviations from Plan
- **WHAT**: The plan's Task 1 offered two paths — (primary) rebuild the docker web container, or (alt, per web/CLAUDE.md) run a host `next dev` on another port + `PLAYWRIGHT_BASE_URL` when a stale container occupies :3000. I attempted the **non-disruptive alt path first** (host dev on :3005) to avoid replacing the user's running container.
- **WHY it failed**: The Next.js rewrite forwards the browser `Origin: http://localhost:3005` to the Spring server, whose `CORS_ORIGINS` allowlist is `:3000,:3001,iyae.localhost`. State-changing `POST /api/auth/login` from origin :3005 → **403 Forbidden**, so `login()` never reached `/dashboard` (the 4 public routes still passed; only the 3 authed ones failed on the login hook, not on any a11y violation). curl (no Origin header) got 200, which masked it initially.
- **Resolution**: Fell back to the plan's **primary path** — rebuilt the docker web image from main (which already carries `#b91c1c`) and recreated `iyae-web-1` on the allowlisted :3000 origin. Login then succeeded and all 7 axe tests passed. The rebuild also brought the user's stale 13-hour-old pre-fix container up to current main (a net improvement, not a regression).

## Issues Encountered
- **Stale running container**: the pre-existing `iyae-web-1` (built 05:48Z) served the old `#dc2626` token — direct verification against it would have been invalid. Resolved by the rebuild.
- **Host-dev CORS 403** (above) — resolved by using the allowlisted :3000 origin.
- None outstanding.

## Tests Written
None — this was a run of the pre-authored `web/e2e/a11y.spec.ts` gate (no spec changes). Its 7 cases are the deliverable.

## Next Steps
- [x] Live authed axe re-verify — **confirmed** (this report).
- [ ] (Optional) Seed a rigged outfit to un-`fixme` the 5 pose canvas tests (tracked separately; out of scope).
- [ ] (Optional, orthogonal) Investigate checkout delivery-options flakiness if it recurs — unrelated to contrast.
