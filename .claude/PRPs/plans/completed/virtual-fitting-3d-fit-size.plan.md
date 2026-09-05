# Plan: Virtual Fitting (Full 3D) + Fit/Size

## Summary
Harden IYAE's full-3D try-on into a measurement-true, KPI-driving experience: fix the two production-blocking worker defects (Meshy's fabricated GLB metadata; the author-flagged `measurements_to_betas`), add an **explicit "your recommended size"** service + PDP surface, deliver an **instant 2D preview** while the high-fidelity rigged avatar streams in async, embed try-on **inline in the AI chat** (today it only links out), and ship a privacy **one-tap delete** for avatar/body data. This is the owner-selected hero feature and the primary lever on the return-rate KPI.

## User Story
As a **Toronto Gen Z shopper who is tired of guessing my size and returning things**, I want **a try-on that shows me instantly on a body true to my measurements, tells me my recommended size, and lets me delete my body data in one tap**, so that **I can confidently buy one piece I'll actually keep — without bracketing or privacy anxiety**.

## Problem → Solution
**Current state:** The 3D pipeline exists but (a) MeshyGenerator reports a hardcoded `triangle_count=30000` and `bbox=None`, so malformed GLBs silently pass validation and reach the Three.js viewer; (b) `measurements_to_betas` is a hand-authored linear approximation the author explicitly flagged as non-production, with no accuracy metric; (c) there is **no** recommended-size logic anywhere in the stack; (d) the viewer shows a spinner (not a product-relevant preview) while GLBs load; (e) AI chat only *links out* to `/outfits/{id}/view` — no inline try-on; (f) there is **no** avatar/body-data delete endpoint or UI.
**Desired state:** Bad GLBs are rejected by independent geometry validation; avatar shape carries a tracked `fit_accuracy` metric; every PDP/try-on shows an explicit recommended size (or a clear prompt to add measurements); an instant 2D still renders while the rigged avatar loads async; chat outfits are tried on inline; users can one-tap-delete all body/avatar data.

## Metadata
- **Complexity**: **XL** (spans worker/server/web; ~28 files; delivers as 3 loosely-coupled PRs — see "Delivery Split")
- **Source PRD**: `.claude/PRPs/prds/iyae.prd.md`
- **PRD Phase**: Phase 4 — Virtual Fitting (Full 3D) + Fit/Size
- **Estimated Files**: ~28 (11 worker · 9 server · 8 web), incl. tests
- **Depends on**: Phase 1 (Rebrand & Foundation — complete), Phase 2 (Design System + Core Reskin — complete)

---

## Delivery Split (recommended PR boundaries)

The three workstreams share no code and can land independently (each keeps the full suite green):

| PR | Workstream | Tasks | Risk |
|----|-----------|-------|------|
| PR-A | **Worker hardening** (fit accuracy + GLB validation) | W1–W3 | Isolated to `worker/`; strong existing test net (292 tests) |
| PR-B | **Server** (recommended size + one-tap delete) | S1–S3 | New migration V11 + new endpoints; additive |
| PR-C | **Web** (2D preview + inline chat + size UI + privacy UI) | F1–F5 | Consumes PR-B endpoints; degrade-gracefully if absent |

