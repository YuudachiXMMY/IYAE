[Root](../CLAUDE.md) > **worker**

# Clossette Worker (Python 3.12)

Python daemon that polls three MySQL task queues (`model_generation_tasks`, `avatar_generation_tasks`, `rigging_tasks`) to generate 3D garment models (GLB/USDZ), SMPL-X body avatars, and rigged garment meshes with skinning weights.

## Module Purpose

The worker is a standalone process that claims pending 3D generation tasks from a shared MySQL queue, runs a generation provider (stub or Tripo3D), validates the output (GLB header + metadata: triangle count, bounding box, NaN checks), and marks the task as complete. It also periodically reclaims stale RUNNING tasks and supports retry of failed tasks. It runs as a long-lived polling loop and shares no code with the server -- coordination is purely via the MySQL table. It also runs an independent garment rigging pipeline that transfers skinning weights from an SMPL-X avatar onto garment meshes, producing rigged GLB files ready for real-time try-on.

## Entry & Startup

- **Main entry**: `main.py` (calls `run()` which starts an infinite polling loop)
- **Polling interval**: `WORKER_POLL_INTERVAL` env var (default 5 seconds)
- **Provider selection**: `MODEL_GENERATION_PROVIDER` env var (`mock`, `tripo3d`, or `meshy`)
- **Stale reclamation**: Every 12 poll cycles (~1 minute), reclaims RUNNING tasks stuck for >15 minutes
- **Rigging provider selection**: `RIGGING_PROVIDER` env var (`mock`, `python`, or `blender`)

## Commands

```bash
pip install -r requirements.txt
python main.py                      # Start polling daemon
pytest                              # Run tests
pytest -v                           # Verbose output
```

## Architecture

```
main.py           --> Entry point: polling loop, provider selection, stale reclamation, orchestration
task_queue.py     --> MySQL-based queue (claim, complete, fail, retry, reclaim_stale) for model tasks
avatar_task_queue.py --> MySQL-based queue (claim, complete, fail, reclaim_stale) for avatar tasks
rigging_task_queue.py --> MySQL-based queue (claim, complete, fail, reclaim_stale) for rigging tasks
validator.py      --> GLB/USDZ validation + metadata validation (triangle count, bbox, NaN) + rigged GLB validation
providers/
  stub_generator.py      --> Creates minimal valid GLB files for development
  tripo_generator.py     --> Calls Tripo3D API (image-to-3D) for production
  meshy_generator.py     --> Calls Meshy.ai API (image-to-3D) for production (GLB + USDZ), auto-converts local paths to base64
  smplx_provider.py      --> SMPL-X parametric body model avatar generation (requires torch/trimesh)
  smplx_stub_provider.py --> Creates minimal humanoid box-mesh GLB for avatar dev/testing
  stub_rigging_provider.py   --> Placeholder rigged GLB for development (default)
  blender_rigging_provider.py --> Blender headless subprocess rigging (legacy)
  python_rigging_provider.py --> Pure-Python weight transfer rigging (production)
  canonical_skeleton.py      --> SMPL-X 55-joint skeleton + slot bone subsets
  mesh_preflight.py          --> Topology preflight checks (non-manifold, degenerate, loose)
  a_pose.py                  --> A-pose body_pose vector (63-dim, 21 body joints × 3, 30° shoulder rotation) for SMPL-X
  scale_normalizer.py        --> Garment-to-avatar scale normalization (slot-aware height/Y-center alignment)
  weight_transfer.py         --> 3-phase weight pipeline (projection, inpainting, normalize)
  skinned_glb_writer.py      --> Skinned GLB file builder (pygltflib)
  blender_scripts/           --> Blender headless rigging scripts (legacy + pose conversion)
    canonical_skeleton.py    --> Skeleton constants for Blender rigging script
    rig_garment.py           --> Blender Python script executed by BlenderRiggingProvider subprocess
    fbx_to_pose_glb.py       --> FBX to pose GLB conversion for animated pose support
scripts/
  generate_pose_glbs.py      --> CLI tool: generates pose GLB files (manifest-driven, expanded with animated pose support)
  import_fbx_pose.py         --> CLI tool: import FBX pose files and convert to GLB
  import_smplx_pose.py       --> CLI tool: import SMPL-X pose files and convert to GLB
  pose_manifest.py           --> Pose manifest generator for web/lib/poses-manifest.json
tests/
  test_task_queue.py       --> Unit tests for task claiming, retry, stale reclamation (7 tests)
  test_validator.py        --> Unit tests for GLB/USDZ/metadata/bbox/NaN/rigged-GLB/skin/bones validation (37 tests)
  test_stub_generator.py   --> Unit tests for StubGenerator output validation (13 tests)
  test_meshy_generator.py  --> Unit tests for MeshyGenerator output + image URL resolve (30 tests)
  test_avatar_task_queue.py --> Unit tests for AvatarTaskQueue (4 tests)
  test_smplx_provider.py   --> Unit tests for SmplxProvider + SmplxStubProvider (54 tests)
  test_rigging_task_queue.py     --> Unit tests for RiggingTaskQueue (8 tests)
  test_python_rigging_provider.py --> Unit tests for PythonRiggingProvider (19 tests)
  test_weight_transfer.py        --> Unit tests for weight transfer pipeline (18 tests)
  test_mesh_preflight.py         --> Unit tests for mesh preflight checks (9 tests)
  test_skinned_glb_writer.py     --> Unit tests for skinned GLB writer (17 tests)
  test_blender_rigging_provider.py --> Unit tests for BlenderRiggingProvider (46 tests)
  test_generate_pose_glbs.py     --> Unit tests for pose GLB generation (10 tests)
  test_a_pose.py                 --> Unit tests for A-pose vector generation (5 tests)
  test_scale_normalizer.py       --> Unit tests for scale normalizer (15 tests)
```

