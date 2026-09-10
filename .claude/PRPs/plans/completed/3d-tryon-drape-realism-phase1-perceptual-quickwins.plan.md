# Plan: 3D Try-On Drape Realism — Phase 1 (感知快赢 / Perceptual Quick-Wins)

## Summary
Restore the garment's UV + material/texture through the pure-Python rigging pipeline (B1), add
contact + soft shadows to the R3F try-on viewer (D1), and apply a neutral fabric fallback material
to still-untextured garments (D2). Together these kill the three highest-signal "fake" cues —
灰白塑料外壳 (grey-white plastic shell), 悬浮 (floating), and plastic specular — at near-zero cost,
without touching the LBS skinning core.

## User Story
As a buyer trying a garment on in 3D, I want the clothing to render with its real texture, sit with a
grounded contact shadow, and look like fabric rather than plastic, so that I trust the preview enough
to add to cart.

## Problem → Solution
**Current**: The production rigging write-path (`PythonRiggingProvider` → `write_skinned_glb`) emits
`POSITION/NORMAL/JOINTS_0/WEIGHTS_0` only — no `TEXCOORD_0`, no material, no texture. three.js's
`GLTFLoader` then applies the glTF default material (white baseColor, **metalness=1**, roughness=1) →
a grey-white plastic shell (empirically confirmed, 100% of rigged output is untextured — see Phase 0
findings). The `<Canvas>` has no `shadows`, so garments read as floating.
**Desired**: Rigged GLBs carry the source garment's UV + baseColor texture + a fabric-tuned PBR
material (metalness=0). The viewer casts a soft contact shadow. Any garment that still lacks a
texture (stub provider, non-PBR Meshy) gets a neutral matte-fabric fallback instead of plastic.

## Metadata
- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/3d-tryon-garment-drape-realism.prd.md`
- **PRD Phase**: Phase 1 — 感知快赢(MVP) (B1 + D1 + D2)
- **Estimated Files**: 8 (3 source UPDATE + 3 test UPDATE worker/web + 2 docs UPDATE)

---

## UX Design

### Before
```
┌──────────────────────────────┐
│   ○  avatar (SMPL-X)          │
│  ╱ ╲                          │
│ ▓▓▓▓  <- garment: flat white  │
│ ▓▓▓▓     plastic shell,       │
│ ╱  ╲     no texture,          │
│              no shadow —       │
│              looks pasted on   │
└──────────────────────────────┘
```

### After
```
┌──────────────────────────────┐
│   ○  avatar (SMPL-X)          │
│  ╱ ╲                          │
│ ██▓▓  <- garment: real print/ │
│ ██▓▓     weave texture,       │
│ ╱  ╲     matte fabric shading │
│  ▚▚▚▚  <- soft contact shadow │
│           grounds the figure   │
└──────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Rigged GLB payload | POSITION/NORMAL/JOINTS/WEIGHTS | + TEXCOORD_0 + material + embedded baseColor image | Backward-compatible: consumers ignore extra attrs |
| Viewer shading | metalness=1 plastic, no shadow | fabric PBR (metalness=0) + contact shadow | Purely visual; no new controls |
| MATERIAL_AUDIT log | `has_material=false has_texcoord=false` | `has_material=true has_texcoord=true` for textured sources | The "untextured ratio" baseline moves toward ~0% |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `worker/providers/skinned_glb_writer.py` | 1-276 | The write-end that must gain TEXCOORD_0 + material + image; accessor/bufferView layout to extend |
| P0 | `worker/providers/python_rigging_provider.py` | 56-184 | `generate()` call chain + `_load_garment_glb` (the extract-end that discards UV/material) |
| P0 | `web/components/AvatarViewer.tsx` | 78-120, 278-317 | GarmentModel/BoundGarmentModel + the `<Canvas>`/lights to add shadows to |
| P0 | `web/components/FittingHelper.tsx` | 1-74 | Existing mesh-traversal pattern to mirror for D2 fabricize + castShadow |
| P1 | `worker/validator.py` | 250-295 | `validate_material_and_uv` — the advisory audit that flips to true once B1 lands |
| P1 | `worker/main.py` | 205-278 | Rigging validation chain + MATERIAL_AUDIT log line (keep advisory in Phase 1) |
| P1 | `worker/tests/test_skinned_glb_writer.py` | 30-84, 144-164 | `write_for_slot` helper + POSITION-bounds test pattern to extend |
| P1 | `worker/tests/test_python_rigging_provider.py` | 100-273 | Mock-patch call-chain test pattern (`write_skinned_glb` kwargs assertions) |
| P2 | `docs/phase0-drape-realism-findings.md` | 30-62 | Root-cause: loss is extract-discard + write-omission, NOT the trimesh.load call |
| P2 | `web/__tests__/components/FittingHelper.test.ts` | all | Vitest pattern for the material-traversal helpers (no jsdom Canvas) |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| trimesh TextureVisuals | Context7 `trimesh` docs | `mesh.visual.uv` (V,2) aligns to `mesh.vertices`; `mesh.visual.material` is `PBRMaterial`/`SimpleMaterial`; `baseColorTexture` is a PIL image |
| trimesh load processing | Context7 `trimesh` docs | `trimesh.load(..., process=True)` (default) **merges duplicate vertices** → can collapse UV seams & reorder verts; use `process=False` to preserve topology/UV |
| glTF material metalness | glTF 2.0 spec (drei/three) | glTF default `metallicFactor=1.0` → the "plastic/metal" look; fabric wants `metallicFactor=0`, `roughnessFactor≈0.85` |
| drei ContactShadows | `@react-three/drei` (v10.7.7, installed) | `<ContactShadows position={[0,0,0]} opacity blur far />` renders a cheap grounded shadow; no analytic light shadow map needed |