Land order: **PR-A ∥ PR-B first, then PR-C** (PR-C's recommended-size UI and privacy button consume PR-B endpoints; it degrades gracefully — hides the chip/button — if the endpoints 404).

---

## UX Design

### Before
```
PDP try-on / outfit view:
┌──────────────────────────────┐
│   [ spinner  32% ]           │  ← generic spinner, no product context
│                              │
│  Size:  [S] [M] [L] [XL]     │  ← no guidance; user guesses → brackets
└──────────────────────────────┘

AI chat outfit:
┌──────────────────────────────┐
│  [img][img]                  │
│  [img][img]                  │
│  ( View in 3D → )            │  ← links OUT to /outfits/{id}/view
└──────────────────────────────┘

Profile privacy:
  Body data — Always private (lock)   ← read-only; no way to delete
```

### After
```
PDP try-on / outfit view:
┌──────────────────────────────┐
│  [ product 2D still ]        │  ← instant; "Loading your fit..." caption
│      | (streams in async)    │
│  [ rigged avatar in 3D ]     │
│                              │
│  ✓ Your recommended size: M  │  ← explicit, pre-selected
│  Size:  [S] [=M=] [L] [XL]   │
└──────────────────────────────┘

AI chat outfit:
┌──────────────────────────────┐
│  [ inline avatar try-on 3D ] │  ← embedded, no navigation
│  ✓ Your size: M              │
└──────────────────────────────┘

Profile privacy:
  Body data — Always private (lock)
  [ Delete my avatar & body data ]  ← one tap, confirm, purged
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Viewer load | Spinner-only fallback | 2D product still as fallback, then 3D swaps in | `AvatarViewer` gains `previewImageUrl` prop |
| PDP size block | Bare size buttons | "Your recommended size: M" label + pre-selected chip | New `GET /api/products/{id}/recommended-size` |
| AI chat outfit | "View in 3D" link-out | Inline `AvatarViewer` embed | `OutfitCard` mounts dynamic viewer |
| Profile privacy | Read-only "always private" | One-tap delete button + confirm | New `DELETE /api/avatar` |
| Fit accuracy | Untracked | `fit_accuracy` in avatar payload | Worker-side, observable |

---

## Mandatory Reading

Read before implementing. Grouped by workstream.

### Worker (PR-A)
| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `worker/providers/meshy_generator.py` | 99–143 | The metadata no-op to fix (`triangle_count=30000` L134, `bbox=None` L135, `has_nan_vertices=False` L138) |
| P0 | `worker/providers/smplx_provider.py` | 165–283 | `measurements_to_betas` (165–205, the flagged target) **and** the real bbox/NaN pattern to copy into Meshy (267–283) |
| P0 | `worker/validator.py` | 44–115, 162–211 | Why `None` bbox/count pass silently (44–48, 60–65); the working `pygltflib` parse to reuse for real geometry validation (162–211) |
| P1 | `worker/main.py` | 36–76, 124–232 | Provider factories + per-queue `validate_glb`/`validate_metadata`/`complete`/`fail` wiring — where new validation plugs in |
| P1 | `worker/tests/test_meshy_generator.py` | ~300–330 | `test_triangle_count_is_30000` + `test_bbox_is_none` **pin the bad behavior** — must be rewritten |
| P2 | `worker/tests/test_smplx_provider.py` | 219–233 | Betas test style (`test_default_measurements_produce_near_zero_betas`) |
| P2 | `worker/CLAUDE.md` | payload/validation/gotchas | Authoritative conventions + schema v1; update changelog when done |

### Server (PR-B)
| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `server/src/main/java/com/iyae/service/AvatarService.java` | all (1–229) | Canonical service pattern; `buildInputPayload` (201–217) reads `BodyProfile`; `generateAvatar`/`getStatus`; where one-tap delete lands |
| P0 | `server/src/main/java/com/iyae/entity/BodyProfile.java` | 1–70 | The measurement + self-reported-size source the recommender consumes (`heightCm`…`inseamCm`, `topSize`/`bottomSize`/`dressSize`/`jacketSize`/`shoeSize`) |
| P0 | `server/src/main/java/com/iyae/service/RiggingService.java` | 25–120, 232–259 | Service pattern to mirror (`@Transactional`, ownership, `extractField`, DTO records) |
| P1 | `server/src/main/java/com/iyae/entity/Product.java` | ~48–55 | `sizes` JSON column (`columnDefinition="json"`) — the pattern for the new `sizeChart` column; `category` field for size mapping |
| P1 | `server/src/main/java/com/iyae/controller/RiggingController.java` | all | Controller pattern (`@RestController`, `Authentication`, `ResponseEntity<record>`) |
| P1 | `server/src/main/java/com/iyae/controller/AvatarController.java` | all | Where `DELETE` maps; `Authentication auth` injection |
| P1 | `server/src/main/resources/db/migration/V10__cart_item_selected_size.sql` | all | Latest migration — **next is `V11`**; MySQL DDL style |
| P1 | `server/src/main/java/com/iyae/config/GlobalExceptionHandler.java` | 20–72 | Error→HTTP contract (`IllegalArgumentException`→400, `AccessDeniedException`→403) new endpoints inherit |
| P1 | `server/src/main/java/com/iyae/config/SecurityConfig.java` | ~40–46 | `/api/products/**` is **public** — a new authenticated `recommended-size` route needs an explicit matcher |
| P2 | `server/src/test/java/com/iyae/service/RiggingServiceTest.java` | 36–55 | Service test template (Mockito, `@Spy ObjectMapper`, AssertJ) |
| P2 | `server/src/test/java/com/iyae/controller/RiggingControllerTest.java` | 21–81 | Controller test template (`@WebMvcTest`, `@Import(WebMvcSecurityConfig)`, `.with(csrf())`) |

### Web (PR-C)
| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `web/components/AvatarViewer.tsx` | 24–34, 217–250 | `Loader` fallback (24–34) + `<Suspense fallback>` (223) — where the 2D preview attaches; the scale/bad-GLB guard (125–137) |
| P0 | `web/lib/api.ts` | 1–65, 144–174 | Fetch wrapper (JWT/AbortSignal); `rigging` helper (152–159) to mirror; `RiggingStatusResponse`/`OutfitItem` types |
| P0 | `web/app/products/[id]/page.tsx` | 120, 160–188, 302–359 | PDP size block (302–315), `handleAddToCart` (160–188), `SmartARViewer` mount (345–359) |
| P1 | `web/components/OutfitCard.tsx` | 53–117 | Product grid + "View in 3D" link-out (110–117) to replace with inline embed |
| P1 | `web/components/SizeSelector.tsx` | 1–37 | Size primitive to pre-select/highlight |
| P1 | `web/components/profile/ProfileSettingsDialog.tsx` | 335–379 | Privacy section — home of the one-tap delete button |
| P1 | `web/lib/hooks/useAvatarStatus.ts` | 1–73 | Avatar PENDING→READY status machine (silent 5s poll) the UI reacts to |
| P1 | `web/middleware.ts` | 12–45 | CSP `connect-src`/`script-src` allowlist + `/ar`+`/try-on` camera gate — reconcile any new asset host |
| P2 | `web/app/outfits/[id]/view/page.tsx` | 104–198 | Reference rigged-garment assembly passed to `AvatarViewer` |
| P2 | `web/app/profile/avatar/page.tsx` | 407–530 | Avatar controls + read-only measurements; alt home for delete action |

## External Documentation
| Topic | Source | Key Takeaway |
|---|---|---|
| Next.js 16 APIs | `web/node_modules/next/dist/docs/` (per `web/AGENTS.md`) | **Read before changing any Next.js API** — conventions differ from training data |
| pygltflib GLB parsing | already vendored (`worker/requirements.txt` `pygltflib>=1.16.0`) | Reuse the exact `GLTF2.load()` + accessor pattern in `validate_skin_metadata` (validator.py:162–211) — no new dep |
| SMPL-X betas | `worker/providers/smplx_provider.py` docstring L172–173 | A production system uses a trained regressor (e.g. Measurements2SMPL); **out of scope** — we improve + add a tracked metric, not train a model |

> No external web research needed — all patterns are internal. pygltflib, trimesh, torch are already dependencies.

---

## Patterns to Mirror

Actual codebase snippets. Follow these exactly.

### WORKER — real bbox/NaN/triangle metadata (copy into Meshy)
```python
# SOURCE: worker/providers/smplx_provider.py:264-283
        glb_size = os.path.getsize(glb_path)
        elapsed_ms = int((time.time() - start_time) * 1000)

        # Compute bounding box
        bbox_min = vertices.min(axis=0).tolist()
        bbox_max = vertices.max(axis=0).tolist()
        has_nan = bool(__import__("numpy").isnan(vertices).any())

        return {
            "schemaVersion": 1,
            "provider_used": "SMPLX",
            # ...
            "triangle_count": len(faces),
            "bbox": {"min": bbox_min, "max": bbox_max},
            "sanity": {"glb_size_bytes": glb_size, "has_nan_vertices": has_nan},
            # ...
        }
```

### WORKER — lazy pygltflib parse for real geometry validation (reuse in validator)
```python
# SOURCE: worker/validator.py:162-176 (validate_skin_metadata)
def validate_skin_metadata(file_path: str) -> dict:
    """Check that GLB contains valid glTF skin data (skins, joints, weights)."""
    from pygltflib import GLTF2               # lazy import — do the same in validate_glb_geometry
    errors: list[str] = []
    try:
        gltf = GLTF2.load(file_path)
    except Exception as e:
        return {"valid": False, "errors": [f"Failed to parse GLB: {e}"]}
```

### WORKER — the metadata no-op being fixed
```python
# SOURCE: worker/providers/meshy_generator.py:128-143
        return {
            "schemaVersion": 1,
            "provider_used": "MESHY",
            # ...
            "triangle_count": 30000,  # target_polycount estimate; Meshy API doesn't return actual count
            "bbox": None,  # Meshy API doesn't return bounding box
            "sanity": {
                "glb_size_bytes": len(glb_resp.content),
                "has_nan_vertices": False,
            },
            # ...
        }
```

### WORKER — validators return `[]` (pass) on `None` (why bad GLBs slip through)
```python
# SOURCE: worker/validator.py:44-49 & 60-65
def validate_triangle_count(metadata: dict) -> list[str]:
    errors: list[str] = []
    count = metadata.get("triangle_count")
    if count is None:
        return errors                 # <-- absent count passes
    # ...
def validate_bounding_box(metadata: dict) -> list[str]:
    errors: list[str] = []
    bbox = metadata.get("bbox")
    if bbox is None:
        return errors                 # <-- Meshy's bbox=None passes
```

### WORKER — pytest test style (mirror for new tests)
```python
# SOURCE: worker/tests/test_smplx_provider.py:219-233
    def test_default_measurements_produce_near_zero_betas(self):
        default = {"heightCm":170.0,"weightKg":70.0,"chestCm":90.0,"waistCm":75.0,
                   "hipsCm":95.0,"shoulderWidthCm":40.0,"inseamCm":80.0}
        betas = SmplxProvider.measurements_to_betas(default)
        for i, b in enumerate(betas):
            assert abs(b) < 0.01, f"beta[{i}]={b} expected ~0 at population average"
```

### SERVER — service layer (mirror for SizeRecommendationService)
```java
// SOURCE: server/src/main/java/com/iyae/service/AvatarService.java:26-53,201-217
@Slf4j
@Service
@RequiredArgsConstructor
public class AvatarService {
    private final BodyProfileRepository bodyProfileRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public /* ... */ getStatus(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        BodyProfile profile = bodyProfileRepository.findByUserId(user.getId()).orElse(null);
        // read heightCm/weightKg/chestCm/waistCm/hipsCm/... off profile
    }
}
```

### SERVER — ownership + JSON extract helpers
```java
// SOURCE: server/src/main/java/com/iyae/service/RiggingService.java:232-259
private void checkOwnership(Product product, String userEmail) {
    User owner = product.getDesignerProfile().getUser();
    if (!owner.getEmail().equals(userEmail)) {
        throw new AccessDeniedException("Access denied: product does not belong to current user");
    }
}
private String extractField(String json, String fieldName) {
    try {
        JsonNode node = objectMapper.readTree(json);
        JsonNode field = node.get(fieldName);
        return field != null && !field.isNull() ? field.asText() : null;
    } catch (Exception e) { log.warn("Failed to extract field '{}' ...", fieldName); return null; }
}
```

### SERVER — controller (mirror for size + delete endpoints)
```java
// SOURCE: server/src/main/java/com/iyae/controller/RiggingController.java:10-31
@RestController
@RequestMapping("/api/designer/products")
@RequiredArgsConstructor
public class RiggingController {
    private final RiggingService riggingService;