## How It Works

```
1. main.py starts infinite loop (poll_count tracks cycles)
2. Every 12 polls: TaskQueue.reclaim_stale_tasks() resets RUNNING tasks
   stuck for >15 minutes back to PENDING
3. TaskQueue.claim_task() runs:
     SELECT ... FROM model_generation_tasks
     WHERE status = 'PENDING'
     ORDER BY created_at ASC LIMIT 1
     FOR UPDATE SKIP LOCKED
4. If task found, UPDATE status -> 'RUNNING', increment attempt_count
5. Provider.generate(task_id, product_id, input_payload) runs
6. validator.validate_glb() checks output (magic header, non-empty, version)
7. validator.validate_metadata() checks output payload (triangle count <= 500k,
   bbox dimensions 0.01m-10m, no NaN/Inf in bbox or vertices)
8. On success: TaskQueue.complete_task() -> status = 'READY' with output_payload JSON
9. On failure: TaskQueue.fail_task() -> status = 'FAILED' with error_message
10. Spring Scheduler (server-side) materializes READY tasks into GarmentAsset rows
    and sets status -> 'MATERIALIZED'
11. Sleep POLL_INTERVAL seconds, repeat

Rigging task flow (runs in parallel with model/avatar tasks in main.py):
1. RiggingTaskQueue.claim_task() uses FOR UPDATE SKIP LOCKED on rigging_tasks table
2. get_rigging_provider() selects provider based on RIGGING_PROVIDER env var
3. Provider.generate(task_id, garment_asset_id, input_payload) runs
4. For PythonRiggingProvider: mesh_preflight -> weight_transfer (3 phases) -> skinned_glb_writer
5. validate_rigged_glb() checks output (GLB header + skin metadata + required bones)
6. On success: RiggingTaskQueue.complete_task() -> status = 'READY'
7. On failure: RiggingTaskQueue.fail_task() with error_message and failure_code
8. Spring Scheduler (server-side) materializes READY rigging tasks into GarmentAsset columns
```

## Task Queue Operations

`task_queue.py` provides 5 operations via the `TaskQueue` class:

| Method | Purpose |
|--------|---------|
| `claim_task()` | Claim one PENDING task using `FOR UPDATE SKIP LOCKED`; returns task dict or None |
| `complete_task(task_id, output_payload)` | Mark task as READY with JSON output |
| `fail_task(task_id, error_message)` | Mark task as FAILED with error message |
| `retry_task(task_id)` | Reset a FAILED task back to PENDING if `attempt_count < 3`; returns bool |
| `reclaim_stale_tasks()` | Reset RUNNING tasks stuck >15 minutes back to PENDING; returns count reclaimed |

All operations use connection-per-call pattern (no pool). `retry_task` has a max attempts guard (3) and catches exceptions gracefully. `reclaim_stale_tasks` uses `NOW() - INTERVAL 15 MINUTE` threshold.

### Rigging Task Queue Operations

`rigging_task_queue.py` provides 4 operations via the `RiggingTaskQueue` class:

| Method | Purpose |
|--------|---------|
| `claim_task()` | Claim one PENDING rigging task using `FOR UPDATE SKIP LOCKED`; filters by `attempt_count < 3`; returns task dict or None |
| `complete_task(task_id, output_payload)` | Mark task as READY with JSON output; only updates if still RUNNING (prevents superseded tasks from resurrecting) |
| `fail_task(task_id, error_message, failure_code)` | Mark task as FAILED with error message and optional failure_code |
| `reclaim_stale_tasks()` | Reset stale RUNNING tasks (>15 min) back to PENDING if under attempt limit; mark as FAILED with MAX_ATTEMPTS_EXCEEDED if over limit |

