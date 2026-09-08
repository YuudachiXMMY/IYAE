# Plan: Phase 9 Live Authed-Route Axe Re-Verify (Deploy-Time Confirmation)

## Summary
Run the one carry-forward item Phase 9 left open: a **live axe-core re-verification** of the three authenticated routes (`/cart`, `/checkout`, `/try-on`) plus the destructive-banner cases, against a **freshly rebuilt web container**, so the `--color-destructive #dc2626→#b91c1c` fix is confirmed on a running stack (not just by the unit contrast math that already encodes axe's computation). Record the result and check off the last unchecked acceptance box in the closeout report.

## User Story
As the **IYAE owner / release engineer**, I want the authenticated a11y routes re-scanned by axe on the rebuilt web image, so that I can confirm 0 serious/critical WCAG 2.1 AA violations against real DOM before deploying the Phase 9 relaunch.

## Problem → Solution
The Phase 9 closeout (PR #22 + `phase9-authed-a11y-closeout`) fixed the destructive error-banner contrast (4.13:1 → ~5.5:1) and pinned it with a dependency-free CI contrast test, but the **live docker axe re-verify was deferred** — it needs `docker compose build web` + a running stack, which the prior background job could not spin up. `token-contrast.test.ts` proves the math; `a11y.spec.ts` encodes the gate. This plan **executes** that gate on a live rebuilt container and records the deploy-time confirmation. → Phase 9's `[~] Live authed axe re-verify` acceptance box flips to `[x]`.

## Metadata
- **Complexity**: Small (verification-only; no product-code change expected)
- **Source PRD**: `.claude/PRPs/prds/iyae.prd.md`
- **PRD Phase**: Phase 9 — Hardening, A11y & KPI Instrumentation (carry-forward closeout item; phase already `complete`)
- **Estimated Files**: 0 code / 2–3 docs (report + finding + optional PRD note). Code touched only if axe surfaces a *new* live-only violation.

---

## UX Design

Internal / verification change — **no user-facing UX transformation.** The destructive-token darkening (red-600 → red-700) already shipped in the closeout; this plan only *confirms* it renders AA-legibly on the live stack. If confirmation passes, the shopper sees exactly what is already deployed.

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| `/checkout` error banner | ~5.5:1 (proven by unit math) | ~5.5:1 (proven by **live axe** too) | Confidence upgrade, not a visual change |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `web/e2e/a11y.spec.ts` | 1-128 | The exact gate being run: `expectNoSeriousA11yViolations` helper, seeded `login()`, the 3 authed tests + 2 banner tests. Do not rewrite it. |
| P0 | `.claude/PRPs/reports/phase9-authed-a11y-closeout-report.md` | all | The report whose last acceptance box (`[~] Live authed axe re-verify`) this plan closes; "Next Steps" spells out the exact command. |
| P0 | `.claude/PRPs/reviews/authed-a11y-reverify-finding.md` | all | The PR #22 finding: `/cart` + `/try-on` already passed live; only `/checkout` was Fail (now fixed). Records the resolution. |
| P1 | `web/app/checkout/page.tsx` | 54-76, 140-146 | Why the `#checkout-error` banner renders (fulfillment options fetch `.catch`) — advisory, non-blocking; explains the delivery-options flake side-note. |
| P1 | `dev.sh` | 60-75, 160-185, 240-285 | `./dev.sh start` brings up MySQL→Server→Worker→Web + waits on `/api/health`; `./dev.sh build web` rebuilds a single service. |
| P1 | `web/playwright.config.ts` | all | No `webServer`; `baseURL` `:3000`, overridable via `PLAYWRIGHT_BASE_URL`. Tests assume the stack is already up. |
| P2 | `server/src/main/java/com/iyae/config/DataSeeder.java` | 45-90 | Seeds buyer `emma@<domain>` / `password123`; domain from `app.brand.domain` (default `iyae.ca`) → `emma@iyae.ca`. Confirms the a11y-spec login creds exist. |
| P2 | `web/app/globals.css` | 26, 103 | The token under verification: light `--color-destructive: #b91c1c` (line 26); dark `#ef4444` (line 103) unchanged. |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| axe-core impact levels | `@axe-core/playwright` `results.violations[].impact` | Gate filters to `serious`/`critical` only; `moderate`/`minor` logged as advisory TODOs (see helper lines 15, 31-37). No new dep needed — already installed (`^4.10.2`). |
| WCAG 2.1 AA text contrast | SC 1.4.3 (4.5:1 normal text) | The exact threshold `token-contrast.test.ts` and axe both enforce; `#b91c1c` on `bg-destructive/10` composites to ~5.5:1. |

---

## Patterns to Mirror

### A11Y_GATE_HELPER
```ts
// SOURCE: web/e2e/a11y.spec.ts:15-45
const BLOCKING_IMPACTS = ['serious', 'critical'];
async function expectNoSeriousA11yViolations(page, label, opts) {
  const builder = new AxeBuilder({ page });
  if (opts?.include) builder.include(opts.include);
  const results = await builder.analyze();
  const blocking = results.violations.filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ''));
  // advisory (moderate/minor) → console.info, not a failure
  expect(blocking, `Serious/critical a11y violations on ${label}:\n${detail}`).toEqual([]);
}
```

### SEEDED_AUTHED_LOGIN
```ts
// SOURCE: web/e2e/a11y.spec.ts:47-53  (creds from DataSeeder; domain = app.brand.domain, default iyae.ca)
async function login(page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('emma@iyae.ca');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('/dashboard', { timeout: 30000 });
}
```

### SINGLE_SERVICE_REBUILD
```bash
# SOURCE: dev.sh (build/start commands) + closeout report "Next Steps"
docker compose build web           # rebuild only the web image against current source
docker compose up -d web           # restart the web container
# stack already up? bring the rest first:
./dev.sh start                     # MySQL→Server→Worker→Web + health-wait on :3001/api/health
```

### RUN_ONE_SPEC
```bash
# SOURCE: web/CLAUDE.md commands + playwright.config.ts (no webServer)
cd web && npm run test:e2e -- a11y.spec.ts     # runs the 5 a11y tests against the LIVE :3000 stack
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `.claude/PRPs/reports/phase9-authed-a11y-closeout-report.md` | UPDATE | Flip `[~] Live authed axe re-verify` → `[x]`; paste the live axe result table (per route). |
| `.claude/PRPs/reviews/authed-a11y-reverify-finding.md` | UPDATE | Append a "Live re-verify confirmed (<date>)" line under Resolution. |
| `.claude/PRPs/reports/phase9-live-authed-axe-reverify-report.md` | CREATE | Short verification report: env, commands run, per-route axe result, pass/fail, any advisory findings. |
| `.claude/PRPs/prds/iyae.prd.md` | UPDATE (optional) | Add this plan link to the Phase 9 row's PRP-Plan cell (phase stays `complete`). |
| _web product code_ | **NONE (expected)** | Only touched if axe surfaces a genuinely new serious/critical live-only violation — then a follow-up plan/fix, not silent scope creep. |

## NOT Building

- **No new a11y tests or helpers** — `a11y.spec.ts` already encodes the gate; running it is the deliverable.
- **No re-fix of the destructive token** — already shipped and unit-guarded; this only confirms it live.
- **No full 37-route axe sweep** — scope is the 3 authed routes + the 2 destructive-banner cases already in the spec.
- **No un-`fixme` of the 5 pose canvas tests** — needs a seeded rigged outfit; explicitly out of scope (tracked separately).
- **No fix of the checkout delivery-options flake** — orthogonal to contrast; note it, don't chase it (see Risks).
- **No prod deploy / SSL / KPI dashboard work** — Phase 9's other units are already merged.

---

## Step-by-Step Tasks

### Task 1: Bring up a clean, rebuilt stack
- **ACTION**: Rebuild the web image against current source and start the full 5-service stack.
- **IMPLEMENT**:
  ```bash
  ./dev.sh start                       # ensures MySQL healthy + API /health green + seed runs
  docker compose build web             # rebuild web against current globals.css (#b91c1c)
  docker compose up -d web             # restart the web container on the fresh image
  ```
- **MIRROR**: SINGLE_SERVICE_REBUILD.
- **IMPORTS**: Docker + Docker Compose; ports 3000 (web) / 3001 (API) / 3002 (MySQL) free per root CLAUDE.md.
- **GOTCHA**: The web image bakes `API_PROXY_TARGET` at **build time** (web/CLAUDE.md) — verify against the **rebuilt container**, never a stale one still on the old image. If `:3000` is occupied by a stale container, either `docker compose up -d web` (replaces it) or run the host `next dev` on another port and pass `PLAYWRIGHT_BASE_URL`.
- **VALIDATE**: `curl -sf http://localhost:3001/api/health` returns healthy; `curl -sI http://localhost:3000` returns 200; `docker compose ps` shows `web` `Up` on the just-built image.

### Task 2: Confirm the seed buyer exists
- **ACTION**: Verify `emma@iyae.ca` / `password123` can log in (the spec's authed precondition).
- **IMPLEMENT**: Confirm the server ran with default brand domain (`iyae.ca`) so `DataSeeder` created `emma@iyae.ca`. If the server was started with `BRAND_DOMAIN=example.com`, the seed email is `emma@example.com` and the a11y spec's hardcoded `emma@iyae.ca` login will fail — restart the server with the default domain (or temporarily point the spec at the seeded address).
- **MIRROR**: SEEDED_AUTHED_LOGIN.
- **IMPORTS**: none.
- **GOTCHA**: web/CLAUDE.md notes only `a11y.spec.ts` + `pose-selector.spec.ts` use `emma@iyae.ca`; the *other* specs still hardcode `emma@example.com`. We run **only `a11y.spec.ts`**, so `iyae.ca` is correct.
- **VALIDATE**: Manual `/login` with the creds reaches `/dashboard`, OR trust Task 3's `login()` (it fails loudly at `waitForURL('/dashboard')` if the seed is wrong).

### Task 3: Run the live axe gate
- **ACTION**: Execute the a11y spec against the live stack.
- **IMPLEMENT**:
  ```bash
  cd web && npm install          # fresh worktree has no node_modules (see Risks)
  npx playwright install chromium   # if the browser binary is absent
  npm run test:e2e -- a11y.spec.ts
  ```
- **MIRROR**: RUN_ONE_SPEC + A11Y_GATE_HELPER.
- **IMPORTS**: `@playwright/test` 1.60.0, `@axe-core/playwright` ^4.10.2 (both already in `package.json`).
- **GOTCHA**: 3D routes (`/try-on`) wait up to 15s for `<canvas>` then scan regardless (spec lines 116-125); the 40s `test.setTimeout` covers it. `waitForLoadState('networkidle')` can hang if a background poll never idles — if a route flakes on networkidle (not on a violation), that's an infra timeout, not an AA failure; re-run before concluding.
- **VALIDATE**: All 5 tests pass — the 3 authed (`cart`, `checkout`, `try-on`) + the 2 banner cases (`login error banner`, public routes). `0 serious/critical`. Capture the HTML report (`playwright-report/`) and any `[a11y:*] advisory` console lines.

### Task 4: Handle the `/checkout` banner path explicitly
- **ACTION**: Confirm `/checkout` passes **whether or not** the delivery-options banner renders.
- **IMPLEMENT**: The banner (`#checkout-error`) only appears if `GET /api/fulfillment/shipping-options` **or** `/pickup-locations` rejects (checkout page lines 56-73). Either state is acceptable for axe now:
  - Banner absent → nothing to fail on.
  - Banner present → `text-destructive #b91c1c` on `bg-destructive/10` composites ~5.5:1 ≥ AA.
  To deterministically exercise the *banner-present* path, you may temporarily stop the fulfillment source or block the two endpoints, reload `/checkout`, and confirm axe still passes — optional, since the invalid-login banner case already covers the destructive pattern deterministically.
- **MIRROR**: checkout `.catch` at page.tsx:69-73.
- **IMPORTS**: none.
- **GOTCHA**: A `/checkout` **failure** now would be a *new* violation unrelated to the fixed token (the contrast is proven) — inspect the axe `detail` string; do not re-touch `--color-destructive`.
- **VALIDATE**: `/checkout` axe = 0 serious/critical in both banner states (or at minimum the state observed in this run, with the other state reasoned from the invalid-login banner case).

### Task 5: Record the confirmation and close the box
- **ACTION**: Write the results and flip the last acceptance box.
- **IMPLEMENT**:
  - CREATE `.claude/PRPs/reports/phase9-live-authed-axe-reverify-report.md` — env (image build id / date via `git rev-parse HEAD` + a shell `date`), exact commands, per-route result table, advisory findings, pass/fail.
  - UPDATE closeout report: `[~] Live authed axe re-verify` → `[x]` with a one-line pointer to the new report.
  - UPDATE the finding: append "Live re-verify confirmed" under Resolution.
  - (Optional) UPDATE the PRD Phase 9 PRP-Plan cell with this plan link.
- **MIRROR**: existing report structure in `phase9-authed-a11y-closeout-report.md`.
- **IMPORTS**: none. **Do NOT** use `Date.now()`/`new Date()` in any workflow script; stamp the date from a shell `date` call or `git log` if needed.
- **GOTCHA**: If a *new* serious/critical violation is found, do **not** silently patch — record it in the report as a **new finding** and surface it; that becomes its own scoped fix, not part of this verification.
- **VALIDATE**: Closeout report shows `[x]`; new report committed; finding updated.

---

## Testing Strategy

This plan *is* a test run; the "unit tests" are the axe cases already authored.

### Verification Matrix
| Route / Case | Command | Expected | Blocking? |
|---|---|---|---|
| `/cart` (authed) | `npm run test:e2e -- a11y.spec.ts` | 0 serious/critical | Yes |
| `/checkout` (authed) | same | 0 serious/critical (was 1 serious pre-fix) | Yes |
| `/try-on` (authed) | same | 0 serious/critical; canvas mounts ≤15s | Yes |
| `login error banner` | same | 0 serious/critical on `#login-error` | Yes |
| public routes (`/`, `/products`, PDP) | same | 0 serious/critical | Yes (regression guard) |
| advisory (moderate/minor) | same | logged `[a11y:*]`, not failed | No |

### Edge Cases Checklist
- [ ] Stale `:3000` container serving the **old** image → rebuild/replace before scanning.
- [ ] Seed domain mismatch (`BRAND_DOMAIN=example.com`) → `emma@iyae.ca` login fails; restart server with default domain.
- [ ] Fresh worktree missing `node_modules` / Playwright browser → `npm install` + `npx playwright install chromium`.
- [ ] `networkidle` hang on a 3D route → infra timeout, re-run; not an AA failure.
- [ ] `/checkout` banner-absent this run → reason banner-present state from the invalid-login case (same global token).
- [ ] A genuinely new live-only violation → record as new finding, do not silently fix.

---

## Validation Commands

### Pre-flight (unit guard still green — cheap, run first)
```bash
cd web && npm install
cd web && npm run test -- a11y/token-contrast.test.ts
```
EXPECT: 3/3 pass (destructive ≥ AA, muted-foreground ≥ AA, pre-fix `#dc2626` would fail).

### Stack up
```bash
./dev.sh start && docker compose build web && docker compose up -d web
curl -sf http://localhost:3001/api/health && curl -sI http://localhost:3000 | head -1
```
EXPECT: API healthy; web returns `HTTP/1.1 200`.

### Live axe gate (the deliverable)
```bash
cd web && npx playwright install chromium
cd web && npm run test:e2e -- a11y.spec.ts
```
EXPECT: all a11y tests pass; `0 serious/critical` on `/cart` `/checkout` `/try-on` + both banner cases.

### Manual Validation
- [ ] `docker compose ps` — `web` `Up`, built this session.
- [ ] Playwright HTML report (`web/playwright-report/index.html`) shows all a11y cases green.
- [ ] Any advisory `[a11y:*]` console lines captured into the report.
- [ ] Closeout report box flipped to `[x]`; new verification report created.

---

## Acceptance Criteria
- [ ] Web image rebuilt against current source; full stack healthy.
- [ ] `a11y.spec.ts` run **live**: `/cart` `/checkout` `/try-on` + banner cases = 0 serious/critical.
- [ ] `token-contrast.test.ts` green (pre-flight regression guard).
- [ ] Results recorded in a new verification report; closeout `[~]` → `[x]`.
- [ ] Any new serious/critical violation surfaced as a finding (not silently patched).

## Completion Checklist
- [ ] Ran the exact existing gate (no spec rewrite).
- [ ] Verified against the **rebuilt** container, not a stale one.
- [ ] Used the correct seed creds (`emma@iyae.ca` / `password123`).
- [ ] Advisory vs blocking findings distinguished per the helper's `impact` filter.
- [ ] Docs updated; Phase 9's last acceptance box closed.
- [ ] No product-code change unless a new live violation demanded one (then documented).

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Fresh worktree missing `node_modules` / browser binary | H (env) | Blocks the run | `npm install` + `npx playwright install chromium` before Task 3 (see [[iyae-worktree-test-setup]]) |
| Stale `:3000` container serves old image → false pass/fail | M | Wrong conclusion | Rebuild + `up -d web`; or host `next dev` on another port + `PLAYWRIGHT_BASE_URL` |
| Seed domain mismatch → authed login fails | M | 3 authed tests error at `waitForURL` | Start server with default `BRAND_DOMAIN` (`iyae.ca`) so `emma@iyae.ca` seeds |
| `/checkout` delivery-options genuinely flaky (side-note in finding) | M | Banner renders unexpectedly | Orthogonal to contrast — axe still passes; note it, don't fix here |
| `networkidle` hang on `/try-on` | L | Timeout, not AA failure | 40s `test.setTimeout` + canvas `.catch(()=>{})`; re-run once before concluding |
| A new live-only serious/critical violation appears | L | Reopens a11y work | Record as a new finding → scoped follow-up plan; keep this plan's scope to verification |
| Background job barred from spinning up Docker | M (env/policy) | Can't run live here | If the run must happen at deploy-time, this plan documents the exact steps; the unit contrast test already proves correctness. Escalate to a live/deploy env if the bg job is barred from Docker. |

## Notes
- **This is the sole remaining Phase 9 item** — every other unit (A–E + the destructive-token closeout) is merged and unit-green. Closing this flips the last `[~]` acceptance box and fully lands the relaunch a11y story.
- **Why it can be deferred safely if the env bars Docker**: `token-contrast.test.ts` reproduces axe's exact contrast computation (4.14 → ~5.5 on the `/10` tint), and `/cart` + `/try-on` already passed live in PR #22 — only `/checkout` changed, and strictly for the better. The live run is a *confidence* upgrade, not a correctness gate. If this background job is policy-barred from spinning up Docker, deliver the plan + run it at deploy time (the closeout report's "Next Steps" already says exactly this).
- **Confidence for single-pass execution: 9/10** — the gate is pre-authored, creds/commands are pinned, the only real variable is environment (Docker availability + fresh-worktree deps).
