# Implementation Report: 3D Try-On Drape Realism — Phase 2 (质感增强)

## Summary
Implemented Phase 2 texture enhancement on the drape-realism track, zero cloth simulation:
- **C1** — `MeshyGenerator` PBR map generation is now an env-gated constructor flag (`WORKER_MESHY_ENABLE_PBR`, default OFF).
- **C2** — slot-keyed tiled tangent-space normal maps applied to garment materials on the frontend (`lib/fabric-textures.ts` + `FittingHelper.applyGarmentNormalMap`), with 2 procedurally-generated seamless normal-map assets. Works on both the rigged (B1 UV) and static paths.
- **D3** — `AvatarViewer` `<Canvas>` now uses ACES Filmic tone mapping + tuned exposure + `environmentIntensity` for a matte-fabric look.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium (as predicted) |
| Confidence | 8/10 | Held — no surprises; one write-only-setter test fix |
| Files Changed | ~11 | 12 (2 worker src, 1 worker test, 2 web src, 1 web lib, 2 web test, 3 assets/README, +3 docs, +PRD) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | C1 — Meshy PBR env-gated ctor flag | ✅ Complete | `enable_pbr` param + `WORKER_MESHY_ENABLE_PBR` in `main.py` |
| 2 | C2 — slot→normal-map config module | ✅ Complete | `lib/fabric-textures.ts`, always returns a config |
| 3 | C2 — normal-map applier in FittingHelper | ✅ Complete | Memoized `TextureLoader`; don't-clobber guard |
| 4 | C2/D3 — wire slot + tone mapping | ✅ Complete | ACES + `environmentIntensity=0.6`; `GarmentModel` gains `slot` |
| 5 | C2 — web tests | ✅ Complete | +4 FittingHelper, +7 fabric-textures |
| 6 | C2 — fabric normal-map assets | ✅ Complete | Procedurally generated, seamless, blue-dominant, README provenance |
| 7 | C1 — worker tests | ✅ Complete | +3 (init default/enabled, POST body PBR on/off) |
| 8 | Doc-sync | ✅ Complete | worker/web/root CLAUDE.md + changelogs + env tables |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | ✅ Pass | `tsc --noEmit` clean; changed-file ESLint clean (EXIT 0). Repo-wide lint has 53 pre-existing errors in untouched files (documented) |
| Unit Tests | ✅ Pass | web 335 (34 files, +11); worker 364 pass / 7 skipped (+3 Meshy) |
| Build | ✅ Pass | `next build` succeeds |
| Integration | N/A | Canvas can't render in jsdom; C1 live PBR eval is a manual gated step |
| Edge Cases | ✅ Pass | unknown/mixed-case slot, don't-clobber, scene traversal, PBR default-off |

## Files Changed

| File | Action | Notes |
|---|---|---|
| `worker/providers/meshy_generator.py` | UPDATED | `enable_pbr` ctor param → POST body field |
| `worker/main.py` | UPDATED | `WORKER_MESHY_ENABLE_PBR` env → `MeshyGenerator(enable_pbr=...)` |
| `worker/tests/test_meshy_generator.py` | UPDATED | +3 tests (init + POST body) |
| `web/lib/fabric-textures.ts` | CREATED | slot→normal-map config + lookup |
| `web/components/FittingHelper.tsx` | UPDATED | `applyGarmentNormalMap`/`…ToScene` + memoized loader |
| `web/components/AvatarViewer.tsx` | UPDATED | C2 wiring (slot) + D3 ACES tone mapping + env intensity |
| `web/__tests__/components/FittingHelper.test.ts` | UPDATED | +4 normal-map tests |
| `web/__tests__/lib/fabric-textures.test.ts` | CREATED | +7 config tests |
| `web/public/textures/fabric/weave-normal.png` | CREATED | plain-weave normal map (top/dress) |
| `web/public/textures/fabric/denim-normal.png` | CREATED | twill normal map (bottom) |
| `web/public/textures/fabric/README.md` | CREATED | provenance/license (CC0, procedural) |
| `worker/CLAUDE.md`, `web/CLAUDE.md`, `CLAUDE.md` | UPDATED | doc-sync + env tables + changelogs |
| `.claude/PRPs/prds/3d-tryon-garment-drape-realism.prd.md` | UPDATED | Phase 2 → complete |

## Deviations from Plan
- **Test assertion fix**: `MeshStandardMaterial.needsUpdate` is a write-only setter (reads `undefined`); the FittingHelper test asserts `material.version` bumped instead of reading `needsUpdate`. WHY: three.js API — the implementation still calls `needsUpdate = true` per the standard pattern; only the test assertion changed.
- **`environmentIntensity` confirmed present** in installed drei (v10) — applied `0.6` as planned rather than the light-intensity fallback.

## Issues Encountered
- **No `python`/`pytest` on PATH** in the worktree — used the original repo's `worker/.venv` interpreter. No project change needed.
- **`web/node_modules` absent** in the fresh worktree (per project memory) — ran `npm install`.
- **1 pre-existing worker test failure** (`test_ground_truth_height_error_within_threshold`) requires SMPL-X LFS model data not present locally — unrelated to Phase 2; documented as a known env gap.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `worker/tests/test_meshy_generator.py` | +3 | PBR flag default/enabled + POST body reflects flag |
| `web/__tests__/components/FittingHelper.test.ts` | +4 | normal-map applied, default slot, don't-clobber, scene traversal |
| `web/__tests__/lib/fabric-textures.test.ts` | +7 (new file) | slot lookup, case-insensitive, default fallback, shape |

## Known Follow-ups (out of Phase 2 scope)
- **C1 live evaluation**: run one `WORKER_MESHY_ENABLE_PBR=true` generation, record credit delta + PBR quality; then decide default-on. If high-value, a **writer extension** to embed normal/roughness maps in the rigged GLB is a separate task (rigged path currently gets relief only via C2's frontend map).
- **Browser QA**: verify tiled relief + matte finish + intact contact shadow at `/outfits/[id]/view` on a real rigged garment.
- **Fabric taxonomy**: no `fabric` field on Product/GarmentAsset — a per-fabric map set (vs slot-keyed) needs a data-model track.

## Next Steps
- [ ] Code review via `/code-review`
- [ ] Merge PR #36 (branch `worktree-prd-drape-phase2-plan`)
- [ ] Phase 3 (geometric anti-penetration, A1) or Phase 4 (conversion decision gate)