## Task Status Lifecycle

The `model_generation_tasks.status` column has 5 values (V3 migration added MATERIALIZED):

| Status | Set By | Meaning |
|--------|--------|---------|
| `PENDING` | Server (GenerationService) | Task created, awaiting worker |
| `RUNNING` | Worker (task_queue.py) | Worker claimed and is processing |
| `READY` | Worker (task_queue.py) | Generation succeeded, output available |
| `FAILED` | Worker or Server | Error during generation, or superseded by regeneration |
| `MATERIALIZED` | Server (GenerationService) | READY task materialized into GarmentAsset row |

The worker only interacts with `PENDING`, `RUNNING`, `READY`, and `FAILED`. The `MATERIALIZED` status is set server-side after the worker completes its work.

## Providers

| Provider | Env Setting | Behavior |
|----------|------------|----------|
| StubGenerator | `MODEL_GENERATION_PROVIDER=mock` | Creates minimal valid GLB (empty scene) + placeholder USDZ. Default. |
| TripoGenerator | `MODEL_GENERATION_PROVIDER=tripo3d` | Calls Tripo3D API v2: create task -> poll until success -> download GLB |
| MeshyGenerator | `MODEL_GENERATION_PROVIDER=meshy` | Calls Meshy.ai API: create task -> poll until success -> download GLB + USDZ. Auto-converts local file paths to base64 data URIs via `_resolve_image_url()`. |
| SmplxProvider | `AVATAR_GENERATION_PROVIDER=smplx` | Generates body-accurate avatars using SMPL-X parametric body model from measurements. Requires downloaded SMPL-X model files + torch/trimesh. |
| SmplxStubProvider | `AVATAR_GENERATION_PROVIDER=mock` | Creates minimal valid GLB humanoid box mesh for development. Default for avatars. |
| StubRiggingProvider | `RIGGING_PROVIDER=mock` | Placeholder rigged GLB (stub output). Default for rigging. |
| PythonRiggingProvider | `RIGGING_PROVIDER=python` | Pure-Python weight transfer: mesh preflight -> surface projection (igl BVH) -> Laplacian inpainting (robust_laplacian) -> prune & normalize -> skinned GLB writer. Requires SMPL-X model data. Returns schemaVersion=2 payload. |
| BlenderRiggingProvider | `RIGGING_PROVIDER=blender` | Blender headless subprocess rigging (legacy). Requires Blender installed at BLENDER_PATH. Uses scripts in `providers/blender_scripts/`. |

### StubGenerator Details

- Creates a minimal valid GLB file with `glTF` magic header, version 2, empty scene JSON chunk
- Creates a placeholder USDZ file (non-empty but not a real USDZ)
- Returns schema v1 output payload with `provider_used: "STUB"`

### TripoGenerator Details

- Requires `WORKER_TRIPO_API_KEY` env var
- API base: `https://api.tripo3d.ai/v2`
- Flow: `POST /task` (image_to_model) -> poll `GET /task/{id}` every 5s (max 10 min) -> download GLB
- Does not produce USDZ (null in output)
- Returns schema v1 output payload with `provider_used: "TRIPO3D"`

### MeshyGenerator Details