    @GetMapping("/{id}/rigging-status")
    public ResponseEntity<RiggingStatusResponse> getStatus(
            @PathVariable Long id, Authentication authentication) {
        return ResponseEntity.ok(riggingService.getStatus(id, authentication.getName()));
    }
}
```
```java
// SOURCE: server/src/main/java/com/iyae/controller/AvatarController.java:11-34 (delete lands here)
@RestController
@RequestMapping("/api/avatar")
@RequiredArgsConstructor
public class AvatarController {
    private final AvatarService avatarService;
    @PostMapping("/generate")
    public ResponseEntity<AvatarStatusResponse> generate(Authentication auth) {
        return ResponseEntity.ok(avatarService.generateAvatar(auth.getName()));
    }
}
```

### SERVER — record DTO style
```java
// SOURCE: pattern of dto/RiggingStatusResponse.java (record, camelCase, nullable fields)
public record RiggingStatusResponse(String status, String riggedGlbUrl,
                                    String errorMessage, String failureCode, Integer attemptCount) {}
```

### SERVER — Flyway migration DDL (V11 model)
```sql
-- SOURCE: style of V10__cart_item_selected_size.sql (MySQL DDL, JSON columns)
ALTER TABLE products ADD COLUMN size_chart JSON NULL;
```

### WEB — Suspense fallback (attach the 2D preview here)
```tsx
// SOURCE: web/components/AvatarViewer.tsx:24-34 (Loader) & 223 (<Suspense fallback>)
function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
      </div>
    </Html>
  );
}
// ...
        <Suspense fallback={<Loader />}>   // L223 — swap for <PreviewFallback previewImageUrl={...}/>
```

### WEB — API helper object to mirror (`rigging` → new `avatar`/`sizing`)
```ts
// SOURCE: web/lib/api.ts:152-159
export const rigging = {
  getStatus: (productId: number, signal?: AbortSignal) =>
    api.get<RiggingStatusResponse>(`/api/designer/products/${productId}/rigging-status`, { signal }),
  trigger: (productId: number) =>
    api.post<RiggingStatusResponse>(`/api/designer/products/${productId}/rigging`),
  retry: (productId: number) =>
    api.post<RiggingStatusResponse>(`/api/designer/products/${productId}/rigging-status/retry`),
};
```

### WEB — SizeSelector (semantic tokens; pre-select/highlight recommended)
```tsx
// SOURCE: web/components/SizeSelector.tsx:1-37
export function SizeSelector({ sizes, selectedSize, onSelect, disabled }: SizeSelectorProps) {
  if (sizes.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Select a size">
      {sizes.map((size) => (
        <button aria-pressed={selectedSize === size}
          className={cn("min-w-11 min-h-11 px-3 rounded-md text-sm font-medium border",
            selectedSize === size
              ? "bg-foreground text-background border-foreground"
              : "border-border hover:border-foreground/50")}>
          {size}
        </button>
      ))}
    </div>
  );
}
```

### WEB — dynamic 3D import (all R3F must be ssr:false)
```tsx
// SOURCE: web/app/profile/avatar/page.tsx:19-31 pattern (per HC-23)
const AvatarViewer = dynamic(() => import("@/components/AvatarViewer"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-muted" />,
});
```

### WEB — hook/api test style (Vitest fake timers + AbortSignal assertion)
```ts
// SOURCE: web/__tests__/lib/hooks/useOutfitRiggingStatus.test.ts (pattern)
vi.mock("@/lib/api");
vi.useFakeTimers();
// ...
expect(api.get).toHaveBeenCalledWith(expect.any(String),
  expect.objectContaining({ signal: expect.any(AbortSignal) }));
