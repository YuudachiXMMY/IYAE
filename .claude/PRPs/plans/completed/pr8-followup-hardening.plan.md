# Plan: PR #8 Follow-up Hardening (M2/M3/M6/M7/M10/M11 + L1–L7)

## Summary
Close the deferred correctness, honesty, a11y, and test-coverage findings from the PR #8 review across all three modules (server / worker / web). No new features — this is defense-in-depth, accuracy, and consistency work on Phase 4 "Virtual Fitting + Fit/Size" code that already shipped its 2 HIGH + 5 MEDIUM fixes in commit `e69ef87`.

## User Story
As a **maintainer of IYAE**, I want the residual review findings resolved (metric consistency, honest validation claims, de-duplicated geometry code, accessible delete flows, rate-limit coverage, and the missing tests), so that the size-recommendation and 3D-validation paths behave correctly under edge cases and the codebase does not carry latent traps or overstated guarantees.

## Problem → Solution
- **Chart selection uses a different metric than confidence** (raw Euclidean vs RMS) → select on RMS so the reported entry and its confidence agree.
- **`validate_glb_geometry` claims buffer-level anti-forgery it does not do** → make the docstring honest (accessor-declared, not buffer-verified) and, optionally, add a bounded buffer sample check.
- **Triangle counting assumes `TRIANGLES` mode and is copy-pasted in two files** → one shared helper that also handles primitive `mode`.
- **Two-step delete confirm is not accessible** → move focus + announce via `aria-live`.
- **New endpoints unrated-limited, delete purges active tasks, `basis` is a bare string, size_chart uncapped** → close the LOW gaps.
- **Highest-risk new branches are untested** → add the missing server/worker/web tests.

