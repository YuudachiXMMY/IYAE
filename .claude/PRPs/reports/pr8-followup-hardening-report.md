# Implementation Report: PR #8 Follow-up Hardening (M2/M3/M6/M7/M10/M11 + L1–L7)

## Summary
Implemented all deferred PR #8 review findings across server / worker / web: RMS chart-selection (M2), honest geometry-validation docs (M3), mode-aware triangle counting (M6), a single shared geometry helper (M7), accessible delete-confirm (M10), the missing tests (M11), and every LOW (L1–L7). Shipped into the existing PR #8 worktree branch `worktree-iyae-phase4-prp-plan` — no new PR.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Large | Large |
| Confidence | 8/10 | Held — no blocking surprises; L4 wired (not documented-away) |
| Files Changed | ~20 | 20 (7 server, 8 worker, 3 web, 3 docs) + 2 artifacts |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | M2 — select chart entry on RMS | Complete | `bestRms` selection; confidence uses same metric |
| 2 | L6 — `SizeRecommendationBasis` enum | Complete | DTO stays `String` via `.name()` — JSON unchanged |
| 3 | M3 — honest `validate_glb_geometry` docs | Complete | Docstring + worker CLAUDE.md; no behavior change |
| 3b | M3 buffer-decode (optional) | Skipped | Out of default scope, as planned |
| 4 | M7+M6 — shared `compute_glb_geometry_stats` | Complete | New `worker/glb_geometry.py`; both callers rewired |
| 5 | M6/M7/M11 worker tests | Complete | New `test_glb_geometry.py` (8) + meshy L2 (4) |
| 6 | M10 — accessible delete confirm | Complete | Focus→Cancel + `aria-live` in both components |
| 7 | L5 — disable Delete while generating | Complete | `disabled={isGenerating}` on avatar page |
| 8 | L2 — cap Meshy download size | Complete | `_enforce_download_cap`, 100 MB cap |
| 9 | L1 — rate-limit new endpoints | Complete | `pathSuffix` extension + DELETE/recommended-size rules |
| 10 | L3 — log active-task purge | Complete | Javadoc + `log.info` for PENDING/RUNNING count |
| 11 | L7 — cap `size_chart` cardinality | Complete | `MAX_CHART_ENTRIES=50` at parse time |
| 12 | L4 — geometry check on rigging path | Complete | Deviated to **wire** (preferred route) not document |
| 13 | M11 — server/web test gaps | Complete | SizeRec (M2/tie/malformed/empty/cap) + delete flow |
| 14 | Docs sync | Complete | worker M3 honesty wording + 3 Changelog rows |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (web `tsc --noEmit`) | Pass | Zero errors in changed files (pre-existing non-PR errors unchanged) |
| Unit Tests — server | Pass | `./gradlew test` BUILD SUCCESSFUL (full suite) |
| Unit Tests — worker | Pass* | 320 passed, 7 skipped (igl/robust_laplacian-gated), 1 failed = `smplx` missing (pre-existing env, unrelated) |
| Unit Tests — web | Pass | `ProfileSettingsDialog.test.tsx` 6/6; new geometry+cap tests green |
| Build | Pass | Server gradle build green |
| Edge Cases | Pass | LINE-mode, multi-mesh union, negative index, oversized chart, delete failure, focus/aria-live |

\* The single worker failure (`test_missing_smplx_dir_raises_rigging_error`) is a missing optional dependency (`smplx`) in the local venv — the plan explicitly noted torch/smplx/igl are not installable locally. It is not caused by this change.

## Files Changed

| File | Action |
|---|---|
| `server/.../entity/enums/SizeRecommendationBasis.java` | CREATED |
| `server/.../service/SizeRecommendationService.java` | UPDATED (M2, L6, L7) |
| `server/.../config/RateLimitFilter.java` | UPDATED (L1) |
| `server/.../service/AvatarService.java` | UPDATED (L3) |
| `server/.../service/SizeRecommendationServiceTest.java` | UPDATED (M2, M11) |
| `server/.../config/RateLimitFilterTest.java` | UPDATED (L1) |
| `server/.../service/AvatarServiceTest.java` | UPDATED (L3) |
| `worker/glb_geometry.py` | CREATED (M7, M6, M3) |
| `worker/validator.py` | UPDATED (M3, M6, M7) |
| `worker/providers/meshy_generator.py` | UPDATED (M6, M7, L2) |
| `worker/main.py` | UPDATED (L4) |
| `worker/tests/test_glb_geometry.py` | CREATED (M6/M7/M11) |
| `worker/tests/test_meshy_generator.py` | UPDATED (L2) |
| `web/components/profile/ProfileSettingsDialog.tsx` | UPDATED (M10) |
| `web/app/profile/avatar/page.tsx` | UPDATED (M10, L5) |
| `web/__tests__/components/ProfileSettingsDialog.test.tsx` | UPDATED (M11) |
| `server/CLAUDE.md`, `worker/CLAUDE.md`, `web/CLAUDE.md` | UPDATED (docs) |

## Deviations from Plan
- **L4 (Task 12)** — wired `validate_glb_geometry` into the rigging success path (the plan's *preferred* route) rather than documenting an exemption. Rigged garment meshes are garment-sized, so thresholds are not spuriously tripped.
- **Worker M6 tests (Task 5)** — placed mode/multi-mesh coverage in the new `test_glb_geometry.py` (the single source where M6 now lives) instead of duplicating into `test_validator.py`, which would have required constructing real LINE-mode GLB files for no extra coverage. `validate_glb_geometry` delegates to the tested helper.
- **trimesh-fallback-success test** — deferred: it requires a GLB with no accessor `min`/`max` to force the Tier-2 path, which is impractical to craft; the existing "degrades to None when unparseable" test already covers the fallback boundary.
- **Docs (Task 14)** — applied the substantive M3 honesty rewrite + one Changelog row per module rather than re-tallying every component/test count (the repo's own changelog treats counts as approximate).

## Issues Encountered
- Worker venv lacked `mysql-connector-python` (queue tests failed to *collect*) — installed it into the job venv so the full suite runs; the remaining `smplx` failure is an unavoidable local-env gap.
- GateGuard fact-forcing gate fired on the first edit of each new file (~20 times) — resolved each time by restating importers/API/data/instruction, then retrying. No functional impact.

## Tests Written

| Test File | Tests Added | Coverage |
|---|---|---|
| `worker/tests/test_glb_geometry.py` | 8 | `_tris_for_mode` modes + `compute_glb_geometry_stats` (M6/M7/M5/union/empty) |
| `worker/tests/test_meshy_generator.py` | 4 | `_enforce_download_cap` (L2) |
| `server/.../SizeRecommendationServiceTest.java` | 5 | M2 RMS, tie-break, malformed/empty chart, L7 cap |
| `server/.../RateLimitFilterTest.java` | 3 | L1 recommended-size + DELETE /api/avatar + catalog-not-throttled |
| `server/.../AvatarServiceTest.java` | 1 | L3 active-task deletion |
| `web/.../ProfileSettingsDialog.test.tsx` | 4 | delete cancel/confirm/failure + focus/aria-live (M10/M11) |

## Next Steps
- [ ] Code review via `/ecc:code-review` (optional — findings originate from a prior review)
- [ ] Push to the PR #8 branch (no new PR) and update the PR description/comment
