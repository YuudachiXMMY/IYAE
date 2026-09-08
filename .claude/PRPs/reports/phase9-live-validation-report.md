# Implementation Report: Phase 9 Live Validation

## Summary
Closed out Phase 9's "run the a11y/pose E2E live + fix the OOM" next-steps. The headline result: the long-standing `useOutfitRiggingStatus.test.ts` "OOM" — flagged in three prior reports as *pre-existing / environmental / unrelated* — was in fact a **real infinite-render-loop bug in the production `useOutfitRiggingStatus` hook** that also hangs the outfit viewer. Fixed at the source; the full web unit suite now runs clean (30 files / 301 tests, ~8s, no OOM). Separately, wired the two live specs to a **seeded** account, `test.fixme`-guarded the pose spec's rigged-outfit-dependent tests, ran the axe gate against **current source**, and fixed the two real serious/critical a11y violations it surfaced on the PDP (color-contrast + link-in-text-block).

## Assessment vs Reality
| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium–Large (OOM root cause + real a11y fixes + stale-container detour) |
| Confidence | 8/10 | Met for the achievable scope; 3 authed routes could not be re-verified on current source (dev-server login artifact) |
| Files Changed | 6–9 | 8 code/doc + 1 plan + 1 report |
| OOM root cause | Fake-timers / pool / heap (staged) | **None of these** — a real infinite `setItems→render→new-[]→effect` loop in the hook |

