# Implementation Report: PR #8 Post-Merge Hardening (H1 + M1–M9 + L1–L8)

## Summary
Implemented the residual findings from the independent **post-merge** review of PR #8 (Phase 4 Virtual Fitting + Fit/Size), across worker / server / web. Centerpiece **H1** (negative-accessor-`count` bypass of the triangle-count cap) is closed at the shared helper plus a validator belt-and-suspenders guard. Also shipped the streaming download caps (M1/M3), bounds-absent fail-closed (M2), web pre-select validation (M5), abort-on-unmount (M6), consistent delete guard (M7), `AvatarStatus` type ownership (M8), and the LOW polish (L1/L6/L8) + M4 TODO. Work was done on a fresh worktree branched from `origin/main` (which carries the merged Phase 4 code); local `main` is behind and lacks those files.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Large | Large |
| Confidence | 9/10 | Held — no blocking surprises; one self-introduced test regression (streaming mocks) caught and fixed immediately |
| Files Changed | ~16 | 14 source/test + 2 docs = 16 |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | H1 — clamp negative count (helper + validator guard) | Complete | `max(0, count) // 3`; `triangle_count < 0` rejected |
| 2 | H1/M2 worker tests | Complete | negative single/multi-primitive (geometry) + negative-aggregate + bounds-absent (validator) |
| 3 | M2 — bounds-absent fail closed | Complete | `elif triangle_count > 0`; empty scene still passes |
| 4 | M1 — streaming Meshy cap | Complete | new `stream_to_file_capped` (`iter_content`, removes partial file); GLB + USDZ |
| 5 | M3 — Tripo cap | Complete | reuses `stream_to_file_capped` via `from providers.meshy_generator import` |
| 6 | M8 — `AvatarStatus` into `api.ts` | Complete | hook imports + re-exports; no circular import (tsc clean) |
| 7 | M6 — abort `useAvatarStatus` on unmount | Complete | `fetchStatus({silent,signal})`; per-effect `AbortController`; swallows `AbortError` |
| 8 | M5 — validate pre-select vs `product.sizes` | Complete | `product.sizes?.includes(size)` before `setSelectedSize` |
| 9 | M7 + L8 — delete guard + a11y | Complete | dialog derives `isGenerating` via `useAvatarStatus`; `disabled` + `aria-expanded` |
| 10 | L1 / L6 / M4 | Complete (L5 deferred) | L1 accessory→null; L6 `ApiError.message` (both delete sites); M4 TODO. L5 deferred — hook exposes no status setter |
| 11 | M9 — tests | Partial | Added `useAvatarStatus.test.ts` (M6 abort). PDP pre-select + OutfitCard abort render-tests deferred (see Deviations) |
| 12 | Docs sync | Complete | worker + web CLAUDE.md changelog rows |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (web `tsc --noEmit`) | Pass | 0 errors in changed files; 14 pre-existing errors remain in `useGenerationStatus.test.ts` (2) + `e2e/checkout-flow.spec.ts` (12), exactly as the review noted |
| Unit Tests — worker | Pass | 100/100 across `test_glb_geometry.py`, `test_validator.py`, `test_meshy_generator.py` (venv with pytest/pygltflib/trimesh/requests/numpy) |
| Unit Tests — web | Pass | 226 passed; 1 pre-existing environmental fork-worker crash in `useOutfitRiggingStatus.test.ts` (documented in the review, unrelated) |
| Unit Tests — server | Pass | `./gradlew test` BUILD SUCCESSFUL (incl. new L1 test) |
| Build | Pass | server gradle build green |
| Edge Cases | Pass | negative count (single/multi), bounds-absent vs empty-scene, streaming over-cap + lying Content-Length, unmount abort, accessory→NONE |

## Files Changed

