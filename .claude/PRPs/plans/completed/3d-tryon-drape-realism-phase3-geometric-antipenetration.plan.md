# Plan: 3D Try-On Drape Realism — Phase 3 (几何防穿模 / Geometric Anti-Penetration)

## Summary
Replace the *depth-cheat* anti-penetration (frontend `polygonOffset`, which never moves a vertex) with a
real **geometric push-out** in the worker rigging pipeline (A1). After weight transfer and before writing
the skinned GLB, compute each garment vertex's signed distance to the SMPL-X avatar surface (reusing the
igl BVH already used by `weight_transfer.py`) and push any vertex that sits inside the body — or within a
fabric-thickness shell — back out along the body's outward normal. Emit a `PENETRATION_AUDIT` log +
payload block so the PRD's "self-collision count after push-out" success metric becomes measurable.

## User Story
As a buyer trying a garment on in 3D, I want the clothing to actually wrap *outside* my body instead of
clipping through it, so the try-on looks like a real garment on a real body and I trust it enough to buy.

## Problem → Solution
**Current**: There is no geometry-level penetration fix anywhere. `weight_transfer.py` binds garment
vertices to bones via LBS; the rigged bind-pose garment can already interpenetrate the avatar, and any
pose deformation makes it worse. The only "fix" is `web/components/FittingHelper.tsx` `polygonOffset`
(`applyLayeredAntiPenetration`), which biases the **depth buffer** so the garment renders on top — it
does **not** move a single vertex, so true penetration (skin poking through, gaps at the neckline) is
still geometrically present and visible at grazing angles / silhouette.
**Desired**: The production rigging path (`PythonRiggingProvider`) writes a bind-pose garment whose
vertices are pushed to at least `fabric_thickness` outside the avatar surface. Residual penetrating-vertex
count is measured and logged (baseline for the PRD metric). `polygonOffset` stays as cheap z-fighting /
inter-garment-layering insurance — it is no longer the *primary* anti-penetration mechanism.

## Metadata
- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/3d-tryon-garment-drape-realism.prd.md`
- **PRD Phase**: Phase 3 — 几何防穿模 (A1; optional B3 anchor scale-fit)
- **Estimated Files**: 6 (1 source CREATE + 1 source UPDATE + 1 source UPDATE main.py + 2 test files + 1 doc) — B3 optional adds 2 more

---

## UX Design

### Before
```
        avatar surface
          │
   skin ──┤▓▓▓  ← garment verts sit INSIDE the body;
          │▓▓▓    only polygonOffset hides it in the
          │▓▓▓    depth buffer → skin pokes through at
          │       silhouette / grazing angles ("穿模")