## Metadata
- **Complexity**: Large (cross-module, ~20 files incl. tests, ~1 new shared module + 1 new enum + 1 new worker test file)
- **Source PRD**: N/A (driven by review artifact `.claude/PRPs/reviews/pr-8-review.md`)
- **PRD Phase**: Phase 4 Virtual Fitting (Full 3D) + Fit/Size — post-review hardening
- **Estimated Files**: 20 (7 server, 8 worker, 3 web, 3 docs)
- **Branch**: `worktree-iyae-phase4-prp-plan` (continues PR #8; commit fixes here, do not open a new PR — same worktree)

---

## UX Design

### Before (delete confirm — M10)
```
Delete body data
[ Delete my avatar & body data ]     ← tap
        │
        ▼  (button is replaced in place)
[ Cancel ] [ Confirm delete ]        ← focus is now on <body>;
                                        SR announces nothing; keyboard
                                        user is one blind Enter from
                                        an irreversible purge
```

### After (delete confirm — M10)
```
Delete body data
[ Delete my avatar & body data ]     ← tap
        │
        ▼  region has aria-live="polite"
[ Cancel ] [ Confirm delete ]        ← focus MOVES to "Cancel";
   ▲focus                              SR announces the Cancel/Confirm
                                        pair; Esc/blur path unchanged
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Enter confirm mode (ProfileSettingsDialog) | Focus lost to body | Focus on "Cancel"; region announced | `aria-live="polite"` wrapper |
| Enter confirm mode (avatar page) | Focus lost to body | Focus on "Cancel"; region announced | Same pattern |
| Delete button during avatar generation | Enabled (L5) | Disabled while `isGenerating` | avatar page only |
| Everything else (server/worker) | — | — | Internal — no user-facing change |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/reviews/pr-8-review.md` | all | Canonical description of every finding being closed |
| P0 | `server/src/main/java/com/iyae/service/SizeRecommendationService.java` | 116–166 | M2 metric fix + L6 enum + L7 cap all live here |
| P0 | `worker/validator.py` | 118–211 | M3 docstring + M6 mode + M7 extraction target |
| P0 | `worker/providers/meshy_generator.py` | 14–105, 200–241 | M7 duplicate to extract + L2 download cap |
| P0 | `web/components/profile/ProfileSettingsDialog.tsx` | 102–145, 410–451 | M10 focus/aria-live; existing `[open]` reset effect |
| P0 | `web/app/profile/avatar/page.tsx` | 183–184, 214–, 448–484 | M10 + L5; delete state + isGenerating |
| P1 | `server/src/main/java/com/iyae/config/RateLimitFilter.java` | 20–66 | L1 — RULES list + matcher (prefix-only today) |
| P1 | `server/src/main/java/com/iyae/service/AvatarService.java` | 126–144 | L3 — deleteAvatarData task purge |
| P1 | `worker/main.py` | rigging task flow | L4 — where to wire (or document skipping) `validate_glb_geometry` |
| P1 | `server/src/test/java/com/iyae/service/SizeRecommendationServiceTest.java` | all | M2 + M11 server tests mirror this fixture style |
| P1 | `web/__tests__/components/ProfileSettingsDialog.test.tsx` | all | M11 web tests extend this file |
| P2 | `server/src/main/java/com/iyae/dto/SizeRecommendationResponse.java` | all | L6 — DTO `basis` field (keep JSON string) |
| P2 | `server/src/main/java/com/iyae/entity/Product.java` | 53–54 | L7 — `size_chart` JSON column |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| glTF primitive `mode` | glTF 2.0 spec §3.7.2 (`mesh.primitive.mode`) | `4`=TRIANGLES (default when absent), `5`=TRIANGLE_STRIP, `6`=TRIANGLE_FAN, `0`=POINTS, `1`=LINES, `2`=LINE_LOOP, `3`=LINE_STRIP. Triangles = strips/fans give `count-2`; points/lines give 0 |
| `pygltflib` primitive attrs | already used in repo | `prim.mode` is `Optional[int]` (None ⇒ TRIANGLES); `prim.indices`, `prim.attributes.POSITION` are accessor indices |
| WAI-ARIA live regions | WAI-ARIA APG | `aria-live="polite"` announces content changes; moving focus to the new "Cancel" both announces and prevents a blind confirm |

No external network research needed — all patterns are established in-repo.

---

## Patterns to Mirror

### SERVICE_METRIC (server, M2)
```java
// SOURCE: SizeRecommendationService.java:123-166 (current — raw distance select, RMS confidence)
SizeChartEntry best = null;
double bestDistance = Double.MAX_VALUE;
int bestDimCount = 0;
for (SizeChartEntry entry : chart) {
    double sumSq = 0.0; int n = 0;
    for (Map.Entry<String, Double> dim : userDims.entrySet()) {
        Double chartVal = entry.dims().get(dim.getKey());
        if (chartVal != null) { double diff = dim.getValue() - chartVal; sumSq += diff*diff; n++; }
    }
    if (n == 0) continue;
    double distance = Math.sqrt(sumSq);          // ← raw distance
    if (distance < bestDistance) { bestDistance = distance; best = entry; bestDimCount = n; }
}
...
double rms = bestDistance / Math.sqrt(bestDimCount);   // ← RMS only at the end
```

### ENUM_CONSTANTS (server, L6 — mirror existing enum style)
```java
// SOURCE: server/src/main/java/com/iyae/entity/enums/ProductStatus.java (pattern)
public enum ProductStatus { DRAFT, PUBLISHED, ARCHIVED }
```

### RATE_RULE (server, L1)
```java
// SOURCE: RateLimitFilter.java:20-30
private record RateRule(String method, String pathPrefix, int maxRequests, long windowMs) {}
private static final List<RateRule> RULES = List.of(
        new RateRule("POST", "/api/auth/login", 5, 60_000),
        ...
        new RateRule("POST", "/api/public/avatar/generate", 3, 60_000)
);
// matcher (line 51-53): (method null || method==req.method) && path.startsWith(pathPrefix)
```

### GEOMETRY_TRAVERSAL (worker, M6/M7 — the block duplicated in both files)
```python
# SOURCE: validator.py:152-178  ≈  meshy_generator.py:42-61
for mesh in (gltf.meshes or []):
    for prim in (mesh.primitives or []):
        attrs = prim.attributes
        pos = getattr(attrs, "POSITION", None) if attrs else None
        idx = prim.indices
        if idx is not None and not (0 <= idx < len(accessors)):   # M5 (done)
            result["errors"].append(...)
        if idx is not None and 0 <= idx < len(accessors):
            triangle_count += accessors[idx].count // 3           # M6: assumes TRIANGLES
        elif pos is not None and 0 <= pos < len(accessors):
            triangle_count += accessors[pos].count // 3
        if pos is not None and 0 <= pos < len(accessors):
            acc = accessors[pos]
            if acc.min and acc.max and len(acc.min) >= 3 and len(acc.max) >= 3:
                bounds_found = True
                for i in range(3):
                    mins[i] = min(mins[i], float(acc.min[i]))
                    maxs[i] = max(maxs[i], float(acc.max[i]))
```

### PYGLTFLIB_LAZY_IMPORT (worker — every geometry fn lazy-imports)
```python
# SOURCE: validator.py:135, 259, 318 ; meshy_generator.py:33
def validate_glb_geometry(file_path: str) -> dict:
    from pygltflib import GLTF2      # lazy import inside the function body
```

### TEST_FIXTURE_SERVICE (server tests, M2/M11)
```java
// SOURCE: SizeRecommendationServiceTest.java:49-83 — product() builder + when(...) stubbing
private Product product(String category, String sizes, String sizeChart) {
    return Product.builder().id(100L).name("Test Product").category(category)
            .sizes(sizes).sizeChart(sizeChart).status(ProductStatus.PUBLISHED).build();
}
when(productRepository.findById(100L)).thenReturn(Optional.of(product));
when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(profile));
```

### TEST_VALIDATOR (worker tests, M6/M11 — build a real GLB with pygltflib)
```python
# SOURCE: worker/tests/test_validator.py :: TestValidateGlbGeometry (7 tests exist)
# Mirror how those tests construct a minimal GLB (POSITION accessor with min/max,
# index accessor with count) and assert on validate_glb_geometry(path)["triangle_count"].
```

### TEST_DELETE_FLOW (web tests, M11)
```tsx
// SOURCE: web/__tests__/components/ProfileSettingsDialog.test.tsx:1-33 — mock sonner + @/lib/api
vi.mock("@/lib/api", () => ({ ...
  avatar: { delete: vi.fn().mockResolvedValue({}) }, ApiError }));
// enter confirm mode: fireEvent.click(screen.findByRole("button",{name:/delete my avatar & body data/i}))
```

---

## Files to Change

| File | Action | Finding | Justification |
|---|---|---|---|
| `server/.../service/SizeRecommendationService.java` | UPDATE | M2, L6, L7 | RMS selection; use `SizeRecommendationBasis`; cap chart entries |
| `server/.../entity/enums/SizeRecommendationBasis.java` | CREATE | L6 | Typed basis (MEASUREMENT_CHART/SELF_REPORTED/NONE) |
| `server/.../config/RateLimitFilter.java` | UPDATE | L1 | Add DELETE `/api/avatar` + recommended-size rule (needs suffix match) |
| `server/.../service/AvatarService.java` | UPDATE | L3 | Document/log active-task purge on delete |
| `server/.../service/SizeRecommendationServiceTest.java` | UPDATE | M2, M11 | RMS-vs-raw case; malformed/empty chart; tie-break |
| `server/.../config/RateLimitFilterTest.java` | UPDATE | L1 | Rule coverage for new matchers |
| `server/.../service/AvatarServiceTest.java` | UPDATE | L3 | Assert active tasks handled as documented |
| `worker/glb_geometry.py` | CREATE | M7 (+M3,M6) | Single `compute_glb_geometry_stats()`; mode-aware |
| `worker/validator.py` | UPDATE | M3, M6, M7 | Honest docstring; call shared helper |
| `worker/providers/meshy_generator.py` | UPDATE | M6, M7, L2 | Call shared helper; cap GLB download |
| `worker/main.py` | UPDATE | L4 | Wire (or explicitly document) geometry check on rigging path |
| `worker/tests/test_glb_geometry.py` | CREATE | M7, M6, M11 | Unit-test the shared helper directly |
| `worker/tests/test_validator.py` | UPDATE | M6, M11 | mode handling; multi-mesh bbox union |
| `worker/tests/test_meshy_generator.py` | UPDATE | M6, L2, M11 | trimesh fallback success; download cap |
| `web/components/profile/ProfileSettingsDialog.tsx` | UPDATE | M10 | Focus Cancel + aria-live on confirm |
| `web/app/profile/avatar/page.tsx` | UPDATE | M10, L5 | Same a11y; disable Delete while generating |
| `web/__tests__/components/ProfileSettingsDialog.test.tsx` | UPDATE | M11 | confirm/cancel, failure toast, focus, aria-live |
| `server/CLAUDE.md` | UPDATE | docs | basis enum, rate-limit rows, test counts |
| `worker/CLAUDE.md` | UPDATE | docs | Honest `validate_glb_geometry` wording, shared helper, test counts |
| `web/CLAUDE.md` | UPDATE | docs | a11y note on delete flow, test counts |

## NOT Building
- Buffer-level cryptographic GLB verification (M3): the primary fix is an **honest docstring**. Full byte-decode of POSITION/index buffers is documented as an OPTIONAL deeper task (Task 3b) but is **out of default scope** — the threat actor is a lying/MITM provider, not an end user.
- Any designer-facing `size_chart` authoring UI (L7 only adds a defensive parse cap; no write path).
- Distributed/shared rate-limit store (L1 stays in-memory `ConcurrentHashMap`).
- Refactor of `validate_glb`, `validate_rigged_glb`, or the SMPL-X / rigging pipelines beyond what L4 requires.
- New product endpoints, DTO shape changes visible to the web client (JSON for `basis` stays a plain string).

---

## Step-by-Step Tasks

### Task 1 — M2: select chart entry on RMS, not raw distance (server)
- **ACTION**: In `SizeRecommendationService.recommendFromChart` track the best entry by RMS.
- **IMPLEMENT**: Replace `bestDistance`/`Math.sqrt(sumSq)` selection with per-entry RMS: inside the loop compute `double rms = Math.sqrt(sumSq / n);` and compare `if (rms < bestRms)`. Rename `bestDistance`→`bestRms`, drop the later `double rms = bestDistance / Math.sqrt(bestDimCount);` (line 161) and use `bestRms` directly in the confidence formula. `bestDimCount` becomes unused once RMS is tracked — remove it.
- **MIRROR**: SERVICE_METRIC pattern above.
- **IMPORTS**: none new.
- **GOTCHA**: Preserve tie-break behavior — keep strict `<` so the **first** entry wins on ties (document this in a comment; M11 adds a test). `n==0` entries still `continue`.
- **VALIDATE**: `cd server && ./gradlew test --tests SizeRecommendationServiceTest --rerun-tasks` green; existing `recommend_measurementChart_picksNearestSize` still returns "M".

### Task 2 — L6: introduce `SizeRecommendationBasis` enum (server)
- **ACTION**: Create `entity/enums/SizeRecommendationBasis.java` with `MEASUREMENT_CHART, SELF_REPORTED, NONE`.
- **IMPLEMENT**: Replace the three `private static final String BASIS_*` constants (lines 42–44) with the enum; populate the DTO via `basis.name()` so the JSON contract is byte-identical. Keep `SizeRecommendationResponse.basis` typed as `String` (no web contract change).
- **MIRROR**: ENUM_CONSTANTS pattern.
- **IMPORTS**: `import com.iyae.entity.enums.SizeRecommendationBasis;`
- **GOTCHA**: Do **not** change the DTO field type — a Jackson enum would still serialize to the same string, but keeping `String` guarantees zero risk to `web/lib/api.ts` `SizeRecommendationResponse` typing.
- **VALIDATE**: gradle compile + `SizeRecommendationServiceTest` assertions on `result.basis()` (still `"MEASUREMENT_CHART"` etc.) pass unchanged.

### Task 3 — M3: honest `validate_glb_geometry` docstring (worker)
- **ACTION**: Rewrite the docstring at `validator.py:118-134` and the mirror at `meshy_generator.py:14-28` to state the truth: geometry is read from **accessor-declared** `min`/`max`/`count` in the glTF JSON chunk, which is provider-controlled and **not cross-checked against `bufferView`/`buffer` bytes**.
- **IMPLEMENT**: Remove the "so a provider that reports fabricated triangle_count/bbox cannot slip a malformed GLB past validation" sentence; replace with: catches a provider that reports metadata **inconsistent with its own declared accessors**, and note the buffer-decode limitation explicitly. Update `worker/CLAUDE.md` "Independent GLB Geometry Validation" wording to match.
- **MIRROR**: existing docstring voice.
- **IMPORTS**: none.
- **GOTCHA**: This is a claim-accuracy fix — **no behavior change**, so no test should break. Do not weaken the existing threshold gating.
- **VALIDATE**: `cd worker && pytest tests/test_validator.py` unchanged-green; grep the file for the removed sentence returns nothing.

### Task 3b — M3 (OPTIONAL, deeper): bounded buffer sample check
- **ACTION**: Only if explicitly requested — add an opt-in sample decode of a few POSITION/index bytes to confirm declared `count`/bounds.
- **IMPLEMENT**: In the shared helper (Task 4), read the first/last element of the POSITION `bufferView` slice and assert it falls within declared `min`/`max`; treat mismatch as a validation error.
- **GOTCHA**: Guard against `byteLength:0` buffers and sparse accessors; keep it bounded (never decode the whole buffer). Left OUT of default scope.
- **VALIDATE**: new test in `test_glb_geometry.py` — a GLB with `buffers:[{byteLength:0}]` + hand-set bounds is rejected.

### Task 4 — M7 + M6: extract mode-aware `compute_glb_geometry_stats()` (worker)
- **ACTION**: Create `worker/glb_geometry.py` with one function that both `validator.py` and `meshy_generator.py` call.
- **IMPLEMENT**:
  ```python
  # worker/glb_geometry.py
  import math
  def compute_glb_geometry_stats(gltf) -> dict:
      """Traverse an already-loaded pygltflib GLTF2 and return geometry stats.
      Returns {triangle_count:int, mins:list[3], maxs:list[3], bounds_found:bool, errors:list[str]}.
      Reads ACCESSOR-DECLARED counts/min/max only (no buffer decode). Mode-aware:
      TRIANGLES/None -> count//3, TRIANGLE_STRIP/FAN -> max(0,count-2), POINTS/LINES -> 0.
      """
      accessors = gltf.accessors or []
      triangle_count = 0
      mins = [math.inf]*3; maxs = [-math.inf]*3; bounds_found = False
      errors: list[str] = []
      for mesh in (gltf.meshes or []):
          for prim in (mesh.primitives or []):
              attrs = prim.attributes
              pos = getattr(attrs, "POSITION", None) if attrs else None
              idx = prim.indices
              mode = prim.mode if prim.mode is not None else 4   # default TRIANGLES
              if idx is not None and not (0 <= idx < len(accessors)):
                  errors.append(f"indices accessor index {idx} out of range [0, {len(accessors)})")
              if pos is not None and not (0 <= pos < len(accessors)):
                  errors.append(f"POSITION accessor index {pos} out of range [0, {len(accessors)})")
              count = None
              if idx is not None and 0 <= idx < len(accessors):
                  count = accessors[idx].count
              elif pos is not None and 0 <= pos < len(accessors):
                  count = accessors[pos].count
              if count is not None:
                  triangle_count += _tris_for_mode(mode, count)
              if pos is not None and 0 <= pos < len(accessors):
                  acc = accessors[pos]
                  if acc.min and acc.max and len(acc.min) >= 3 and len(acc.max) >= 3:
                      bounds_found = True
                      for i in range(3):
                          mins[i] = min(mins[i], float(acc.min[i]))
                          maxs[i] = max(maxs[i], float(acc.max[i]))
      return {"triangle_count": triangle_count, "mins": mins, "maxs": maxs,
              "bounds_found": bounds_found, "errors": errors}

  def _tris_for_mode(mode: int, count: int) -> int:
      if mode in (0, 1, 2, 3):        # POINTS, LINES, LINE_LOOP, LINE_STRIP
          return 0
      if mode in (5, 6):              # TRIANGLE_STRIP, TRIANGLE_FAN
          return max(0, count - 2)
      return count // 3               # 4 TRIANGLES (and None default)
  ```
  Then: `validator.validate_glb_geometry` loads the GLB, calls `compute_glb_geometry_stats(gltf)`, appends the helper's `errors`, applies `MAX_TRIANGLE_COUNT` + bbox thresholds on `mins`/`maxs`. `meshy_generator._compute_glb_metadata` calls the same helper for its Tier-1 path (keeping its trimesh Tier-2 fallback and its own return shape `{triangle_count, bbox, has_nan}`).
- **MIRROR**: GEOMETRY_TRAVERSAL + PYGLTFLIB_LAZY_IMPORT (each caller lazy-imports `GLTF2`, then passes the loaded object into the pure helper — the helper needs no pygltflib import).
- **IMPORTS**: `from glb_geometry import compute_glb_geometry_stats` (both callers). Worker runs with CWD on `sys.path`, matching existing `from providers.canonical_skeleton import ...` style — verify import resolves (module at repo `worker/` root, like `validator.py`).
- **GOTCHA**: M5's out-of-range guard is already applied in both files — after extraction it must live **only** in the helper; delete the inline copies. `meshy_generator` previously **silently skipped** out-of-range (no error append) while `validator` **appended** an error — unify on append-error; meshy still degrades to `None` on any exception, so appended errors are simply ignored by meshy's path (it does not gate). Preserve meshy's "any exception ⇒ None/None/False" contract.
- **VALIDATE**: `cd worker && pytest tests/test_validator.py tests/test_meshy_generator.py tests/test_glb_geometry.py` green.

### Task 5 — M6/M7/M11 worker tests
- **ACTION**: Add `test_glb_geometry.py`; extend `test_validator.py` and `test_meshy_generator.py`.
- **IMPLEMENT**:
  - `test_glb_geometry.py`: TRIANGLES count//3; TRIANGLE_STRIP/FAN ⇒ count-2; LINES/POINTS ⇒ 0; multi-mesh bbox union (two meshes → min/max spans both); negative/out-of-range index ⇒ error; empty geometry ⇒ zero + no bounds.
  - `test_validator.py`: `validate_glb_geometry` on a LINE-mode primitive does **not** inflate `triangle_count`; multi-mesh union bbox.
  - `test_meshy_generator.py`: `_compute_glb_metadata` uses trimesh Tier-2 when accessor bounds are absent and returns real tri/bbox (mock `trimesh.load`); download cap test (Task 8).
- **MIRROR**: TEST_VALIDATOR pattern (construct real GLBs with pygltflib as the existing `TestValidateGlbGeometry` does).
- **GOTCHA**: Some geometry tests need `pygltflib` (already a base dep). trimesh-fallback test must mock `trimesh` (heavy/optional) — follow existing meshy test mocking.
- **VALIDATE**: worker suite green; new counts reflected in `worker/CLAUDE.md`.

### Task 6 — M10: accessible delete confirm (web, both components)
- **ACTION**: On entering confirm mode, move focus to "Cancel" and wrap the Cancel/Confirm pair in an `aria-live="polite"` region — in **both** `ProfileSettingsDialog.tsx` and `app/profile/avatar/page.tsx`.
- **IMPLEMENT**:
  - Add `useRef` to the import from `"react"`.
  - `const cancelDeleteRef = useRef<HTMLButtonElement>(null);`
  - `useEffect(() => { if (confirmingDelete) cancelDeleteRef.current?.focus(); }, [confirmingDelete]);`
  - Attach `ref={cancelDeleteRef}` to the Cancel `<Button>`.
  - Wrap the `confirmingDelete ? (...) : (...)` ternary's confirm branch container with `aria-live="polite"` (the `<div className="flex gap-2">` at ProfileSettingsDialog:418 / avatar page:459).
- **MIRROR**: existing button group markup (ProfileSettingsDialog.tsx:417-451).
- **IMPORTS**: `import { useState, useCallback, useEffect, useRef } from "react";` (ProfileSettingsDialog); `import { useState, useEffect, useRef } from "react";` (avatar page).
- **GOTCHA**: shadcn `<Button>` forwards `ref` (Radix Slot) — `ref` on `<Button>` lands on the underlying `<button>`. The effect must depend on `confirmingDelete` only. Do not focus on mount (guard with `if (confirmingDelete)`).
- **VALIDATE**: `cd web && npx tsc --noEmit` clean for these files; M11 test asserts focus + `aria-live`.

### Task 7 — L5: disable Delete during avatar generation (web, avatar page)
- **ACTION**: Disable the non-confirm "Delete" trigger while `isGenerating`.
- **IMPLEMENT**: On the `<Button ... onClick={() => setConfirmingDelete(true)}>` (avatar page ~481) add `disabled={isGenerating}`. `isGenerating` is already in scope (line 264).
- **MIRROR**: `disabled={!hasProfile || statusLoading}` on the Generate button (avatar page:~431).
- **GOTCHA**: Only the avatar page has `isGenerating`; ProfileSettingsDialog has no generation state — leave it unchanged.
- **VALIDATE**: `tsc` clean; manual — Delete is greyed while a task is PENDING/RUNNING.

### Task 8 — L2: cap Meshy GLB download size (worker)
- **ACTION**: Bound the GLB (and USDZ) download in `meshy_generator.generate`.
- **IMPLEMENT**: Add `MAX_GLB_BYTES = 100 * 1024 * 1024` module constant. Use `requests.get(glb_url, timeout=60, stream=True)`; if `Content-Length` present and over the cap, raise `RuntimeError`; otherwise accumulate chunks and abort once bytes exceed the cap. Apply the same to the USDZ download.
- **MIRROR**: existing `requests.get(...).raise_for_status()` flow (meshy_generator.py:202-205).
- **IMPORTS**: none new.
- **GOTCHA**: `len(glb_resp.content)` is used later for `glb_size_bytes` (line 235) — when streaming, capture the accumulated byte length instead. Keep `raise_for_status()`.
- **VALIDATE**: new `test_meshy_generator.py` test — a mocked response with oversized `Content-Length` raises; a normal one still writes the file.

### Task 9 — L1: rate-limit new authed endpoints (server)
- **ACTION**: Add rules for `DELETE /api/avatar` and `GET /api/products/*/recommended-size`.
- **IMPLEMENT**:
  - `DELETE /api/avatar` is cleanly matchable by method+prefix (POST `/api/avatar/generate`, GET `/api/avatar/status` are different methods): `new RateRule("DELETE", "/api/avatar", 10, 60_000)`.
  - `recommended-size` cannot be isolated by prefix (would catch catalog + detail). Extend `RateRule` with a nullable `pathSuffix` and add to the matcher `&& (rule.pathSuffix()==null || path.endsWith(rule.pathSuffix()))`; then `new RateRule("GET", "/api/products/", "/recommended-size", 30, 60_000)`. Update `BucketKey` to include the suffix (or the full effective key) to avoid bucket collision with any future `/api/products/` rule.
- **MIRROR**: RATE_RULE pattern.
- **GOTCHA**: L1 is **optional** per the review — if the `pathSuffix` extension is judged too invasive, ship only the `DELETE /api/avatar` rule and note recommended-size as intentionally unlimited (authenticated + cheap). Whichever is chosen, keep `RateLimitFilterTest` in sync.
- **VALIDATE**: `./gradlew test --tests RateLimitFilterTest --rerun-tasks` green; add a test that the recommended-size suffix rule does **not** throttle plain `/api/products` catalog GETs.

### Task 10 — L3: document/log active-task purge on delete (server)
- **ACTION**: Make `AvatarService.deleteAvatarData` transparent about PENDING/RUNNING tasks.
- **IMPLEMENT**: Before `deleteAll(tasks)`, count tasks in `PENDING`/`RUNNING` and `log.info("Deleting avatar data for user {} incl. {} active task(s)", userId, activeCount)`. Add a Javadoc line stating that in-flight worker results are intentionally discarded (the row is deleted; the worker's later UPDATE affects 0 rows) to prevent a completed task from resurrecting `avatarGlbUrl` after a privacy delete.
- **MIRROR**: existing `log.info("Deleted avatar data for user {}", ...)` (AvatarService:143).
- **GOTCHA**: Do **not** switch to skip-active (that would leave an orphan task that later repopulates `avatarGlbUrl` because the User still exists) — deleting active rows is the correct privacy behavior; this task only makes it explicit.
- **VALIDATE**: `AvatarServiceTest` — a profile with a PENDING task still deletes all tasks; assert log/behavior. gradle green.

### Task 11 — L7: cap `size_chart` cardinality at parse time (server)
- **ACTION**: Guard `SizeRecommendationService.parseSizeChart` against pathological arrays.
- **IMPLEMENT**: Add `private static final int MAX_CHART_ENTRIES = 50;`; stop adding entries past the cap and `log.warn` once. Add a comment that `size_chart` measurement values are centimetres (unit contract) pending an authoring UI.
- **MIRROR**: existing `parseSizeChart` try/catch + `log.warn` (SizeRecommendationService:222-251).
- **GOTCHA**: Not reachable via any write path today (no designer authoring UI) — this is purely defensive. Keep the existing "non-array ⇒ empty list" behavior.
- **VALIDATE**: `SizeRecommendationServiceTest` — a 60-entry chart parses at most 50; malformed JSON still yields `NONE`.

### Task 12 — L4: geometry validation on the rigging path (worker)
- **ACTION**: Either wire `validate_glb_geometry` into the rigging success path in `main.py`, or document the deliberate exemption.
- **IMPLEMENT**: Read `main.py` rigging flow (after `validate_rigged_glb`). Preferred: add a `validate_glb_geometry(rigged_glb_path)` call and fail the task on errors, matching the model/avatar paths. If rigged GLB geometry legitimately differs (e.g., pose-baked bounds outside 0.01–10 m), instead add a comment in `main.py` + a `worker/CLAUDE.md` note explaining why rigging is exempt.
- **MIRROR**: how model/avatar paths call `validate_glb` → `validate_glb_geometry` → `validate_metadata` (worker CLAUDE.md "How It Works" steps 6–8).
- **GOTCHA**: Rigged bboxes are A-pose garment meshes — confirm they fall within thresholds before enabling the hard gate, else it will spuriously FAIL rigging tasks. When unsure, choose the documentation route (LOW severity).
- **VALIDATE**: worker suite green; if wired, a rigging test asserting an oversized rigged GLB FAILs.

### Task 13 — M11: fill server/web test gaps
- **ACTION**: Add the remaining tests called out in M11.
- **IMPLEMENT**:
  - `SizeRecommendationServiceTest`: (a) malformed `size_chart` JSON ⇒ falls through to Tier-2/`NONE`; (b) empty `size_chart` `"[]"` ⇒ Tier-2; (c) tie-break — two entries equidistant, assert the **first** wins (documents strict `<`); (d) M2 — a chart where raw-distance and RMS would pick **different** entries (entries with differing comparable-dim counts), assert the RMS winner.
  - `ProfileSettingsDialog.test.tsx`: (a) Cancel returns to non-confirm; (b) Confirm calls `avatar.delete()` then toasts success + `onUserRefresh`; (c) `avatar.delete` rejects ⇒ error toast, stays usable; (d) focus moves to Cancel on confirm (M10); (e) confirm region has `aria-live` (M10).
- **MIRROR**: TEST_FIXTURE_SERVICE, TEST_DELETE_FLOW.
- **GOTCHA**: For the M2 test, craft a chart where one entry matches on 1 dim with small raw distance but another matches on 3 dims with smaller **RMS** — this is the only case that distinguishes the two metrics.
- **VALIDATE**: `./gradlew test --tests SizeRecommendationServiceTest` + `cd web && npx vitest run __tests__/components/ProfileSettingsDialog.test.tsx` green.

### Task 14 — Docs sync (all three CLAUDE.md)
- **ACTION**: Update module docs to match reality.
- **IMPLEMENT**: server (basis enum, +rate-limit rows, test counts), worker (honest `validate_glb_geometry` wording, new `glb_geometry.py`, mode handling, test counts + new file), web (delete-flow a11y note, test counts). Add a Changelog row to each dated `2026-09-05` (per repo convention; do not invent a future date).
- **MIRROR**: existing Changelog table rows.
- **GOTCHA**: `Date.now()` is unavailable here — use the repo's current-cycle date `2026-09-05` as other recent rows do.
- **VALIDATE**: counts in each CLAUDE.md match actual `ls`/test output.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected | Edge? |
|---|---|---|---|
| M2 RMS select | chart: entry A matches 1 dim (Δ small), entry B matches 3 dims (smaller RMS) | recommends B | Yes |
| M2 tie-break | two entries equal RMS | first entry wins | Yes |
| M11 malformed chart | `size_chart="{bad json"` | basis `NONE`/Tier-2 | Yes |
| M11 empty chart | `size_chart="[]"` | Tier-2 self-reported | Yes |
| L7 cap | 60-entry chart | ≤50 parsed, warn logged | Yes |
| M6 line mode | GLB primitive `mode=1` (LINES), count 3000 | `triangle_count` unchanged (0 added) | Yes |
| M6 strip mode | `mode=5`, count 100 | +98 triangles | Yes |
| M7 multi-mesh | two meshes, disjoint bounds | bbox unions both | Yes |
| M5 (regression) | negative `indices` | validation error | Yes |
| L2 download cap | mocked `Content-Length` > 100 MB | `RuntimeError` | Yes |
| M10 focus | click Delete | focus on Cancel button | Yes |
| M10 aria-live | confirm mode | region has `aria-live="polite"` | Yes |
| M11 delete success | click Confirm | `avatar.delete()` + success toast + refresh | No |
| M11 delete failure | `avatar.delete` rejects | error toast, no crash | Yes |
| L1 recommended-size rule | 31 GETs to `/api/products/1/recommended-size` in window | 31st ⇒ 429; catalog GET unaffected | Yes |

### Edge Cases Checklist
- [ ] Empty geometry GLB (stub) still passes `validate_glb_geometry`
- [ ] `byteLength:0` buffer (only if Task 3b implemented)
- [ ] size_chart present but shares no comparable dims with user → Tier-2
- [ ] Delete during active generation (L5) → button disabled
- [ ] Reopen dialog after entering confirm (H2 regression) → non-confirm state
- [ ] Non-TRIANGLES primitive mixed with TRIANGLES in one mesh

---

## Validation Commands

### Static Analysis
```bash
cd web && npx tsc --noEmit        # EXPECT: zero errors in changed files (pre-existing non-PR errors OK)
```

### Unit Tests — per module
```bash
cd server && ./gradlew test --tests SizeRecommendationServiceTest --tests RateLimitFilterTest --tests AvatarServiceTest --rerun-tasks
cd worker && python -m pytest tests/test_validator.py tests/test_meshy_generator.py tests/test_glb_geometry.py
cd web    && npx vitest run __tests__/components/ProfileSettingsDialog.test.tsx
```
EXPECT: all pass. (Worker needs a venv with `pytest numpy trimesh pygltflib requests`; the local system python3 lacks pytest — reuse `/Users/jadyn/.claude/jobs/afea158a/tmp/wkvenv` or rebuild it.)

### Full Test Suite
```bash
cd server && ./gradlew test --rerun-tasks     # EXPECT: BUILD SUCCESSFUL, 0 failures
cd worker && python -m pytest                  # EXPECT: green (torch/smplx/igl-gated tests may skip locally)
cd web    && npm run test                       # EXPECT: PR-changed files green (useOutfitRiggingStatus.test.ts is a known env flake, unrelated)
```

### Database Validation
N/A — no schema/migration changes (L7 is parse-time only; no new column).

### Manual Validation
- [ ] Keyboard-only: Tab to "Delete my avatar & body data", Enter → focus lands on "Cancel"; screen reader announces the Cancel/Confirm pair.
- [ ] Avatar page: start generation → "Delete" button greyed (L5).
- [ ] Same product with a stale `size_chart` entry not in `sizes` still never recommends the missing size (M1 regression).

---

## Acceptance Criteria
- [ ] M2, M3, M6, M7, M10, M11 addressed; L1–L7 addressed or explicitly documented as intentionally deferred with rationale
- [ ] All validation commands pass (server BUILD SUCCESSFUL, worker green, web tsc clean + targeted vitest green)
- [ ] New tests written for every behavioral change (M2/M6/M7/M10/L2/L7 + M11 gaps)
- [ ] `validate_glb_geometry` docstring no longer overstates anti-forgery (M3)
- [ ] Geometry traversal exists in exactly one place (M7); M5/M6 fixes not duplicated
- [ ] Three CLAUDE.md files synced (counts + wording)

## Completion Checklist
- [ ] Java: Lombok/`@RequiredArgsConstructor`, records for DTOs, enum in `entity/enums/`
- [ ] Python: stdlib + lazy `pygltflib` import; connection/return-shape contracts preserved
- [ ] Web: `"use client"`, shadcn primitives untouched, semantic tokens only, `ref` via shadcn Button
- [ ] Error handling matches existing (`IllegalArgumentException`→400; worker parse failure→validation error, never crash)
- [ ] No hardcoded colors, no `stone-*`/`bg-white` (web residue gate)
- [ ] No new scope beyond the listed findings
- [ ] Commit on `worktree-iyae-phase4-prp-plan` (PR #8), do NOT open a new PR

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| M7 extraction changes worker import resolution | Med | Med | Place `glb_geometry.py` at `worker/` root (like `validator.py`); run full worker suite; keep helper pure (no pygltflib import) |
| M2 metric change shifts an existing recommendation | Low | Med | Existing `picksNearestSize` test pins "M"; uniform-dim charts (the common case) are unaffected — RMS==distance/√n monotonic there |
| L1 `pathSuffix` change touches `BucketKey` and matcher | Med | Low | It's optional; fall back to shipping only the clean `DELETE /api/avatar` rule |
| L4 hard-gating rigging FAILs valid rigged GLBs | Med | Med | Verify A-pose garment bboxes vs thresholds first; default to the documentation route |
| Worker deps unavailable locally | High | Low | Reuse the existing `wkvenv`; torch/smplx tests already skip |
| claude.ai monthly spend limit (hit in prior session) | Med | Med | Prefer direct edits + local validation over spawning many subagents/workflows |

## Notes
- **M1, M4, M5 are already fixed** (commit `e69ef87`; M5 verified present in both `validator.py:160-171` and `meshy_generator.py:51-54`). This plan does **not** touch them except where M7 consolidates the M5 guard into the shared helper.
- Recommended implementation order: server (Tasks 1,2,11,9,10 → cheap, isolated) → worker (Task 4 first, then 3/5/8/12 build on it) → web (6,7) → tests (13) interleaved per module → docs (14). Task 4 (M7 extraction) must precede the worker test/behavior tasks since it's where M6 lives.
- Everything ships into the existing PR #8 worktree branch — commit and push there; **do not** open a second PR.