> RESEARCH NOTE: Verify trimesh material attribute names against the installed version before coding
> (`worker/requirements.txt`); B1 must degrade gracefully when `mesh.visual` is a `ColorVisuals`
> (vertex colors, no UV) — that path yields `uv=None, material=None` and falls through to D2.

---

## Patterns to Mirror

### NAMING_CONVENTION (worker: keyword-only writer params, snake_case)
```python
# SOURCE: worker/providers/skinned_glb_writer.py:88-99
def write_skinned_glb(
    output_path: str | Path,
    vertices: np.ndarray,
    normals: np.ndarray,
    ...
    slot_hint: str = "DRESS",
) -> None:
```

### ACCESSOR/BUFFERVIEW LAYOUT (append, don't renumber)
```python
# SOURCE: worker/providers/skinned_glb_writer.py:189-231
blobs = [pos_data, norm_data, ji_data, jw_data, idx_data, ibm_data]   # append uv_data / img_data here
targets = [_ARRAY_BUFFER, _ARRAY_BUFFER, _ARRAY_BUFFER, _ARRAY_BUFFER, _ELEMENT_ARRAY_BUFFER, None]
# accessors 0..5 = POSITION, NORMAL, JOINTS_0, WEIGHTS_0, indices, IBM
# -> add accessor 6 = TEXCOORD_0 (bufferView 6, target ARRAY_BUFFER)
# -> add bufferView 7 = image bytes (target None, no accessor)
```

### GLTF ASSEMBLY (pygltflib objects)
```python
# SOURCE: worker/providers/skinned_glb_writer.py:252-274
attrs = pygltflib.Attributes(POSITION=0, NORMAL=1, JOINTS_0=2, WEIGHTS_0=3)  # + TEXCOORD_0=6
primitive = pygltflib.Primitive(attributes=attrs, indices=4, mode=pygltflib.TRIANGLES)  # + material=0
gltf = pygltflib.GLTF2(scene=0, scenes=[scene], nodes=gltf_nodes, meshes=[mesh], skins=[skin],
                       accessors=accessors, bufferViews=buffer_views,
                       buffers=[pygltflib.Buffer(byteLength=len(binary_blob))])
# + materials=[...], textures=[...], images=[...], samplers=[...] when a texture is present
```