```

### After
```
        avatar surface
          │   ┌── fabric_thickness shell
   skin ──┤   │▓▓▓  ← penetrating verts pushed out along
          │◄──┘▓▓▓    the body normal to sit OUTSIDE the
          │    ▓▓▓    body; garment wraps, no skin poke-through
          │
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Rigged bind-pose geometry | garment verts may lie inside avatar | penetrating verts pushed ≥ `fabric_thickness` outside | Worker-only; GLB attribute schema unchanged |
| Anti-penetration mechanism | `polygonOffset` depth-cheat only | real geometry push-out (worker) + `polygonOffset` retained for z-fighting/layering | Frontend unchanged in this phase |
| Rigging payload | no penetration data | `+ "penetration": {before, after, pushed, thickness_m}` block | Additive; consumers ignore unknown keys |
| Worker log | `MATERIAL_AUDIT ...` | `+ PENETRATION_AUDIT task=.. before=.. after=.. pushed=..` | Greppable baseline for the "-50% clipping" metric |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `worker/providers/weight_transfer.py` | 23-92 | The exact igl BVH call to reuse: `igl.point_mesh_squared_distance(query, V, F)` → `(sq_dist, closest_face, closest_pt)`; float64/int32 dtype discipline |
| P0 | `worker/providers/python_rigging_provider.py` | 65-156 | `generate()` call chain — the integration point is **after** `transfer_weights` (line 100) and **before** `write_skinned_glb` (line 121); avatar arrays are already in scope from `_get_avatar_data` |
| P0 | `worker/providers/scale_normalizer.py` | 25-113 | Immutable `.copy()` + `compute_bbox` pattern to mirror in the new module; also the B3 target if the optional task is taken |
| P1 | `worker/main.py` | 259-272 | `MATERIAL_AUDIT` log line — mirror this for the `PENETRATION_AUDIT` line (read the block from the payload) |
| P1 | `worker/tests/test_weight_transfer.py` | 1-70 | igl `importlib.util.find_spec` skip guard + synthetic cube/plane mesh builders to reuse for push-out tests |
| P1 | `worker/tests/test_python_rigging_provider.py` | 55-155 | Mock-patch call-chain pattern (6-tuple `_load_garment_glb`, patch `write_skinned_glb`, assert payload keys) — new penetration block asserted here |
| P2 | `worker/providers/mesh_preflight.py` | all | Reference for the module docstring / return-shape style (garment-scale thresholds) |
| P2 | `docs/phase0-drape-realism-findings.md` | 66-79 | Why the clipping baseline is QA-visual until A1 lands a self-collision count — this task provides that count |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| libigl point-mesh distance | Context7 `libigl` / installed `igl` (Dockerfile.rigging) | `igl.point_mesh_squared_distance(P, V, F)` returns `(sqrD, I, C)` = squared distances, closest-face indices, closest points. Same call already in `weight_transfer.py:40` — no new dependency |
| libigl signed distance | libigl python docs | `igl.signed_distance` exists but its sign_type/return signature is version-sensitive; **prefer** deriving the sign from the avatar face-normal dot (robust, no extra API surface). Documented as a Decision below |
| glTF vertex positions | glTF 2.0 spec | Push-out only mutates POSITION values in bind pose; JOINTS_0/WEIGHTS_0/TEXCOORD_0 accessors are index-aligned and unaffected as long as vertex **count/order** is preserved (push-out edits in place, never adds/removes verts) |

> RESEARCH NOTE: igl + robust-laplacian live **only** in `Dockerfile.rigging`, not base `requirements.txt`.
> New push-out tests MUST guard with `@pytest.mark.skipif(importlib.util.find_spec("igl") is None)` exactly
> like `test_weight_transfer.py`, so the base CI (no igl) stays green.

---

## Patterns to Mirror

### IGL BVH DISTANCE QUERY (reuse verbatim — same call as Phase 1 weight transfer)
```python
# SOURCE: worker/providers/weight_transfer.py:34-43
import igl
avatar_verts_f = np.asarray(avatar_verts, dtype=np.float64)
avatar_faces_i = np.asarray(avatar_faces, dtype=np.int32)
garment_verts_f = np.asarray(garment_verts, dtype=np.float64)
sq_dist, closest_face, closest_pt = igl.point_mesh_squared_distance(
    garment_verts_f, avatar_verts_f, avatar_faces_i
)
distances = np.sqrt(np.maximum(sq_dist, 0.0))
```

### IMMUTABLE VERTEX TRANSFORM + INFO DICT (mirror scale_normalizer)
```python
# SOURCE: worker/providers/scale_normalizer.py:72-113
scaled_verts = garment_verts.copy()          # never mutate input in place
...
scale_info = {
    "scale_factor": float(scale_factor),
    "translation": translation.tolist(),
    "was_normalized": was_normalized,
}
return scaled_verts, scale_info               # (new_array, metadata_dict)
```

### PROVIDER INTEGRATION — post-transfer, pre-write (mirror the existing scale_normalize block)
```python
# SOURCE: worker/providers/python_rigging_provider.py:79-88 (scale_normalize call site to mirror)
from providers.scale_normalizer import normalize_garment_to_avatar
garment_verts, scale_info = normalize_garment_to_avatar(garment_verts, avatar_verts, slot_hint)
if scale_info["was_normalized"]:
    logger.info("Rigging task %s: garment scaled by %.3f ...", task_id, scale_info["scale_factor"], ...)
# -> A1 mirrors this: after transfer_weights, before write_skinned_glb, call resolve_penetration(...)
```