```

---

## Files to Change

### PR-A — Worker
| File | Action | Justification |
|---|---|---|
| `worker/providers/meshy_generator.py` | UPDATE | Load downloaded GLB; compute real `triangle_count`/`bbox`/`has_nan_vertices` |
| `worker/validator.py` | UPDATE | Add `validate_glb_geometry(file_path)` — independent geometry parse (defense-in-depth) |
| `worker/providers/smplx_provider.py` | UPDATE | Clamp betas; gender-condition hook; emit `fit_accuracy` (height reconstruction error) |
| `worker/main.py` | UPDATE | Wire `validate_glb_geometry` into model + avatar task validation |
| `worker/tests/test_meshy_generator.py` | UPDATE | Rewrite `test_triangle_count_is_30000` / `test_bbox_is_none`; add real-metadata tests |
| `worker/tests/test_validator.py` | UPDATE | Add `TestValidateGlbGeometry` (valid, degenerate, oversized, NaN) |
| `worker/tests/test_smplx_provider.py` | UPDATE | Beta clamping + `fit_accuracy` presence/range tests |
| `worker/CLAUDE.md` | UPDATE | Schema note (`fit_accuracy`), validator addition, changelog |

### PR-B — Server
| File | Action | Justification |
|---|---|---|
| `server/src/main/resources/db/migration/V11__product_size_chart.sql` | CREATE | Add `products.size_chart JSON NULL` |
| `server/src/main/java/com/iyae/entity/Product.java` | UPDATE | Add `sizeChart` JSON column field |
| `server/src/main/java/com/iyae/service/SizeRecommendationService.java` | CREATE | Two-tier recommendation (measurement-chart → self-reported → none) |
| `server/src/main/java/com/iyae/dto/SizeRecommendationResponse.java` | CREATE | Record `(recommendedSize, basis, confidence, availableSizes)` |
| `server/src/main/java/com/iyae/controller/SizeRecommendationController.java` | CREATE | `GET /api/products/{id}/recommended-size` (authenticated) |
| `server/src/main/java/com/iyae/config/SecurityConfig.java` | UPDATE | Explicit `authenticated()` matcher for `GET /api/products/*/recommended-size` |
| `server/src/main/java/com/iyae/service/AvatarService.java` | UPDATE | Add `deleteAvatarData(email)` — purge avatar + body profile + tasks |
| `server/src/main/java/com/iyae/controller/AvatarController.java` | UPDATE | Add `DELETE /api/avatar` |
| `server/src/test/java/com/iyae/service/SizeRecommendationServiceTest.java` | CREATE | Chart-match, self-reported fallback, none, category mapping |
| `server/src/test/java/com/iyae/service/AvatarServiceTest.java` | UPDATE | `deleteAvatarData` clears fields + tasks |
| `server/src/test/java/com/iyae/controller/SizeRecommendationControllerTest.java` | CREATE | 200 authed, 401 unauth, shape |
| `server/src/test/java/com/iyae/controller/AvatarControllerTest.java` | UPDATE | `DELETE` 200 + unauth |
| `server/src/main/java/com/iyae/config/DataSeeder.java` | UPDATE (optional) | Seed one product `size_chart` for demo/manual QA |

### PR-C — Web
| File | Action | Justification |
|---|---|---|
| `web/components/AvatarViewer.tsx` | UPDATE | `previewImageUrl` prop → 2D still as Suspense fallback |
| `web/lib/api.ts` | UPDATE | Add `avatar` (getStatus/generate/getAvatar/**delete**) + `sizing` (getRecommendedSize) helpers + types |
| `web/app/products/[id]/page.tsx` | UPDATE | Fetch recommended size; label + pre-select chip; pass `previewImageUrl` to viewer |
| `web/components/RecommendedSizeHint.tsx` | CREATE | "Your recommended size: M" presentational component |
| `web/components/OutfitCard.tsx` | UPDATE | Inline `AvatarViewer` embed (replace link-out) |
| `web/components/profile/ProfileSettingsDialog.tsx` | UPDATE | One-tap "Delete my avatar & body data" button + confirm |
| `web/__tests__/components/RecommendedSizeHint.test.tsx` | CREATE | Renders size/basis; hidden when none |
| `web/__tests__/lib/api.test.ts` | UPDATE | `avatar.delete` / `sizing.getRecommendedSize` wiring |

## NOT Building
- **A trained betas regression model** (Measurements2SMPL) — we clamp, gender-condition, and add a tracked accuracy metric; the trained model is a future accuracy enhancement.
- **Designer size-chart authoring UI** — `size_chart` is a nullable JSON column, seed/API-populated; a studio form is future work. Recommendation degrades to self-reported sizes when null.
- **Face detection / blur / face-photo storage** — "face optional" is already satisfied: SMPL-X avatars are faceless bodies and no face photo is persisted (`avatarMode` toggle already exists). Only one-tap delete is net-new.
- **AR / WebXR changes, new poses, new decoders/CDNs** — no `middleware.ts` CSP host additions; all GLBs remain same-origin `/assets/*`.
- **Circumference-based fit validation** — the tracked metric is height-reconstruction error + beta-range sanity (bounded, testable); mesh-circumference measurement is future.
- **New async queue** — high-fidelity streaming reuses the existing avatar/rigging PENDING→READY status machines; no new task table.
- **Guest recommended-size** — endpoint is authenticated; guests see the "add measurements" prompt.

---

## Step-by-Step Tasks

### PR-A — Worker hardening

### Task W1: Meshy real GLB metadata
- **ACTION**: Replace the fabricated metadata in `MeshyGenerator.generate` with values computed from the downloaded GLB.
- **IMPLEMENT**: After the GLB is written (`meshy_generator.py:110-111`), parse it and compute `triangle_count` (sum of primitive index counts / 3), `bbox` (`{"min":[...],"max":[...]}` from POSITION accessor `min`/`max`, unioned across meshes), and `has_nan` (scan the POSITION buffer). Set payload keys L134/135/138 to the computed values. Prefer `pygltflib` (already a dep) to read accessor `min`/`max` without decoding buffers; fall back to `trimesh.load(glb_path)` if accessor bounds are absent.
- **MIRROR**: `smplx_provider.py:264-283` (real bbox/NaN) + `validator.py:162-176` (lazy `GLTF2.load`).
- **IMPORTS**: `from pygltflib import GLTF2` (lazy, inside a helper `_compute_glb_metadata(glb_path) -> dict`).
- **GOTCHA**: glTF stores POSITION `min`/`max` per-accessor — union them; if a mesh lacks bounds, decode via trimesh. Do not import torch/trimesh at module top (keep lazy, per existing style).
- **VALIDATE**: `cd worker && pytest tests/test_meshy_generator.py -q` — new metadata tests green.

### Task W2: Independent GLB geometry validator (defense-in-depth)
- **ACTION**: Add `validate_glb_geometry(file_path: str) -> dict` to `validator.py` and call it from `main.py` for model + avatar tasks, so bad GLBs are rejected even if a provider lies.
- **IMPLEMENT**: New function returns `{"valid": bool, "errors": [...], "triangle_count": int, "bbox": {...}}`. Parse with `GLTF2.load`; derive triangle_count + bbox + NaN independently; reuse thresholds `MAX_TRIANGLE_COUNT` (500k), `BBOX_MIN_DIM`/`BBOX_MAX_DIM`. In `main.py` model-task path (~L136-148) and avatar-task path (~L168-175), call it on the absolute GLB path after `validate_glb`; append its errors before `complete_task`.
- **MIRROR**: `validator.py:134-159` (`validate_rigged_glb` orchestration shape) + `162-211` (pygltflib parse).
- **IMPORTS**: reuse module constants; `from pygltflib import GLTF2` lazy inside the function.
- **GOTCHA**: Keep it lazy-import + graceful — a parse failure is a validation error (task FAILED), never an unhandled crash of the poll loop. Rigging path already uses `validate_rigged_glb`; leave it unchanged.
- **VALIDATE**: `cd worker && pytest tests/test_validator.py -q`.

### Task W3: Harden `measurements_to_betas` + tracked fit accuracy
- **ACTION**: Clamp betas to a safe range, add a gender-conditioning hook, and emit a `fit_accuracy` block in the avatar payload.
- **IMPLEMENT**: In `smplx_provider.py:165-205`, clamp each returned beta to `[-4.0, 4.0]` (guards degenerate SMPL-X shapes) and accept an optional `gender` arg used to shift population means when `gender in ("male","female")` (keep neutral = current behavior so the existing near-zero test still holds). In `generate` (after the forward pass, ~L267), compute `height_error_cm = abs(mesh_height_cm - input_heightCm)` where `mesh_height_cm = (bbox_max[1]-bbox_min[1])*100`; add `"fit_accuracy": {"height_error_cm": round(err,2), "betas_in_range": all(-4<=b<=4)}` to the returned payload (after L282).
- **MIRROR**: existing `measurements_to_betas` structure (165-205); payload extension mirrors `sanity` block (L279).
- **IMPORTS**: none new (numpy already used).
- **GOTCHA**: The default-measurements test (`test_smplx_provider.py:219-233`) asserts betas ≈ 0 for `gender=neutral` at population average — keep neutral coefficients unchanged so it stays green. Clamp must not alter near-zero values.
- **VALIDATE**: `cd worker && pytest tests/test_smplx_provider.py -q`.

### PR-B — Server (recommended size + one-tap delete)

### Task S1: V11 migration + Product.sizeChart
- **ACTION**: Add a nullable `size_chart` JSON column to `products` and map it on the entity.
- **IMPLEMENT**: Create `V11__product_size_chart.sql` with `ALTER TABLE products ADD COLUMN size_chart JSON NULL;`. In `Product.java`, add `@Column(name = "size_chart", columnDefinition = "json") private String sizeChart;` (store raw JSON string like the existing `sizes` column; parse in the service via `ObjectMapper`).
- **MIRROR**: `Product.sizes` JSON column (`Product.java:~50`); `V10` DDL style.
- **IMPORTS**: none new.
- **GOTCHA**: `ddl-auto: validate` — the entity field MUST match the migration or the context fails to start. JSON as `String` (not `@Convert`) matches the `sizes` precedent. In `application-test` (H2), Flyway is disabled and Hibernate auto-creates — H2 maps `columnDefinition="json"` to a native JSON type in recent H2; keep the column nullable so auto-create succeeds. If H2 rejects the DDL, fall back to `columnDefinition = "text"` on the entity (MySQL migration stays `JSON`).
- **VALIDATE**: `cd server && ./gradlew test` (context loads under H2).

### Task S2: SizeRecommendationService + endpoint
- **ACTION**: New authenticated endpoint returning the user's recommended size for a product.
- **IMPLEMENT**:
  - `SizeRecommendationResponse` record: `(String recommendedSize, String basis, double confidence, List<String> availableSizes)`, `basis ∈ {"MEASUREMENT_CHART","SELF_REPORTED","NONE"}`.
  - `SizeRecommendationService.recommend(Long productId, String email)`:
    1. Load `Product` (400 if missing) → parse `sizes` (available) + `sizeChart` (nullable) via `objectMapper`.
    2. Load the user's `BodyProfile` (via `bodyProfileRepository.findByUserId`); if absent → `NONE`, confidence 0.
    3. **Tier 1 (chart present + measurements present):** compute Euclidean distance between the user's `{chestCm,waistCm,hipsCm,inseamCm}` (available dims only) and each chart entry; pick nearest → `MEASUREMENT_CHART`, confidence from normalized distance.
    4. **Tier 2 (no chart / no measurements):** map `Product.category` → the matching self-reported size (`tops→topSize`, `bottoms/pants→bottomSize`, `dresses→dressSize`, `outerwear/jacket→jacketSize`, `shoes→shoeSize`, else `topSize`); if that size ∈ availableSizes → `SELF_REPORTED`; else `NONE`.
  - `SizeRecommendationController`: `@GetMapping("/api/products/{id}/recommended-size")` → `recommend(id, auth.getName())`.
- **MIRROR**: `AvatarService` (service shape, `bodyProfileRepository`); `RiggingController` (controller shape); `RiggingStatusResponse` (record DTO).
- **IMPORTS**: `ObjectMapper`, `BodyProfileRepository`, `ProductRepository`, `UserRepository`.
- **GOTCHA**: `/api/products/**` is **public** in `SecurityConfig`, so `Authentication` would be `null` for anon and this route must require login. **Decision:** add an explicit `.requestMatchers(HttpMethod.GET, "/api/products/*/recommended-size").authenticated()` **before** the public `/api/products/**` rule (Spring Security matches first-match). Controller test asserts 401 for anon.
- **VALIDATE**: `cd server && ./gradlew test --tests '*SizeRecommendation*'`.

