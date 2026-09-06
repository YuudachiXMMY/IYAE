# Plan: Fix all Critical / High / Medium code-review findings (phase3 + phase4)

## Summary
The `/code-review max` pass over the phase3 (weather-aware AI stylist + inline avatar try-on) and phase4 (virtual fitting full 3D + fit/size hardening + cross-brand size recommendation) feature set surfaced 1 Critical, 4 High, and 6 Medium defects. This plan fixes every one of them in a single pass, spanning the Python worker (GLB geometry), the Spring Boot server (size recommendation, avatar privacy, scheduler config, rate limiting), and the Next.js web PDP.

## User Story
As a shopper (and as the platform operator), I want the 3D try-on, size-recommendation, avatar-privacy, and rate-limiting subsystems to actually work in production, so that avatars/garments render, recommended sizes are correct and consistent, a privacy delete truly erases my body scan, and legitimate chat use is never throttled.

## Problem → Solution
The production 3D pipeline is fully broken (every real SMPL-X avatar and every python-rigged garment fails validation), Meshy generation crashes on the last line, size recommendations mis-route by category / mis-case, a privacy delete leaves the avatar GLB publicly downloadable, a bad `WEATHER_CACHE_TTL` crashes startup, and the weather poll shares the AI-chat rate bucket → **all fixed at the correct depth (spec-compliant GLB, single recommendation source, on-disk file purge, floored TTL, POST-scoped chat limiter), with regression tests.**

## Metadata
- **Complexity**: Large
- **Source PRD**: N/A (free-form: "fix all Critical / High / Medium" — the code-review findings)
- **PRD Phase**: N/A (post-review hardening of phase3 + phase4)
- **Estimated Files**: ~11 source files + ~8 test files
- **Base branch / worktree**: `worktree-fix-review-crit-high-med`

---

## UX Design

Internal / correctness change for most tasks. The one user-visible change:

### Before (PDP size)
```
┌───────────────────────────────────────────┐
│ Your recommended size: M   (chart source)  │  ← hint = /recommended-size (sizeRec)
│ [ S ] [ M ] [ L ]   ← "L" pre-highlighted  │  ← preselect = product.recommendedSize (cm source)
│ Add to Cart  → adds L                      │  ← hint says M, cart gets L (two sources disagree)
└───────────────────────────────────────────┘
Also: if recommendedSize="XL" not in [S,M,L], "XL" is silently selected → unstocked size in cart.
```

