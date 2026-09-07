# Implementation Report: Phase 9 Completion — WCAG 2.1 AA Finish + KPI Loose Ends

## Summary
Finished the deferred Phase 9 work: the **C-fin** accessibility sweep (focus-trapped
Escape-able AR overlay with a keyboard placement path, `PoseSelector` APG roving-tabindex
toolbar, announced live-status on the three secondary 3D viewers, programmatic field-error
association on the login/checkout/product forms + register banner, and an automated
`@axe-core/playwright` scan of the key routes) and the **D-fin** KPI loose ends (corrected
the stale "interim DESIGNER" comment on the ADMIN-gated `/api/admin/kpis` endpoint + a
test asserting ADMIN 200 / DESIGNER 403 / BUYER 403, and wired the client `VIEW` +
`ADD_TO_CART` advisory events into the PDP).

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium (as predicted) |
| Confidence | — | High — all automated checks green modulo pre-existing issues |
| Files Changed | ~15 | 16 (1 new hook + 9 edits + 3 new tests + 1 e2e edit + package.json + 2 server) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| D-1 | KPI gate comment + ADMIN/DESIGNER/BUYER test | ✅ Complete | Added `kpis_asDesigner_returns403`; made buyer test's role explicit (`BUYER`) |
| D-2 | Client `VIEW` + `ADD_TO_CART` on PDP | ✅ Complete | Ref-guarded VIEW (StrictMode-safe), fire-and-forget, `sizeBracket` field |
| C-1 | `useFocusTrap` hook | ✅ Complete | onEscape via ref → no focus-bounce on re-render; SSR-guarded; re-queries on Tab |
| C-2 | `ARViewer` trap + Escape + keyboard place + alert | ✅ Complete | `role="dialog"` `aria-modal`, sr-only status, "Place model" button, `role="alert"` |
| C-3 | `PoseSelector` roving-tabindex + arrow keys | ✅ Complete | Clamped ends (no wrap) + Home/End; one tab stop; focus follows selection |
| C-4 | Secondary viewers announced status | ✅ Complete | `role="status"`/`aria-busy` on SmartARViewer, DemoOutfitModel, OutfitBuilderPreview |
| C-5 | Form error association | ✅ Complete | login field-precise (`errorField`); register/checkout banner `role="alert"`; PDP size-required ↔ Add-to-Cart via `aria-describedby` |
| C-6 | axe scans + ARViewer a11y test + pose arrow e2e | ✅ Complete | `@axe-core/playwright` added; `a11y.spec.ts`; new Vitest `ARViewer.a11y` + `PoseSelector`; pose e2e extended |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (tsc) | ✅ Pass | Zero new type errors; 2 pre-existing errors in `useGenerationStatus.test.ts` (known, untouched) |
| Lint (eslint) | ✅ Pass | Zero new lint issues; 2 pre-existing `set-state-in-effect` errors in PDP (proven pre-existing against HEAD) |
| Unit/Component (web Vitest) | ✅ Pass | 273 passed incl. 10 new (ARViewer.a11y 5 + PoseSelector 5); `useOutfitRiggingStatus.test.ts` OOMs — pre-existing, reproduces in isolation, unrelated |
| Server tests (full suite) | ✅ Pass | `BUILD SUCCESSFUL`; includes D-1 ADMIN/DESIGNER/BUYER assertions |
| e2e (a11y + pose arrow) | ⏸ Not run here | Requires live dev+API (no auto webServer) — documented prerequisite; specs authored |

## Files Changed

