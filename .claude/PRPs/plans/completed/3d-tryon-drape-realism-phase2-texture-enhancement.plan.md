# Plan: 3D Try-On Drape Realism — Phase 2 (质感增强 / Texture Enhancement)

## Summary
Fake fabric micro-relief and kill the residual plastic look on top of Phase 1's restored UV/material,
with **zero cloth simulation**: (C1) make Meshy's PBR map generation an env-gated toggle so metallic/
roughness/normal maps can be evaluated for cost + quality on the raw-Meshy display path; (C2) apply a
slot-keyed **tiled normal map** to garment materials on the frontend (the only wrinkle route that
reaches the *rigged* path, which carries UV via B1 but whose writer embeds baseColor only); (D3) tune
the viewer's tone mapping + environment so garments read as matte fabric rather than glossy plastic.

## User Story
As a buyer inspecting a garment in 3D, I want the fabric to show believable weave/wrinkle relief and a
matte, non-plastic finish, so that the preview looks like real cloth and I trust it enough to buy.

## Problem → Solution
**Current** (post-Phase 1): rigged garments carry their baseColor texture + a fabric-tuned PBR material
(metalness=0), and untextured garments get a matte fallback (D2). But the surface is still perfectly
smooth — no weave, no wrinkle relief — and Meshy generation runs `enable_pbr=False`, so even the raw
(non-rigged) display path has only a flat diffuse texture with no normal/roughness detail. The viewer
uses default (linear-ish) output with `Environment preset="studio"`, which can still read glossy.
**Desired**: (C1) Meshy PBR is a config toggle → raw Meshy GLBs can carry metallic/roughness/normal
maps (evaluated for credit cost + quality before default-on). (C2) every garment material with UV gets
a tiled, slot-appropriate normal map on the frontend → plausible fabric relief on **both** the rigged
and static paths. (D3) ACES tone mapping + tuned exposure/environment → consistent matte-fabric look,
plastic highlights gone.

## Metadata
- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/3d-tryon-garment-drape-realism.prd.md`
- **PRD Phase**: Phase 2 — 质感增强 (C1 Meshy PBR + C2 category/slot normal maps + D3 environment/tone mapping)
- **Estimated Files**: ~11 (2 worker source + 1 worker test + 3 web source + 2 web test + 1 web asset dir + 2 docs)
- **Depends on**: Phase 0 (root cause + funnel — done), Phase 1 (B1 UV/material — `complete`; C2 relies on B1's TEXCOORD_0)
- **Parallel with**: Phase 3 (geometric anti-penetration) — different code regions

---

## UX Design

### Before (post-Phase 1)
```
┌──────────────────────────────┐
│   ○  avatar (SMPL-X)          │
│  ╱ ╲                          │
│ ██▓▓  <- garment: real print  │
│ ██▓▓     texture but a         │
│ ╱  ╲     dead-smooth surface,  │
│  ▚▚▚▚     slight plastic sheen │
└──────────────────────────────┘
```

### After (Phase 2)
```
┌──────────────────────────────┐
│   ○  avatar (SMPL-X)          │
│  ╱ ╲                          │
│ ▚▞▚▞  <- garment: texture +   │
│ ▞▚▞▚     tiled weave/wrinkle   │
│ ╱  ╲     normal relief, matte  │
│  ▚▚▚▚     ACES-toned fabric    │
└──────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Meshy generation | `enable_pbr=false` hardcoded | env-gated `WORKER_MESHY_ENABLE_PBR` (default false) | Off by default; flip to evaluate credit cost/quality; raw GLB gains normal/roughness/metallic maps |
| Garment material (frontend) | baseColor `.map` only, smooth | `.map` + tiled `.normalMap` (slot-keyed) | Only meshes with UV; normalScale tuned per slot; mutated in place |
| Viewer output | default tone mapping, `Environment studio` | ACES Filmic + tuned exposure + fabric-friendly env | Purely visual; no new user controls |