### Task S3: One-tap delete of avatar + body data
- **ACTION**: Add `deleteAvatarData(email)` to `AvatarService` and `DELETE /api/avatar`.
- **IMPLEMENT**: `@Transactional public void deleteAvatarData(String email)`: load user; set `user.setAvatarGlbUrl(null)` + save; delete the `BodyProfile` row (`bodyProfileRepository.delete(...)` if present); delete the user's `AvatarGenerationTask` rows (`avatarTaskRepository.deleteAll(avatarTaskRepository.findByUserIdOrderByCreatedAtDesc(user.getId()))`). Add `@DeleteMapping public ResponseEntity<Void> deleteAvatarData(Authentication auth)` → `avatarService.deleteAvatarData(auth.getName()); return ResponseEntity.noContent().build();`.
- **MIRROR**: `AvatarService.getAvatar/generateAvatar` (lookup + save); `AvatarController` (auth injection).
- **IMPORTS**: existing repos on `AvatarService`.
- **GOTCHA**: `avatar_generation_tasks` FK is `ON DELETE CASCADE` from users, but we are NOT deleting the user — delete the task rows explicitly. Do NOT delete the `User`. Guest sentinel account is never targeted (endpoint is per-authenticated-user). Body-profile deletion is idempotent (skip if absent).
- **VALIDATE**: `cd server && ./gradlew test --tests '*AvatarServiceTest' --tests '*AvatarControllerTest'`.

