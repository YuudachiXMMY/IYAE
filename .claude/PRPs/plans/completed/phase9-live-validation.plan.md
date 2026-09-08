# Plan: Phase 9 Live Validation — E2E a11y/pose against a live server + fix the `useOutfitRiggingStatus` OOM

## Summary
Close out Phase 9's "Next Steps": actually **run** the authored `a11y.spec.ts` and `pose-selector.spec.ts` against a live dev+API server, gate on **zero serious/critical axe violations**, and fix the pre-existing `useOutfitRiggingStatus.test.ts` Vitest heap OOM so the unit suite runs clean. Exploration uncovered three concrete blockers that make the specs un-runnable as-written on a fresh seeded DB (unseeded login user, seed-domain mismatch, no rigged-outfit seed) — this plan fixes those first, then runs, gates, and remediates real findings.

## User Story
As the IYAE maintainer, I want the Phase 9 accessibility + pose E2E specs to actually pass against a running app (not just be "authored, not run"), and the unit suite to run without OOMing, so that WCAG 2.1 AA is *verified* (not just claimed) and CI is green end-to-end.

## Problem -> Solution
**Current state:** `a11y.spec.ts` + `pose-selector.spec.ts` were authored in Phase 9 but never executed against a live server (Playwright config omits `webServer`; reports mark them "Not run"). Both log in as `jadyn.hwu@gmail.com`/`admin` — a personal account that is **not** seeded — so they fail at `beforeEach`. The pose spec additionally needs an outfit with rigged garments that `DataSeeder` never creates. Separately, `useOutfitRiggingStatus.test.ts` OOMs the Vitest worker ("JavaScript heap out of memory"), even in isolation, polluting every full `npm run test` run.
**Desired state:** Both specs use seeded credentials at the correct domain; `a11y.spec.ts` runs green with zero serious/critical axe violations across the 6 key routes; the pose spec runs its seed-independent test live and its 3D-dependent tests are either seeded or deterministically `fixme`-guarded with a documented prerequisite (roving-tabindex/arrow coverage already lives in the CI Vitest `PoseSelector.test.tsx`); `npm run test` completes without OOM.