No new user-facing controls. All changes are visual fidelity.

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `web/components/FittingHelper.tsx` | 1-111 | The material-traversal home for C2; mirror `fabricizeMaterial`/`fabricizeScene` exactly — the normal-map applier is a sibling |
| P0 | `web/components/AvatarViewer.tsx` | 83-90, 142-203, 294-328 | GarmentModel/BoundGarmentModel call sites (where C2 hooks in) + the `<Canvas>`/`<Environment>` block (D3) |
| P0 | `worker/providers/meshy_generator.py` | 203-227 | The `image-to-3d` POST body carrying `enable_pbr=False` (C1) |
| P0 | `worker/main.py` | 44-58 | `get_provider()` — where `MeshyGenerator(...)` is constructed; thread the PBR env flag here |
| P1 | `web/__tests__/components/FittingHelper.test.ts` | all | Vitest pattern for material-traversal helpers (no jsdom Canvas); extend for the normal-map applier |
| P1 | `worker/tests/test_meshy_generator.py` | `TestMeshyGeneratorGenerate`, `TestMeshyGeneratorInit` | POST-body param assertions + constructor tests to extend for the PBR flag |
| P1 | `worker/providers/skinned_glb_writer.py` | 99-128, 216-317 | Confirms the rigged writer embeds **baseColor only** — no normal/roughness accessor → why C2 is frontend, not writer-side |
| P1 | `worker/providers/python_rigging_provider.py` | 178-245 | `_load_garment_glb` extracts baseColor only → the rigged path cannot forward Meshy's PBR maps (C1 boundary) |
| P2 | `.claude/PRPs/plans/completed/3d-tryon-drape-realism-phase1-perceptual-quickwins.plan.md` | all | Phase 1 plan this mirrors (structure, validation cadence, doc-sync convention) |
| P2 | `docs/api-reference/meshy_Image-to-3D.md` | params table | `enable_pbr` semantics: needs `should_texture:true`; emits metallic/roughness/normal/emission; `hd_texture` gives 2K PBR maps |
| P2 | `web/app/globals.css` | R3F color allowlist note | Frontend R3F material files are on the hardcoded-color allowlist — safe to set hex/material props here |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Meshy `enable_pbr` | `docs/api-reference/meshy_Image-to-3D.md` (Context7 `meshy` if deeper needed) | `enable_pbr:true` requires `should_texture:true`; generates metallic/roughness/normal/emission maps; costs extra credits; `hd_texture:true` → 2K PBR maps (meshy-6/latest only) |
| three.js `MeshStandardMaterial.normalMap` | Context7 `three` (v0.184.0, installed) | `mat.normalMap = texture; mat.normalScale = new Vector2(s,s)`; the texture's `wrapS/wrapT = RepeatWrapping` + `repeat.set(n,n)` tiles it; `needsUpdate = true` after assignment; normal map requires UVs on the mesh |
| three.js `useTexture` (drei) | `@react-three/drei` (v10.7.7, installed) | `useTexture(url)` loads a texture with Suspense; for imperative traversal use three's `TextureLoader` (module-level, memoized) so the map is shared across meshes, not reloaded per mesh |
| ACES tone mapping | three.js / R3F docs | `<Canvas gl={{ toneMapping: ACESFilmicToneMapping }} >` + `toneMappingExposure` compresses highlights → matte look; drei `<Environment>` still supplies IBL. R3F sets `ACESFilmicToneMapping` by default in recent versions — set it explicitly + tune exposure to be deterministic |

> RESEARCH NOTE: Confirm three's default `toneMapping` in the installed `three@0.184.0` before assuming
> it's linear — recent R3F defaults to `ACESFilmicToneMapping`. If already ACES, D3 becomes "tune
> exposure + environment intensity", not "switch tone mapping". Verify via a quick console check in the
> running viewer, not from memory.

---

## Patterns to Mirror

### FRONTEND MATERIAL TRAVERSAL (C2 mirrors this exactly)
```typescript
// SOURCE: web/components/FittingHelper.tsx:89-110
export function fabricizeMaterial(mesh: Mesh): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const mat of materials) {
    if (mat && mat instanceof MeshStandardMaterial && !mat.map) {
      mat.metalness = 0;
      mat.roughness = 0.85;
    }
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}
export function fabricizeScene(scene: Object3D): void {
  scene.traverse((child) => {
    if ((child as Mesh).isMesh) fabricizeMaterial(child as Mesh);
  });
}
```

### FRONTEND CALL SITES (where C2 hooks in — alongside fabricizeScene)
```typescript
// SOURCE: web/components/AvatarViewer.tsx:83-90 (GarmentModel) and 176-177 (BoundGarmentModel)
function GarmentModel({ url }: GarmentModelProps) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(), [scene]);
  useEffect(() => { fabricizeScene(cloned); }, [cloned]);   // -> also applyGarmentNormalMap(cloned, slot)
  return <primitive object={cloned} />;
}
// BoundGarmentModel effect already calls: applyLayeredAntiPenetrationToScene + fabricizeScene(clonedScene)
```