### After (PDP size)
```
┌───────────────────────────────────────────┐
│ Your recommended size: M                    │  ← hint = sizeRec (single source)
│ [ S ] [·M·] [ L ]  ← "M" pre-highlighted    │  ← preselect = sizeRec, guarded ∈ product.sizes
│ Add to Cart  → adds M                       │  ← hint and cart always agree
└───────────────────────────────────────────┘
An unstocked/mis-cased recommendation never pre-selects (guard already at page.tsx:181).
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| PDP size preselect | 2 sources (`product.recommendedSize` unguarded + `sizeRec` guarded) | 1 source (`sizeRec`, guarded) | Removes review #8 + #9 |
| Chat weather poll | shares 10/min AI-chat bucket | not counted against AI-chat limit | Removes review #6 (429 on legit messages) |
| Privacy delete | DB rows purged, GLB stays downloadable | DB rows purged + GLB file removed | Removes review #4 |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `worker/providers/skinned_glb_writer.py` | 176–221 | C1 fix site — POSITION accessor lacks `min`/`max` |
| P0 | `worker/validator.py` | 173–203 | The fail-closed branch (line 192–200) C1 trips; do NOT weaken it |
| P0 | `worker/providers/meshy_generator.py` | 248–288 | H1 (`len(glb_resp.content)`), M3 (`has_nan` misses Inf) |
| P0 | `worker/glb_geometry.py` | 88–95 | M2 — NaN dropped in multi-mesh bbox union |
| P0 | `server/.../service/SizeRecommendationService.java` | 79–134, 245–295 | H2 (category), M4 (chart casing), M6 (visibility gate dup) |
| P0 | `server/.../service/AvatarService.java` | 121–157 | H3 — `deleteAvatarData` leaves GLB on disk |
| P0 | `server/.../config/SchedulerConfig.java` | 70–86 | H4 — weather TTL string-concat crash |
| P0 | `server/.../config/RateLimitFilter.java` | 23–37, 65–81 | M1 — chat rule matches any method incl. GET /weather |
| P0 | `web/app/products/[id]/page.tsx` | 124–189, 333–352 | M5 — remove line 142 (unify size source) |
| P1 | `server/.../service/ProductService.java` | 73–96, 379–393 | M6 — the duplicated visibility gate + circular-dep hazard |
| P1 | `worker/providers/smplx_provider.py` | 296–360 | Confirms real avatars ALSO use `write_skinned_glb` (C1 scope) |
| P1 | `worker/providers/smplx_stub_provider.py` | 129–167 | Stub hardcodes POSITION min/max (why stubs pass, prod fails) |
| P1 | `server/.../controller/ChatController.java` | 26–32 | `GET /api/chat/weather` exists (M1) |
| P1 | `server/.../config/WebMvcConfig.java` | 11–26 | `worker.output-dir` → `/assets/**` mapping (H3 path resolution) |
| P2 | `server/.../config/DataSeeder.java` | 157–689 | Canonical categories: Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories/Bags/Jewelry |

## External Documentation
| Topic | Source | Key Takeaway |
|---|---|---|
| glTF POSITION accessor | glTF 2.0 spec §3.6.2.1 | POSITION accessors **must** define `min`/`max`; our writer violated this — adding them is the correct fix, not weakening the validator |
| requests streaming | `requests` docs — `Response.content` after `iter_content` | Accessing `.content` after the stream is consumed raises `StreamConsumedError` (a `RuntimeError`); use the written file size instead |
| Spring `@Scheduled` | Spring Framework `@Scheduled#fixedDelayString` | Supports SpEL (`#{...}`); `fixedDelay` must be a positive long, else `IllegalStateException`/`IllegalArgumentException` at bean init |

No further external research needed — all other fixes use established internal patterns.

---

## Patterns to Mirror

### PYGLTFLIB_ACCESSOR_WITH_BOUNDS (C1)
```python
# SOURCE: worker/providers/smplx_stub_provider.py:130-138 (the stub gets this RIGHT)
{
    "bufferView": 0, "componentType": 5126, "count": 8, "type": "VEC3",
    "min": [-0.2, 0.0, -0.125],
    "max": [0.2, 1.7, 0.125],
}
# The pygltflib.Accessor equivalent takes min=/max= kwargs (lists of float).
```

### GLB_METADATA_FROM_FILE (H1)
```python
# SOURCE: worker/providers/smplx_provider.py:325 — size read from the written file, not the response
glb_size = os.path.getsize(glb_path)
```

### JAVA_SIZE_LABEL_CASE_MATCH (M4) — Tier-2 already does this correctly; Tier-1 must too
```java
// SOURCE: SizeRecommendationService.java:122-128 (Tier-2 returns the AVAILABLE-cased label)
Optional<String> match = availableSizes.stream()
        .filter(s -> s.equalsIgnoreCase(selfReported))
        .findFirst();
if (match.isPresent()) {
    return new SizeRecommendationResponse(
            match.get(),  // <-- available casing, NOT selfReported casing
            SizeRecommendationBasis.SELF_REPORTED.name(), SELF_REPORTED_CONFIDENCE, availableSizes);
}
```

### JAVA_ASSET_ROOT_INJECTION (H3)
```java
// SOURCE: WebMvcConfig.java:11-12 — the exact property + default to mirror
@Value("${worker.output-dir:/var/iyae/assets}")
private String assetRoot;
```

### JAVA_ATOMIC_FILE_IO (H3)
```java
// SOURCE: FileStorageService.java:44-55 — java.nio.file.* usage pattern (Paths.get, Files.*)
Path uploadDir = Paths.get(UPLOAD_DIR);
Files.createDirectories(uploadDir);
// (H3 uses the delete-side equivalent: Files.deleteIfExists / walk-delete)
```

### RATE_RULE_METHOD_SCOPING (M1)
```java
// SOURCE: RateLimitFilter.java:27-36 — POST-scoped rules already exist; mirror for chat
new RateRule("POST", "/api/auth/login", null, 5, 60_000),
// ...
new RateRule(null, "/api/chat/", null, 10, 60_000),   // <-- null method = ANY method (the bug)
```

### PYTEST_GLB_ROUNDTRIP (C1 test)
```python
# SOURCE: worker/tests/test_skinned_glb_writer.py (TestRoundTripGlbHeader / TestRoundTripSkinMetadata)
# writes a skinned GLB to a tmp path, reloads via pygltflib.GLTF2.load, asserts structure.
```

### MOCKITO_SERVICE_TEST (server tests)
```java
// SOURCE: server/.../SizeRecommendationServiceTest (@ExtendWith(MockitoExtension.class), @Mock repos)
// AvatarServiceTest declares a BrandProperties mock; use ReflectionTestUtils.setField for @Value fields.
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `worker/providers/skinned_glb_writer.py` | UPDATE | C1: add POSITION `min`/`max` |
| `worker/providers/meshy_generator.py` | UPDATE | H1: `os.path.getsize`; M3: `has_nan` also checks Inf |
| `worker/glb_geometry.py` | UPDATE | M2: NaN-preserving bbox union |
| `server/.../service/SizeRecommendationService.java` | UPDATE | H2: category routing; M4: Tier-1 casing; M6: delegate to guard |
| `server/.../service/AvatarService.java` | UPDATE | H3: delete GLB on privacy delete |
| `server/.../config/SchedulerConfig.java` | UPDATE | H4: floored TTL via SpEL static helper |
| `server/.../config/RateLimitFilter.java` | UPDATE | M1: scope chat rule to POST |
| `server/.../service/ProductService.java` | UPDATE | M6: delegate visibility check to guard |
| `server/.../config/ProductVisibilityGuard.java` | CREATE | M6: shared, cycle-free visibility gate |
| `web/app/products/[id]/page.tsx` | UPDATE | M5: remove line 142 (single size source) |
| `worker/tests/test_skinned_glb_writer.py` | UPDATE | C1 regression |
| `worker/tests/test_validator.py` | UPDATE | C1 regression (skinned GLB passes geometry) |
| `worker/tests/test_glb_geometry.py` | UPDATE | M2 regression |
| `worker/tests/test_meshy_generator.py` | UPDATE | H1 + M3 regression |
| `server/.../SizeRecommendationServiceTest.java` | UPDATE | H2 + M4 regression |
| `server/.../AvatarServiceTest.java` | UPDATE | H3 regression (@TempDir + ReflectionTestUtils) |
| `server/.../SchedulerConfigTest.java` | UPDATE | H4 regression (floor helper) |
| `server/.../RateLimitFilterTest.java` | UPDATE | M1 regression (GET /chat/weather not limited; POST is) |
| `server/.../ProductServiceTest.java` | VERIFY/UPDATE | M6: draft-nonowner message now uniformly "Product not found" |

## NOT Building
- **Review #11 (server computes recommendation "twice")** — `getProductById`'s `recommendForBuyer` (cm, populates `ProductResponse.recommendedSize`) and the `/recommended-size` endpoint (`recommend`, chart/self-reported) feed **different** fields/contracts and are covered by existing tests; they are not truly redundant. Out of scope (Low).
- **Review #13 (OutfitCard SLOT_LABELS/SLOT_ORDER duplication)** — Low/conventions; `outfit-slots.ts` already exports `SLOTS`/`SLOT_LABELS`. Not required by "Critical/High/Medium". (Optional cleanup — see Notes.)
- **Review #10 (stale sizing request race)** — already mitigated: `page.tsx:171/188` creates and aborts an `AbortController` on `[user, product]` change. No action.
- **Folding `product_size_measurements` (cm) into the `/recommended-size` endpoint** — would change recommendation *behavior/coverage*, not fix a bug. Documented as future work (see Notes), not built here.
- **Distributed/external rate limiter** — the in-memory limiter's cross-instance limitation is pre-existing and out of scope.

---

## Step-by-Step Tasks

### Task 1 (C1 — CRITICAL): Emit POSITION `min`/`max` in the skinned GLB writer
- **ACTION**: Add `min`/`max` to the POSITION accessor in `write_skinned_glb`.
- **IMPLEMENT**: In `worker/providers/skinned_glb_writer.py`, in the "--- 6. Build accessors ---" block (around line 212–221), compute bounds from `vertices` and pass them to the POSITION `pygltflib.Accessor`:
  ```python
  num_verts = len(vertices)
  num_faces = len(indices)
  if num_verts > 0:
      _pos = vertices.astype(np.float32)
      pos_min = _pos.min(axis=0).tolist()
      pos_max = _pos.max(axis=0).tolist()
  else:
      pos_min = pos_max = None
  accessors = [
      pygltflib.Accessor(bufferView=0, componentType=_FLOAT, count=num_verts, type="VEC3",
                         min=pos_min, max=pos_max),   # POSITION (glTF requires min/max)
      # ... NORMAL/JOINTS_0/WEIGHTS_0/indices/IBM unchanged ...
  ]
  ```
- **MIRROR**: PYGLTFLIB_ACCESSOR_WITH_BOUNDS (stub at `smplx_stub_provider.py:130-138`).
- **IMPORTS**: none new (`numpy as np` already imported).
- **GOTCHA**: This writer is used by BOTH `PythonRiggingProvider` (rigged garments) AND `SmplxProvider.generate()` (real avatars, `smplx_provider.py:312`), so the one fix unblocks the entire production 3D pipeline. Do NOT weaken `validator.py:192-200` — the file was genuinely spec-non-compliant. Guard the empty-mesh case (`num_verts == 0` → omit bounds; triangle_count is 0 so the validator's fail-closed branch is not reached).
- **VALIDATE**: `cd worker && pytest tests/test_skinned_glb_writer.py tests/test_validator.py -q`

### Task 2 (C1 test): Regression-guard the skinned GLB geometry
- **ACTION**: Add tests proving a `write_skinned_glb` output has POSITION bounds and passes `validate_glb_geometry`.
- **IMPLEMENT**:
  - `test_skinned_glb_writer.py`: new test — write a small skinned mesh, `GLTF2.load` it, assert `accessors[0].min`/`.max` are present and equal the input vertices' per-axis min/max.
  - `test_validator.py` (`TestValidateGlbGeometry`): new test — write a skinned GLB via `write_skinned_glb`, call `validate_glb_geometry(path)`, assert `result["valid"] is True` and no "bounds absent" error. (This is the exact production failure the review found.)
- **MIRROR**: PYTEST_GLB_ROUNDTRIP.
- **GOTCHA**: Build minimal valid inputs (e.g. reuse the fixture shape from existing `test_skinned_glb_writer.py` round-trip tests). Vertices must yield a bbox within `[0.01m, 10m]` per axis so the dimension check passes.
- **VALIDATE**: both tests pass and would FAIL against the pre-fix writer.

### Task 3 (H1 — HIGH): Meshy `glb_size_bytes` from the file, not the consumed stream
- **ACTION**: Replace `len(glb_resp.content)` with the on-disk size.
- **IMPLEMENT**: `worker/providers/meshy_generator.py:282`:
  ```python
  "glb_size_bytes": os.path.getsize(glb_path),
  ```
- **MIRROR**: GLB_METADATA_FROM_FILE (`smplx_provider.py:325`).
- **IMPORTS**: none (`os` already imported).
- **GOTCHA**: The GLB was downloaded with `stream=True` and consumed by `stream_to_file_capped` (`iter_content`), so `glb_resp.content` raises `StreamConsumedError` at return time — every real Meshy generation crashes here. Tests pass today only because mocks let `.content` be read.
- **VALIDATE**: `cd worker && pytest tests/test_meshy_generator.py -q`

### Task 4 (M3 — MEDIUM): Meshy Tier-2 `has_nan` must also detect Inf
- **ACTION**: Extend the trimesh-fallback NaN check to include Inf (Tier-1 already does).
- **IMPLEMENT**: `worker/providers/meshy_generator.py:149`:
  ```python
  "has_nan": bool(np.isnan(verts).any() or np.isinf(verts).any()),
  ```
- **MIRROR**: Tier-1 at `meshy_generator.py:115` (`math.isnan(v) or math.isinf(v)`).
- **GOTCHA**: `numpy` is imported locally in Tier-2 as `np` (line 127) — in scope here.
- **VALIDATE**: covered by Task 3's pytest run; add a Tier-2 payload test asserting `has_nan` True for Inf-containing vertices.

### Task 5 (M2 — MEDIUM): NaN-preserving bbox union in `compute_glb_geometry_stats`
- **ACTION**: Make the multi-mesh min/max union propagate NaN so `validator.py:178` can reject it.
- **IMPLEMENT**: `worker/glb_geometry.py`, replace lines 92–94:
  ```python
  for i in range(3):
      mn = float(acc.min[i]); mx = float(acc.max[i])
      # Python min/max silently drop NaN (min(inf, nan) -> inf), which would hide a
      # NaN-bounded mesh from the validator's NaN check. Propagate NaN explicitly.
      mins[i] = mn if math.isnan(mn) or math.isnan(mins[i]) else min(mins[i], mn)
      maxs[i] = mx if math.isnan(mx) or math.isnan(maxs[i]) else max(maxs[i], mx)
  ```
- **MIRROR**: existing loop structure (lines 90–94); `math` already imported (line 16).
- **GOTCHA**: `mins[i]` starts at `math.inf`; `min(inf, nan)` returns `inf` (drops NaN) — that's the bug. The new form makes `mn` NaN win, and keeps NaN sticky once set. Do NOT convert to numpy (keep the pure-stdlib, no-heavy-import contract of this module).
- **VALIDATE**: `cd worker && pytest tests/test_glb_geometry.py tests/test_validator.py -q`

### Task 6 (M2 test): NaN bbox in one of several meshes is rejected
- **ACTION**: Add a `test_glb_geometry.py` test with 2 primitives where one POSITION `min` contains NaN; assert `bounds_found` True and a NaN survives in `mins`, and (integration) `validate_glb_geometry` reports the NaN error.
- **VALIDATE**: fails against pre-fix union.

### Task 7 (H2 — HIGH): Correct category → self-reported-size routing
- **ACTION**: Reorder checks so more-specific categories win, and broaden synonyms, in `selfReportedSizeForCategory`.
- **IMPLEMENT**: `SizeRecommendationService.java:274-295`, rewrite the body (canonical categories are Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories/Bags/Jewelry; web fallback adds ACTIVEWEAR):
  ```java
  private String selfReportedSizeForCategory(String category, BodyProfile profile) {
      String cat = category == null ? "" : category.toLowerCase();
      // Order matters: check the most specific tokens first so a compound label like
      // "dress shoes" resolves to footwear, not dresses.
      if (cat.contains("shoe") || cat.contains("footwear") || cat.contains("boot")
              || cat.contains("sneaker")) {
          return profile.getShoeSize();
      }
      if (cat.contains("dress") || cat.contains("gown")) {
          return profile.getDressSize();
      }
      if (cat.contains("bottom") || cat.contains("pant") || cat.contains("trouser")
              || cat.contains("jean") || cat.contains("short") || cat.contains("skirt")
              || cat.contains("legging")) {
          return profile.getBottomSize();
      }
      if (cat.contains("outerwear") || cat.contains("jacket") || cat.contains("coat")
              || cat.contains("blazer") || cat.contains("hoodie")) {
          return profile.getJacketSize();
      }
      if (cat.contains("top") || cat.contains("tee") || cat.contains("shirt")
              || cat.contains("blouse") || cat.contains("sweater") || cat.contains("knit")
              || cat.contains("activewear")) {
          return profile.getTopSize();
      }
      // Accessories / Bags / Jewelry (and anything unrecognized) have no meaningful
      // self-reported size — return null so the caller emits NONE, not a wrong size (L1).
      return null;
  }
  ```
- **MIRROR**: existing method shape (the original already returned `null` for unknowns; preserve that contract).
- **GOTCHA**: The reorder (shoe before dress) is the correctness core. Keep "sweater dress"/"skirt" edge intent simple — do not over-engineer token weighting; the ordered `if` chain is the intended altitude here. `top` must stay LAST among garment checks so "tank top" etc. fall through correctly, and because "top" is a common substring.
- **VALIDATE**: `cd server && ./gradlew test --tests '*SizeRecommendationServiceTest'`

### Task 8 (M4 — MEDIUM): Tier-1 returns the available-cased size label
- **ACTION**: Return the product's own casing for a chart recommendation (matches Tier-2 + the case-sensitive frontend preselect).
- **IMPLEMENT**: `SizeRecommendationService.recommendFromChart` (lines 250–262), capture the matched available size and return it:
  ```java
  String bestSize = best.size();
  Optional<String> availMatch = availableSizes.stream()
          .filter(s -> s.equalsIgnoreCase(bestSize))
          .findFirst();
  if (availMatch.isEmpty()) {
      return null;   // chart size not offered — fall through to self-reported/NONE
  }
  double confidence = Math.max(0.0, Math.min(1.0, 1.0 - bestRms / CONFIDENCE_REFERENCE_CM));
  confidence = Math.round(confidence * 100.0) / 100.0;
  return new SizeRecommendationResponse(
          availMatch.get(),   // <-- available casing (was best.size())
          SizeRecommendationBasis.MEASUREMENT_CHART.name(), confidence, availableSizes);
  ```
- **MIRROR**: JAVA_SIZE_LABEL_CASE_MATCH (Tier-2, lines 122–128).
- **IMPORTS**: `java.util.Optional` already imported (line 26).
- **GOTCHA**: Frontend preselect is case-sensitive (`page.tsx:181` `product.sizes?.includes(size)`), so a chart label "m" against product sizes `["S","M","L"]` must come back as "M" or it never highlights. Replaces both the availability gate (lines 252–257) and the return casing in one pass — remove the now-redundant `bestIsAvailable` block.
- **VALIDATE**: `cd server && ./gradlew test --tests '*SizeRecommendationServiceTest'`

### Task 9 (H3 — HIGH): Purge the avatar GLB file on privacy delete
- **ACTION**: In `deleteAvatarData`, delete the on-disk avatar directory after the DB purge.
- **IMPLEMENT**: `AvatarService.java`:
  1. Add the asset-root field (mirror WebMvcConfig) and imports:
     ```java
     @Value("${worker.output-dir:/var/iyae/assets}")
     private String assetRoot;
     ```
     imports: `org.springframework.beans.factory.annotation.Value` (already present), `java.nio.file.*`, `java.io.IOException`, `java.util.Comparator`.
  2. At the end of `deleteAvatarData` (after `avatarTaskRepository.deleteAll`, before the final log), best-effort recursive delete of `avatars/{userId}`:
     ```java
     deleteAvatarFiles(user.getId());
     ```
     and a private helper:
     ```java
     private void deleteAvatarFiles(Long userId) {
         Path dir = Paths.get(assetRoot, "avatars", String.valueOf(userId));
         if (!Files.exists(dir)) {
             return; // idempotent — nothing generated yet
         }
         try (var paths = Files.walk(dir)) {
             paths.sorted(Comparator.reverseOrder()).forEach(p -> {
                 try {
                     Files.deleteIfExists(p);
                 } catch (IOException e) {
                     // ERROR, not swallow: a lingering body scan is a privacy issue that
                     // must be visible for manual cleanup. Do not fail the tx (DB is purged).
                     log.error("Failed to delete avatar file {} for user {}: {}", p, userId, e.getMessage());
                 }
             });
         } catch (IOException e) {
             log.error("Failed to walk avatar dir {} for user {}: {}", dir, userId, e.getMessage());
         }
     }
     ```
- **MIRROR**: JAVA_ASSET_ROOT_INJECTION (WebMvcConfig), JAVA_ATOMIC_FILE_IO (FileStorageService `java.nio.file`).
- **GOTCHA**: The worker writes `avatars/{userId}/avatar.glb` (`smplx_provider.py:311`, `smplx_stub_provider.py:237`) under `WORKER_OUTPUT_DIR`, served publicly at `/assets/avatars/{userId}/avatar.glb` (WebMvcConfig `/assets/**`). File cleanup must be **best-effort** (log ERROR, don't throw) so a failed unlink cannot roll back the committed DB purge — but must be logged loudly because it's a privacy failure. `userId` is a `Long` → no path-traversal risk. Guest avatars are never deleted through this authed path.
- **VALIDATE**: `cd server && ./gradlew test --tests '*AvatarServiceTest'`

### Task 10 (H3 test): Privacy delete removes the file
- **ACTION**: In `AvatarServiceTest`, set `assetRoot` to a `@TempDir`, create `avatars/{userId}/avatar.glb`, call `deleteAvatarData`, assert the file (and dir) are gone; plus an idempotent case (no file present → no throw).
- **IMPLEMENT**: use `org.springframework.test.util.ReflectionTestUtils.setField(avatarService, "assetRoot", tempDir.toString())`; JUnit 5 `@TempDir Path tempDir`. Mock repos as the existing delete tests do.
- **MIRROR**: MOCKITO_SERVICE_TEST (existing `AvatarServiceTest` delete cases already stub user/profile/task repos).
- **VALIDATE**: passes; fails against pre-fix service.

### Task 11 (H4 — HIGH): Floor the weather refresh interval (no startup crash)
- **ACTION**: Replace the fragile string concat with a floored SpEL expression backed by a static helper.
- **IMPLEMENT**: `SchedulerConfig.java`:
  ```java
  @Scheduled(initialDelay = 5000,
             fixedDelayString = "#{T(com.iyae.config.SchedulerConfig).weatherRefreshMs(${app.weather.cache-ttl-seconds:1800})}")
  public void refreshWeatherCache() { ... }   // body unchanged

  /** Refresh cadence in ms; floors at 1s so a 0/negative TTL cannot make @Scheduled throw. */
  public static long weatherRefreshMs(long ttlSeconds) {
      return Math.max(1L, ttlSeconds) * 1000L;
  }
  ```
- **MIRROR**: none needed (Spring SpEL idiom).
- **GOTCHA**: The old `"${app.weather.cache-ttl-seconds:1800}000"` yields `"0000"` (=0 → `IllegalArgumentException`) for `WEATHER_CACHE_TTL=0` and a `NumberFormatException` for non-numeric — both crash context init. `Math.max(1, ...)` fixes 0/negative. A **non-numeric** value is unrecoverable config (the placeholder still fails to bind to the `long` arg) and now fails fast with a clear SpEL/bind error — document in `.env.example` / CLAUDE.md that `WEATHER_CACHE_TTL` must be a positive integer.
- **VALIDATE**: `cd server && ./gradlew test --tests '*SchedulerConfigTest'`

### Task 12 (H4 test): Floor helper + context loads with TTL=0
- **ACTION**: Unit-test `SchedulerConfig.weatherRefreshMs`: `weatherRefreshMs(1800)==1_800_000`, `weatherRefreshMs(0)==1000`, `weatherRefreshMs(-5)==1000`. Optionally add a `@SpringBootTest(properties="app.weather.cache-ttl-seconds=0")` context-load smoke test asserting the context starts (the pre-fix code failed here).
- **IMPLEMENT**: extend existing `SchedulerConfigTest` for the static helper; put the context-load test there or in a small `@SpringBootTest` if the existing file is a pure Mockito unit test.
- **VALIDATE**: passes.

### Task 13 (M1 — MEDIUM): Scope the chat rate rule to POST
- **ACTION**: Change the chat `RateRule` method from `null` (any) to `"POST"` so `GET /api/chat/weather` (and other chat GETs) don't share the AI-message bucket.
- **IMPLEMENT**: `RateLimitFilter.java:32`:
  ```java
  new RateRule("POST", "/api/chat/", null, 10, 60_000),
  ```
- **MIRROR**: RATE_RULE_METHOD_SCOPING (the other rules are already method-scoped).
- **GOTCHA**: Under `/api/chat/`, only `POST /sessions` and `POST /sessions/{id}/messages` are AI-cost endpoints; `GET /weather`, `GET /sessions`, `GET /sessions/{id}/messages` should not be throttled by the AI limiter. Scoping to POST is the minimal correct fix and preserves the 10 expensive-POSTs/min protection. The `useWeather` hook polls `GET /weather`, which is what exhausted the shared bucket.
- **VALIDATE**: `cd server && ./gradlew test --tests '*RateLimitFilterTest'`

### Task 14 (M1 test): Chat GET not limited; chat POST still limited
- **ACTION**: Update `RateLimitFilterTest` — the existing "chat endpoint any-method limit" test must become "POST /api/chat/... limited after 10", plus a new "GET /api/chat/weather is never limited" case (e.g. 20 GETs all pass).
- **VALIDATE**: passes; the GET case fails against the pre-fix `null`-method rule.

### Task 15 (M5 — MEDIUM): PDP uses a single, guarded size source
- **ACTION**: Remove the unguarded `product.recommendedSize` preselect so the guarded `/recommended-size` (`sizeRec`) result is the only source for both the hint and the preselect.
- **IMPLEMENT**: `web/app/products/[id]/page.tsx` — delete line 142:
  ```ts
  // DELETE this line (unguarded + a second, disagreeing source):
  if (p.recommendedSize) setSelectedSize(p.recommendedSize);
  ```
  Keep `setSelectedImage(0)` (line 141). The `sizeRec` effect (lines 169–189) already: (a) guards on `product.sizes?.includes(size)` (line 181) and (b) drives the `RecommendedSizeHint` (line 338–339). After deletion, hint and preselect come from one source and can never disagree, and an unstocked/mis-cased size can never be selected.
- **MIRROR**: the surviving guarded preselect at `page.tsx:180-183`.
- **GOTCHA**: `product.recommendedSize` (the `ProductResponse` cm-based field) is consumed for preselect ONLY at line 142 (verified via grep: other refs are the type decl in `api.ts:182`/`ProductListItem.tsx:23`, the hint using `sizeRec`, and the guarded `sizeRec` preselect). Leave the API field intact (marketplace contract + tests). Do not touch the server. Guests are unaffected (they skip the authed `sizeRec` fetch and had no `recommendedSize` anyway).
- **VALIDATE**: `cd web && npm run lint && npm run test` (PDP page has no unit test — verify no type/lint regressions; manual + e2e below).

### Task 16 (M6 — MEDIUM): De-duplicate the product visibility gate (cycle-free)
- **ACTION**: Extract the "load product + visibility check → entity" logic into a new `@Component ProductVisibilityGuard`, and have BOTH `ProductService.getProductById` and `SizeRecommendationService.recommend` delegate to it.
- **IMPLEMENT**:
  1. CREATE `server/.../config/ProductVisibilityGuard.java` (depends only on Product/DesignerProfile/User repos — NO ProductService/SizeRecommendationService, to avoid a cycle):
     ```java
     @Component
     @RequiredArgsConstructor
     public class ProductVisibilityGuard {
         private final ProductRepository productRepository;
         private final DesignerProfileRepository designerProfileRepository;
         private final UserRepository userRepository;

         /**
          * Load a product enforcing visibility: PUBLISHED is public; non-PUBLISHED is visible
          * only to the owning designer. All other cases throw the SAME "Product not found"
          * IllegalArgumentException so a DRAFT/ARCHIVED product is indistinguishable from a
          * missing one (no existence enumeration, no designer-profile info leak).
          */
         public Product requireVisible(Long productId, String email) {
             Product product = productRepository.findById(productId)
                     .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
             if (product.getStatus() == ProductStatus.PUBLISHED) {
                 return product;
             }
             if (email == null) {
                 throw new IllegalArgumentException("Product not found: " + productId);
             }
             boolean owner = userRepository.findByEmail(email)
                     .flatMap(u -> designerProfileRepository.findByUserId(u.getId()))
                     .map(dp -> dp.getId().equals(product.getDesignerProfile().getId()))
                     .orElse(false);
             if (!owner) {
                 throw new IllegalArgumentException("Product not found: " + productId);
             }
             return product;
         }
     }
     ```
  2. `SizeRecommendationService`: inject `ProductVisibilityGuard`; replace lines 81–97 with `Product product = productVisibilityGuard.requireVisible(productId, email);` and drop the now-unused gate fields (`designerProfileRepository`, and `productRepository` only if unreferenced elsewhere). Keep `userRepository`/`bodyProfileRepository` — still used for measurements at lines 101–104, 146. Re-verify each field's remaining usage before removing it.
  3. `ProductService.getProductById`: replace lines 74–87 with `Product product = productVisibilityGuard.requireVisible(id, email);` (inject the guard; keep everything from line 89 onward).
- **MIRROR**: the SizeRecommendationService gate (lines 84–97) is the safe semantics to lift; `@Component @RequiredArgsConstructor` per server conventions.
- **GOTCHA (critical)**: `ProductService` already constructor-injects `SizeRecommendationService` (line 52). Making `SizeRecommendationService` depend on `ProductService` would be a **constructor cycle → context fails to start.** The new guard depends on neither service, breaking the cycle. Also: `getProductById`'s current non-owner path for a *buyer* calls `resolveDesignerProfile(email)` which throws **"Designer profile not found for user: {email}"** (a minor info leak + existence hint). The guard unifies this to "Product not found" — a small **security improvement**. This changes the exception *message* for the draft-nonowner-buyer case → see Task 17.
- **VALIDATE**: `cd server && ./gradlew test --tests '*ProductServiceTest' --tests '*SizeRecommendationServiceTest'`

### Task 17 (M6 test): Update visibility-gate expectations
- **ACTION**: Ensure `ProductServiceTest` draft-nonowner/draft-anon cases expect `IllegalArgumentException` with message "Product not found: {id}" (uniform), and `SizeRecommendationServiceTest` product-not-found/DRAFT cases still pass through the guard. Add a case: a buyer (no designer profile) requesting a DRAFT product gets "Product not found" (was the leaky "Designer profile not found").
- **GOTCHA**: If any existing assertion pinned the old buyer message, update it. Prefer asserting on the exception type + "Product not found" substring.
- **VALIDATE**: server test suite green.

### Task 18: Docs sync
- **ACTION**: Update `CLAUDE.md` changelog(s) and `.env.example`:
  - Root/`server/CLAUDE.md`: note the C1..M6 fixes; `WEATHER_CACHE_TTL` must be a positive integer (floored at 1s); chat rate rule now POST-scoped; `deleteAvatarData` now purges the on-disk avatar GLB; new `ProductVisibilityGuard`.
  - `worker/CLAUDE.md`: `write_skinned_glb` now emits POSITION min/max; Meshy `glb_size_bytes` from file; NaN-preserving bbox union; Tier-2 has_nan includes Inf. Update test counts.
  - `.env.example`: clarify `WEATHER_CACHE_TTL` accepts a positive integer only.
- **VALIDATE**: `git diff --stat`; counts consistent.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| skinned GLB bounds (C1) | `write_skinned_glb(verts,...)` | POSITION accessor `min`/`max` == verts bounds | — |
| skinned GLB geometry (C1) | `validate_glb_geometry(skinned.glb)` | `valid=True`, no "bounds absent" | production repro |
| meshy size (H1) | mock stream; `.content` raises | payload `glb_size_bytes == getsize(file)`, no crash | consumed stream |
| meshy Inf (M3) | verts with `+inf` (Tier-2) | `has_nan=True` | Inf ≠ NaN |
| bbox NaN union (M2) | 2 prims, one NaN min | NaN survives in `mins`; validator errors | multi-mesh |
| category routing (H2) | "Dress Shoes"→shoeSize; "Coat"→jacketSize; "Jeans"→bottomSize; "Accessories"→null | correct getter / null | ordering + synonyms |
| chart casing (M4) | chart "m", sizes `["S","M","L"]` | returns "M" | case mismatch |
| avatar file purge (H3) | tmp `avatars/7/avatar.glb` | file+dir removed; idempotent when absent | privacy |
| weather floor (H4) | `weatherRefreshMs(0)` / `(-5)` / `(1800)` | 1000 / 1000 / 1_800_000 | zero/negative |
| chat rate (M1) | 20× `GET /chat/weather` / 11× `POST /chat/...` | GETs all pass; 11th POST → 429 | method scoping |
| visibility guard (M6) | buyer → DRAFT product | `IllegalArgumentException "Product not found"` | info-leak fix |

### Edge Cases Checklist
- [x] Empty mesh (V=0) → C1 omits bounds, still valid (triangle_count 0)
- [x] `WEATHER_CACHE_TTL=0` / negative → floored, no crash
- [x] Non-numeric TTL → fails fast + documented (unrecoverable config)
- [x] Chart size not in `product.sizes` → Tier-1 returns null (falls through)
- [x] Avatar file missing on delete → idempotent no-op
- [x] Guest avatar not deleted via authed path
- [x] Circular dependency avoided (guard depends on neither service)

---

## Validation Commands

### Worker
```bash
cd worker && pytest -q
```
EXPECT: all pass (was: geometry tests would fail with the new skinned-GLB round-trip case pre-fix).

### Server (static + tests)
```bash
cd server && ./gradlew test
```
EXPECT: all pass; no context-startup failure with `app.weather.cache-ttl-seconds=0`.

### Web
```bash
cd web && npm run lint && npm run test
```
EXPECT: zero lint/type errors; existing vitest suite green (no PDP unit test to change).

### Web E2E (manual/optional — requires running stack)
```bash
cd web && npm run test:e2e   # cart + ai-stylist specs exercise size + chat paths
```

### Manual Validation
- [ ] With `RIGGING_PROVIDER=python` (or SMPL-X avatar), generate → task reaches READY (was FAILED "bounds absent").
- [ ] Meshy provider (or a mocked real GLB) → generation completes, payload has real `glb_size_bytes`.
- [ ] Authed PDP for a product with a recommendation: hint size == pre-highlighted size == added-to-cart size.
- [ ] Chat page open (weather polling) + send >10 messages worth of weather polls → chat messages still send (no 429 from weather).
- [ ] Profile → delete avatar & body data → `GET /assets/avatars/{me}/avatar.glb` returns 404.
- [ ] Boot with `WEATHER_CACHE_TTL=0` → app starts.

---

## Acceptance Criteria
- [ ] All 11 findings (C1, H1–H4, M1–M6) fixed at the depths above
- [ ] `cd worker && pytest` green; `cd server && ./gradlew test` green; `cd web && npm run lint && npm run test` green
- [ ] Each fix has a regression test that fails pre-fix
- [ ] No new type/lint errors
- [ ] No circular Spring dependency (context loads)
- [ ] Docs (CLAUDE.md ×3 + .env.example) synced

## Completion Checklist
- [ ] Code follows discovered patterns (pygltflib Accessor, java.nio.file, RateRule, Mockito+ReflectionTestUtils)
- [ ] Error handling matches codebase style (log+continue in schedulers/best-effort file IO; IllegalArgumentException for not-found)
- [ ] Logging: privacy file-delete failure logged at ERROR (visible)
- [ ] Tests mirror existing test files/patterns
- [ ] No hardcoded values (asset root via `worker.output-dir`)
- [ ] Docs updated
- [ ] No unnecessary scope additions (Lows explicitly deferred)
- [ ] Self-contained — implementable without further searching

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| M6 introduces a Spring constructor cycle | Med | High (no boot) | Guard depends on repos only, never on either service; context-load covered by suite |
| M6 changes an exception message a test pins | Med | Low | Task 17 updates assertions to type + "Product not found" substring |
| H2 synonym list mis-maps an odd category (e.g. "sweater dress") | Low | Low | Ordered specificity (shoe→dress→bottom→outerwear→top); unknown→null (safe) |
| C1 empty-mesh (V=0) min/max computation | Low | Med | Guarded: bounds only when `num_verts>0`; validator passes triangle_count 0 |
| H4 non-numeric TTL still fails at bind | Low | Low | Documented as invalid config; fails fast with clear error |
| H3 file delete fails (perms) | Low | Med (privacy) | Logged at ERROR with path; DB purge still commits; surfaced for manual cleanup |
| M5 reduces recommendation coverage (cm source no longer preselects) | Low | Low | Consistency > coverage; deeper Tier-0 merge noted as future work |

## Notes
- **Why C1 is Critical, not High**: `write_skinned_glb` is the *only* writer for both real SMPL-X avatars (`smplx_provider.py:312`) and all python-rigged garments (`python_rigging_provider`), and `validate_glb_geometry` runs on the model, avatar, AND rigging task paths (`main.py`). Every non-stub 3D artifact fails today. Unit tests pass because stub GLBs (`smplx_stub_provider.py`, `stub_generator.py`) hardcode POSITION min/max.
- **Deferred (Low, optional follow-ups)**: (a) `OutfitCard.tsx:31` should import `SLOT_LABELS`/`SLOTS` from `web/lib/outfit-slots.ts` (web CLAUDE.md: "Import Slot, SlotMap, SLOTS from lib/outfit-slots.ts, not inline constants"); (b) fold `product_size_measurements` (cm) into the `/recommended-size` endpoint as a Tier-0 so the single PDP source also uses precise garment cm — a behavior/coverage enhancement, not a bug fix.
- **Suggested task order**: worker (C1→C1test→H1→M3→M2→M2test) → server (H2→M4→H3→H3test→H4→H4test→M1→M1test→M6→M6test) → web (M5) → docs. Worker and server are independent and can be parallelized across two workstreams; M6 (touches ProductService+SizeRecommendationService) should land after H2/M4 to avoid churn in the same file.