### PR-C — Web

### Task F1: Instant 2D preview fallback
- **ACTION**: Give `AvatarViewer` an optional `previewImageUrl`; render it as the Suspense fallback instead of the bare spinner.
- **IMPLEMENT**: Add `previewImageUrl?: string` to `AvatarViewerProps` (L151-160). Add a `PreviewFallback({ previewImageUrl }: { previewImageUrl?: string })` component: if `previewImageUrl`, render `<Html center><img src={previewImageUrl} className="max-h-[60vh] object-contain opacity-80" alt="" /><p className="text-xs text-muted-foreground">Loading your fit...</p></Html>`; else render the existing `<Loader/>`. Swap `<Suspense fallback={<Loader />}>` (L223) for `<Suspense fallback={<PreviewFallback previewImageUrl={previewImageUrl} />}>`.
- **MIRROR**: existing `Loader` (24-34) using drei `<Html center>`.
- **IMPORTS**: none new (`Html` already imported).
- **GOTCHA**: The fallback renders **inside** the R3F `<Canvas>`, so it must be a drei `<Html>` (a raw `<img>` at that position breaks reconciliation). Keep semantic tokens (`text-muted-foreground`); no hardcoded colors (residue-scan gate). Image must be same-origin/https (`img-src 'self' data: blob: https:` already allows it).
- **VALIDATE**: `cd web && npx tsc --noEmit && npm run test`.

### Task F2: `avatar` + `sizing` API helpers
- **ACTION**: Add helper objects + types to `lib/api.ts` mirroring `rigging`.
- **IMPLEMENT**:
  - `export interface SizeRecommendationResponse { recommendedSize: string | null; basis: "MEASUREMENT_CHART" | "SELF_REPORTED" | "NONE"; confidence: number; availableSizes: string[]; }`
  - `export const sizing = { getRecommendedSize: (productId: number, signal?: AbortSignal) => api.get<SizeRecommendationResponse>(\`/api/products/${productId}/recommended-size\`, { signal }) };`
  - `export const avatar = { getStatus: (s?: AbortSignal) => api.get<AvatarStatus>("/api/avatar/status", { signal: s }), generate: () => api.post<AvatarStatus>("/api/avatar/generate"), getAvatar: (s?: AbortSignal) => api.get<AvatarResponse>("/api/avatar", { signal: s }), delete: () => api.delete<void>("/api/avatar") };`
- **MIRROR**: `rigging` helper (api.ts:152-159); `RiggingStatusResponse` type.
- **IMPORTS**: none new.
- **GOTCHA**: `api.post/delete` do NOT forward a `signal` (only `api.get` does); don't pass signals to those. `AvatarStatus` type currently lives in `useAvatarStatus.ts` — either import it or re-export from `api.ts`; keep one source of truth.
- **VALIDATE**: `cd web && npm run test -- api`.

### Task F3: Recommended-size on PDP
- **ACTION**: Fetch and surface the recommended size on the product detail page.
- **IMPLEMENT**: Create `RecommendedSizeHint.tsx` (presentational): props `{ recommendedSize, basis }`; renders nothing when `basis==="NONE"`/null; else `✓ Your recommended size: <strong>{recommendedSize}</strong>` in `text-brand`/`text-foreground`, with a subtle caption when `basis==="SELF_REPORTED"` ("based on your saved sizes"). In `app/products/[id]/page.tsx`: on mount (authed only) call `sizing.getRecommendedSize(product.id, signal)`; store in state; if `recommendedSize` and `selectedSize` is unset, pre-select it (set `selectedSize`); mount `<RecommendedSizeHint/>` above `<SizeSelector/>` (~L302). Pass the product's primary image as `previewImageUrl` to any `AvatarViewer`/`SmartARViewer` mount.
- **MIRROR**: `SearchFilterBar` AbortController fetch-on-mount; `SizeSelector` selection.
- **IMPORTS**: `sizing` from `@/lib/api`; new `RecommendedSizeHint`.
- **GOTCHA**: Guests (no JWT) → the call 401s and `api.ts` redirects to `/login`. Guard: only fetch when `useAuth().user` is present; otherwise skip silently (show nothing). Do NOT let a 401 here bounce a browsing guest to login.
- **VALIDATE**: `cd web && npm run test -- RecommendedSizeHint && npx tsc --noEmit`.