### PROVIDER EXTRACT PATTERN (lazy trimesh import, np dtype discipline)
```python
# SOURCE: worker/providers/python_rigging_provider.py:168-184
def _load_garment_glb(self, path):
    import trimesh
    mesh = trimesh.load(path, force="mesh")          # -> process=False + extract uv/material
    verts = np.asarray(mesh.vertices, dtype=np.float64)
    faces = np.asarray(mesh.faces, dtype=np.int32)
    normals = np.asarray(mesh.vertex_normals, dtype=np.float64)
    return verts, faces, normals                     # -> also return uv, material_bytes, material_info
```

### FRONTEND MESH TRAVERSAL (D1/D2 mirror this exactly)
```typescript
// SOURCE: web/components/FittingHelper.tsx:53-74
export function applyLayeredAntiPenetration(mesh: Mesh, slot: string): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of materials) {
    if (mat && mat instanceof MeshStandardMaterial) {
      mat.polygonOffset = true; mat.polygonOffsetFactor = -1 * layer;
    }
  }
}
export function applyLayeredAntiPenetrationToScene(scene: Object3D, slot: string): void {
  scene.traverse((child) => { if ((child as Mesh).isMesh) applyLayeredAntiPenetration(child as Mesh, slot); });
}
```

### CANVAS / LIGHTS (D1 extends this block)
```typescript
// SOURCE: web/components/AvatarViewer.tsx:286-301
<Canvas camera={{ position: [0, 1, 3], fov: 50 }}>          // + shadows
  <ambientLight intensity={0.6} />
  <directionalLight position={[4, 6, 4]} intensity={1.2} /> // + castShadow
  <directionalLight position={[-4, 2, -4]} intensity={0.4} />
  <Suspense fallback={...}> ... <Environment preset="studio" /> </Suspense>
  <OrbitControls makeDefault enablePan enableZoom enableRotate />
</Canvas>
```

### TEST_STRUCTURE (worker: mock-patch the whole call chain)
```python
# SOURCE: worker/tests/test_python_rigging_provider.py:112-131
with (
    patch.object(provider, "_load_garment_glb", return_value=(verts, faces, normals)),  # -> 6-tuple
    patch.object(provider, "_get_avatar_data", return_value=(verts, faces, normals, weights, jp)),
    patch("providers.mesh_preflight.preflight_mesh", return_value=[]),
    patch("providers.weight_transfer.transfer_weights", return_value=weights),
    patch("providers.weight_transfer.dense_weights_to_top4", return_value=(ji, jw)),
    patch("providers.skinned_glb_writer.write_skinned_glb") as mock_write,
):
    result = provider.generate(1, 99, VALID_PAYLOAD)
```