| File | Action | Notes |
|---|---|---|
| `web/lib/hooks/useFocusTrap.ts` | CREATED | Shared focus-trap + Escape + restore hook |
| `web/components/ARViewer.tsx` | UPDATED | Trap, Escape, keyboard place, `role="alert"`, dialog semantics, sr-only status |
| `web/components/PoseSelector.tsx` | UPDATED | Roving-tabindex + arrow/Home/End nav (APG toolbar) |
| `web/components/SmartARViewer.tsx` | UPDATED | Skeleton loader → `role="status"` + `aria-busy` |
| `web/components/DemoOutfitModel.tsx` | UPDATED | Fallback label → `role="status"` |
| `web/components/outfits/OutfitBuilderPreview.tsx` | UPDATED | Loading + error fallback → `role="status"` |
| `web/app/login/page.tsx` | UPDATED | `errorField` state → per-field `aria-invalid`/`aria-describedby`; banner `role="alert"`+id |
| `web/app/register/page.tsx` | UPDATED | Page-level error banner `role="alert"`+id |
| `web/app/checkout/page.tsx` | UPDATED | Error banner `role="alert"`+id |
| `web/app/products/[id]/page.tsx` | UPDATED | D-2 emits + size-required `aria-describedby` + `addedMessage` live-region + `track` dep |
| `web/package.json` | UPDATED | `@axe-core/playwright` devDependency |
| `web/e2e/a11y.spec.ts` | CREATED | Axe scans of home/products/PDP/cart/checkout/try-on (serious/critical gate) |
| `web/e2e/pose-selector.spec.ts` | UPDATED | Arrow-key focus+selection assertions |
| `web/__tests__/components/ARViewer.a11y.test.tsx` | CREATED | Focus-trap / Tab-cycle / Escape / unsupported-alert / dialog (R3F mocked) |
| `web/__tests__/components/PoseSelector.test.tsx` | CREATED | Roving-tabindex + arrow/Home/End (added beyond plan's file list; CI-runnable) |
| `server/.../controller/AnalyticsController.java` | UPDATED | Corrected KPI ADMIN-gate Javadoc |
| `server/.../controller/AnalyticsControllerTest.java` | UPDATED | +DESIGNER 403; explicit BUYER role |

## Deviations from Plan
- **Added `PoseSelector.test.tsx`** (not in the plan's file list): the plan's Testing Strategy lists `PoseSelector_arrowMovesSelection` but the pose arrow coverage was only scheduled as e2e (which can't run in CI without a live server). Added a CI-runnable Vitest equivalent. WHY: keep the arrow-key behavior covered by the always-on suite.
- **`useFocusTrap` reads `onEscape` via a ref** rather than depending on it: `ARViewer`'s exit handler is not memoized, so a naive dep would re-run the trap each render and bounce focus. WHY: correctness.
- **Did NOT edit `SizeSelector`** for the PDP size-required association: kept it in-scope by associating the requirement text with the (in-scope) Add-to-Cart button via `aria-describedby`. WHY: `SizeSelector` was not in the plan's file list and has a tested public API.

## Issues Encountered
- **Fresh worktree had no `web/node_modules`** and `typescript` was uninstalled → ran `npm install` (installed 655 packages incl. the new axe dep) before validation.
- **`gradle-wrapper.jar` is gitignored and absent** in both the worktree and main checkout, and there is no system gradle → server tests were run with the cached distribution at `~/.gradle/wrapper/dists/gradle-8.10-bin/.../bin/gradle` (matches `gradle-wrapper.properties`). `BUILD SUCCESSFUL`.
- **`useOutfitRiggingStatus.test.ts` OOMs** ("JavaScript heap out of memory") even in isolation — pre-existing, unrelated to this change (that hook/test was not touched).

## Pre-existing Issues (out of scope, documented for honesty)
- `useGenerationStatus.test.ts` — 2 `TS2345` type errors (called out in the plan as known).
- `products/[id]/page.tsx` — 2 `react-hooks/set-state-in-effect` lint errors on the existing `setProductLoading(true)`/`setReviewsLoading(true)` effect-body calls (proven present at HEAD, before this change).
- `useOutfitRiggingStatus.test.ts` — worker OOM/teardown timeout.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `web/__tests__/components/ARViewer.a11y.test.tsx` | 5 | dialog semantics, focus-into-overlay, Tab/Shift+Tab cycle, Escape→onExit, unsupported `role="alert"` |
| `web/__tests__/components/PoseSelector.test.tsx` | 5 | role/aria-pressed, single tab stop, ArrowRight move, ArrowLeft clamp, Home/End |
| `server/.../AnalyticsControllerTest.java` | +1 (kpis_asDesigner_returns403) | ADMIN 200 / DESIGNER 403 / BUYER 403 |
| `web/e2e/a11y.spec.ts` | 6 | axe serious/critical gate on 6 key routes (live-server prerequisite) |
| `web/e2e/pose-selector.spec.ts` | +1 | arrow-key focus+selection |

## Acceptance Criteria
- [x] `useFocusTrap` created; `ARViewer` focus-trapped, Escape-able, keyboard-placeable, unsupported announced
- [x] `PoseSelector` roving-tabindex + arrow-key nav (APG toolbar)
- [x] `SmartARViewer` / `DemoOutfitModel` / `OutfitBuilderPreview` announce via `role="status"`
- [x] Login/register/checkout/product forms associate field errors
- [x] `@axe-core/playwright` added; `e2e/a11y.spec.ts` authored (serious/critical gate)
- [x] KPI endpoint ADMIN gate documented in-code + test-asserted (ADMIN 200 / DESIGNER 403 / BUYER 403)
- [x] PDP emits advisory `VIEW` + `ADD_TO_CART` (fire-and-forget)
- [x] Tests written and passing; no new type/lint errors; no regressions

## Next Steps
- [ ] Run `npm run test:e2e -- a11y.spec.ts pose-selector.spec.ts` against a live `./dev.sh start` to confirm zero serious/critical axe violations + arrow-key e2e.
- [ ] Code review via `/code-review`; open PR via `/prp-pr`.