### Task F4: Inline try-on in AI chat
- **ACTION**: Replace `OutfitCard`'s "View in 3D" link-out with an inline avatar try-on.
- **IMPLEMENT**: In `OutfitCard.tsx`, dynamic-import `AvatarViewer` (`ssr:false`), fetch the user's avatar url via `avatar.getAvatar()` (once, memoized), build `glbUrls` from the outfit items' `glbUrl`/`riggedGlbUrl` (mirror `outfits/[id]/view` assembly), and render `<ViewerErrorBoundary><AvatarViewer avatarUrl={...} riggedGarmentUrls={...} riggedGarmentSlots={...} glbUrls={...} previewImageUrl={items[0]?.media?.[0]} /></ViewerErrorBoundary>` in place of the link button (L110-117). Keep the 2×2 grid as the collapsed default; expand to the viewer on a "Try on" toggle so R3F is not mounted for every chat message.
- **MIRROR**: `app/outfits/[id]/view/page.tsx:104-198` (URL assembly + `AvatarViewer` props); `OutfitBuilderPreview` (dynamic import + `ViewerErrorBoundary`).
- **IMPORTS**: `dynamic` from `next/dynamic`; `ViewerErrorBoundary`; `avatar` helper.
- **GOTCHA**: Mounting R3F in a chat stream is expensive — gate the viewer behind an explicit "Try on" click (lazy mount), never auto-mount for all messages. All R3F imports MUST be `dynamic(..., {ssr:false})`.
- **VALIDATE**: `cd web && npx tsc --noEmit && npm run build`.

### Task F5: One-tap delete UI
- **ACTION**: Add the delete control to the profile privacy section.
- **IMPLEMENT**: In `ProfileSettingsDialog.tsx` privacy section (L335-379), below the read-only "Body data — Always private" row, add a `destructive`-styled button "Delete my avatar & body data"; on click, open a confirm (reuse shadcn `AlertDialog` or a two-step inline confirm), then `await avatar.delete()`, `toast.success("Your body data was deleted")`, and refresh local avatar/body state. Also expose the same action on `app/profile/avatar/page.tsx` action row (L407-426).
- **MIRROR**: existing `api.delete` usages (`lib/cart-context.tsx`); `sonner` toast pattern.
- **IMPORTS**: `avatar` from `@/lib/api`; `toast` from `sonner`.
- **GOTCHA**: Irreversible — require explicit confirm (destructive, affects the user's own data). After delete, the avatar viewer must handle a now-null avatar url (falls back to demo/guest path — already supported by `AvatarViewer`'s `hasContent` guard, L179-182).
- **VALIDATE**: `cd web && npx tsc --noEmit && npm run test`.

### Task Z: Docs + PRD status
- **ACTION**: Sync module docs and mark the PRD phase.
- **IMPLEMENT**: Update `worker/CLAUDE.md` (schema `fit_accuracy`, `validate_glb_geometry`, changelog), `server/CLAUDE.md` (V11, SizeRecommendation service/controller/DTO, avatar DELETE, test counts), `web/CLAUDE.md` (RecommendedSizeHint, avatar/sizing helpers, AvatarViewer prop). Confirm PRD Phase 4 status is `in-progress` with the plan link.
- **VALIDATE**: docs match code; counts reconcile.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| Meshy real triangle_count | GLB with 1,234 tris | payload `triangle_count == 1234` | — |
| Meshy real bbox | GLB spanning known bounds | `bbox.min/max` match accessor bounds | — |
| Meshy oversized GLB | GLB > 500k tris | `validate_glb_geometry` → invalid | ✅ |
| `validate_glb_geometry` NaN | GLB with NaN position | invalid + error | ✅ |
| `validate_glb_geometry` degenerate bbox | flat GLB (dim < 0.01m) | invalid | ✅ |
| betas clamping | extreme measurements (2.3m, 200kg) | every beta ∈ [-4,4] | ✅ |
| betas neutral unchanged | population-avg measurements | betas ≈ 0 (existing test still passes) | ✅ (regression) |
| fit_accuracy present | any avatar generate | payload has `fit_accuracy.height_error_cm` | — |
| SizeRec chart match | user 90/75/95, chart {S,M,L} | nearest size, `MEASUREMENT_CHART` | — |
| SizeRec self-reported | no chart, `topSize="M"`, category tops | `M`, `SELF_REPORTED` | — |
| SizeRec none | no chart, no body profile | `null`, `NONE`, confidence 0 | ✅ |
| SizeRec category map | dress product, `dressSize="8"` | `8` from `dressSize` | ✅ |
| deleteAvatarData | user with avatar+profile+tasks | avatarGlbUrl null, profile gone, tasks gone | — |
| deleteAvatarData idempotent | user with no profile | no error, avatarGlbUrl null | ✅ |
| SizeRec endpoint auth | authed GET | 200 + body | — |
| SizeRec endpoint unauth | anon GET | 401 | ✅ |
| DELETE /api/avatar unauth | anon | 401 | ✅ |
| RecommendedSizeHint | `basis:"NONE"` | renders nothing | ✅ |
| RecommendedSizeHint | size "M", chart basis | shows "Your recommended size: M" | — |
| `sizing.getRecommendedSize` | mock api | GET correct URL + signal | — |
| `avatar.delete` | mock api | DELETE `/api/avatar` | — |

### Edge Cases Checklist
- [x] Empty input — Meshy GLB with 0 tris; no body profile → `NONE`
- [x] Maximum size input — >500k triangle GLB rejected
- [x] Invalid types — NaN vertices rejected by geometry validator
- [ ] Concurrent access — task-queue `FOR UPDATE SKIP LOCKED` unchanged (not touched)
- [x] Network failure — recommended-size fetch aborts cleanly (AbortController); UI hides on error
- [x] Permission denied — recommended-size 401 for guest handled (no fetch when unauth); DELETE requires auth
- [x] Destructive confirm — one-tap delete gated behind explicit confirmation