### CANVAS / ENVIRONMENT (D3 extends this block)
```typescript
// SOURCE: web/components/AvatarViewer.tsx:302-326
<Canvas shadows camera={{ position: [0, 1, 3], fov: 50 }}>   // + gl={{ toneMapping, toneMappingExposure }}
  <ambientLight intensity={0.6} />
  <directionalLight castShadow position={[4, 6, 4]} intensity={1.2} />
  <directionalLight position={[-4, 2, -4]} intensity={0.4} />
  <Suspense fallback={...}>
    ...
    <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={6} blur={2.4} far={4} resolution={512} color="#000000" />
    <Environment preset="studio" />                          // + environmentIntensity tuning if needed
  </Suspense>
  <OrbitControls makeDefault enablePan enableZoom enableRotate />
</Canvas>
```

### WORKER: MESHY POST BODY (C1 flips one field, sourced from a constructor flag)
```python
# SOURCE: worker/providers/meshy_generator.py:213-227
resp = requests.post(
    f"{MESHY_API_BASE}/image-to-3d",
    headers=self.headers,
    json={
        "image_url": resolved_url,
        "ai_model": "meshy-6",
        "should_remesh": True,
        "topology": "triangle",
        "target_polycount": 30000,
        "target_formats": ["glb", "usdz"],
        "enable_pbr": False,      # -> self.enable_pbr
        "should_texture": True,
    },
    timeout=30,
)
```

### WORKER: PROVIDER CONSTRUCTION FROM ENV (C1 mirrors the api_key env pattern)
```python
# SOURCE: worker/main.py:51-56
elif provider_name == "meshy":
    from providers.meshy_generator import MeshyGenerator
    api_key = os.environ.get("WORKER_MESHY_API_KEY")
    if not api_key:
        raise ValueError("WORKER_MESHY_API_KEY required for meshy provider")
    return MeshyGenerator(api_key=api_key, output_base_dir=OUTPUT_BASE_DIR)  # -> + enable_pbr=<env bool>
```

### WORKER TEST: POST-BODY / CONSTRUCTOR ASSERTION
```python
# SOURCE: worker/tests/test_meshy_generator.py (TestMeshyGeneratorGenerate / TestMeshyGeneratorInit)
# Mocks requests.post; asserts the JSON body carries the expected params.
# -> add: enable_pbr defaults False; MeshyGenerator(enable_pbr=True) puts enable_pbr:true in the body.
```