- Requires `WORKER_MESHY_API_KEY` env var
- API base: `https://api.meshy.ai/openapi/v1`
- Flow: `POST /image-to-3d` -> poll `GET /image-to-3d/{id}` every 5s (max 10 min) -> download GLB + USDZ
- Request params: `ai_model="meshy-6"`, `should_remesh=true`, `target_polycount=30000`, `target_formats=["glb","usdz"]`, `enable_pbr=false`
- **Image URL resolution** (`_resolve_image_url()`): HTTP/HTTPS URLs and `data:` URIs are passed through directly; relative file paths (e.g., `/uploads/products/xxx.jpg`) are resolved against `WORKER_OUTPUT_DIR`, read from disk, and encoded as base64 data URIs with correct MIME type
- Produces both GLB and USDZ (unlike TripoGenerator)
- `triangle_count` uses `target_polycount` estimate (30000); Meshy API doesn't return actual count
- `bbox` set to `None` (Meshy API doesn't return bounding box; validator permits None)
- Logs `consumed_credits` per task (30 credits/task typical)
- Returns schema v1 output payload with `provider_used: "MESHY"`

### PythonRiggingProvider Details

- Requires SMPL-X model data at `SMPLX_MODELS_PATH` (same as SmplxProvider)
- Pipeline: scale_normalizer.py (slot-aware height scaling + Y-center alignment) -> mesh_preflight.py -> weight_transfer.py (Phase 1: igl BVH surface projection, Phase 2: robust_laplacian biharmonic inpainting, Phase 3: slot-aware bone masking + top-4 prune + normalize) -> skinned_glb_writer.py
- Uses `a_pose.py` to generate A-pose body_pose vector for SMPL-X avatar loading
- Slot-aware bone subsets: TOP (14 bones: pelvis to wrists), BOTTOM (9 bones: pelvis to feet), DRESS (all 55 joints)
- Output: skinned GLB with JOINTS_0/WEIGHTS_0 attributes, skeleton hierarchy, inverse bind matrices
- Returns schemaVersion=2 output payload with `provider_used: "PYTHON_WEIGHT_TRANSFER"`

## Output Payload Schema (v1)

```json
{
  "schemaVersion": 1,
  "provider_used": "STUB",
  "provider_request_id": null,
  "glb_path": "products/{pid}/tasks/{tid}/preview.glb",
  "usdz_path": "products/{pid}/tasks/{tid}/preview.usdz",
  "triangle_count": 0,
  "bbox": {"min": [0, 0, 0], "max": [0.5, 1.0, 0.5]},
  "sanity": {"glb_size_bytes": 1024, "has_nan_vertices": false},
  "elapsed_ms": 42,
  "public_glb_url": "/assets/products/{pid}/tasks/{tid}/preview.glb",
  "public_usdz_url": "/assets/products/{pid}/tasks/{tid}/preview.usdz"
}
```

### Rigging Output Payload Schema (v2)

```json
{
  "schemaVersion": 2,
  "provider_used": "PYTHON_WEIGHT_TRANSFER",
  "garment_asset_id": 42,
  "rigged_glb_path": "rigged/42/garment-rigged.glb",
  "rigged_glb_url": "/assets/rigged/42/garment-rigged.glb",
  "slot_hint": "TOP",
  "triangle_count": 5000,
  "bbox": {"min": [-0.3, 0.0, -0.2], "max": [0.3, 0.7, 0.2]},
  "skin": {"has_skin": true, "joint_count": 14},
  "rigging": {"method": "PYTHON_WEIGHT_TRANSFER", "pose": "A_POSE"},
  "elapsed_ms": 1500
}
```

## Validation

### GLB Header Validation (`validate_glb`)

| Check | Failure Mode |
|-------|-------------|
| File exists | `"File does not exist"` |
| File non-empty | `"File is empty"` |
| Magic header is `b"glTF"` | `"Invalid magic header"` |
| Version + total length readable | Struct unpack error |

### Metadata Validation (`validate_metadata`)

`validate_metadata()` orchestrates three sub-validators and returns `{"valid": bool, "errors": list}`:

| Sub-validator | Check | Threshold | Failure Mode |
|--------------|-------|-----------|-------------|
| `validate_triangle_count` | Triangle count within limit | Max 500,000 | `"triangle_count {n} exceeds limit of 500000"` |
| `validate_bounding_box` | Bbox has min/max with 3 components, dimensions in range | 0.01m - 10.0m per axis | `"below minimum"` / `"above maximum"` / missing keys |
| `validate_no_nan` | No NaN/Inf in bbox coords or sanity flag | -- | `"NaN vertices"` / `"NaN or Inf"` |

Missing fields pass silently (validation is permissive for optional metadata).

### Rigged GLB Validation (`validate_rigged_glb`)

`validate_rigged_glb(file_path, slot_hint)` orchestrates three checks:

| Check | Function | Failure Mode |
|-------|----------|-------------|
| GLB header | `validate_glb()` | Standard GLB header checks (magic, non-empty, version) |
| Skin metadata | `validate_skin_metadata()` | No skins, no joints, missing inverseBindMatrices, IBM count mismatch, missing JOINTS_0/WEIGHTS_0 attributes |
| Required bones | `validate_required_bones()` | Missing required bones for slot (TOP: 14 bones, BOTTOM: 9 bones, DRESS: 5 core structural bones) |

`validate_skin_metadata` uses `pygltflib.GLTF2.load()` to parse the GLB and check glTF skin data structure.
`validate_required_bones` derives required bone sets from `canonical_skeleton.SLOT_BONE_SUBSETS`.

### USDZ Validation (`validate_usdz`)

Basic existence and non-empty check only.

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| mysql-connector-python | >=8.0.33 | MySQL connection (no ORM) |
| requests | >=2.31.0 | HTTP client (Tripo3D API, Meshy API) |
| pytest | >=7.4.0 | Testing |
| scipy | >=1.11.0 | Sparse linear algebra (biharmonic inpainting) |
| pygltflib | >=1.16.0 | glTF/GLB reading and writing |
| libigl | >=2.5.0 | BVH point-to-mesh projection (rigging only, installed in Dockerfile.rigging) |
| robust-laplacian | >=1.0.0 | Mesh/point-cloud Laplacian construction (rigging only, installed in Dockerfile.rigging) |

## Environment Variables

| Var | Required | Default | Purpose |
|-----|----------|---------|---------|
| `DB_HOST` | No | `localhost` | MySQL host |
| `DB_PORT` | No | `3306` | MySQL port |
| `DB_NAME` | No | `clossette` | Database name |
| `DB_USERNAME` | No | `clossette` | DB user |
| `DB_PASSWORD` | Yes | -- | DB password |
| `MODEL_GENERATION_PROVIDER` | No | `mock` | Provider selection |
| `WORKER_TRIPO_API_KEY` | For tripo3d | -- | Tripo3D API key |
| `WORKER_MESHY_API_KEY` | For meshy | -- | Meshy.ai API key |
| `WORKER_POLL_INTERVAL` | No | `5` | Seconds between polls |
| `WORKER_OUTPUT_DIR` | No | `/var/clossette/assets` | Output directory (also used by MeshyGenerator for local image file resolution) |
| `AVATAR_GENERATION_PROVIDER` | No | `mock` | Avatar provider selection (`mock` or `smplx`) |
| `SMPLX_MODELS_PATH` | For smplx | `./smplx_models` | Host path to SMPL-X model files (mounted read-only into container) |
| `RIGGING_PROVIDER` | No | `mock` | Rigging provider selection (`mock`, `python`, or `blender`) |
| `BLENDER_PATH` | For blender | `blender` | Path to Blender executable (only when RIGGING_PROVIDER=blender) |

## Test & Quality

- **Framework**: pytest
- **Test files**: `tests/test_task_queue.py` (7 tests), `tests/test_validator.py` (37 tests), `tests/test_stub_generator.py` (13 tests), `tests/test_meshy_generator.py` (30 tests), `tests/test_avatar_task_queue.py` (4 tests), `tests/test_smplx_provider.py` (54 tests), `tests/test_rigging_task_queue.py` (8 tests), `tests/test_python_rigging_provider.py` (19 tests), `tests/test_weight_transfer.py` (18 tests), `tests/test_mesh_preflight.py` (9 tests), `tests/test_skinned_glb_writer.py` (17 tests), `tests/test_blender_rigging_provider.py` (46 tests), `tests/test_a_pose.py` (5 tests), `tests/test_scale_normalizer.py` (15 tests)
- **Total tests**: 292
- **Strategy**: Unit tests with mocked MySQL connections, mocked HTTP requests, and temp files (no integration tests)
- **Coverage**: Task queue (claim/retry/reclaim), validator (GLB header, USDZ, triangle count, bounding box, NaN/Inf, metadata composition, rigged GLB header+skin+bones), StubGenerator (GLB output, payload schema, validator integration), MeshyGenerator (init, generate flow, error handling, payload schema, image URL resolution for local/http/data-uri inputs), AvatarTaskQueue (claim/complete/fail/reclaim), SmplxProvider + SmplxStubProvider (generate, measurements, errors, GLB output, gender handling, LFS file detection, model caching, skin metadata), RiggingTaskQueue (claim/complete/fail/reclaim), PythonRiggingProvider (input validation, path resolution, output format, call chain, SMPLX path validation, scale normalization integration), weight transfer (surface matching, inpainting, prune & normalize, pipeline, dense-to-top4), mesh preflight (valid mesh, degenerate faces, loose vertices, non-manifold edges, garment size warnings), skinned GLB writer (joint hierarchy, inverse bind matrices, round-trip GLB, buffer alignment, shape validation, child joint positioning), A-pose vector (length, shoulder values, immutability), scale normalizer (bbox computation, slot ratios, centering, immutability, edge cases); TripoGenerator not tested

### Test Inventory

| Test File | Class | Tests | Covers |
|-----------|-------|-------|--------|
| `test_task_queue.py` | `TestTaskQueue` | 2 | `claim_task` returns None when empty, returns task dict when found |
| `test_task_queue.py` | `TestRetryTask` | 3 | `retry_task` resets failed task under limit, refuses non-eligible, returns false on exception |
| `test_task_queue.py` | `TestReclaimStaleTasks` | 2 | `reclaim_stale_tasks` updates stale RUNNING tasks, returns zero when none stale |
| `test_validator.py` | `TestValidateGlb` | 4 | Missing file, empty file, invalid magic, valid GLB |
| `test_validator.py` | `TestValidateUsdz` | 2 | Missing file, valid USDZ |
| `test_validator.py` | `TestValidateTriangleCount` | 5 | Within limit, at limit, exceeds limit, missing field, zero |
| `test_validator.py` | `TestValidateBoundingBox` | 6 | Valid bbox, missing bbox, dimension too small, dimension too large, missing min/max keys, wrong component count |
| `test_validator.py` | `TestValidateNoNan` | 5 | Clean metadata, has_nan_vertices flag, NaN in bbox min, Inf in bbox max, missing sanity |
| `test_validator.py` | `TestValidateMetadata` | 5 | Normal model passes, triangle count over limit, bbox out of range, NaN vertices, empty metadata |
| `test_validator.py` | `TestValidateRiggedGlb` | 2 | Calls validate_glb first, valid rigged GLB passes |
| `test_validator.py` | `TestValidateSkinMetadata` | 5 | No skins, no joints, no inverse bind matrices, no JOINTS_0 attribute, no WEIGHTS_0 attribute |
| `test_validator.py` | `TestValidateRequiredBones` | 3 | TOP valid bones, TOP missing bones, returns bone names |
| `test_stub_generator.py` | `TestCreateMinimalGlb` | 4 | `create_minimal_glb()` returns bytes, valid magic header, version 2, total_length matches |
| `test_stub_generator.py` | `TestStubGeneratorGenerate` | 4 | GLB/USDZ file creation, directory structure, task isolation |
| `test_stub_generator.py` | `TestStubGeneratorOutputPayload` | 3 | Schema v1 key set, field values, path embedding of IDs |
| `test_stub_generator.py` | `TestStubGeneratorValidatorIntegration` | 2 | Generated GLB passes validate_glb, payload passes validate_metadata |
| `test_meshy_generator.py` | `TestResolveImageUrl` | 6 | HTTPS URL passthrough, HTTP URL passthrough, data URI passthrough, relative path to base64 conversion, PNG MIME type detection, missing file raises FileNotFoundError |
| `test_meshy_generator.py` | `TestMeshyGeneratorInit` | 5 | api_key storage, default/custom output_dir, Authorization header, Content-Type header |
| `test_meshy_generator.py` | `TestMeshyGeneratorGenerate` | 4 | GLB/USDZ file creation, POST request params (ai_model, topology, target_polycount), directory structure |
| `test_meshy_generator.py` | `TestMeshyGeneratorErrors` | 5 | None input_payload, missing image_url, FAILED status, CANCELED status, timeout after 120 polls |
| `test_meshy_generator.py` | `TestMeshyGeneratorPayload` | 10 | All required keys, schemaVersion=1, provider_used=MESHY, provider_request_id, paths contain IDs, triangle_count=30000, bbox=None, sanity.has_nan_vertices=False, elapsed_ms type |
| `test_rigging_task_queue.py` | `TestRiggingTaskQueueClaim`, `TestRiggingTaskQueueComplete`, `TestRiggingTaskQueueFail`, `TestRiggingReclaimStaleTasks` | 8 | claim returns dict/none, skips max attempts, complete updates status, fail with/without code, reclaim stale, fail max attempts |
| `test_python_rigging_provider.py` | `TestInputValidation`, `TestResolvePath`, `TestOutputFormat`, `TestCallChain`, `TestSmplxPathValidation` | 19 | None/missing/empty payload, invalid slot, default DRESS, HTTP/assets path resolve, schema v2 keys, rigged_glb_url prefix, elapsed_ms type, bbox keys, slot_hint forwarded, preflight errors, write_skinned_glb params, missing SMPLX dir, scale normalization integration |
| `test_weight_transfer.py` | `TestFindClosestSurfaceMatches`, `TestInpaintWeights`, `TestPruneAndNormalizeWeights`, `TestTransferWeightsPipeline`, `TestDenseWeightsToTop4` | 18 | Phase 1 match rate/far verts/shape, Phase 2 nonzero/immutable/all-matched, Phase 3 max-4/row-sums/TOP-masking/DRESS-all/immutable, pipeline shape+normalization, top4 shapes/dtypes/sums/max4/pelvis-fallback/immutable |
| `test_mesh_preflight.py` | `TestPreflightMeshValid`, `TestPreflightMeshDegenerateFaces`, `TestPreflightMeshLooseVertices`, `TestPreflightMeshNonManifold`, `TestPreflightGarmentSizeWarnings` | 9 | Valid box passes, many/few degenerate faces, loose vertices (warning only), non-manifold edges above threshold, garment size warnings above/below/at threshold, normal ratio checks |
| `test_skinned_glb_writer.py` | `TestBuildJointHierarchy`, `TestComputeInverseBindMatrices`, `TestRoundTripGlbHeader`, `TestRoundTripSkinMetadata`, `TestRoundTripRequiredBones`, `TestBufferAlignment`, `TestShapeValidation`, `TestChildJointPositioning` | 17 | Single root/names preserved, IBM shape/inverse translation, GLB header valid, skin metadata TOP/DRESS, required bones TOP/BOTTOM/DRESS, 4-byte alignment, wrong vertex/joint_indices/joint_weights shape raises, child joint hierarchy and positioning |
| `test_blender_rigging_provider.py` | Multiple test classes | 46 | BlenderRiggingProvider subprocess invocation, script generation, error handling, timeout, output parsing, fallback behavior |
| `test_a_pose.py` | `TestGetAPoseBodyPose` | 5 | Returns 63 floats (21 body joints × 3), left shoulder Z positive, right shoulder Z negative, only shoulders nonzero, immutability (separate list per call) |
| `test_scale_normalizer.py` | `TestComputeBbox`, `TestNormalizeGarmentToAvatar` | 15 | Bbox min/max/center/dimensions/single-vertex, scale skip [0.8-1.2]/scale-down/scale-up, slot TOP/BOTTOM/DRESS ratios, Y-centering per slot, XZ-centering, immutability, zero-height garment, unknown slot defaults to DRESS |

### Running Tests

```bash
pytest                              # All tests
pytest -v                           # Verbose output
pytest tests/test_validator.py      # Single file
pytest tests/test_task_queue.py     # Task queue tests only
```

## Gotchas

- Worker shares `model_generation_tasks` table with Spring Boot -- schema is owned by Flyway migrations in `server/` (V1 baseline + V3 MATERIALIZED status)
- Connection created per operation (no pool) -- acceptable for low-throughput worker
- GLB validation is strict: invalid magic header = FAILED task
- Metadata validation failures also mark task as FAILED (triangle count, bbox, NaN)
- `SKIP LOCKED` ensures multiple worker instances can run safely in parallel
- Output files are written to `WORKER_OUTPUT_DIR` (default `/var/clossette/assets`), path pattern: `products/{product_id}/tasks/{task_id}/preview.glb`
- `retry_task` has a hard limit of 3 attempts (`attempt_count < 3`); exceeded retries are refused
- `reclaim_stale_tasks` runs every 12 poll cycles (~1 minute); resets tasks RUNNING for >15 minutes back to PENDING
- The `MATERIALIZED` status is a server-side concern; the worker should only query for `PENDING` tasks
- SMPL-X model files are tracked via Git LFS (`.gitattributes`); if `AVATAR_GENERATION_PROVIDER=smplx` and the worker fails with "Failed to interpret file as a pickle", run `git lfs pull` to download the actual model data -- LFS pointer files (~130 bytes) cannot be loaded by numpy
- SmplxProvider requires heavy dependencies (torch, smplx, trimesh) that are lazy-loaded on first use; if these are not installed, the worker will raise RuntimeError on the first avatar task
- Rigging worker runs as an independent container (`Dockerfile.rigging`) under docker-compose profile `rigging` -- it is NOT started by default with `docker compose up`; use `docker compose --profile rigging up` to include it
- `libigl` and `robust-laplacian` are installed only in `Dockerfile.rigging` (require C++ compiler), not in the base `requirements.txt`
- PythonRiggingProvider requires SMPL-X model data at `SMPLX_MODELS_PATH` (same requirement as SmplxProvider for avatar generation)
- `validate_rigged_glb` and `validate_skin_metadata` import `pygltflib` inside the function body (lazy import) to avoid import errors when pygltflib is not installed
- `rigging_tasks` table is shared with the Spring Boot server -- schema owned by Flyway migration V7 in `server/`
- RiggingTaskQueue.complete_task() only updates tasks still in RUNNING state -- prevents superseded (FAILED) tasks from being resurrected if a slow worker finishes after a re-request
- Some weight_transfer tests are conditionally skipped (`@pytest.mark.skipif`) when `igl` or `robust_laplacian` are not installed (CI-safe)
- BlenderRiggingProvider uses scripts in `providers/blender_scripts/` (canonical_skeleton.py, rig_garment.py) which are passed to Blender's Python subprocess -- these are separate from the main provider modules
- MeshyGenerator's `_resolve_image_url()` reads local files from `WORKER_OUTPUT_DIR` and encodes them as base64 data URIs -- ensure product images are accessible within the Docker volume at the relative path stored in `input_payload.image_url`
- `a_pose.py` returns a new list on each call (safe for mutation); both SmplxProvider and PythonRiggingProvider use it
- `scale_normalizer.py` skips scaling when the factor is within [0.8, 1.2] (close enough); uses `1e-6` floor on garment height to prevent division by zero; unknown slot_hint defaults to DRESS ratio (0.85)
- `scripts/generate_pose_glbs.py` outputs to `web/public/models/poses/` (outside worker dir); requires pygltflib; imports from `providers/canonical_skeleton.py` via sys.path manipulation

## Related Files

| Path | Purpose |
|------|---------|
| `main.py` | Entry point, polling loop, stale reclamation scheduling |
| `task_queue.py` | MySQL task queue (claim/complete/fail/retry/reclaim) |
| `validator.py` | GLB header validation + metadata validation (triangle count, bbox, NaN) + rigged GLB validation (skin, bones) |
| `providers/stub_generator.py` | Mock 3D generation |
| `providers/tripo_generator.py` | Tripo3D API integration |
| `providers/meshy_generator.py` | Meshy.ai API integration (GLB + USDZ, local path to base64 resolution) |
| `providers/__init__.py` | Package init |
| `providers/blender_scripts/canonical_skeleton.py` | Skeleton constants for Blender rigging subprocess |
| `providers/blender_scripts/rig_garment.py` | Blender Python script for headless garment rigging |
| `tests/test_task_queue.py` | Task queue unit tests (claim, retry, reclaim) |
| `tests/test_validator.py` | Validator unit tests (GLB, USDZ, metadata, bbox, NaN, rigged GLB, skin, bones) |
| `tests/test_stub_generator.py` | StubGenerator output validation tests |
| `tests/test_meshy_generator.py` | MeshyGenerator output + image URL resolve tests |
| `tests/test_avatar_task_queue.py` | AvatarTaskQueue unit tests (claim, complete, fail, reclaim) |
| `tests/test_smplx_provider.py` | SmplxProvider + SmplxStubProvider unit tests |
| `tests/test_rigging_task_queue.py` | RiggingTaskQueue unit tests |
| `tests/test_python_rigging_provider.py` | PythonRiggingProvider unit tests |
| `tests/test_weight_transfer.py` | Weight transfer pipeline unit tests |
| `tests/test_mesh_preflight.py` | Mesh preflight unit tests |
| `tests/test_skinned_glb_writer.py` | Skinned GLB writer unit tests |
| `tests/__init__.py` | Test package init |
| `avatar_task_queue.py` | MySQL avatar task queue (claim/complete/fail/reclaim) |
| `rigging_task_queue.py` | MySQL rigging task queue (claim/complete/fail/reclaim) |
| `providers/smplx_provider.py` | SMPL-X parametric body model avatar generation |
| `providers/smplx_stub_provider.py` | Stub humanoid box-mesh GLB for avatar dev/testing |
| `providers/stub_rigging_provider.py` | Stub rigging provider (placeholder GLB) |
| `providers/blender_rigging_provider.py` | Blender headless rigging provider (legacy) |
| `providers/python_rigging_provider.py` | Pure-Python weight transfer rigging provider |
| `providers/canonical_skeleton.py` | SMPL-X 55-joint skeleton definition + bone subsets |
| `providers/mesh_preflight.py` | Mesh topology preflight checks |
| `providers/weight_transfer.py` | 3-phase weight transfer pipeline |
| `providers/skinned_glb_writer.py` | Skinned GLB file builder (pygltflib) |
| `providers/a_pose.py` | A-pose body_pose vector for SMPL-X (used by SmplxProvider + PythonRiggingProvider) |
| `providers/scale_normalizer.py` | Garment-to-avatar scale normalization (slot height ratios, Y-center offsets) |
| `scripts/generate_pose_glbs.py` | CLI script: generates 5 pose GLB files to `web/public/models/poses/` |
| `tests/test_blender_rigging_provider.py` | BlenderRiggingProvider unit tests |
| `tests/test_a_pose.py` | A-pose vector unit tests |
| `tests/test_scale_normalizer.py` | Scale normalizer unit tests |
| `Dockerfile.rigging` | Rigging worker container (Python 3.12 + libigl + robust-laplacian) |
| `requirements.txt` | Python dependencies |
| `Dockerfile` | Python 3.12-slim container |

## Changelog

| Date | Action |
|------|--------|
| 2026-06-03 | Added a_pose.py, scale_normalizer.py, generate_pose_glbs.py; tests 12->14 files / 235->282 (SmplxProvider, mesh_preflight, skinned_glb_writer, python_rigging expansions) |
| 2026-06-07 | A-pose corrected 165->63 dimensions; tests 14->15 files / 282->292 (+pose GLBs); new scripts (import_fbx_pose, import_smplx_pose, pose_manifest, fbx_to_pose_glb) |
| 2026-06-08 | Quality audit: fixed test_a_pose description "165 floats"→"63 floats", trimmed changelog |