---

## Validation Commands

### Static Analysis
```bash
cd web && npx tsc --noEmit          # Web type check
cd web && npm run lint              # ESLint (incl. residue-scan gate for stray colors)
cd worker && python -m py_compile providers/*.py validator.py main.py
```
EXPECT: Zero type errors; no `purple-*`/`rose-*`/hardcoded-hex residue.

### Unit Tests (per workstream)
```bash
cd worker && pytest                 # PR-A — expect 292 + new tests green
cd server && ./gradlew test         # PR-B — expect 336 + new tests green
cd web && npm run test              # PR-C — expect 222 + new tests green
```
EXPECT: All pass; no regressions in existing counts.

### Full Test Suite
```bash
cd worker && pytest && cd ../server && ./gradlew test && cd ../web && npm run test && npm run build
```
EXPECT: All green; web production build succeeds.

### Database Validation
```bash
cd server && ./gradlew test         # H2 auto-creates schema; validates entity<->column match
# (dev) ./dev.sh start && ./dev.sh logs server  -> Flyway applies V11 cleanly under ddl-auto:validate
```
EXPECT: V11 applies; `products.size_chart` present; context starts under `ddl-auto: validate`.

### Browser Validation
```bash
cd web && npm run dev               # + server on :3001
```
EXPECT: PDP shows "Your recommended size" (authed w/ measurements); viewer shows 2D still then 3D; chat "Try on" mounts inline viewer; profile delete purges data.

### Manual Validation
- [ ] Log in as a buyer with a body profile → PDP shows recommended size + pre-selected chip.
- [ ] Trigger a try-on → a 2D product still appears instantly, then the rigged avatar streams in.
- [ ] In AI chat, generate an outfit → "Try on" mounts an inline avatar viewer (no navigation).
- [ ] Profile → privacy → "Delete my avatar & body data" → confirm → avatar/body gone; `/api/avatar` returns NONE.
- [ ] Force a malformed GLB through the worker (e.g. truncated file) → task marked FAILED (not surfaced to viewer).

---

## Acceptance Criteria
- [ ] All tasks (W1–W3, S1–S3, F1–F5, Z) completed.
- [ ] All validation commands pass; no regressions in worker/server/web suites.
- [ ] Meshy payload carries **real** `triangle_count`/`bbox`/`has_nan`; a bad GLB is rejected before the viewer.
- [ ] Avatar payload carries a tracked `fit_accuracy`; betas are clamped.
- [ ] `GET /api/products/{id}/recommended-size` returns an explicit size (or `NONE`) for the authed user.
- [ ] PDP + inline surfaces show "Your recommended size"; instant 2D preview precedes the rigged 3D.
- [ ] `DELETE /api/avatar` purges avatar url + body profile + avatar tasks; UI one-tap delete works with confirm.
- [ ] No type/lint errors; no hardcoded colors (residue gate clean).

## Completion Checklist
- [ ] Code follows discovered patterns (service/controller/record DTO; pytest classes; drei `<Html>` fallback; `dynamic ssr:false`).
- [ ] Error handling matches codebase (`IllegalArgumentException`→400, `AccessDeniedException`→403; worker task→FAILED, never crash loop).
- [ ] Logging follows conventions (`log.info/warn` server; module `logger` worker).
- [ ] Tests follow existing templates (Mockito/`@WebMvcTest`; Vitest fake timers + AbortSignal; pytest mocks).
- [ ] No hardcoded values (thresholds reuse validator constants; brand via tokens).
- [ ] Module `CLAUDE.md` docs updated (worker/server/web) + changelog.
- [ ] No unnecessary scope additions (see NOT Building).
- [ ] Self-contained — implementable without further codebase search.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `measurements_to_betas` still imperfect after clamping (accuracy KPI) | H | H | Ship the tracked `fit_accuracy` metric now; trained model is an explicit future task; recommended-size gives an independent fit signal |
| Recommended size wrong when only self-reported sizes exist | M | M | Return `basis` so UI can hedge copy ("based on your saved sizes"); confidence field; chart path preferred when present |
| `/api/products/**` is public — auth mismatch on new endpoint | M | M | Explicit `authenticated()` matcher for `*/recommended-size` **before** the public rule; controller test asserts 401 for anon |
| H2 test DB JSON column handling for `size_chart` | M | L | Store JSON as `String` (matches `Product.sizes` precedent); nullable so auto-create works; fall back to `columnDefinition="text"` on the entity if H2 rejects `json` |
| Inline R3F in chat degrades perf | M | M | Lazy-mount behind "Try on" click; `dynamic ssr:false`; never auto-mount per message |
| pygltflib can't read POSITION bounds on some Meshy GLBs | L | M | Fall back to `trimesh.load` to compute bbox/tris; both already deps |
| Guest 401 bounces browsers to `/login` from PDP fetch | M | M | Only fetch recommended-size when `useAuth().user` present |

## Notes
- **Phase-4 reality:** two categories of work — *hardening* existing code (W1–W3 target real, author-flagged defects) and *net-new* subsystems (recommended size, 2D preview, inline chat, one-tap delete had **zero** prior code, confirmed by exhaustive grep across all three modules).
- **Async high-fidelity is mostly already built:** `useAvatarStatus`/`useOutfitRiggingStatus` already stream PENDING→READY and swap static→rigged. Phase 4's "async high-fidelity" deliverable is therefore just the **instant 2D fallback** (F1) plus wiring — no new queue.
- **"Face optional" is already satisfied** architecturally (faceless SMPL-X body model + existing `avatarMode` toggle + no face-photo storage); only one-tap delete is net-new.
- **Token-key discrepancy (minor):** `web/lib/api.ts` reads `localStorage("clossette_token")` while `web/CLAUDE.md` documents `iyae_token`. New code uses `api.get/post/delete` and inherits the wrapper, so this doesn't block Phase 4 — flag for a Phase-1 residue cleanup, don't fix here.
- **Delivery:** land PR-A ∥ PR-B, then PR-C. Each PR keeps its module suite green independently.