### AUDIT LOG LINE (mirror MATERIAL_AUDIT prefix convention)
```python
# SOURCE: worker/main.py:263-271
material = validate_material_and_uv(absolute_path)
logger.info(
    "MATERIAL_AUDIT task=%s garment=%s has_material=%s has_texcoord=%s",
    task_id, garment_asset_id, material["has_material"], material["has_texcoord"],
)
# -> add: PENETRATION_AUDIT task=%s garment=%s before=%s after=%s pushed=%s
#         read from output["penetration"] (present only for PYTHON_WEIGHT_TRANSFER)
```

### TEST — igl skip guard + synthetic meshes
```python
# SOURCE: worker/tests/test_weight_transfer.py:8-14, 21-53
import importlib
_igl_available = importlib.util.find_spec("igl") is not None
# @pytest.mark.skipif(not _igl_available, reason="igl not installed")
def _make_cube_mesh(): ...   # unit cube (12 tris) — use as the "avatar body"
```

### TEST — provider call-chain mock (payload block assertion)
```python
# SOURCE: worker/tests/test_python_rigging_provider.py:112-135
with (
    patch.object(provider, "_load_garment_glb", return_value=(verts, faces, normals, None, None, None)),
    patch.object(provider, "_get_avatar_data", return_value=(verts, faces, normals, weights, jp)),
    patch("providers.mesh_preflight.preflight_mesh", return_value=[]),
    patch("providers.weight_transfer.transfer_weights", return_value=weights),
    patch("providers.weight_transfer.dense_weights_to_top4", return_value=(ji, jw)),
    patch("providers.skinned_glb_writer.write_skinned_glb"),
):
    result = provider.generate(1, 99, VALID_PAYLOAD)
# assert "penetration" in result and result["penetration"]["fabric_thickness_m"] > 0
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `worker/providers/penetration_pushout.py` | CREATE | A1 core: `resolve_penetration(garment_verts, avatar_verts, avatar_faces, ...) -> (new_verts, stats)` via igl BVH + face-normal sign |
| `worker/providers/python_rigging_provider.py` | UPDATE | Call `resolve_penetration` after `transfer_weights`, before `write_skinned_glb`; write pushed verts + bbox; add `"penetration"` payload block |
| `worker/main.py` | UPDATE | `PENETRATION_AUDIT` log line for the rigging path (mirror MATERIAL_AUDIT; read `output["penetration"]`) |
| `worker/tests/test_penetration_pushout.py` | CREATE | Unit tests for the new module (penetrating vert pushed out, exterior vert untouched, max-push clamp, empty/degenerate, igl-skip guard) |
| `worker/tests/test_python_rigging_provider.py` | UPDATE | Assert `generate()` output carries a `"penetration"` block; call-chain still green with the new pushout call |
| `worker/CLAUDE.md` | UPDATE | Doc-sync: new module, provider pipeline step, payload block, test counts, changelog row |

**Optional (B3 — only if taken; see Step 7):** `worker/providers/scale_normalizer.py` (UPDATE) + `worker/tests/test_scale_normalizer.py` (UPDATE).

## NOT Building

- **Ripping out `FittingHelper` `polygonOffset`** — the PRD says A1 "replaces the depth-cheat" as the
  *primary* mechanism, but `applyLayeredAntiPenetration` still earns its keep for inter-garment layering
  (top-over-bottom) and residual sub-thickness z-fighting. Leave the frontend untouched this phase.
- **Per-pose / animated push-out** — push-out runs once in the A-pose bind pose. Pose-conditioned
  re-penetration (garment clips when the avatar bends) is dynamic cloth territory → post-gate Phase 5.
- **Self-collision resolution between garment layers** (garment-vs-garment) — only garment-vs-avatar here.
- **Cloth simulation / physical drape** (A2/A3) — Phase 5, gated on the Phase 4 conversion decision.
- **Blender rigging path** — `blender_rigging_provider` is legacy/opt-in; A1 targets the production
  `PythonRiggingProvider` only.
- **`igl.signed_distance`** — deliberately avoided (version-sensitive signature); sign is derived from the
  avatar face normal dot instead (Decision below).
- **B3 anchor scale-fit is OPTIONAL** — the PRD marks it "Could". Land A1 first; treat B3 as stretch. If
  time-boxed out, it stays a clean follow-up (no coupling to A1).

---

## Step-by-Step Tasks

### Task 1: Create `penetration_pushout.py` — the push-out core
- **ACTION**: New module with `resolve_penetration(...)` that pushes penetrating garment vertices outside the avatar surface.
- **IMPLEMENT**:
  ```python
  def resolve_penetration(
      garment_verts: np.ndarray,      # (G, 3)
      avatar_verts: np.ndarray,       # (V, 3)
      avatar_faces: np.ndarray,       # (F, 3)
      fabric_thickness: float = 0.006,   # ~6 mm shell offset outside the body
      max_push: float = 0.05,            # clamp: never move a vert > 5 cm (guards bad matches)
  ) -> tuple[np.ndarray, dict]:
  ```
  1. Lazy `import igl`. Cast avatar/garment to float64/int32 (mirror weight_transfer).
  2. `sq_dist, closest_face, closest_pt = igl.point_mesh_squared_distance(garment_f, avatar_f, faces_i)`; `dist = sqrt(max(sq_dist, 0))`.
  3. Compute **per-face outward normals** of the avatar from `avatar_verts[faces]` via `np.cross(v1-v0, v2-v0)`, normalize (guard zero-length). `n_i = face_normal[closest_face[i]]`.
  4. Signed offset: `d_vec = garment_vert - closest_pt`; `signed = dot(d_vec, n_i)` (positive = outside body, negative = inside).
  5. A vertex needs pushing when `signed < fabric_thickness` (inside, or in the thickness shell). Target position = `closest_pt + n_i * fabric_thickness`. Push delta = `target - garment_vert`; clamp its magnitude to `max_push` (skip / partial-push if a vertex is absurdly far, i.e. a bad closest-point match).
  6. Apply pushes to a **copy** (`new_verts = garment_verts.copy()`); only touch rows flagged as penetrating.
  7. Return `(new_verts, stats)` where
     ```python
     stats = {
         "penetrating_before": int,        # signed < fabric_thickness
         "penetrating_after": int,         # recomputed against the shell test on new_verts (should be ~0)
         "vertices_pushed": int,
         "max_depth_before_m": float,      # max(fabric_thickness - signed) over penetrating, >=0
         "fabric_thickness_m": float,
         "was_applied": bool,              # False when igl unavailable / empty input
     }
     ```
- **MIRROR**: IGL BVH DISTANCE QUERY + IMMUTABLE VERTEX TRANSFORM.
- **IMPORTS**: `from __future__ import annotations`, `import logging`, `import numpy as np`; `import igl` lazily inside the function; module `logger = logging.getLogger(__name__)`.
- **GOTCHA**: Preserve vertex **count and order** — edit in place on the copy, never append/drop verts (TEXCOORD_0/JOINTS_0/WEIGHTS_0 accessors are index-aligned; reordering corrupts the GLB). Guard empty garment (`len==0` → return copy + `was_applied=False`). Zero-length face normals (degenerate avatar tris) → skip that vertex (leave unpushed) rather than divide by zero. `penetrating_after` is a *measurement* — recompute signed distance to the **same** avatar mesh using the pushed verts (cheap second BVH query is fine; or reuse the shell test analytically since target sits exactly at thickness).
- **VALIDATE**: `cd worker && pytest tests/test_penetration_pushout.py -v` (Task 4 authors these).

### Task 2: Integrate push-out into `PythonRiggingProvider.generate()`
- **ACTION**: Call `resolve_penetration` after weight transfer, before writing the GLB; write the pushed vertices; add a `"penetration"` payload block.
- **IMPLEMENT**: In `python_rigging_provider.py`, after `transfer_weights(...)` returns (currently line ~100-110) and before `dense_weights_to_top4` / `write_skinned_glb`:
  ```python
  from providers.penetration_pushout import resolve_penetration
  garment_verts, pen_stats = resolve_penetration(
      garment_verts, avatar_verts, avatar_faces,
  )
  if pen_stats["was_applied"]:
      logger.info(
          "Rigging task %s: push-out moved %d/%d verts (%d penetrating before, %d after)",
          task_id, pen_stats["vertices_pushed"], len(garment_verts),
          pen_stats["penetrating_before"], pen_stats["penetrating_after"],
      )
  ```
  `garment_verts` is now the pushed array → the existing `write_skinned_glb(..., vertices=garment_verts.astype(np.float32), ...)` and the `bbox_min/bbox_max` computation (lines 139-140) automatically use pushed positions. Add to the returned payload dict (after `"rigging": {...}`, alongside `"scale_normalization"`):
  ```python
  "penetration": pen_stats,
  ```
- **MIRROR**: PROVIDER INTEGRATION block (the scale_normalize call site pattern).
- **IMPORTS**: `from providers.penetration_pushout import resolve_penetration` (lazy import inside `generate`, matching the file's existing lazy-import-in-method convention, e.g. `from providers.weight_transfer import transfer_weights`).
- **GOTCHA**: Push-out runs **after** weight transfer, so weights were surface-matched on pre-push positions — that is fine (offset ≤ fabric thickness ≪ the 0.02 m match threshold in `weight_transfer.find_closest_surface_matches`). `garment_normals` become slightly stale after the push (verts move ≤ thickness along the body normal); the written NORMAL is negligibly affected — do **not** recompute normals here (would need face connectivity re-derivation; out of scope, note only). Keep `garment_uv` untouched (push-out never reorders verts). When igl is unavailable (`was_applied=False`), `garment_verts` is returned unchanged → graceful no-op, task still completes.
- **VALIDATE**: `cd worker && pytest tests/test_python_rigging_provider.py -v` — payload carries `"penetration"`.

### Task 3: `PENETRATION_AUDIT` log line in `main.py`
- **ACTION**: Add a greppable audit line in the rigging success path, mirroring `MATERIAL_AUDIT`.
- **IMPLEMENT**: In `worker/main.py`, right after the `MATERIAL_AUDIT` log (line ~263-271) and before `rigging_queue.complete_task(...)`:
  ```python
  pen = output.get("penetration") if isinstance(output, dict) else None
  if pen:
      logger.info(
          "PENETRATION_AUDIT task=%s garment=%s before=%s after=%s pushed=%s thickness_m=%s",
          task_id, garment_asset_id,
          pen.get("penetrating_before"), pen.get("penetrating_after"),
          pen.get("vertices_pushed"), pen.get("fabric_thickness_m"),
      )
  ```
- **MIRROR**: AUDIT LOG LINE (MATERIAL_AUDIT).
- **IMPORTS**: none new.
- **GOTCHA**: Read from the payload (`output`), not by re-parsing the GLB — the stats are computed in the provider and only the `PythonRiggingProvider` emits them (stub/blender payloads have no `"penetration"` key → the `if pen:` guard silently skips, no crash). Non-blocking: never fail the task on this.
- **VALIDATE**: manual — `grep PENETRATION_AUDIT` appears once per python-rigged task in worker logs.

### Task 4: Unit tests — `test_penetration_pushout.py`
- **ACTION**: New test file for the push-out module.
- **IMPLEMENT**: Reuse `_make_cube_mesh()` (copy the helper from `test_weight_transfer.py` or a local minimal version) as the "avatar body" (unit cube centered-ish). Guard the igl-dependent cases with `@pytest.mark.skipif(not _igl_available, ...)`.
  - **penetrating vertex pushed out**: a garment vert placed *inside* the cube → after `resolve_penetration`, its signed distance to the cube surface is `≥ fabric_thickness - eps`; `vertices_pushed >= 1`; `penetrating_after == 0`.
  - **exterior vertex untouched**: a garment vert well outside the cube (e.g. 0.5 m away, `signed > fabric_thickness`) → position unchanged (`np.allclose`), not counted in `vertices_pushed`.
  - **max_push clamp**: a vert deep inside with a pathological far closest-point → push magnitude ≤ `max_push` (assert no vertex moved more than `max_push + eps`).
  - **immutability**: input `garment_verts` array is not mutated (compare a pre-call copy).
  - **empty garment**: `garment_verts` shape `(0,3)` → returns `(0,3)` copy, `was_applied` truthy-or-False but no crash, `vertices_pushed == 0`.
  - **igl-absent no-op** (no skip): monkeypatch/simulate `igl` import failure is awkward; instead assert the empty-input path returns `was_applied=False` without importing igl. (Document that the real igl-absent path is covered by the provider's graceful `was_applied=False` branch.)
- **MIRROR**: TEST — igl skip guard + synthetic meshes.
- **IMPORTS**: `import importlib`, `import numpy as np`, `import pytest`; `from providers.penetration_pushout import resolve_penetration`.
- **GOTCHA**: The cube from `test_weight_transfer` spans `[0,1]^3`; place the "inside" garment vert near the center `[0.5,0.5,0.5]` and "outside" vert at `[0.5,0.5,1.6]`. Use a generous eps (1e-4) — igl closest points are exact but float. `fabric_thickness=0.006` is small vs the cube, so an interior vert pushes to just outside the nearest face.
- **VALIDATE**: `cd worker && pytest tests/test_penetration_pushout.py -v`.

### Task 5: Extend `test_python_rigging_provider.py`
- **ACTION**: Assert the `generate()` payload carries the `"penetration"` block and the call chain stays green.
- **IMPLEMENT**: The provider's `generate` calls `resolve_penetration` on real (mocked-avatar) arrays. In the existing `TestOutputFormat`/call-chain tests the avatar is a tiny synthetic mesh, so igl runs for real — guard the new assertion path so CI-without-igl still passes: either (a) add `"penetration"` to `required_keys` **only** under `@pytest.mark.skipif(not _igl_available)`, or (b) `patch("providers.penetration_pushout.resolve_penetration", return_value=(verts, {"was_applied": False, "penetrating_before":0, "penetrating_after":0, "vertices_pushed":0, "max_depth_before_m":0.0, "fabric_thickness_m":0.006}))` in the call-chain mocks so the assertion is deterministic without igl. **Prefer (b)** — consistent with how the suite already patches every pipeline stage. Add one focused test: `test_output_has_penetration_block` asserting `"penetration" in result` and `result["penetration"]["fabric_thickness_m"] > 0`.
- **MIRROR**: TEST — provider call-chain mock.
- **IMPORTS**: add `importlib` + `_igl_available` at top only if going route (a); route (b) needs none.
- **GOTCHA**: Route (b) — add the `resolve_penetration` patch to **every** existing `with (...)` block in the call-chain tests, or `generate()` will run real igl on the synthetic arrays (works if igl present, ImportError-graceful if not, but non-deterministic across CI). Match the module path exactly: `patch("providers.penetration_pushout.resolve_penetration")` (the provider imports it lazily from that module).
- **VALIDATE**: `cd worker && pytest tests/test_python_rigging_provider.py -v` (with and without igl).

### Task 6: Doc-sync — `worker/CLAUDE.md`
- **ACTION**: Document the new module, pipeline step, payload block, test counts, changelog.
- **IMPLEMENT**:
  - Architecture tree: add `penetration_pushout.py --> igl signed-distance garment push-out (A1)` under `providers/`.
  - PythonRiggingProvider "Details": add the push-out step to the pipeline chain (…weight_transfer → **penetration_pushout** → skinned_glb_writer).
  - Rigging payload schema (v2): add the `"penetration": {...}` block.
  - Add `PENETRATION_AUDIT` to the rigging-flow / gotchas notes (non-blocking, greppable).
  - Test inventory: add `test_penetration_pushout.py` row; bump totals (run the suite first for exact numbers — was 325).
  - Changelog row dated 2026-09-10: "Drape-realism Phase 3 (A1 — geometric push-out)…".
- **MIRROR**: existing changelog table rows + Test Inventory table.
- **GOTCHA**: Copy **real** test totals from the suite run, not estimates. Keep `Dockerfile.rigging` note that igl is rigging-only.
- **VALIDATE**: manual read; counts match `pytest` output.

### Task 7 (OPTIONAL / stretch): B3 — anchor-based scale fit
- **ACTION**: Only if A1 is done and time remains. Upgrade `scale_normalizer` from bbox-height-ratio to shoulder/waist-anchor alignment.
- **IMPLEMENT**: This is a **separate, self-contained** improvement with no dependency on A1. If taken: add an anchor-aware scale using SMPL-X joint positions (shoulders for TOP, hips/waist for BOTTOM) already produced by `_get_avatar_data` (`joint_positions`), threading them into `normalize_garment_to_avatar`. Keep the existing bbox-ratio as fallback when joints are unavailable. Mirror the existing immutable `.copy()` + `scale_info` dict contract; extend `test_scale_normalizer.py`.
- **MIRROR**: `scale_normalizer.py` existing structure.
- **GOTCHA**: Do NOT let B3 block A1 delivery. If skipped, it remains a clean follow-up. Changing the scale contract ripples into `python_rigging_provider` (extra arg) — keep the signature backward-compatible (optional `joint_positions=None`).
- **VALIDATE**: `cd worker && pytest tests/test_scale_normalizer.py -v`.
- **RECOMMENDATION**: **Defer** unless explicitly requested — ship A1 (Task 1-6) as the phase deliverable.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| pushout: interior vert pushed | garment vert inside cube | signed dist ≥ thickness after; `penetrating_after==0`; `vertices_pushed>=1` | No |
| pushout: exterior vert untouched | vert 0.5 m outside cube | position unchanged; not in `vertices_pushed` | Yes |
| pushout: max_push clamp | vert deep inside, far match | no vert moved > `max_push+eps` | Yes |
| pushout: input immutability | any | input array unchanged (compare pre-copy) | Yes |
| pushout: empty garment | `(0,3)` verts | `(0,3)` copy, no crash, `vertices_pushed==0` | Yes |
| pushout: degenerate avatar face | zero-area tri nearest | that vert skipped (no NaN/div-zero) | Yes |
| provider: payload has penetration | VALID_PAYLOAD (mocked) | `"penetration"` in result, `fabric_thickness_m>0` | No |
| provider: call chain green | VALID_PAYLOAD | write_skinned_glb receives pushed verts; all schema-v2 keys present | No |

### Edge Cases Checklist
- [x] Garment vertex inside body → pushed to shell
- [x] Garment vertex already outside → untouched
- [x] Absurdly-far closest match → clamped by `max_push`
- [x] Empty garment mesh → no-op, no crash
- [x] Degenerate avatar face (zero-area) → vert skipped, no NaN
- [x] igl unavailable (base CI) → `was_applied=False`, provider no-op, task completes
- [x] Vertex count/order preserved (UV/JOINTS/WEIGHTS accessors stay aligned)
- [ ] Concurrent access — n/a (per-task compute)
- [ ] Network failure — n/a (local geometry)

---

## Validation Commands

### Static Analysis
```bash
cd worker && python -m pyflakes providers/penetration_pushout.py providers/python_rigging_provider.py main.py
```
EXPECT: No undefined-name / unused-import errors. (Repo has no mypy gate; match existing style.)

### Unit Tests
```bash
cd worker && pytest tests/test_penetration_pushout.py tests/test_python_rigging_provider.py -v
```
EXPECT: All pass — with igl installed the real push-out cases run; without igl the skip-guarded cases skip and the provider payload assertion still passes via the mock.

### Full Test Suite
```bash
cd worker && pytest        # full worker suite (was 325)
```
EXPECT: No regressions; count increases by the new penetration tests.

### Manual / Container Validation (needs Dockerfile.rigging: igl + robust-laplacian + SMPL-X)
```bash
docker compose --profile rigging up rigging-worker
# trigger a python-rigging task on a textured garment, then:
grep PENETRATION_AUDIT <worker-logs>   # before=<N> after=~0 pushed=<M>
```
EXPECT: `after` ≈ 0 (all detectable bind-pose penetration resolved); open the rigged GLB in a glTF viewer next to the avatar → garment wraps outside the body, no skin poke-through at the silhouette.

### Manual Validation
- [ ] Run a real python-rigging task; `PENETRATION_AUDIT ... after=0` (or ≪ before) in worker logs.
- [ ] Rigged GLB in a viewer: garment sits outside the SMPL-X body; neckline/armhole gaps closed.
- [ ] `/outfits/[id]/view` (web) with the new rigged GLB: no visible clipping at rest pose; existing shadows/texture (Phase 1/2) still correct.

---

## Acceptance Criteria
- [ ] `resolve_penetration` pushes interior garment verts to ≥ `fabric_thickness` outside the avatar, leaves exterior verts untouched, clamps by `max_push`, and preserves vertex count/order.
- [ ] `PythonRiggingProvider.generate()` applies push-out after weight transfer, writes pushed verts, and returns a `"penetration"` payload block.
- [ ] `main.py` logs a non-blocking `PENETRATION_AUDIT` line per python-rigged task.
- [ ] igl-absent path is a graceful no-op (`was_applied=False`) — the task never crashes on a missing dep.
- [ ] All validation commands pass; no regressions; base CI (no igl) stays green.

## Completion Checklist
- [ ] Follows discovered patterns (igl BVH reuse, immutable `.copy()` + info dict, lazy-import-in-method, AUDIT log prefix)
- [ ] Error handling matches codebase (graceful no-op on missing igl; skip degenerate faces, no NaN)
- [ ] Logging follows conventions (`PENETRATION_AUDIT` mirrors `MATERIAL_AUDIT`, non-blocking)
- [ ] Tests follow worker patterns (igl skip guard, synthetic meshes, call-chain mock)
- [ ] No hardcoded magic beyond documented `fabric_thickness` / `max_push` defaults (named params)
- [ ] `worker/CLAUDE.md` doc-sync + changelog row with real test counts
- [ ] No scope creep into A2/A3 (dynamic/per-pose), frontend, or garment-vs-garment
- [ ] B3 either landed as an optional clean addition or explicitly deferred (not half-done)
- [ ] Self-contained — no further codebase search needed

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Push-out over-corrects (balloons garment) on bad closest-point matches | M | M | `max_push` clamp (5 cm); push only when `signed < thickness`; audit `vertices_pushed` vs total |
| Sign from face-normal-dot wrong on thin/concave regions (armpit, crotch) | M | M | Face-normal is the local outward direction at the closest point; acceptable for A-pose; `igl.signed_distance` deliberately avoided (version-sensitive) — note as known limitation, refine in Phase 5 |
| Stale `garment_normals` after push degrade shading | L | L | Push ≤ fabric thickness along body normal; NORMAL delta negligible; recompute deferred (out of scope) |
| Weights matched on pre-push positions | L | L | Offset (≤6 mm) ≪ 0.02 m match threshold; no re-transfer needed |
| Provider call-chain tests run real igl non-deterministically | M | M | Patch `resolve_penetration` in call-chain mocks (route b); igl-real cases skip-guarded |
| Vertex reorder/count change corrupts TEXCOORD_0/JOINTS_0 alignment | L | H | Edit in place on a `.copy()`; never add/drop/reorder verts; assert count preserved in tests |
| igl not in base image breaks CI | M | M | `@pytest.mark.skipif(find_spec("igl") is None)`; provider no-ops when igl absent |

## Notes
- **Root-cause honesty (Phase 0)**: there is *no* geometric penetration fix today — `polygonOffset` is a
  depth-buffer trick, not geometry. A1 is the first real fix. It also finally produces the PRD's
  "self-collision count after push-out" metric (`penetration.penetrating_after`), which Phase 0 flagged as
  unmeasurable until A1 lands.
- **Placement decision**: push-out runs *after* weight transfer, *before* write — per the PRD ("在绑定后
  写出前"). Running it before transfer would surface-match on already-corrected positions (marginally worse
  matches); after-transfer keeps the LBS binding intact and only nudges the bind-pose geometry.
- **Sign decision**: signed distance via avatar **face-normal dot** (not `igl.signed_distance`) — no extra
  API surface, version-stable, and the closest-face normal is exactly the local outward direction we push
  along. Winding-number sign is more robust for deeply concave meshes but SMPL-X in A-pose is well-behaved.
- **Frontend stays put**: `FittingHelper` `polygonOffset` is retained for inter-garment layering + residual
  z-fighting; A1 makes it secondary, not obsolete. No web changes this phase.
- **Deps**: igl + robust-laplacian are rigging-only (`Dockerfile.rigging`); base `requirements.txt` has
  neither. Tests must skip-guard igl exactly like `test_weight_transfer.py`.
- **B3 is optional** (PRD "Could"); recommend deferring so A1 ships clean and single-purpose.