### WEB TEST: MATERIAL-TRAVERSAL HELPER (jsdom, no Canvas)
```typescript
// SOURCE: web/__tests__/components/FittingHelper.test.ts (fabricizeMaterial cases)
// Construct a Mesh with a MeshStandardMaterial, call the helper, assert material props.
// -> add: applyGarmentNormalMap sets mat.normalMap (a Texture) + normalScale when UV present;
//         leaves a material without UV / already-normal-mapped garment alone.
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `worker/providers/meshy_generator.py` | UPDATE | C1: add `enable_pbr: bool = False` ctor param; use `self.enable_pbr` in the POST body |
| `worker/main.py` | UPDATE | C1: read `WORKER_MESHY_ENABLE_PBR` env (default false), pass to `MeshyGenerator(...)` |
| `worker/tests/test_meshy_generator.py` | UPDATE | C1: assert default `enable_pbr:false`; `enable_pbr=True` → body `enable_pbr:true` |
| `web/components/FittingHelper.tsx` | UPDATE | C2: add `applyGarmentNormalMap(mesh, slot)` + `applyGarmentNormalMapToScene(scene, slot)` + a memoized slot→normal-map loader; mutate materials in place |
| `web/components/AvatarViewer.tsx` | UPDATE | C2: call the normal-map applier in GarmentModel + BoundGarmentModel (thread `slot`); D3: `gl={{ toneMapping: ACESFilmicToneMapping, toneMappingExposure }}` on `<Canvas>` + environment tuning |
| `web/lib/fabric-textures.ts` | CREATE | C2: slot→normal-map URL + tiling/normalScale config (single source; keeps FittingHelper clean) |
| `web/public/textures/fabric/` | CREATE (assets) | C2: 2-3 tileable normal maps (e.g. `weave-normal.png`, `knit-normal.png`, `denim-normal.png`); procedurally generated or CC0-sourced |
| `web/__tests__/components/FittingHelper.test.ts` | UPDATE | C2: normal-map applier sets `.normalMap`/`.normalScale`; skips when no config for slot |
| `web/__tests__/lib/fabric-textures.test.ts` | CREATE | C2: slot→config lookup, default fallback, config shape |
| `worker/CLAUDE.md` + `web/CLAUDE.md` | UPDATE | Doc-sync: Meshy PBR toggle + env var; FittingHelper normal-map applier; new fabric-textures module + assets; test counts |

## NOT Building

- **Extending the rigged-GLB writer to embed normal/roughness/metallic textures** — Phase 1's writer
  embeds baseColor only. Carrying full PBR map sets through `skinned_glb_writer` (extra accessors +
  bufferViews + samplers per map) is a larger change; C2 achieves fabric relief on the rigged path via
  a **frontend tiled normal map** instead. If C1 evaluation shows Meshy PBR maps are high-value enough
  to preserve through rigging, that writer extension is a **follow-up**, explicitly out of Phase 2 scope.
- **A per-fabric material taxonomy / product `fabric` field** — no `fabric`/`material` column exists on
  `Product` or `GarmentAsset` (verified). C2 keys the normal map off the **slot** (TOP/BOTTOM/DRESS)
  that already flows to `BoundGarmentModel` — introducing a fabric taxonomy + migration + designer UI is
  out of scope. (Open PRD question: "品类法线贴图需覆盖哪些面料 / 资产从哪来" — Phase 2 ships a small
  generic set; a fabric field is a separate track.)
- **Geometric anti-penetration push-out** (A1) — Phase 3.
- **Cloth simulation / physical wrinkles** (A2/A3) — post-gate Phase 5.
- **Defaulting Meshy PBR ON** — C1 ships the toggle **off by default**; flipping it on is a data-driven
  decision after a credit-cost + quality spot-check (PRD risk: "Meshy PBR 质量不稳定 / credit 暴涨").
- **Roughness/metallic map application on the frontend** — Phase 2 adds a normal map only (biggest
  perceptual win per the DeepWrinkles "high-freq wrinkle → normal map" recipe); roughness/AO maps are a
  later refinement.
- **Avatar body/skin texture** — this PRD is garment-only.

---

## Step-by-Step Tasks

### Task 1: C1 — make Meshy PBR an env-gated constructor flag
- **ACTION**: Add an `enable_pbr` flag to `MeshyGenerator` and drive it from an env var.
- **IMPLEMENT**: In `meshy_generator.py`, add `enable_pbr: bool = False` to `__init__` and store `self.enable_pbr = enable_pbr`. In the `generate()` POST body, replace the hardcoded `"enable_pbr": False` with `"enable_pbr": self.enable_pbr` (keep `"should_texture": True` — PBR requires it). In `main.py` `get_provider()`, read `os.environ.get("WORKER_MESHY_ENABLE_PBR", "false").lower() in ("1", "true", "yes")` and pass `enable_pbr=<bool>` to the `MeshyGenerator(...)` constructor.
- **MIRROR**: WORKER: MESHY POST BODY + PROVIDER CONSTRUCTION FROM ENV.
- **IMPORTS**: none new (`os` already imported in both files).
- **GOTCHA**: Default MUST stay `False` — flipping it on burns extra credits and is a live-evaluation decision, not a code default. `enable_pbr` without `should_texture:true` is rejected by Meshy, so never gate `should_texture` off. This flag only affects the **model-generation** provider (raw Meshy GLB); it does NOT reach the rigged path (the writer embeds baseColor only — see Task 4 note).
- **VALIDATE**: `cd worker && pytest tests/test_meshy_generator.py -v` — default body has `enable_pbr:false`; `MeshyGenerator(api_key, enable_pbr=True)` body has `enable_pbr:true`.

### Task 2: C2 — slot→normal-map config module
- **ACTION**: Create `web/lib/fabric-textures.ts` mapping a garment slot to a tileable normal-map URL + tiling/scale.
- **IMPLEMENT**: Export a type `FabricNormalConfig = { url: string; repeat: number; normalScale: number }` and a `getFabricNormalConfig(slot?: string): FabricNormalConfig | null`. Normalize the slot (lowercase; the frontend uses `top`/`bottom`/`dress`/`shoes`/`accessory` per `LAYER_MAP`). Provide a small map: e.g. `top`/`dress` → `weave-normal.png` (repeat 8, scale 0.6), `bottom` → `denim-normal.png` (repeat 6, scale 0.8), default/unknown → a neutral `weave-normal.png` (repeat 8, scale 0.4). Return `null` only if you deliberately want a slot to opt out (none for now — always return a config so every garment gets *some* relief). Keep URLs under `/textures/fabric/`.
- **MIRROR**: existing `lib/*.ts` constant-module style (e.g. `lib/pose-config.ts`, `lib/outfit-slots.ts`).
- **IMPORTS**: none (pure data + a lookup fn).
- **GOTCHA**: Keep this a plain data module (no three imports) so it unit-tests without jsdom/WebGL. Slot strings arriving from `riggedGarmentSlots` may be mixed-case or undefined — normalize + default. URLs are served from `web/public/textures/fabric/` → referenced as `/textures/fabric/...`.
- **VALIDATE**: `cd web && npm run test -- fabric-textures` — known slots map to their config; unknown/undefined → default; config shape correct.

### Task 3: C2 — normal-map applier in FittingHelper
- **ACTION**: Add `applyGarmentNormalMap(mesh, slot)` + `applyGarmentNormalMapToScene(scene, slot)` that assign a tiled normal map to garment materials.
- **IMPLEMENT**: Mirror `fabricizeMaterial`. Use a **module-level memoized** three `TextureLoader` cache (`Map<string, Texture>`) so each normal-map file loads once and is shared across meshes/renders (never reload per mesh). For each `MeshStandardMaterial` on the mesh: look up `getFabricNormalConfig(slot)`; if a config exists and `mat.normalMap == null` (don't clobber an authored/Meshy-PBR normal map), load/reuse the texture, set `texture.wrapS = texture.wrapT = RepeatWrapping`, `texture.repeat.set(repeat, repeat)`, assign `mat.normalMap = texture`, `mat.normalScale = new Vector2(normalScale, normalScale)`, and `mat.needsUpdate = true`. Add the scene-traversal wrapper. Call `applyGarmentNormalMapToScene(cloned, slot)` in `GarmentModel` (no slot → default config) and `applyGarmentNormalMapToScene(clonedScene, slot)` in `BoundGarmentModel` (has `slot`), right after the existing `fabricizeScene(...)` call.
- **MIRROR**: FRONTEND MATERIAL TRAVERSAL + FRONTEND CALL SITES.
- **IMPORTS**: add `RepeatWrapping, Vector2, TextureLoader, type Texture` to the `three` import in `FittingHelper.tsx`; import `getFabricNormalConfig` from `@/lib/fabric-textures`.
- **GOTCHA**: A normal map has visible effect ONLY if the mesh has UVs — B1 garments (TEXCOORD_0) and Meshy GLBs do; a UV-less mesh silently shows no relief (acceptable, no crash). Do NOT replace the material object (breaks SkinnedMesh binding) — mutate in place. Guard `!mat.normalMap` so a future Meshy-PBR normal map (C1) is not overwritten by the tiled generic one. `GarmentModel` uses `scene.clone()` (shares materials with the cached GLTF) — cloning the scene shares material instances, so set `mat.needsUpdate` and accept that the tiled map applies to all clones of that URL (fine; it's deterministic per slot). If double-application becomes an issue, guard on a `mesh.userData.__fabricNormalApplied` flag.
- **VALIDATE**: `cd web && npm run test -- FittingHelper` (Task 5) + browser check (`npm run dev`, open `/outfits/[id]/view`): garment shows tiled weave relief; no console errors.

### Task 4: C2/D3 — wire slot into GarmentModel + tone mapping on Canvas
- **ACTION**: Thread `slot` to `GarmentModel` where available and set ACES tone mapping + exposure on the `<Canvas>`.
- **IMPLEMENT**:
  - **C2 wiring**: `BoundGarmentModel` already receives `slot` — call `applyGarmentNormalMapToScene(clonedScene, slot)` in its effect. `GarmentModel` currently takes only `url`; add an optional `slot?: string` prop and pass it through from the render map where known (rigged-as-static fallback path passes the matching `riggedGarmentSlots?.[i]`; the pure-static `staticGarments`/`allGarments` maps have no slot → default config). Call `applyGarmentNormalMapToScene(cloned, slot)` in `GarmentModel`'s effect.
  - **D3**: On `<Canvas>`, add `gl={{ toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.0 }}` (tune exposure 0.9–1.1 empirically so fabric isn't blown out). Optionally lower `Environment` contribution if studio IBL still reads glossy — set `<Environment preset="studio" environmentIntensity={0.6} />` (drei prop) rather than changing the preset. Keep `ContactShadows` unchanged.
- **MIRROR**: CANVAS / ENVIRONMENT block; the existing `renderGarments` map in `AvatarViewer.tsx:263-292`.
- **IMPORTS**: add `ACESFilmicToneMapping` from `three` to `AvatarViewer.tsx`.
- **GOTCHA**: Confirm the installed `three@0.184.0` R3F default tone mapping first (RESEARCH NOTE) — if it's already ACES, this task only *tunes exposure/environmentIntensity* (still worth making explicit for determinism). Changing `toneMapping` affects the avatar too (fine — consistent). Don't regress the Phase-1 contact shadow (leave `ContactShadows` + `castShadow` lights intact). `environmentIntensity` is a drei `<Environment>` prop in v10 — verify it exists in the installed version; if not, reduce `ambientLight`/`directionalLight` intensities slightly instead.
- **VALIDATE**: browser: garment reads matte (no plastic hotspot), relief visible, avatar unchanged in silhouette; no console errors. (jsdom can't render Canvas — no unit test for the Canvas gl props.)

### Task 5: C2 — web tests (normal-map applier + config module)
- **ACTION**: Extend `FittingHelper.test.ts`; create `fabric-textures.test.ts`.
- **IMPLEMENT**:
  - `fabric-textures.test.ts`: `getFabricNormalConfig("top")`/`"bottom"`/`"dress"` return configs with the right URL/repeat/normalScale; mixed-case (`"TOP"`) normalizes; unknown/undefined → default config; every returned config has `url` under `/textures/fabric/` + numeric `repeat`/`normalScale`.
  - `FittingHelper.test.ts`: construct a `Mesh` with a `MeshStandardMaterial` (no `normalMap`); call `applyGarmentNormalMap(mesh, "top")`; assert `mat.normalMap` is set (a `Texture` / truthy), `mat.normalScale` is a `Vector2` with the configured value, `mat.needsUpdate === true`. Add a "don't clobber" case: pre-set `mat.normalMap` to a sentinel → applier leaves it. Add a scene-traversal case mirroring the existing `fabricizeScene` test.
- **MIRROR**: WEB TEST: MATERIAL-TRAVERSAL HELPER.
- **IMPORTS**: `three` (`Mesh`, `MeshStandardMaterial`, `Vector2`, `Texture`), `@testing-library`-free (pure logic). `TextureLoader.load` returns a `Texture` synchronously (image loads async but the object exists immediately) — safe in jsdom since we assert the object is assigned, not that pixels loaded.
- **GOTCHA**: In jsdom, `TextureLoader.load(url)` will attempt an image fetch that never completes — that's fine; the returned `Texture` object is assigned synchronously and the assertion checks assignment, not decode. If jsdom throws on the loader, mock `TextureLoader` or inject the loader — prefer asserting on the config-driven props (`normalScale`, `wrapS`) that don't depend on decode. Keep the test off the real network.
- **VALIDATE**: `cd web && npm run test -- FittingHelper fabric-textures`.

### Task 6: C2 — fabric normal-map assets
- **ACTION**: Add 2-3 tileable normal-map PNGs under `web/public/textures/fabric/`.
- **IMPLEMENT**: Provide `weave-normal.png` (generic plain-weave), `denim-normal.png` (diagonal twill), and optionally `knit-normal.png` — small (≤512px), seamlessly tileable, blue-ish tangent-space normal maps. Source: procedurally generate (a short one-off script using PIL/numpy is acceptable, or a noise→normal conversion) or use CC0/public-domain tileable normal maps. Commit the PNGs; note provenance/license in a sibling `README.md` or a comment in `fabric-textures.ts`.
- **MIRROR**: existing static-asset convention (`web/public/models/`, `web/public/assets/`).
- **IMPORTS**: n/a (binary assets).
- **GOTCHA**: MUST be tangent-space normal maps (predominantly blue), NOT height/bump grayscale — three's `normalMap` expects RGB-encoded normals. MUST tile seamlessly or the `RepeatWrapping` shows seams. Keep file size small (these ship to every try-on). If procedurally generating, keep the generator script out of the shipped bundle (e.g. under `worker/scripts/` or `scripts/`, or delete after generating) and record how it was made.
- **VALIDATE**: files exist at `/textures/fabric/*.png`; open the viewer and confirm no 404 in the network tab and relief renders.

### Task 7: C1 — worker tests for the PBR flag
- **ACTION**: Extend `test_meshy_generator.py`.
- **IMPLEMENT**: In `TestMeshyGeneratorInit`, assert `MeshyGenerator(api_key).enable_pbr is False` (default) and `MeshyGenerator(api_key, enable_pbr=True).enable_pbr is True`. In `TestMeshyGeneratorGenerate` (which already mocks `requests.post` and inspects the JSON body), add: default generator → posted body `enable_pbr` is `False` and `should_texture` is `True`; a `enable_pbr=True` generator → posted body `enable_pbr` is `True`.
- **MIRROR**: WORKER TEST: POST-BODY / CONSTRUCTOR ASSERTION.
- **IMPORTS**: none new (reuse the file's existing `unittest.mock.patch` + fixtures).
- **GOTCHA**: The existing generate-flow tests mock the poll loop + downloads; reuse that harness — don't hit the network. Assert against the captured `json=` kwarg of the mocked `requests.post`.
- **VALIDATE**: `cd worker && pytest tests/test_meshy_generator.py -v`.

### Task 8: Doc-sync
- **ACTION**: Update `worker/CLAUDE.md` and `web/CLAUDE.md`.
- **IMPLEMENT**: worker: `MeshyGenerator` gains `enable_pbr` (env `WORKER_MESHY_ENABLE_PBR`, default false); document the env var in the env table + the "MeshyGenerator Details" section; note the request-param change; bump test counts; add a Phase-2 changelog row. web: `FittingHelper` gains `applyGarmentNormalMap`/`applyGarmentNormalMapToScene`; new `lib/fabric-textures.ts` module + `public/textures/fabric/` assets; `AvatarViewer` gains ACES tone mapping (D3); bump FittingHelper + add fabric-textures test counts; changelog row. Also add `WORKER_MESHY_ENABLE_PBR` to the **root** `CLAUDE.md` env table.
- **MIRROR**: existing changelog table rows + env-var table rows.
- **IMPORTS**: n/a.
- **GOTCHA**: Run the test suites first and copy real totals — do not guess counts.
- **VALIDATE**: manual read; counts match `pytest`/`vitest` output.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| meshy: default PBR off | `MeshyGenerator(key)` | `.enable_pbr is False`; body `enable_pbr:false`, `should_texture:true` | No |
| meshy: PBR on | `MeshyGenerator(key, enable_pbr=True)` | body `enable_pbr:true` | No |
| fabric-textures: known slot | `getFabricNormalConfig("top")` | config with `/textures/fabric/...` url, numeric repeat/scale | No |
| fabric-textures: case-insensitive | `"TOP"` / `"Bottom"` | same as lowercase | Yes |
| fabric-textures: unknown/undefined | `"hat"` / `undefined` | default config (not null) | Yes |
| FittingHelper: applies normal map | Mesh + untextured-normal material, slot="top" | `mat.normalMap` set, `normalScale`=config, `needsUpdate` true | No |
| FittingHelper: don't clobber | material with pre-set `normalMap` | left untouched | Yes (Meshy-PBR coexist) |
| FittingHelper: scene traversal | scene with nested meshes | all meshes get the normal map | No |

### Edge Cases Checklist
- [x] Garment slot unknown/undefined → default fabric config (never null-crash)
- [x] Mixed-case slot string from `riggedGarmentSlots`
- [x] Material already has a normal map (Meshy PBR) → not overwritten
- [x] UV-less mesh → normal map assigned but no visible relief (no crash)
- [x] Texture loaded once, shared across meshes (memoized loader)
- [x] Meshy PBR flag defaults OFF (no accidental credit burn)
- [ ] Concurrent access — n/a (per-render traversal)
- [ ] Network failure — texture 404 → three logs, garment still renders (no relief); acceptable

---

## Validation Commands

### Static Analysis
```bash
cd web && npm run lint            # ESLint (FittingHelper/AvatarViewer/fabric-textures) — R3F material files on the color allowlist
cd web && npx tsc --noEmit        # type check (Vector2/Texture/ACESFilmicToneMapping imports)
```
EXPECT: Zero errors.

### Unit Tests
```bash
cd worker && pytest tests/test_meshy_generator.py -v
cd web && npm run test -- FittingHelper fabric-textures
```
EXPECT: All pass, including new PBR-flag + normal-map + config cases.

### Full Test Suite
```bash
cd worker && pytest              # full worker suite (was 325 after Phase 1)
cd web && npm run test           # full web suite (was 234; Phase 1 grew FittingHelper 13→19)
```
EXPECT: No regressions; counts increase by the added cases.

### Browser Validation
```bash
cd web && npm run dev            # :3000 (needs API on :3001)
```
EXPECT: `/outfits/[id]/view` with a rigged garment shows tiled fabric relief + matte (ACES-toned)
shading + the Phase-1 contact shadow intact; no console errors / no texture 404s.

### Meshy PBR (C1) — live evaluation (manual, gated)
```bash
# Only when evaluating; costs credits.
WORKER_MESHY_ENABLE_PBR=true MODEL_GENERATION_PROVIDER=meshy WORKER_MESHY_API_KEY=... python worker/main.py
# Trigger one generation; inspect the raw Meshy GLB in a glTF viewer for normal/roughness maps;
# grep the worker log for consumed_credits and compare against the enable_pbr=false baseline.
```
EXPECT: raw Meshy GLB carries normal/metallicRoughness maps; record credit delta + quality note in the report.

### Manual Validation
- [ ] `/outfits/[id]/view` rigged garment: weave/wrinkle relief visible on rotate; matte finish; contact shadow present.
- [ ] Untextured stub garment: still matte fabric (D2) + now with generic weave relief.
- [ ] Static (non-rigged) garment path: normal map applies (default slot config).
- [ ] C1 evaluation (if run): credit cost delta + PBR quality documented → default-on decision recorded.

---

## Acceptance Criteria
- [ ] `MeshyGenerator` PBR generation is env-gated (`WORKER_MESHY_ENABLE_PBR`), default OFF; POST body reflects the flag.
- [ ] Garment materials with UV receive a slot-keyed tiled normal map on both rigged and static paths.
- [ ] Frontend does not overwrite a pre-existing (Meshy-PBR) normal map.
- [ ] Viewer uses ACES tone mapping + tuned exposure; garments read matte, plastic hotspots gone; Phase-1 shadow intact.
- [ ] Fabric normal-map assets committed (tileable, tangent-space) with provenance noted.
- [ ] All validation commands pass; no type/lint errors; no regressions.

## Completion Checklist
- [ ] Follows discovered patterns (traverse-and-mutate, memoized loader, env-flag ctor, data-only lib module)
- [ ] Error handling matches codebase (graceful default config; no crash on missing UV/slot)
- [ ] No material-object replacement (SkinnedMesh binding preserved)
- [ ] Tests follow existing worker/web patterns
- [ ] No hardcoded colors added on the web side outside the R3F allowlist
- [ ] worker/web/root CLAUDE.md doc-sync + changelog rows + env-var table
- [ ] No scope creep into writer-side PBR embedding, A1, or a fabric taxonomy field
- [ ] Self-contained — no further codebase search needed

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Meshy PBR maps don't reach the **rigged** path (writer embeds baseColor only) | H (by design) | M | C2 frontend normal map covers the rigged path; C1 benefits the raw-Meshy display + is a source for a future writer extension (out of scope) |
| Meshy `enable_pbr` credit cost / quality unstable | M | M | Ship the flag OFF by default; live spot-check credits + quality before flipping (PRD risk) |
| Generic tiled normal map looks wrong on some prints (over-embossed) | M | M | Conservative `normalScale` (0.4–0.8) per slot; tune in browser; keep it subtle |
| Normal map has no effect on UV-less garments | M | L | Expected; B1 garments + Meshy GLBs carry UV; no crash when absent |
| jsdom can't decode textures → flaky FittingHelper test | M | M | Assert on config-driven props (normalScale/wrapS/needsUpdate), not decoded pixels; mock/inject loader if needed |
| ACES tone-mapping change darkens/washes the avatar | L | M | Tune `toneMappingExposure` empirically; verify avatar silhouette unchanged; leave shadows intact |
| three `environmentIntensity` prop absent in installed drei | L | L | Verify prop exists; fall back to reducing light intensities |
| Non-tileable / non-tangent-space asset → seams or broken shading | M | M | Verify assets are tangent-space (blue) + seamless before commit; browser check |

## Notes
- **Root cross-phase finding**: the Phase-1 rigged-GLB writer (`skinned_glb_writer.write_skinned_glb`)
  embeds **baseColor only** (verified: no normal/roughness accessor), and `_load_garment_glb` extracts
  baseColor only. So C1 (Meshy PBR) surfaces normal/roughness maps **only on the raw-Meshy display path**
  (`GarmentModel`/`useGLTF` preserves the full glTF material via three's GLTFLoader), NOT on the rigged
  path. This is why C2's fabric relief is delivered **frontend-side** (works wherever UV exists) rather
  than by forwarding Meshy's maps through rigging. Extending the writer to carry full PBR map sets is a
  deliberate follow-up, gated on the C1 quality evaluation.
- **No fabric metadata exists**: `Product` and `GarmentAsset` have no `fabric`/`material` column, and
  only the **slot** (top/bottom/dress) flows to the viewer. C2 keys off slot; a proper fabric taxonomy
  (per the open PRD question on which fabrics to cover + asset sourcing) is a separate track.
- **D3 may be a no-op-ish tune**: recent R3F defaults `toneMapping` to `ACESFilmicToneMapping` already —
  verify in the running viewer; if so, D3 reduces to explicit-for-determinism + exposure/environment
  tuning rather than a tone-mapping switch.
- **Parallelism**: Phase 2 runs alongside Phase 3 (anti-penetration) — different files; merge into one
  A/B validation window per the PRD (Phase 4 decision gate).
- **Worktree/test setup** (from project memory): fresh worktrees need `npm install` in `web/`; worker
  tests run under the cached gradle/pytest env; known pre-existing test/lint noise is documented — copy
  real suite totals into the doc-sync, don't guess.
