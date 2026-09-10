# Implementation Report: 3D Try-On Drape Realism — Phase 1 (感知快赢 B1+D1+D2)

## Summary
Restored garment UV + material/texture through the pure-Python rigging write-path (B1), added contact +
soft shadows to the R3F try-on viewer (D1), and applied a neutral matte-fabric fallback to untextured
garments (D2). Rigged GLBs now carry `TEXCOORD_0` + a PBR material (metalness=0) + an embedded baseColor
image when the source has them; the viewer grounds the avatar with a contact shadow; untextured garments
render as fabric instead of grey-white plastic. No change to the LBS skinning core.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium |
| Confidence | 8/10 | Held — no surprises; trimesh material attrs + graceful-None path worked as planned |
| Files Changed | 8 (3 src + 3 test + 2 doc) | 9 (3 src + 3 test + 2 CLAUDE.md + PRD) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Extract UV + material in `_load_garment_glb` | ✅ Complete | `process=False`; 6-tuple; guards ColorVisuals; discards+WARNs on UV/vert length mismatch |
| 2 | Thread UV + material through `generate()` | ✅ Complete | uv kept out of scale/weight steps (order-preserving), threaded into writer |
| 3 | Emit TEXCOORD_0 + material + image in writer | ✅ Complete | accessors 0–5 unchanged; UV=accessor/bufferView 6; image=trailing bufferView; PBR material always written (metalness=0) |
| 4 | D1 — shadows in the viewer | ✅ Complete | `<Canvas shadows>` + `castShadow` light + `<ContactShadows>`; avatar meshes cast/receive |
| 5 | D2 — fabric fallback + castShadow | ✅ Complete | `fabricizeMaterial`/`fabricizeScene`; metalness=0 only when `.map` null; in-place mutation |
| 6 | Worker + web tests | ✅ Complete | writer round-trip + no-texture + mismatch + alignment; provider 6-tuple + threading; 6 web cases |
| 7 | Doc-sync | ✅ Complete | worker/web CLAUDE.md descriptions + test counts + changelog rows |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (lint/tsc) | ✅ Pass | `npm run lint` clean on changed files; `tsc --noEmit` clean on changed files |
| Unit Tests (worker) | ✅ Pass | Targeted 43 passed / 1 pre-existing env-fail; full suite **356 passed, 8 skipped**, 1 pre-existing |
| Unit Tests (web) | ✅ Pass | FittingHelper **19 passed**; full vitest **324 passed (33 files)** — no regressions |
| Build | ✅ Pass | tsc clean on changed files (no separate build run — CSR Next app) |
| Integration | N/A | Requires live worker+MySQL+SMPL-X+libigl (rigging container) — not runnable in this env |
| Edge Cases | ✅ Pass | no-UV (ColorVisuals), UV-len mismatch, no-texture material, image 4-byte alignment, textured-not-clobbered |

### Pre-existing failure (NOT a regression)
`test_python_rigging_provider.py::TestSmplxPathValidation::test_missing_smplx_dir_raises_rigging_error`
fails in a venv without `smplx` installed because `_load_smplx_avatar` runs `import smplx`
(python_rigging_provider.py:266) BEFORE the `os.path.isdir` check (:270) → `ModuleNotFoundError`
instead of `RiggingError`. This method was not touched by B1; it passes in the base worker image
(smplx installed) and fails identically on the base commit. Out of scope; the test lacks a `skipif`
marker (a latent robustness gap worth a follow-up).

## Files Changed

| File | Action | Lines |
|---|---|---|
| `worker/providers/python_rigging_provider.py` | UPDATED | +74 / -? (net +65) |
| `worker/providers/skinned_glb_writer.py` | UPDATED | +68 (net +62) |
| `worker/tests/test_python_rigging_provider.py` | UPDATED | +47 / -7 |
| `worker/tests/test_skinned_glb_writer.py` | UPDATED | +101 |
| `web/components/AvatarViewer.tsx` | UPDATED | +33 / -4 |
| `web/components/FittingHelper.tsx` | UPDATED | +36 |
| `web/__tests__/components/FittingHelper.test.ts` | UPDATED | +113 / -? |
| `worker/CLAUDE.md` | UPDATED | doc-sync |
| `web/CLAUDE.md` | UPDATED | doc-sync |

## Deviations from Plan
- Web test file: pre-existing `as any` casts were rewritten to typed `as unknown as Mesh/Object3D`
  so the whole edited file stays lint-clean (no behavior change). Minor, plan-consistent.
- File count 8→9 (the PRD status edit counts as a touched tracked file).

## Issues Encountered
- Fresh worktree lacked worker Python deps + web `node_modules`; each module's subagent set up its own
  venv / ran `npm install`. Resolved.
- The pre-existing smplx import-order failure (documented above) surfaced only because the local venv
  omits the heavy `smplx` dep; confirmed not caused by this change.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `worker/tests/test_skinned_glb_writer.py` | +~4 (TestMaterialAndUv) | UV+texture round-trip, no-texture material, UV shape mismatch, image 4-byte alignment |
| `worker/tests/test_python_rigging_provider.py` | +1 (6-tuple mocks migrated) | write_skinned_glb receives uv/base_color_texture kwargs |
| `web/__tests__/components/FittingHelper.test.ts` | +6 | fabricizeMaterial (untextured→metalness 0, textured untouched, castShadow, arrays, non-standard mat), fabricizeScene traversal |

## Next Steps
- [ ] Live/QA: run a real `RIGGING_PROVIDER=python` task on a textured source → `grep MATERIAL_AUDIT` shows `has_material=true has_texcoord=true`; visually confirm textured + shadowed garment.
- [ ] Phase 2 (C1 Meshy PBR + C2 category normal maps — C2 depends on this UV) and Phase 3 (A1 geometric push-out) can now proceed.
- [ ] Follow-up: add `skipif(smplx absent)` to `test_missing_smplx_dir_raises_rigging_error`, or reorder the dir check before `import smplx`.
- [ ] `/code-review` then PR.