## Tasks Completed
| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Reconcile seed-email domain | ✅ | Probed live login (non-destructive): running stack uses the default `iyae.ca`; `emma@iyae.ca`/`password123` → 200. Did NOT reset (would rebuild + disturb the user's running stack) |
| 2 | Fix login creds in both specs | ✅ | `jadyn.hwu@gmail.com`/`admin` (unseeded) → `emma@iyae.ca`/`password123`; also bumped the login `waitForURL` to 30s for slower servers |
| 3 | Run a11y live + gate serious/critical = 0 | ✅ (public) / ⚠️ (authed) | Found + fixed 2 real PDP violations; home/products/product-detail verified green on current source. Authed routes clean on the deployed build; current-source re-verify blocked by a dev-server login artifact (see Deviations) |
| 4 | Resolve pose rigged-outfit dependency | ✅ (Option B) | 5 canvas tests `test.fixme` with a documented prerequisite comment; the seed-independent test passes live. Roving-tabindex a11y stays covered by CI `PoseSelector.test.tsx` |
| 5 | Diagnose + fix the OOM | ✅ | Real hook bug fixed (content-keyed sync effect) + one stale test assertion corrected + regression test added; full suite green, no OOM |
| 6 | Docs / report / PRD / archive | ✅ | This report; `web/CLAUDE.md` updated; PRD Phase 9 links the plan; plan archived |

## Validation Results
| Level | Status | Notes |
|---|---|---|
| Static Analysis (tsc) | ✅ Pass | Only the 2 pre-existing `TS2345` in `useGenerationStatus.test.ts` (documented); zero new |
| Lint (eslint) | ✅ Pass | Only pre-existing findings (`set-state-in-effect` at `products/[id]/page.tsx:130`, unused `waitFor`/`ApiError`, `any` at test:169); zero new |
| Unit (web Vitest) | ✅ Pass | 30 files / 301 tests, ~8s, **no heap OOM** (previously hung indefinitely on `useOutfitRiggingStatus.test.ts`) |
| E2E — a11y (current source, host dev) | ✅ 3/3 public green | home ✓, /products ✓, /products/[id] ✓ (after fixes); authed routes blocked by dev-login artifact |
| E2E — a11y (deployed prod build) | ✅ cart/checkout green; try-on badge fixed by token | Baseline confirmed on the running `:3000` container |
| E2E — pose (deployed prod build) | ✅ | `pose selector hidden without rigged garments` passes live; 5 rigged-outfit tests `fixme` (visible, not silently dropped) |

## Files Changed
| File | Action | Notes |
|---|---|---|
| `web/lib/hooks/useOutfitRiggingStatus.ts` | UPDATED | **Bug fix**: sync effect keyed on a content signature, not the array reference — kills the infinite loop when callers pass `outfit?.items ?? []` |
| `web/__tests__/lib/hooks/useOutfitRiggingStatus.test.ts` | UPDATED | Corrected the stale synchronous `pendingCount` assertion (added `await act`); +1 regression test for unstable-array callers |
| `web/app/globals.css` | UPDATED | `--color-muted-foreground` (light) `#6f6f6f` → `#5f5f5f` — meets WCAG AA 4.5:1 on `bg-muted` (#f4f1ee); fixes PDP + try-on badge contrast app-wide. Dark value unchanged |
| `web/app/products/[id]/page.tsx` | UPDATED | Guest "sign in" link `hover:underline` → persistent `underline underline-offset-2` (link-in-text-block AA) |
| `web/e2e/a11y.spec.ts` | UPDATED | Seeded creds; 30s login wait |
| `web/e2e/pose-selector.spec.ts` | UPDATED | Seeded creds; 30s login wait; 5 tests `test.fixme` + prerequisite comment |
| `web/playwright.config.ts` | UPDATED | `baseURL` now honors `PLAYWRIGHT_BASE_URL` (default unchanged) — lets axe run against a host dev server |
| `web/CLAUDE.md` | UPDATED | Seeded e2e login, pose fixme prerequisite, `PLAYWRIGHT_BASE_URL`, token bump |
| `.claude/PRPs/prds/iyae.prd.md` | UPDATED | Phase 9 row links this plan |

## Deviations from Plan
- **OOM root cause was NOT what the plan predicted.** The plan's staged remediation (fake-timer teardown → pool/isolate → heap bump) all failed. Empirically isolated the hang to the *trivial* empty-array test (no timers/async), then to a **real infinite loop in the hook**: `useEffect(() => setItems(initialItems), [initialItems])` re-fires forever when `initialItems` is a fresh array each render. The production caller `app/outfits/[id]/view/page.tsx:67` passes exactly such an array (`outfit?.items ?? []`), so this hung the outfit viewer too, not just the test. Fixed the hook (content-keyed effect) rather than masking it in the test — which the plan explicitly authorized once a real hook bug was proven.
- **The running web container was a stale 2026-09-05 prod build** (`node server.js`, no source mount) — predating the FORME redesign and this work. The first live axe run tested that stale code (button-name criticals that no longer exist in current source). Switched to a **host `next dev` server** (`:3100`, current branch) with an env-overridable Playwright `baseURL` to test current source honestly.
- **3 authenticated routes (cart/checkout/try-on) could not be re-verified on current source.** On the host dev server the browser login stays on `/login` (never redirects to `/dashboard`), timing out `waitForURL` — a dev-server-only artifact (the same credential succeeds on the prod build, and the API proxy returns 200 via curl). These routes are axe-clean on the deployed build, and the only source change touching them (the darker muted-foreground token) strictly *improves* contrast (it fixes try-on's "Not available" badge). Not re-run against current source; not a11y findings.
- **Task 1 domain reconciliation** used a non-destructive live probe instead of `./dev.sh reset` (the stack was already running with seeded data; a reset would rebuild and disturb the user's environment). Chose to edit the specs to `@iyae.ca` rather than override `BRAND_DOMAIN` in `.env`.

## Issues Encountered
- `@axe-core/playwright` was declared in `package.json` but missing from `node_modules` → ran `npm install`.
- `npm install` bumped Playwright to a build expecting `chromium_headless_shell-1223` (cache had `-1234`) → ran `npx playwright install chromium`.
- Repeated launch/kill of hung vitest runs leaked tinypool worker forks that polluted later runs → added per-run leak cleanup; confirmed env health via the known-good sibling `useGenerationStatus.test.ts` (11/11, 748ms).

## Tests Written
| Test File | Tests | Coverage |
|---|---|---|
| `web/__tests__/lib/hooks/useOutfitRiggingStatus.test.ts` | +1 (13→14) | Regression: hook does not loop/re-poll when the caller passes a fresh array of identical content each render (the `outfit?.items ?? []` scenario) |

## Acceptance Criteria
- [x] Both specs log in with a seeded credential (`emma@iyae.ca`); no `jadyn.hwu`/`admin`
- [x] a11y serious/critical = 0 on the routes verifiable against current source (home, /products, /products/[id]); the 2 real PDP violations fixed at source
- [~] Authed routes: axe-clean on the deployed build; current-source re-verify blocked by a dev-server login artifact (documented, not an a11y finding)
- [x] Pose: seed-independent test passes live; 3D tests `fixme`-guarded with a documented prerequisite (not silently dropped)
- [x] `useOutfitRiggingStatus.test.ts` passes with no OOM; full `npm run test` completes (301 passed)
- [x] tsc clean (no new errors); lint clean (no new errors)
- [x] `web/CLAUDE.md` + this report + PRD reference updated

## Next Steps
- [ ] Re-verify cart/checkout/try-on axe on current source after the next web-container rebuild (`docker compose build web && docker compose up -d web`), or once the dev-server login-redirect artifact is understood.
- [ ] (Optional, Task 4A) Seed a buyer outfit with a rigged garment so the 5 `fixme` pose tests can run live; then un-`fixme`.
- [ ] Owner sign-off on the `--color-muted-foreground` darkening (#6f6f6f → #5f5f5f) — an AA-driven legibility change, not a brand-hue change.
- [ ] Code review via `/code-review`; open PR via `/prp-pr`.