### TEST_STRUCTURE (worker: real GLB round-trip + validator assertions)
```python
# SOURCE: worker/tests/test_skinned_glb_writer.py:147-163
def test_position_accessor_has_min_max(self, tmp_path):
    out = write_for_slot(tmp_path, "TOP")
    gltf = pygltflib.GLTF2.load(str(out))
    pos = gltf.accessors[0]
    assert pos.min is not None and pos.max is not None
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `worker/providers/skinned_glb_writer.py` | UPDATE | B1 write-end: add optional `uv`, `base_color_texture`(bytes+mime), `base_color_factor`, `metallic`/`roughness`; emit TEXCOORD_0 accessor + material + embedded image |
| `worker/providers/python_rigging_provider.py` | UPDATE | B1 extract-end: `_load_garment_glb` returns UV + material; `generate()` threads them into `write_skinned_glb`; `process=False` load |
| `web/components/AvatarViewer.tsx` | UPDATE | D1: `<Canvas shadows>` + `castShadow` light + drei `<ContactShadows>`; enable castShadow/receiveShadow on garment+avatar meshes |
| `web/components/FittingHelper.tsx` | UPDATE | D2: `fabricizeMaterial`/`fabricizeScene` — force metalness=0, roughness≈0.85 on untextured meshes + set `castShadow`; called from garment traversal |
| `worker/tests/test_skinned_glb_writer.py` | UPDATE | Round-trip: writing uv+texture yields TEXCOORD_0 + material + image; `validate_material_and_uv` → true; metalness default 0 |
| `worker/tests/test_python_rigging_provider.py` | UPDATE | 6-tuple `_load_garment_glb`; `write_skinned_glb` receives uv/material kwargs |
| `web/__tests__/components/FittingHelper.test.ts` | UPDATE | `fabricizeMaterial` forces metalness=0/roughness on untextured; leaves textured (map set) alone |
| `worker/CLAUDE.md` + `web/CLAUDE.md` | UPDATE | Doc-sync: writer now emits material/UV; viewer casts shadows; test counts |

## NOT Building

- **Meshy `enable_pbr=True`** (C1) and **category normal/wrinkle maps** (C2) — Phase 2; C2 depends on B1's UV.
- **Geometric anti-penetration push-out** (A1) — Phase 3; FittingHelper stays polygonOffset-only here.
- **Flipping `validate_material_and_uv` into a hard gate** — the default `StubRiggingProvider` and
  non-PBR Meshy garments legitimately have no texture; a hard gate would fail those tasks. Keep it
  advisory (MATERIAL_AUDIT log). Hard-gating is a follow-up once every source path carries a texture.
- **Cloth simulation / wrinkles from physics** (A2/A3) — post-gate Phase 5.
- **Normal/roughness/metallic textures** — Phase 1 embeds baseColor only; extra PBR maps are C1/C2.
- **Blender rigging path** — already preserves material; out of scope (legacy/opt-in).
- **Avatar body texture/skin** — this PRD is garment-only.

---

## Step-by-Step Tasks

### Task 1: Extract UV + material in `_load_garment_glb`
- **ACTION**: Change `_load_garment_glb` to also return the garment's UV array and baseColor material data.
- **IMPLEMENT**: Load with `trimesh.load(path, force="mesh", process=False)` to preserve topology/UV.
  Read `mesh.visual`: if it is a `TextureVisuals` with `uv is not None`, capture `uv=np.asarray(mesh.visual.uv, dtype=np.float32)` (shape `(V,2)`); read `mesh.visual.material`. From the material capture: `base_color_factor` (RGBA list, default `[1,1,1,1]`), and if a baseColor texture PIL image exists, encode it to PNG bytes (`io.BytesIO`, `img.save(buf, format="PNG")`) with mime `image/png`. Return a 6-tuple `(verts, faces, normals, uv, tex_png_bytes, base_color_factor)`. When there is no UV/material (e.g. `ColorVisuals`), return `uv=None, tex_png_bytes=None, base_color_factor=None`.
- **MIRROR**: PROVIDER EXTRACT PATTERN.
- **IMPORTS**: `import io` (module top or lazy); `import numpy as np` (already imported); trimesh lazy (already).
- **GOTCHA**: `mesh.visual.uv` length MUST equal `len(mesh.vertices)`; with `process=False` they stay aligned. If `uv.shape[0] != len(verts)`, discard UV (set None) and log a WARN — never write a mismatched TEXCOORD_0 (breaks the GLB). Guard `getattr(mesh.visual, "uv", None)` because `ColorVisuals` has no `uv`.
- **VALIDATE**: `pytest worker/tests/test_python_rigging_provider.py -k load` (add a test loading a temp textured GLB → uv not None, tex bytes non-empty).

### Task 2: Thread UV + material through `generate()`
- **ACTION**: Capture the new return values and pass them to `write_skinned_glb`.
- **IMPLEMENT**: Unpack `garment_verts, garment_faces, garment_normals, garment_uv, garment_tex, garment_base_color = self._load_garment_glb(source_path)`. `scale_normalizer` and `weight_transfer` operate on verts/faces/normals only and preserve vertex order, so `garment_uv` stays valid (do NOT pass uv through them). Add kwargs to the `write_skinned_glb(...)` call: `uv=garment_uv, base_color_texture=garment_tex, base_color_factor=garment_base_color`.
- **MIRROR**: `generate()` call chain (`python_rigging_provider.py:67, 114-125`).
- **IMPORTS**: none new.
- **GOTCHA**: `scale_normalizer.normalize_garment_to_avatar` returns *new* vert arrays but same ordering/count — UV correspondence holds. Confirm no code path re-triangulates or drops verts between load and write (it doesn't today). Keep `garment_uv` untouched by preflight/transfer.
- **VALIDATE**: `pytest worker/tests/test_python_rigging_provider.py -k "call_chain or write_skinned"` — assert `write_skinned_glb` called with `uv`/`base_color_texture` kwargs.

### Task 3: Emit TEXCOORD_0 + material + embedded image in `write_skinned_glb`
- **ACTION**: Add optional params and write the glTF material/texture/image + UV accessor.
- **IMPLEMENT**: Signature gains `uv: np.ndarray | None = None`, `base_color_texture: bytes | None = None`, `base_color_texture_mime: str = "image/png"`, `base_color_factor: list[float] | None = None`, `metallic_factor: float = 0.0`, `roughness_factor: float = 0.85`.
  1. If `uv is not None`: validate `uv.shape == (len(vertices), 2)` (raise `ValueError` on mismatch, mirroring existing shape guards at lines 114-124); append `uv_data = uv.astype(np.float32).tobytes()` to `blobs` with target `_ARRAY_BUFFER`; add accessor 6 `type="VEC2"`, `componentType=_FLOAT`, `count=num_verts`, `bufferView=6`; set `attrs.TEXCOORD_0 = 6`.
  2. Always build a PBR material with `metallicFactor=metallic_factor`, `roughnessFactor=roughness_factor`, `baseColorFactor=base_color_factor or [1,1,1,1]`. This fixes the plastic look even with no texture. Set `primitive.material = 0`, `gltf.materials = [material]`.
  3. If `base_color_texture is not None`: append `img_data = _pad4(base_color_texture)` as a trailing bufferView (target `None`, no accessor); add `gltf.images = [Image(bufferView=<img_bv>, mimeType=mime)]`, `gltf.samplers = [Sampler()]`, `gltf.textures = [Texture(source=0, sampler=0)]`, and set `material.pbrMetallicRoughness.baseColorTexture = TextureInfo(index=0)`.
  Keep every bufferView 4-byte aligned via the existing `_pad4`/offset loop; the image bufferView must also start on a 4-byte boundary.
- **MIRROR**: ACCESSOR/BUFFERVIEW LAYOUT + GLTF ASSEMBLY.
- **IMPORTS**: `pygltflib` classes already imported via `import pygltflib` — use `pygltflib.Material`, `pygltflib.PbrMetallicRoughness`, `pygltflib.TextureInfo`, `pygltflib.Texture`, `pygltflib.Sampler`, `pygltflib.Image`.
- **GOTCHA**: Do NOT renumber existing accessors 0-5 / bufferViews 0-5 (JOINTS_0=2 etc. are referenced by index) — append the UV accessor as index 6 and the image as the last bufferView. `baseColorFactor` must be length-4 RGBA. The image bytes go in the same binary blob buffer (buffer 0) via a bufferView, not an external file — GLB must stay single-file.
- **VALIDATE**: `pytest worker/tests/test_skinned_glb_writer.py` — round-trip asserts below.

### Task 4: D1 — shadows in the viewer
- **ACTION**: Enable shadow rendering + a contact shadow in `AvatarViewer`.
- **IMPLEMENT**: Add `shadows` to `<Canvas>`. Add `castShadow` to the key `directionalLight` (position `[4,6,4]`). Import `ContactShadows` from `@react-three/drei` and render `<ContactShadows position={[0, 0, 0]} opacity={0.35} scale={6} blur={2.4} far={4} resolution={512} color="#000000" />` inside the `<Bounds>`/scene (as a sibling of the model, at the feet). Ensure garment + avatar meshes set `castShadow = true` (done via the D2 traversal in Task 5 for garments; for the avatar, set `castShadow`/`receiveShadow` in `AvatarModel`'s existing `useMemo` traverse at lines 94-106).
- **MIRROR**: CANVAS / LIGHTS block; AvatarModel traverse (`AvatarViewer.tsx:97-104`).
- **IMPORTS**: add `ContactShadows` to the existing `@react-three/drei` import (line 5-12).
- **GOTCHA**: `ContactShadows` grounds at y=0 — the SMPL-X avatar is authored feet-near-origin, so `[0,0,0]` is correct; if the model floats, adjust y from the model bbox, not by moving the shadow arbitrarily. Contact shadows don't need `receiveShadow` on a ground plane (they render their own). Keep `Environment preset="studio"` — it provides the IBL that makes fabric roughness read correctly.
- **VALIDATE**: `cd web && npm run dev`, open a rigged outfit at `/outfits/[id]/view`; confirm a soft shadow under the avatar and no console errors. (jsdom can't render Canvas — no unit test for the Canvas itself.)

### Task 5: D2 — fabric fallback + castShadow traversal
- **ACTION**: Add `fabricizeMaterial(mesh)` + `fabricizeScene(scene)` to `FittingHelper.tsx` and call from garment models.
- **IMPLEMENT**: `fabricizeMaterial(mesh)` iterates materials (mirror `applyLayeredAntiPenetration`): for each `MeshStandardMaterial` **without a `map`** (untextured — stub/non-PBR), set `metalness = 0`, `roughness = 0.85` (kills plastic specular; leaves textured garments from B1 untouched since they have `.map`). Always set `mesh.castShadow = true` and `mesh.receiveShadow = true`. Add `fabricizeScene(scene)` that traverses meshes (mirror `applyLayeredAntiPenetrationToScene`). Call `fabricizeScene(clonedScene)` in `BoundGarmentModel`'s effect (alongside the existing `applyLayeredAntiPenetrationToScene`) and in `GarmentModel` (add a small effect, or fabricize the cloned scene before render).
- **MIRROR**: FRONTEND MESH TRAVERSAL.
- **IMPORTS**: `FittingHelper.tsx` already imports `MeshStandardMaterial, type Mesh, type Object3D`.
- **GOTCHA**: Only downgrade metalness when `mat.map == null` — a textured B1 garment should keep its authored material (the writer already sets metalness=0 there, but the frontend guard avoids double-touching). Don't replace the material object (breaks skinning binding); mutate in place. `GarmentModel` currently uses `scene.clone()` (line 80) not `cloneSkeleton` — fabricize its cloned scene too.
- **VALIDATE**: `cd web && npm run test -- FittingHelper` — new cases assert metalness forced to 0 on untextured, left alone when `.map` present, castShadow set.

### Task 6: Worker tests — writer round-trip + provider threading
- **ACTION**: Extend `test_skinned_glb_writer.py` and `test_python_rigging_provider.py`.
- **IMPLEMENT**:
  - Writer: new `TestMaterialAndUv` class — build a small mesh with `uv=(V,2)` and a tiny PNG (`PIL.Image.new("RGB",(2,2)).save(buf,"PNG")`), call `write_skinned_glb(..., uv=uv, base_color_texture=png_bytes)`; load with pygltflib and assert `accessors` includes a VEC2 TEXCOORD_0, `gltf.materials` non-empty with `metallicFactor==0`, `gltf.images`/`textures`/`samplers` present; assert `validate_material_and_uv(str(out))["valid"] is True`. Add a no-texture case: `uv=None, base_color_texture=None` → still writes a material (metalness 0), `has_texcoord=False`, and `validate_glb_geometry` still passes (POSITION bounds intact).
  - Provider: update the mock `_load_garment_glb` return values in existing tests to the **6-tuple** `(v, f, n, uv, tex, factor)`; add a test asserting `write_skinned_glb` is called with `uv`/`base_color_texture` kwargs when the source has them.
- **MIRROR**: TEST_STRUCTURE (both variants).
- **IMPORTS**: `from PIL import Image` (pillow is in worker base deps per Phase 0); `io`.
- **GOTCHA**: Existing provider tests patch `_load_garment_glb` with a 3-tuple — ALL of them must become 6-tuples or `generate()` unpacking raises. Update every occurrence (search `_load_garment_glb", return_value=`).
- **VALIDATE**: `cd worker && pytest tests/test_skinned_glb_writer.py tests/test_python_rigging_provider.py`.

