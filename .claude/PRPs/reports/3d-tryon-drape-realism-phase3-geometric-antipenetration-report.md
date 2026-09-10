# Implementation Report: 3D Try-On Drape Realism — Phase 3 (几何防穿模 / Geometric Anti-Penetration)

## Summary
Implemented A1 geometric push-out for the production rigging pipeline. A new
`worker/providers/penetration_pushout.py` reuses the igl BVH (`point_mesh_squared_distance`,
same call as `weight_transfer.py`) and derives the inside/outside sign from the avatar
face-normal dot to push any garment vertex sitting inside the body — or within a
fabric-thickness shell — back outside, in the bind pose. `PythonRiggingProvider.generate()`
calls it after weight transfer and before the GLB write, adds a `penetration` payload block,
and `main.py` logs a non-blocking `PENETRATION_AUDIT` line (the PRD's "self-collision count
after push-out" metric). The frontend `polygonOffset` depth-cheat is retained for
inter-garment layering / z-fighting, now secondary to real geometry. B3 (anchor scale-fit)
deferred per plan.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium — as predicted |
| Confidence | 8/10 | Held — no surprises; concave-region sign is a documented known limitation |
| Files Changed | 6 (1 CREATE + 3 UPDATE + 2 test) | 6 (2 CREATE + 3 UPDATE + 1 UPDATE test) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Create `penetration_pushout.py` | ✅ Complete | igl BVH + face-normal sign; clamp; immutable copy; graceful igl-absent no-op |
| 2 | Integrate into `generate()` | ✅ Complete | Post-transfer / pre-write; `penetration` payload block; info log |
| 3 | `PENETRATION_AUDIT` in `main.py` | ✅ Complete | Non-blocking, payload-sourced, `if pen:` guard |
| 4 | `test_penetration_pushout.py` | ✅ Complete | Fake-igl deterministic tier (9) + real-igl skip-guarded tier (2) |
| 5 | Extend `test_python_rigging_provider.py` | ✅ Complete | +1 penetration-block assertion (deterministic, no patch needed) |
| 6 | Doc-sync `worker/CLAUDE.md` | ✅ Complete | Tree, pipeline, payload, gotcha, inventory, changelog, related-files |
| 7 | B3 anchor scale-fit (OPTIONAL) | ⏭️ Deferred | Per plan recommendation — clean follow-up, no coupling to A1 |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis | ✅ Pass | `py_compile` clean on all 5 changed/new files (pyflakes not installed in env; used py_compile) |
| Unit Tests | ✅ Pass | New file 11 (9 pass + 2 skip real-igl); provider 25; affected-files run 34 passed / 2 skipped |
| Full Suite | ✅ Pass* | 374 passed, 9 skipped, 1 **pre-existing** failure (`test_fit_accuracy` real-SMPL-X — needs `git lfs pull`, unrelated & untouched) |
| Build | N/A | Python worker — no build step |
| Integration | Deferred to live/QA | Real push-out needs `Dockerfile.rigging` (igl + robust-laplacian + SMPL-X); `grep PENETRATION_AUDIT` verification documented in plan |
| Edge Cases | ✅ Pass | Empty garment, no faces, degenerate avatar face (no-NaN), clamp, immutability, exterior-untouched |

\* The single failure (`TestRealModelFitAccuracy::test_ground_truth_height_error_within_threshold`) is
environmental: `smplx` is installed but the SMPL-X `.npz` model files (Git LFS) are absent, so the test
raises instead of skipping. I did not touch `smplx_provider.py` / `fit_accuracy.py` / `test_fit_accuracy.py`
(confirmed by empty `git diff --stat` on those paths). Documented as a known pre-existing failure.

## Files Changed

| File | Action | Lines |
|---|---|---|
| `worker/providers/penetration_pushout.py` | CREATED | +137 |
| `worker/tests/test_penetration_pushout.py` | CREATED | +186 |
| `worker/providers/python_rigging_provider.py` | UPDATED | +16 |
| `worker/main.py` | UPDATED | +16 |
| `worker/tests/test_python_rigging_provider.py` | UPDATED | +29 |
| `worker/CLAUDE.md` | UPDATED | +15 / -5 |

## Deviations from Plan

1. **Fake-igl test tier added (WHAT)** — the plan proposed skip-guarding igl tests and covering the
   igl-absent path only via the provider. **WHY**: igl is absent in this dev/CI env, so the core push
   math would go entirely unverified here. I injected a stub `igl` module (projects onto the z=0 plane)
   via `sys.modules`, verifying the push/clamp/stats math deterministically everywhere, and kept a
   real-igl skip-guarded tier (unit cube) for the true BVH path. Strictly additive coverage.
2. **"Interior vertex" test uses a shallow interior point (WHAT)** — plan text suggested the cube centre.
   **WHY**: a centre vertex is 0.5 m deep → the `max_push` clamp (5 cm) intentionally can't fully evict
   it, so `penetrating_after==0` would be false. Real garments penetrate shallowly, so the pushed-out
   case uses a 2 cm-deep point; the centre-deep point instead drives the dedicated `max_push` clamp test.
3. **Task 5 needs no `resolve_penetration` patch (WHAT)** — plan offered routes (a)/(b) for determinism.
   **WHY**: the provider always assigns the returned stats dict to the payload regardless of igl, so
   `"penetration" in result` is deterministic in both igl-present and igl-absent envs — no patch required.

## Issues Encountered
- **No igl/robust-laplacian in the local venv** (by design — Dockerfile.rigging-only). Resolved by the
  fake-igl test tier + the module's graceful `was_applied=False` no-op, which is itself the documented
  base-CI behaviour.
- **Pre-existing SMPL-X fit-accuracy test failure** (LFS models absent). Confirmed unrelated; documented.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `tests/test_penetration_pushout.py` | 11 (9 run + 2 real-igl skip) | Push math (interior→shell, exterior untouched, clamp, mixed batch, immutability) via fake igl; guards (empty, no-faces, degenerate-no-NaN, stats keys); real-igl cube tier |
| `tests/test_python_rigging_provider.py` | +1 (→25) | `generate()` output carries a valid `penetration` block |

## Next Steps
- [ ] Code review via `/code-review`
- [ ] Live/QA: run a real `RIGGING_PROVIDER=python` task in `Dockerfile.rigging`; `grep PENETRATION_AUDIT` → `after ≈ 0`; visually confirm garment wraps outside the SMPL-X body
- [ ] Phase 4 (conversion decision gate) once Phases 1–3 are live
- [ ] Optional follow-up: B3 anchor-based scale fit