| File | Action | Findings |
|---|---|---|
| `worker/glb_geometry.py` | UPDATED | H1 |
| `worker/validator.py` | UPDATED | H1/L2, M2 |
| `worker/providers/meshy_generator.py` | UPDATED | M1 (+ `stream_to_file_capped`, `_check_declared_length`) |
| `worker/providers/tripo_generator.py` | UPDATED | M3 |
| `worker/tests/test_glb_geometry.py` | UPDATED | H1 (3 tests) |
| `worker/tests/test_validator.py` | UPDATED | H1 + M2 (2 tests) |
| `worker/tests/test_meshy_generator.py` | UPDATED | M1/M3 streaming (3 tests) + streaming-mock adaptation |
| `web/lib/api.ts` | UPDATED | M8 |
| `web/lib/hooks/useAvatarStatus.ts` | UPDATED | M6, M8 |
| `web/app/products/[id]/page.tsx` | UPDATED | M5 |
| `web/app/profile/avatar/page.tsx` | UPDATED | L6 (ApiError.message) |
| `web/components/profile/ProfileSettingsDialog.tsx` | UPDATED | M7, L8, L6 |
| `web/__tests__/lib/hooks/useAvatarStatus.test.ts` | CREATED | M6 (3 tests) |
| `server/.../service/SizeRecommendationService.java` | UPDATED | L1, M4 (TODO) |
| `server/.../service/SizeRecommendationServiceTest.java` | UPDATED | L1 (1 test) |
| `worker/CLAUDE.md`, `web/CLAUDE.md` | UPDATED | docs |

## Deviations from Plan
- **L5 (optimistic clear before refresh)** — deferred. `useAvatarStatus` returns `status` but exposes no setter, so the avatar page cannot optimistically clear `avatarStatus` without adding a new hook API (scope creep for a LOW item). The `refresh()` after delete + React 19's silent no-op on post-unmount `setState` keep the window harmless. Noted for a follow-up if a setter is added.
- **M9 render-level tests (PDP pre-select, OutfitCard try-on abort)** — the M6 hook abort test (`useAvatarStatus.test.ts`, 3 cases) was added and is the highest-value, most reliable coverage. Full PDP-render and OutfitCard-mount tests were deferred: both require heavy page-level mocking (`sizing`, product fetch, `next/navigation`, dynamic `ssr:false` import) that is brittle relative to the value; the M5 guard is a one-line membership check already covered by tsc + the trivial predicate, and OutfitCard's abort path was verified solid by the review.
- **L3 (annotate helpers)** — the new helpers (`stream_to_file_capped`, `_check_declared_length`) are typed; the pre-existing untyped helpers L3 referenced were left untouched (out of this change's blast radius).
- **Test regression I introduced and fixed** — switching Meshy to streaming broke 4 tests that mocked only `resp.content`; added a `_streaming_download_mock` helper and rewired all download mocks (`iter_content` + `headers`). Re-ran to green (100/100 worker).

## Issues Encountered
- **Fresh worktree lacked `web/node_modules` and the gitignored `gradle-wrapper.jar`** — ran `npm ci` for web; copied `gradle-wrapper.jar` from the `iyae-phase4-prp-plan` worktree so `./gradlew` runs.
- **Worker deps absent locally** (`pytest`/`pygltflib`/`trimesh`/`requests`/`numpy`) — installed into a job-scoped venv (`$CLAUDE_JOB_DIR/tmp/wkvenv`) to run the full worker geometry/validator/meshy suites. `torch`/`igl`/`smplx` still absent, so SMPL-X/rigging suites were not run (consistent with the plan's local-env caveat).
- **GateGuard fact-forcing gate** fired on the first edit of each file (~18 times) — answered each and retried; no functional impact.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `worker/tests/test_glb_geometry.py` | +3 | H1 negative-count clamp (single/multi-primitive, `_tris_for_mode`) |
| `worker/tests/test_validator.py` | +2 | H1 negative-aggregate rejected; M2 geometry-present-no-bounds fails |
| `worker/tests/test_meshy_generator.py` | +3 | M1/M3 streaming over-cap + Content-Length short-circuit + within-cap write |
| `web/__tests__/lib/hooks/useAvatarStatus.test.ts` | +3 | M6 signal passed, abort-on-unmount, AbortError doesn't clobber state |
| `server/.../SizeRecommendationServiceTest.java` | +1 | L1 unrecognized category → NONE |

## Next Steps
- [ ] Code review via `/code-review`
- [ ] Draft PR opened against `main` (new PR — PR #8 already merged)