### Task 7: Doc-sync
- **ACTION**: Update `worker/CLAUDE.md` and `web/CLAUDE.md`.
- **IMPLEMENT**: worker: note `write_skinned_glb` now emits TEXCOORD_0 + material + embedded baseColor image; `_load_garment_glb` returns UV/material; bump test counts; add a Phase-1 changelog row. web: note `AvatarViewer` `<Canvas shadows>` + `ContactShadows`; `FittingHelper` gains `fabricizeMaterial/fabricizeScene`; bump FittingHelper test count; changelog row.
- **MIRROR**: existing changelog table rows.
- **IMPORTS**: n/a.
- **GOTCHA**: Keep counts accurate — run the test suites first and copy real totals.
- **VALIDATE**: manual read; counts match test output.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| writer: uv+texture round-trip | mesh + uv(V,2) + PNG bytes | GLB has TEXCOORD_0 VEC2, material metalness=0, image/texture/sampler | No |
| writer: `validate_material_and_uv` | textured GLB from writer | `{valid:true, has_texcoord:true, has_material:true}` | No |
| writer: no-texture still fabric | uv=None, tex=None | material present (metalness=0), no TEXCOORD_0, geometry valid | Yes (untextured) |
| writer: uv shape mismatch | uv=(V-1,2) | `ValueError` | Yes |
| writer: 4-byte alignment | any + image | every bufferView byteOffset %4==0 | Yes (image blob) |
| provider: load textured GLB | temp GLB w/ texture | uv not None, tex bytes non-empty, factor len 4 | No |
| provider: threads to writer | VALID_PAYLOAD | `write_skinned_glb` kwargs include uv/base_color_texture | No |
| provider: ColorVisuals source | vertex-color GLB | uv=None, tex=None (no crash) | Yes (no UV) |
| web: fabricize untextured | MeshStandardMaterial, map=null | metalness=0, roughness=0.85, castShadow=true | No |
| web: fabricize textured | material with `.map` set | metalness unchanged, castShadow=true | Yes (don't clobber) |

### Edge Cases Checklist
- [x] Garment with no UV / vertex-color only → uv=None, D2 fabric fallback
- [x] Garment with UV but no texture image → material (metalness 0), no image
- [x] UV length ≠ vertex count → discard UV + WARN (never write mismatched accessor)
- [x] Stub provider output (no material) → MATERIAL_AUDIT stays false; not gated
- [x] Existing 3-tuple mock patches → migrate to 6-tuple (else unpack error)
- [x] Image bufferView 4-byte alignment
- [ ] Concurrent access — n/a (per-task write)
- [ ] Network failure — n/a (local mesh I/O)

---

## Validation Commands

### Static Analysis
```bash
cd web && npm run lint            # ESLint (AvatarViewer/FittingHelper)
```
EXPECT: Zero errors (no new `bg-*`/hex colors introduced; R3F material files are on the allowlist).

### Unit Tests
```bash
cd worker && pytest tests/test_skinned_glb_writer.py tests/test_python_rigging_provider.py -v
cd web && npm run test -- FittingHelper
```
EXPECT: All pass, including new material/UV + fabricize cases.

### Full Test Suite
```bash
cd worker && pytest              # full worker suite (was 320)
cd web && npm run test           # full web suite (was 234)
```
EXPECT: No regressions; counts increase by the added cases.

### Browser Validation
```bash
cd web && npm run dev            # :3000 (needs API on :3001)
```
EXPECT: `/outfits/[id]/view` with a rigged garment shows a textured, matte-fabric garment with a soft
contact shadow; no console errors; static-preview fallback unaffected.

### Manual Validation
- [ ] Run a real python-rigging task on a textured source; `grep MATERIAL_AUDIT` in worker logs shows `has_material=true has_texcoord=true`.
- [ ] Open the rigged GLB in a glTF viewer → texture visible, material metalness=0.
- [ ] Try-on viewer: garment textured + grounded shadow; untextured stub garment reads as matte fabric (not plastic).

---

## Acceptance Criteria
- [ ] Rigged GLB from `PythonRiggingProvider` carries TEXCOORD_0 + material + embedded baseColor when the source has them.
- [ ] `validate_material_and_uv` returns `valid:true` for a textured rigged output.
- [ ] Default material metalness=0 (no plastic look) even for untextured garments.
- [ ] Viewer casts a soft contact shadow; garment + avatar meshes castShadow.
- [ ] D2 fabricize forces metalness=0/roughness on untextured meshes, leaves textured (`.map`) alone.
- [ ] All validation commands pass; no type/lint errors; no regressions.

## Completion Checklist
- [ ] Follows discovered patterns (append-accessor, keyword params, traverse-and-mutate)
- [ ] Error handling matches codebase (ValueError on shape mismatch; WARN-and-degrade on UV mismatch)
- [ ] Logging follows conventions (MATERIAL_AUDIT stays advisory)
- [ ] Tests follow existing worker/web patterns
- [ ] No hardcoded colors added on the web side
- [ ] worker/web CLAUDE.md doc-sync + changelog rows
- [ ] No scope creep into C1/C2/A1
- [ ] Self-contained — no further codebase search needed

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| trimesh merges/reorders verts (process=True) → UV/weight desync | M | H | Load `process=False`; assert `len(uv)==len(verts)`, discard+WARN on mismatch |
| Source GLB has no UV (Meshy no-PBR / vertex color) | H | M | Graceful None path → material-only + D2 fabric fallback; test the ColorVisuals case |
| Embedded texture bloats GLB / breaks alignment | M | M | baseColor only (Phase 1); reuse `_pad4`; assert 4-byte alignment in tests |
| Flipping audit to hard gate breaks stub/non-PBR tasks | M | H | Explicitly NOT flipping — keep MATERIAL_AUDIT advisory |
| ContactShadows y-offset wrong if avatar not feet-at-origin | L | M | Derive ground y from model bbox if needed; SMPL-X A-pose is authored feet-near-0 |
| Existing 3-tuple provider mocks break on 6-tuple unpack | H | L | Task 6 migrates every `_load_garment_glb` patch |

## Notes
- Root cause (Phase 0, adversarially verified): loss is **extract-discard + write-omission**, NOT the
  `trimesh.load(force="mesh")` call — B1 must fix both `_load_garment_glb` and `write_skinned_glb`.
- The single biggest perceived-quality win may be the cheapest: setting `metallicFactor=0` in the
  written material (and D2 on the frontend) removes the glTF-default metalness=1 that causes the
  "plastic" read — independent of whether a texture is present.
- Phase 1 runs in parallel with Phase 2 per the PRD, but C2 (normal maps) depends on this task's UV.
- Web token key is `clossette_token` (not `iyae_token`) — irrelevant here but noted from Phase 0 drift.
- Worker material/texture deps (trimesh, pygltflib, numpy, pillow) are in the base image (Phase 0 probe
  ran with exactly these); igl/robust-laplacian/SMPL-X remain rigging-only (Dockerfile.rigging).
```