## Metadata
- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/iyae.prd.md`
- **PRD Phase**: Phase 9 — Hardening, A11y & KPI Instrumentation (in-progress; this is the live-validation sub-thread of its "Next Steps")
- **Estimated Files**: 6-9 (2 e2e specs, 1 unit test, optionally DataSeeder + 1 migration/asset, README/report, PRD row)

---

## UX Design

### Before / After
Internal change — **no user-facing UX transformation.** This is a test-and-verification thread. The only "product" changes are (a) *fixing* any real serious/critical a11y violations the axe gate surfaces (which would be genuine UX/a11y improvements, scoped reactively), and (b) optional seed data for a rigged outfit.

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| E2E auth in a11y/pose specs | Login as unseeded `jadyn.hwu@gmail.com`/`admin` -> fails | Login as a seeded account at the real `BRAND_DOMAIN` | Deterministic against `./dev.sh reset && ./dev.sh start` |
| `npm run test` | `useOutfitRiggingStatus.test.ts` OOMs the worker | Suite completes; that file passes | Removes a standing red/flaky signal |
| a11y verification | Claimed AA (specs authored, not run) | AA *verified* live: serious/critical axe = 0 on 6 routes | Real Phase-9 success signal |

---

## Mandatory Reading

Files that MUST be read before implementing (all verified this session):

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 (critical) | `web/e2e/a11y.spec.ts` | 1-107 | The spec to run; `login()` helper (L41-47) uses the unseeded creds; `expectNoSeriousA11yViolations` gate (L17-39); canvas waits are non-fatal (`.catch(()=>{})`) |
| P0 (critical) | `web/e2e/pose-selector.spec.ts` | 1-112 | `beforeEach` login (L5-9) unseeded; `navigateToOutfitWithViewer` (L12-17) hard-requires a visible canvas on `/outfits/[id]/view`; last test (L104-111) is the only seed-independent one |
| P0 (critical) | `server/src/main/java/com/iyae/config/DataSeeder.java` | 43-100, 787-819 | Seeds 6 users (`emma`/`james` BUYER, `luna`/`marco`/`aria` DESIGNER, `admin` ADMIN), **all `password123`**, at `brandProperties.domain()`; **seeds no Outfit/SavedLook/rigging_task**; 36 products each get a `GarmentAsset(glbUrl=/assets/models/placeholder.glb, status=READY)` |
| P0 (critical) | `web/__tests__/lib/hooks/useOutfitRiggingStatus.test.ts` | 1-226 | The OOMing test; `vi.useFakeTimers()` (L58) + `renderHook` without `unmount()` in most cases + `advanceTimersByTime` (L139, L157) |
| P0 (critical) | `web/lib/hooks/useOutfitRiggingStatus.ts` | 1-103 | Hook under test; `setInterval(poll, 5000)` (L78), async `poll` w/ `Promise.all` + `AbortController` (L35-75), effect dep is a recomputed `.join(",")` string (L91-97) |
| P1 (important) | `web/playwright.config.ts` | 1-22 | `baseURL :3000`, chromium-only, **`webServer` intentionally omitted** — servers must be up first; `retries: CI?1:0`, `reporter:'html'` |
| P1 (important) | `web/vitest.config.ts` | 1-18 | jsdom, globals, `@/` alias, `setupFiles: ['./__tests__/setup.ts']`; **no `pool`/`poolOptions` set** (Vitest 4 defaults) — the lever for the OOM fix |
| P1 (important) | `web/components/design-system/UnderlineField.tsx` | 1-37 | Confirms `<label htmlFor={id}>` association -> `getByLabel('Email'/'Password')` still resolves post-redesign (substring, case-insensitive) |
| P1 (important) | `web/app/login/page.tsx` | 1-190 | Post-FORME login; button text `"SIGN IN"` (L158) -> `getByRole('button',{name:'Sign In'})` matches (case-insensitive); success `router.push("/dashboard")` (L48) -> `waitForURL('/dashboard')` valid |
| P2 (reference) | `dev.sh` | 160-265 | `start` = docker compose up (mysql+server+worker+web) on `:3000`/`:3001`; `web` = host-mode `npm run dev` (proxies only `/api/*`); `reset` wipes volumes -> forces DataSeeder re-seed |
| P2 (reference) | `server/src/main/resources/application.yml` | 37-40 | `app.brand.domain: ${BRAND_DOMAIN:iyae.ca}` — the seed-email domain default |
| P2 (reference) | `.claude/PRPs/reports/phase9-hardening-a11y-completion-report.md` | 100-104 | The "Next Steps" this plan closes; documents the specs were authored but not run live |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| `@axe-core/playwright` `AxeBuilder(...).analyze()` | https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright | `.analyze()` returns `{ violations: [{ id, impact, help, nodes[] }] }`; filter `impact in {serious,critical}` for the gate (already implemented in `a11y.spec.ts:15-39`) |
| Playwright `getByLabel` / `getByRole` name matching | https://playwright.dev/docs/locators | String args are **substring, case-insensitive** unless `{exact:true}` — why `getByLabel('Email')` matches "Email address" and `{name:'Sign In'}` matches "SIGN IN" |
| Playwright browser install | https://playwright.dev/docs/browsers | Fresh checkout needs `npx playwright install chromium` before `test:e2e`; not covered by `npm install` |
| Vitest 4 pools / isolation / heap | https://vitest.dev/config/#pool | `pool` + `poolOptions.forks.singleFork`, `isolate`, `--logHeapUsage`, `--no-file-parallelism` are the OOM diagnosis/remediation levers |
| Testing Library `renderHook` cleanup | https://testing-library.com/docs/react-testing-library/api/#renderhook | Auto-cleanup unmounts between tests only when an `afterEach` global exists; explicit `unmount()` guarantees the hook's `clearInterval`/`abort` cleanup runs before fake timers are torn down |

> RESEARCH note: No novel external tech. All four libraries (Playwright, axe, Vitest, Testing Library) are already in `web/package.json` at the versions listed. The gate logic and specs already exist — this thread is execution + blocker-removal + a focused OOM fix, not new feature code.

---

## Patterns to Mirror

### E2E_LOGIN_HELPER (seeded creds + label/role selectors)
```ts
// SOURCE: web/e2e/checkout-flow.spec.ts:5-6 (canonical seeded-buyer login used by cart/checkout/community/ai-stylist)
await page.getByLabel('Email').fill('emma@example.com');
await page.getByLabel('Password').fill('password123');
// NOTE: the domain here is the OPEN discrepancy — see Blocker B2. The seed default is `iyae.ca`,
// yet every committed spec hardcodes `example.com`. Reconcile before running (Task 1).
```
```ts
// SOURCE: web/e2e/a11y.spec.ts:41-47 — the helper this plan edits (creds are the only change)
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('jadyn.hwu@gmail.com'); // <- unseeded; replace
  await page.getByLabel('Password').fill('admin');            // <- wrong password; replace
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('/dashboard', { timeout: 10000 });
}
```

### AXE_GATE (serious/critical only; advisory logged)
```ts
// SOURCE: web/e2e/a11y.spec.ts:15-39 — already correct; do not rewrite, just run it
const BLOCKING_IMPACTS = ['serious', 'critical'];
async function expectNoSeriousA11yViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ''));
  // advisory (moderate/minor) -> console.info only (tracked TODO, non-blocking)
  const detail = blocking.map((v) => `${v.id} [${v.impact}] — ${v.help} (${v.nodes.length} node(s))`).join('\n');
  expect(blocking, `Serious/critical a11y violations on ${label}:\n${detail}`).toEqual([]);
}
```

### SEEDED_USER_SHAPE (if seeding a rigged outfit — Task 4 option A)
```java
// SOURCE: server/.../config/DataSeeder.java:77-83
User emma = userRepository.save(User.builder()
        .email("emma@" + domain)
        .password(encodedPassword)   // passwordEncoder.encode("password123")
        .role(Role.BUYER)
        .build());
```
```java
// SOURCE: server/.../config/DataSeeder.java:787-806 — the READY GarmentAsset pattern to mirror for a rigged asset
garmentAssetRepository.save(GarmentAsset.builder()
        .product(product)
        .glbUrl(GLB_URL)                 // "/assets/models/placeholder.glb"
        .slotHint(slotHintFromCategory(product.getCategory()))
        .status("READY")
        .build());
```

### VITEST_FAKE_TIMER_TEARDOWN (the OOM-relevant lifecycle)
```ts
// SOURCE: web/__tests__/lib/hooks/useOutfitRiggingStatus.test.ts:57-65 — current teardown (does NOT unmount)
beforeEach(() => { vi.useFakeTimers(); mockApiGet.mockReset(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
// Most `it` blocks call renderHook(...) but never unmount() -> the hook's setInterval(poll,5000)
// + AbortController closures are retained past teardown. This is the prime OOM suspect.
```

### TEST_SKIP_WITH_REASON (deterministic guard for un-seedable pose tests — Task 3 option B)
```ts
// SOURCE: Playwright API (playwright.dev/docs/api/class-test#test-fixme) — idiom to encode a documented prerequisite
test.fixme('shows pose selector with category labels', async ({ page }) => { /* ... */ });
// or annotate the describe: requires a seeded outfit with a rigged garment (DataSeeder seeds none).
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `web/e2e/a11y.spec.ts` | UPDATE | Replace unseeded `jadyn.hwu@gmail.com`/`admin` in `login()` (L43-44) with a seeded buyer at the reconciled domain |
| `web/e2e/pose-selector.spec.ts` | UPDATE | Same credential fix (L6-7); add `test.fixme` + a `describe`-level prerequisite note on the 5 canvas-dependent tests unless a rigged outfit is seeded |
| `web/__tests__/lib/hooks/useOutfitRiggingStatus.test.ts` | UPDATE | Apply the OOM fix (explicit `unmount()` + teardown ordering; possibly a small refactor) once root cause is confirmed |
| `web/vitest.config.ts` | UPDATE (conditional) | Only if the OOM requires a `pool`/`poolOptions`/`isolate` change; keep minimal and scoped |
| `.env` (dev, gitignored) | UPDATE (conditional) | If reconciling on `example.com`: set `BRAND_DOMAIN=example.com` so seeded users match every committed spec (fixes the whole e2e suite, not just these two) — this is a local dev change, not committed |
| `server/src/main/java/com/iyae/config/DataSeeder.java` | UPDATE (optional, stretch) | Task 4 option A only: seed one buyer outfit with a rigged garment so the 5 pose tests run live |
| `web/CLAUDE.md` | UPDATE | Note the reconciled e2e login domain + the pose-spec seed prerequisite in "Gotchas"/E2E section |
| `.claude/PRPs/reports/phase9-live-validation-report.md` | CREATE | Implementation report (per repo convention; every plan has a paired report) |
| `.claude/PRPs/prds/iyae.prd.md` | UPDATE | Add this plan as a reference in the Phase 9 row's PRP cell |

## NOT Building

- **New a11y remediation beyond what the axe gate flags.** Only serious/critical violations the live run actually surfaces get fixed; moderate/minor stay as logged advisory TODOs (matches the spec's existing policy).
- **Rewriting the axe gate or the pose UI.** The gate (`a11y.spec.ts:15-39`) and `PoseSelector` roving-tabindex are already correct and CI-covered; this thread runs them, it doesn't re-author them.
- **A full worker rigging pipeline run to produce real rigged GLBs.** If seeding a rigged outfit (Task 4A), use a placeholder `riggedGlbUrl` asset, not a live SMPL-X/weight-transfer generation.
- **Fixing the other stale e2e specs** (`auth`/`cart`/`checkout`/`community`/`ai-stylist`/`register-wizard` copy-selector drift from the FORME redesign). Reconciling the domain (Task 1) *unblocks* their login, but their FORME copy-selector fixes are a separate thread (the "Redesign completion" option). Out of scope here.
- **CI wiring** (GitHub Actions to boot servers + run e2e). Deferred; this validates locally against `./dev.sh`.
- **The `useGenerationStatus.test.ts` 2 pre-existing TS2345 errors** and the PDP `set-state-in-effect` lint — documented pre-existing, untouched.

---

## Step-by-Step Tasks

### Task 1: Reconcile the seed-email domain and pick a seeded credential
- **ACTION**: Determine the domain the running server actually seeds users at, then choose the buyer credential the specs will use.
- **IMPLEMENT**:
  1. Bring up a fresh DB: `./dev.sh reset && ./dev.sh start` (wipes volumes -> `DataSeeder` re-runs).
  2. Discover the real buyer email (do NOT assume). Either query MySQL or probe login:
     - DB: `docker compose exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SELECT email,role FROM iyae.users;"` (DB name per compose).
     - Or curl: `curl -s -X POST localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{"email":"emma@iyae.ca","password":"password123"}'` and, if 400, retry with `emma@example.com`.
  3. **Decision (recommended):** if the running seed uses `iyae.ca` (the default), set `BRAND_DOMAIN=example.com` in the dev `.env` and `./dev.sh reset && ./dev.sh start` again — this makes the seed match `emma@example.com`/`password123`, which **every** committed spec already uses, fixing the whole suite's auth in one move. Otherwise, standardize the two specs on the discovered `emma@<domain>`.
- **MIRROR**: `E2E_LOGIN_HELPER` — the `emma@example.com`/`password123` pattern from `checkout-flow.spec.ts:5-6`.
- **IMPORTS**: none (shell + env).
- **GOTCHA**: `BRAND_DOMAIN` is **not** in `.env.example` (only `WEB_DOMAIN`/`API_DOMAIN` are, commented). Adding `BRAND_DOMAIN` is a new dev-only override — it also changes `MAIL_FROM`/guest-sentinel derivations, which is harmless for tests but note it. The default `iyae.ca` lives at `application.yml:39`.
- **VALIDATE**: `curl` login returns `200` + a JWT for the chosen credential; `SELECT` shows that email present.

### Task 2: Fix the login credentials in both specs
- **ACTION**: Replace the unseeded `jadyn.hwu@gmail.com`/`admin` with the Task-1 credential in both specs.
- **IMPLEMENT**: In `a11y.spec.ts` L43-44 and `pose-selector.spec.ts` L6-7, set email to `emma@<reconciled-domain>` and password to `password123`. Leave the `getByLabel`/`getByRole`/`waitForURL('/dashboard')` lines untouched — verified still valid against the FORME login (`UnderlineField` labels + `"SIGN IN"` button).
- **MIRROR**: `E2E_LOGIN_HELPER`.
- **IMPORTS**: none.
- **GOTCHA**: `getByLabel('Email')` is a substring match — it resolves "Email address" fine, but do NOT switch to `{exact:true}` (would break). The `admin` password was never valid (seed password is `password123`), so this is a real bug fix, not a preference.
- **VALIDATE**: `npm run test:e2e -- a11y.spec.ts` no longer fails in `beforeEach`/`login`; the 3 public-route tests (home/products/PDP — no login) run regardless.

### Task 3: Run `a11y.spec.ts` live and gate on serious/critical = 0
- **ACTION**: With servers up (`./dev.sh start` -> `:3000`/`:3001`) and chromium installed, run the axe gate and fix any real serious/critical violations.
- **IMPLEMENT**:
  1. `cd web && npx playwright install chromium` (fresh env only).
  2. `npm run test:e2e -- a11y.spec.ts` (Playwright has no `webServer`, so servers must already be up).
  3. Read the HTML report / assertion output. For each serious/critical violation, fix at the source component using semantic tokens + ARIA already established in the codebase (e.g., missing form labels, insufficient contrast, missing landmark). Re-run until `blocking` is empty on all 6 routes.
  4. Moderate/minor findings: leave as the spec's `console.info` advisory TODOs (do not fix here).
- **MIRROR**: `AXE_GATE` (already in the spec). For any fix, mirror the Phase-9 a11y patterns (`role="status"`/`aria-busy`, `aria-describedby` error association) documented in `phase9-hardening-a11y-completion-report.md`.
- **IMPORTS**: none new.
- **GOTCHA**: The PDP + try-on tests wait for a `<canvas>` with `.catch(()=>{})` — a **missing GLB does not fail** them (host-mode `npm run dev` proxies only `/api/*`, so `/assets/models/placeholder.glb` may 404; use `./dev.sh start` (docker) where nginx/static serving applies, or accept the non-fatal skip). `networkidle` can hang on pages with persistent connections — if a test times out on `waitForLoadState('networkidle')`, that's an environment signal, not an a11y failure; note it.
- **VALIDATE**: All 6 axe assertions pass (`serious/critical` = `[]`); advisory counts logged; HTML report saved.

### Task 4: Resolve the pose spec's rigged-outfit dependency
- **ACTION**: The 5 canvas-dependent pose tests need an outfit with a rigged garment on `/outfits/[id]/view`; `DataSeeder` seeds none. Choose one path:
  - **Option A (stretch, most faithful):** Seed one buyer `SavedLook`/outfit for `emma` whose item has a non-null `riggedGlbUrl` pointing at a placeholder rigged GLB asset, so `navigateToOutfitWithViewer` finds a view link + visible canvas + `A-Pose` button.
  - **Option B (recommended, deterministic):** Mark the 5 canvas-dependent tests `test.fixme(...)` with a `describe`-level comment documenting the prerequisite (a seeded rigged outfit), and run only the seed-independent test (`/outfits/99999/view` -> "not found" -> pose selector hidden). Rely on the **already-green CI Vitest `PoseSelector.test.tsx`** (roving-tabindex + arrow/Home/End) for the accessibility behavior the pose e2e would otherwise assert.
- **IMPLEMENT (Option B)**: Wrap the 5 tests (`shows pose selector...`, `switches active pose...`, `arrow keys move focus...`, `pose change produces different canvas...`, `handles rapid pose switching...`) in `test.fixme` or add `test.skip(true, 'requires seeded rigged outfit — DataSeeder seeds none')`. Keep `pose selector hidden without rigged garments` active.
- **IMPLEMENT (Option A)**: In `DataSeeder`, after products/garment-assets, create a `SavedLook`/outfit for `emma` referencing a garment with `riggedGlbUrl` set to a committed placeholder (e.g., reuse `GLB_URL` or a `/assets/models/placeholder-rigged.glb`). Verify against the outfit + rigging read models the `/outfits` and `/outfits/[id]/view` pages consume (`OutfitItem.riggedGlbUrl`, the `a[href*="/outfits/"][href*="/view"]` link).
- **MIRROR**: `SEEDED_USER_SHAPE` + the READY `GarmentAsset` pattern (A); `TEST_SKIP_WITH_REASON` (B).
- **IMPORTS**: none (B); server repos already `@RequiredArgsConstructor`-injected in `DataSeeder` (A).
- **GOTCHA**: The pose UI keys off **rigged** garments (`riggedGlbUrl`), not the base `GarmentAsset.glbUrl` — seeding a plain garment asset is insufficient. Option A requires understanding the outfit read path end-to-end; if that expands scope, prefer B and log the deferral (a silent skip that reads as "covered" is the anti-pattern — annotate the reason).
- **VALIDATE (B)**: `npm run test:e2e -- pose-selector.spec.ts` -> the seed-independent test passes, 5 are reported `fixme` (visible, not silently dropped). **(A)**: all 6 pass live.

### Task 5: Diagnose and fix the `useOutfitRiggingStatus.test.ts` OOM
- **ACTION**: Reproduce, root-cause, then apply the smallest fix that makes the file (and the full `npm run test`) complete without "JavaScript heap out of memory".
- **IMPLEMENT** (in order; stop when green):
  1. Reproduce in isolation with heap logging: `npx vitest run __tests__/lib/hooks/useOutfitRiggingStatus.test.ts --logHeapUsage --no-file-parallelism`.
  2. **Fix candidate 1 (most likely):** the hook mounts `setInterval(poll,5000)` + an `AbortController`; most `it` blocks never `unmount()`, so under `vi.useFakeTimers()` the interval/closures are retained until `vi.useRealTimers()` discards fake timers *without* running the hook's cleanup. Give every `renderHook(...)` an explicit `const { unmount } = renderHook(...)` + `unmount()` at end (or a shared `afterEach` that unmounts the last render), and reorder teardown to `vi.clearAllTimers()` **before** `vi.useRealTimers()` (already so) plus `vi.clearAllMocks()`.
  3. **Fix candidate 2:** if still OOM, pin the pool in `vitest.config.ts` — `test.pool: 'forks'`, `poolOptions: { forks: { singleFork: true } }`, and/or `test.isolate: true` — to bound per-file memory. Keep the change minimal and comment why.
  4. **Fix candidate 3 (stopgap only):** raise heap for the test script (`NODE_OPTIONS=--max-old-space-size=4096 vitest run`) — acceptable only if 1-2 don't fully resolve; document as a mitigation, not a root-cause fix.
  5. Confirm no behavior regression: the 13 assertions still pass.
- **MIRROR**: `VITEST_FAKE_TIMER_TEARDOWN`.
- **IMPORTS**: `unmount` is already returned by `renderHook` (Testing Library); no new imports for candidate 1.
- **GOTCHA**: The effect dependency is a recomputed `.join(",")` string (`useOutfitRiggingStatus.ts:91-97`) — under fake timers a state update that changes the candidate set re-runs the effect (clearInterval->re-setInterval); ensure the test's `advanceTimersByTime` blocks are wrapped in `act(...)` (they are) so React flushes deterministically. Do NOT "fix" the hook's production behavior to satisfy the test unless a real leak is proven in the hook itself.
- **VALIDATE**: `npx vitest run __tests__/lib/hooks/useOutfitRiggingStatus.test.ts` passes (13/13, no OOM); then full `npm run test` completes without the heap error.

### Task 6: Update docs, report, and the PRD reference
- **ACTION**: Record the reconciled e2e login domain + pose seed prerequisite, write the paired report, and link the plan from the PRD.
- **IMPLEMENT**:
  - `web/CLAUDE.md`: in the E2E/"Gotchas" section, state the seeded e2e login (`emma@<domain>`/`password123`) and that the pose spec's 3D tests require a seeded rigged outfit (or are `fixme`-guarded).
  - Create `.claude/PRPs/reports/phase9-live-validation-report.md` (mirror the structure of `phase9-hardening-a11y-completion-report.md`: Summary, Tasks Completed, Validation Results, Deviations, Issues, Next Steps).
  - `.claude/PRPs/prds/iyae.prd.md`: append `. [live-validation plan](../plans/phase9-live-validation.plan.md)` to the Phase 9 row's PRP cell (keep status `in-progress`).
- **MIRROR**: existing report files in `.claude/PRPs/reports/`.
- **IMPORTS**: none.
- **GOTCHA**: Don't overstate — if pose 3D tests are `fixme`-guarded, the report must say the pose 3D path is **not** verified live (only its Vitest equivalent is). Honesty over green-washing.
- **VALIDATE**: PRD Phase 9 row links this plan; report exists; `web/CLAUDE.md` reflects reality.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `useOutfitRiggingStatus.test.ts` (all 13) | existing cases | Pass, **no heap OOM**, file completes in a few s | Yes — fake timers + interval leak |
| Full `npm run test` | 18 files / 234 cases | Completes; no worker OOM/teardown timeout | Yes — cross-file memory accumulation |
| `PoseSelector.test.tsx` (CI, unchanged) | roving-tabindex + arrows | Still 5/5 (the pose a11y coverage relied on when e2e 3D is `fixme`) | — |

### E2E (live server required — `./dev.sh start`)
| Spec | Precondition | Expected |
|---|---|---|
| `a11y.spec.ts` (6 tests) | fresh seeded DB, seeded login, chromium installed | serious/critical axe = 0 on home/products/PDP/cart/checkout/try-on |
| `pose-selector.spec.ts` | Option B: seed-independent test only | "not found" test passes; 5 reported `fixme` (Option A: all 6 pass) |

### Edge Cases Checklist
- [ ] Fresh DB (`./dev.sh reset`) -> DataSeeder actually re-ran (log line "DataSeeder: complete — 6 users...")
- [ ] Login credential resolves (curl 200) before running specs
- [ ] Chromium installed (`npx playwright install chromium`)
- [ ] Servers up on **both** :3000 and :3001 (Playwright has no `webServer`)
- [ ] PDP/try-on canvas absent (GLB 404 in host-mode) -> a11y tests still pass (non-fatal wait)
- [ ] `networkidle` timeout distinguished from a11y failure
- [ ] `fixme`/`skip` on pose tests is **visible** in output, not a silent drop
- [ ] Full `npm run test` (not just the one file) is OOM-free after the fix

---

## Validation Commands

### Static Analysis
```bash
cd web && npx tsc --noEmit
```
EXPECT: Zero new type errors (2 pre-existing `TS2345` in `useGenerationStatus.test.ts` are known/untouched).

### Unit Tests (the OOM fix)
```bash
cd web && npx vitest run __tests__/lib/hooks/useOutfitRiggingStatus.test.ts --logHeapUsage
cd web && npm run test
```
EXPECT: The hook file passes 13/13 with no "heap out of memory"; the full suite completes.

### Lint
```bash
cd web && npm run lint
```
EXPECT: No new lint errors (pre-existing PDP `set-state-in-effect` untouched).

### Live-server bring-up + seed verification
```bash
./dev.sh reset && ./dev.sh start
# then verify the seeded buyer credential (adjust domain per Task 1):
curl -s -X POST localhost:3001/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"emma@example.com","password":"password123"}' | head -c 200
```
EXPECT: `./dev.sh status` healthy; login returns `200` + a token.

### E2E (a11y gate)
```bash
cd web && npx playwright install chromium   # fresh env only
cd web && npm run test:e2e -- a11y.spec.ts
```
EXPECT: 6/6 axe assertions pass (serious/critical = 0); HTML report generated.

### E2E (pose)
```bash
cd web && npm run test:e2e -- pose-selector.spec.ts
```
EXPECT: seed-independent test passes; 3D tests pass (Option A) or are reported `fixme` (Option B).

### Manual Validation
- [ ] Open the Playwright HTML report; confirm zero serious/critical, note advisory items
- [ ] Confirm the pose `fixme`/skip reasons are printed in the run summary
- [ ] Re-run `npm run test` twice — OOM does not reappear (not just a lucky first run)

---

## Acceptance Criteria
- [ ] Both specs log in with a **seeded** credential at the reconciled domain (no `jadyn.hwu`/`admin`)
- [ ] `a11y.spec.ts` runs against a live server with **zero serious/critical** axe violations on all 6 routes; any real blockers found are fixed at source
- [ ] Pose spec: seed-independent test passes live; 3D-dependent tests either pass (seeded) or are `fixme`-guarded with a documented prerequisite (never silently dropped)
- [ ] `useOutfitRiggingStatus.test.ts` passes with no heap OOM; full `npm run test` completes
- [ ] `tsc` clean (no new errors); `lint` clean (no new errors)
- [ ] `web/CLAUDE.md` + a paired report reflect the reconciled login domain and pose prerequisite; PRD Phase 9 links this plan

## Completion Checklist
- [ ] Code follows discovered patterns (seeded-login helper, axe gate, fake-timer teardown)
- [ ] Error handling / a11y fixes match codebase style (semantic tokens + ARIA)
- [ ] Tests follow the existing Vitest/Playwright conventions
- [ ] No hardcoded personal accounts; no silent test drops
- [ ] Docs + report updated; PRD reference added
- [ ] No unnecessary scope (other stale specs, CI wiring, real rigging pipeline left out)
- [ ] Self-contained — the blockers, seed facts, and selectors are all captured above

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Axe surfaces genuine serious/critical violations needing real fixes | **M** | Expands scope beyond "just run it" | Fix only serious/critical at source using existing a11y patterns; log moderate/minor as advisory; each fix is small and local |
| Pose 3D path can't be verified live without heavy seed/worker setup | **H** | Pose e2e stays partially unverified | Option B: `fixme`-guard + lean on green CI `PoseSelector.test.tsx`; document honestly; Option A only if the outfit read path is quickly seedable |
| OOM root cause isn't the unmount leak -> deeper Vitest 4/jsdom issue | **M** | OOM fix takes longer | Staged remediation (unmount -> pool/isolate -> heap bump); `--logHeapUsage` to confirm which lever works |
| Domain reconciliation (`BRAND_DOMAIN`) has side effects (mail-from, guest sentinel) | **L** | Confusing dev state | Dev-only `.env` override; note in report; alternatively edit the 2 specs to `@iyae.ca` and leave env alone |
| Host-mode `npm run dev` 404s `/assets` GLBs -> canvas never mounts | **M** | PDP/try-on axe scans skip 3D DOM (still pass) | Prefer `./dev.sh start` (docker) for the run; a11y waits are non-fatal by design |
| `waitForLoadState('networkidle')` hangs on some routes | **L** | False timeout read as failure | Distinguish timeout from a11y failure in the report; adjust to `domcontentloaded` only if proven necessary (note as deviation) |

## Notes
- **Why the reports missed these blockers:** Phase 9 + FORME reports both said e2e was "not run" (author's local DB happened to have `jadyn.hwu@gmail.com` + rigged outfits). This plan makes the specs deterministic against the **committed seed**, which is the actual CI/reviewer reality.
- **The domain discrepancy is a latent suite-wide bug:** every committed spec uses `emma@example.com` while the seed defaults to `iyae.ca`. Reconciling it (Task 1) is the single highest-leverage fix — it unblocks login for the whole e2e suite, not just these two specs (the rest are still blocked by FORME copy-selector drift, a separate thread).
- **Verified this session (so implementation needs no re-discovery):** seeded users = `luna/marco/aria` (DESIGNER), `emma/james` (BUYER), `admin` (ADMIN), all `password123` at `brandProperties.domain()` (default `iyae.ca`); `UnderlineField` associates labels via `htmlFor`; login button reads `"SIGN IN"` and redirects to `/dashboard`; `DataSeeder` seeds **no** outfits/looks/rigging; products get READY `GarmentAsset(/assets/models/placeholder.glb)`; Playwright omits `webServer`; Vitest config sets no `pool`.
