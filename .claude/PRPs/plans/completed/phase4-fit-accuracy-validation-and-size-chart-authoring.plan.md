# Plan: Phase 4 Completion — Fit-Accuracy Validation + Size-Chart Authoring

## Summary
Close the two explicitly-deferred remainders of Phase 4 (Virtual Fitting). **(1)** Give the author-flagged `measurements_to_betas` an actual *validated* accuracy story: a dependency-free ground-truth validation harness + a CI-checkable threshold on the already-emitted `fit_accuracy` metric (today it is emitted but never validated). **(2)** Connect the size-chart authoring UI to the PDP "your recommended size" surface — the designer measurement form already exists but writes a table (`product_size_measurements`) that the Phase-4 recommender (`SizeRecommendationService.recommend`) never reads; it only reads the write-less `size_chart` JSON column. We wire the recommender to fall back to the normalized rows so an authored size chart actually drives `MEASUREMENT_CHART` recommendations, and finish the authoring UX (labels, edit round-trip, tests).

## User Story
As a **Toronto indie designer onboarding my pieces** (and the shopper who buys them), I want **the per-size measurements I enter in the studio to actually power the "your recommended size" hint on the product page**, and as **the team shipping the fit KPI**, I want **a validated accuracy metric on the body-shape model instead of an un-checked number**, so that **recommended size is real end-to-end and the return-rate KPI rests on a measured, not assumed, fit accuracy**.

## Problem → Solution
**Current state (verified this session):**
- **Fit accuracy is observational, not validated.** `SmplxProvider.generate()` emits `fit_accuracy: {height_error_cm, betas_in_range}` (`smplx_provider.py:333-360`), but **no validator in `main.py` reads it** (avatar path runs only `validate_glb → validate_glb_geometry → validate_metadata`, `main.py:179-189`) and there is **no ground-truth dataset anywhere** in `worker/` (no `.npz/.pkl/.csv`, no `conftest.py`). `measurements_to_betas` is still a hand-authored linear map its own docstring flags as non-production (`smplx_provider.py:241-266`).
- **The size-chart authoring UI exists but is disconnected from the PDP recommender.** `web/components/ProductForm.tsx:312-348` already renders a per-size chest/waist/hips/length grid and writes `measurements: SizeMeasurement[]` to `product_size_measurements` (V12). But the PDP hint (`sizing.getRecommendedSize` → `/api/products/{id}/recommended-size` → `SizeRecommendationService.recommend`) reads the **`size_chart` JSON column** (`SizeRecommendationService.java:111`, `parseSizeChart`), which has **no write path** (two `TODO(size-chart-authoring)` markers at `SizeRecommendationService.java:60-61,341-344`). So `basis: "MEASUREMENT_CHART"` can never fire from designer input today — it silently degrades to `SELF_REPORTED`/`NONE`.

**Desired state:**
- `measurements_to_betas` has a committed ground-truth validation harness asserting height-reconstruction error within a documented threshold; `fit_accuracy` is checked against `FIT_ACCURACY_MAX_HEIGHT_ERROR_CM` (a new constant) and surfaced as a validation warning in the worker avatar path — a *validated* metric, not just an emitted one.
- A designer's authored per-size measurements drive the PDP recommender: `recommend` derives a chart from `product_size_measurements` when the `size_chart` JSON is null, so `basis: "MEASUREMENT_CHART"` fires end-to-end. The two `TODO(size-chart-authoring)` markers are retired; the authoring UX (labels, edit round-trip, client validation, tests) is finished.

## Metadata
- **Complexity**: **Large** (spans worker/server/web; ~16 files incl. tests; 3 loosely-coupled PRs)
- **Source PRD**: `.claude/PRPs/prds/iyae.prd.md`
- **PRD Phase**: Phase 4 — Virtual Fitting (Full 3D) + Fit/Size (the two deferred "future work" items)
- **Estimated Files**: ~16 (5 worker · 6 server · 5 web), incl. tests
- **Depends on**: Phase 4 core (complete, merged to `main`), Phase 5 marketplace measurements (`product_size_measurements`, V12 — present on `main`)
- **Chosen scope (owner selection this session)**: "验证 + 尺码表 UI" — fit-accuracy validation **plus** the size-chart authoring UI. Explicitly **excludes** the trained betas regressor (Measurements2SMPL) — that stays future work.

---

## Delivery Split (recommended PR boundaries)

The two workstreams share no code and land independently (each keeps the full suite green):

| PR | Workstream | Tasks | Risk |
|----|-----------|-------|------|
| PR-A | **Worker — fit-accuracy validation harness** | W1–W3 | Isolated to `worker/`; pure-Python core, no heavy deps; strong existing net (308 tests) |
| PR-B | **Server — connect authored measurements to the recommender** | S1–S3 | Behavior change to `recommend`'s Tier-1 source; additive + covered by new tests; **no migration** |
| PR-C | **Web — finish size-chart authoring UX** | F1–F3 | Relabels/validates an existing form; fills a test gap; consumes PR-B behavior |

Land order: **PR-A ∥ PR-B first, then PR-C**. PR-C's only server dependency is PR-B's recommender change (the write path already exists); it degrades gracefully.

---

## ARCHITECTURE DECISION (read before implementing)

There are **two size-data seams** in the server and they are currently disconnected. This is the single most important thing to get right.

| Seam | Column/Table | Dims | Written by | Read by |
|---|---|---|---|---|
| **A — JSON blob** | `products.size_chart` (V11, Phase 4) | `chestCm, waistCm, hipsCm, inseamCm` | **nothing** (no write path) | `SizeRecommendationService.recommend` Tier-1 (`MEASUREMENT_CHART`) → **the PDP hint** |
| **B — normalized rows** | `product_size_measurements` (V12, Phase 5) | `chest_cm, waist_cm, hips_cm, length_cm` | `ProductForm.tsx` → `CreateProductRequest.measurements` → `ProductService.replaceMeasurements` (**shipped**) | `SizeRecommendationService.recommendForBuyer` (**not called by any controller**) |

**Chosen approach (primary): unify onto the already-written rows (Seam B) via a recommender fallback — no migration, no duplicate UI.**
Make `recommend` derive chart entries from `product_size_measurements` when `products.size_chart` is null/blank. The designer form already writes Seam B; this single change makes authored measurements reach the PDP. `size_chart` JSON stays supported (takes precedence when present) so nothing regresses.

**Field-mapping note:** Seam A uses `inseamCm`; Seam B uses `length_cm`. The recommender's primary match is chest/waist/hips (the three dims both seams share and the only ones the match needs); do **not** rely on the 4th dim for the match. `CHART_DIMS` (`SizeRecommendationService.java:56-58`) already lists `chestCm/waistCm/hipsCm/inseamCm` — keep the match on the shared three.

**Alternatives considered:**
- **Alt-1 — build a net-new `size_chart` JSON authoring form** (thread `sizeChart` through both DTOs + `ProductService` + a new UI grid). **Rejected**: duplicates the shipped `measurements` UI with a parallel blob, breaks every positional `new CreateProductRequest(...)`/`new ProductResponse(...)` test literal, and needs the exact same client grid we already have. Higher cost, more surface, same user outcome.
- **Alt-2 — call `recommendForBuyer` from the controller instead of `recommend`.** Rejected: `recommend` already implements the two-tier (chart → self-reported → none) contract and the `SizeRecommendationResponse` basis the web client expects; swapping the controller entry point is a larger blast radius than a fallback inside `recommend`.

> **If the owner prefers Alt-1** (author the raw JSON blob rather than reuse normalized rows), PR-B/PR-C change shape: see "NOT Building → If Alt-1 is chosen" for the delta. The default plan below implements the primary approach.

---

## UX Design

### Before
```
Designer studio → Product form:
  [ Size measurements (cm, optional) ]   <- already exists, writes product_size_measurements
     S  [chest][waist][hips][length]
     M  [chest][waist][hips][length]
        ...saves fine, but...

Shopper → PDP:
  "Your recommended size"  <- NEVER shows MEASUREMENT_CHART from designer input
                              (recommender reads size_chart JSON, which no form writes)
                              -> silently falls back to SELF_REPORTED / hidden
```

### After
```
Designer studio → Product form:
  [ Size chart (cm, optional) ]          <- same grid, clearer label + inline validation
     S  [chest][waist][hips][length]
     M  [chest][waist][hips][length]
        -> still writes product_size_measurements

Shopper → PDP (authed, has BodyProfile):
  (check) Your recommended size: M       <- basis: MEASUREMENT_CHART, now driven by
                                            the designer's authored measurements
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Designer size grid label | "Size measurements (cm, optional)" | "Size chart (cm, optional)" + "powers your recommended size" helper | Copy/clarity only; same data path |
| Designer size grid validation | Server rejects unknown size label (`ProductService.java:246`) | Same, **plus** inline client hint before submit | Mirror server rule client-side |
| PDP recommended-size basis | `MEASUREMENT_CHART` unreachable from designer input | Fires when the product has authored measurements + buyer has a BodyProfile | Core fix |
| Worker avatar generate | `fit_accuracy` emitted, never checked | `fit_accuracy` checked vs threshold; WARN logged when exceeded | Observability → validation |

---

## Mandatory Reading

Files that MUST be read before implementing.

### Worker (PR-A)
| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `worker/providers/smplx_provider.py` | 15-32, 188-266, 268-360 | `_POPULATION_MEANS`, `BETA_MIN/MAX`, `_raw_betas`, `measurements_to_betas`, `generate` + `fit_accuracy` emission — the exact functions to validate |
| P0 | `worker/tests/test_smplx_provider.py` | 1-15, 225-239, 642-775 | Import style, `_run_generate(vertices=)` helper, existing `fit_accuracy`/betas tests to mirror |
| P1 | `worker/main.py` | 59-65, 167-195 | Avatar provider selection + task path where a `fit_accuracy` check would wire in |
| P1 | `worker/tests/test_weight_transfer.py` | 12-13, 86 | `importlib.util.find_spec` + `@pytest.mark.skipif` guard pattern for "real SMPL-X installed only" |
| P2 | `worker/CLAUDE.md` | 220-234, 254-305, 465-475 | `fit_accuracy` schema section, validator section, changelog format + test-count bookkeeping |

### Server (PR-B)
| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `server/src/main/java/com/iyae/service/SizeRecommendationService.java` | 28-49, 56-61, 110-181, 336-374 | Class javadoc (two seams), `CHART_DIMS`, `recommend`/`recommendForBuyer`/`pickBestFit`, `parseSizeChart` + the TODOs to retire |
| P0 | `server/src/main/java/com/iyae/entity/ProductSizeMeasurement.java` | all | The normalized row the fallback reads |
| P1 | `server/src/main/java/com/iyae/repository/*` | — | Find the `ProductSizeMeasurement` repository + its `findByProductId` (used by `replaceMeasurements`) |
| P1 | `server/src/test/java/com/iyae/service/SizeRecommendationServiceTest.java` | 39-41, 73-77 | `@Spy ObjectMapper`, size-chart JSON test fixtures to extend |
| P2 | `server/src/main/java/com/iyae/service/ProductService.java` | 227-263 | `replaceMeasurements` — how rows are written/validated (source of the fallback data) |

### Web (PR-C)
| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `web/components/ProductForm.tsx` | 32-119, 136-192, 312-348 | Form shape, submit, the per-size grid to relabel + validate |
| P1 | `web/app/designer/products/new/page.tsx` · `.../[id]/edit/page.tsx` | all | Create/update request bodies + edit round-trip of `measurements` |
| P1 | `web/__tests__/components/RecommendedSizeHint.test.tsx` · `SizeSelector.test.tsx` | all | vitest + Testing Library render/fireEvent style to mirror for the new `ProductForm.test.tsx` |
| P2 | `web/lib/api.ts` | 181-191, 335-341 | `sizing` helper + `SizeMeasurement` type (read contract) |

## External Documentation

No external research needed — feature uses established internal patterns only (SMPL-X betas mapping is documented in-repo; both sizing seams and all test idioms exist in the codebase).

---

## Patterns to Mirror

### WORKER — pure static numeric core (mirror for the validation scorer)
```python
# SOURCE: worker/providers/smplx_provider.py:241-266
@staticmethod
def measurements_to_betas(measurements: dict, gender: str = "neutral") -> list[float]:
    # Clamp to a safe range (near-zero neutral values are unaffected).
    return [
        max(BETA_MIN, min(BETA_MAX, b))
        for b in SmplxProvider._raw_betas(measurements, gender)
    ]
# BETA_MIN/BETA_MAX = -4.0/+4.0 (module constants, lines 29-32)
# _POPULATION_MEANS keyed by neutral/male/female (lines 15-28) = the only ground-truth-ish constants
```

### WORKER — fit_accuracy computed from a controllable mesh Y-extent (mirror in the harness)
```python
# SOURCE: worker/providers/smplx_provider.py:336-343
input_height_cm = float(measurements.get("heightCm", 170.0))
mesh_height_cm = (bbox_max[1] - bbox_min[1]) * 100.0
height_error_cm = abs(mesh_height_cm - input_height_cm)
raw_betas = self._raw_betas(measurements, gender)      # raw so betas_in_range isn't tautological
betas_in_range = all(BETA_MIN <= b <= BETA_MAX for b in raw_betas)
```

### WORKER — deterministic mesh injection in tests (mirror for harness assertions)
```python
# SOURCE: worker/tests/test_smplx_provider.py:738-750
def test_fit_accuracy_height_error_reflects_mesh_height(self, tmp_path):
    import numpy as np
    verts = np.array([[0.0,0.0,0.0],[0.1,1.60,0.1],[-0.1,0.8,-0.1]], dtype=np.float32)
    result, _, _ = self._run_generate(tmp_path, input_payload={"heightCm":160.0}, vertices=verts)
    assert result["fit_accuracy"]["height_error_cm"] == pytest.approx(0.0, abs=0.5)
    assert result["fit_accuracy"]["betas_in_range"] is True
```

### WORKER — skipif guard for "real SMPL-X only" (mirror if the harness optionally runs the real model)
```python
# SOURCE: worker/tests/test_weight_transfer.py:12-13,86
import importlib.util
_igl_available = importlib.util.find_spec("igl") is not None
@pytest.mark.skipif(not _igl_available, reason="igl not installed")
```

### SERVER — the recommender's chart parse + match seam (extend, don't replace)
```java
// SOURCE: SizeRecommendationService.java:110-111, 336-374, 56-58
private static final List<String> CHART_DIMS = List.of("chestCm","waistCm","hipsCm","inseamCm");
// Tier 1: measurement chart
List<SizeChartEntry> chart = parseSizeChart(product.getSizeChart());
// parseSizeChart(json) -> List<SizeChartEntry(size, Map<dim,Double>)>; caps at MAX_CHART_ENTRIES=50
private record SizeChartEntry(String size, Map<String, Double> dims) {}
```

### SERVER — the normalized rows to fall back to
```java
// SOURCE: ProductSizeMeasurement.java (entity) + ProductService.replaceMeasurements:239-259
// rows: {sizeLabel, chestCm, waistCm, hipsCm, lengthCm}; unique per (product_id, size_label)
// write-time rule already enforced at (ProductService.java:245-248):
if (!declaredSizes.isEmpty() && !declaredSizes.contains(label)) {
    throw new IllegalArgumentException("Measurement size '" + label + "' is not one of the product sizes: " + declaredSizes);
}
```

### SERVER — service test with a real mapper (mirror for fallback tests)
```java
// SOURCE: SizeRecommendationServiceTest.java:39-41
@Spy ObjectMapper objectMapper = new ObjectMapper();
@InjectMocks SizeRecommendationService service;   // @Mock the repositories
// existing size_chart JSON fixture to reuse for the "JSON present takes precedence" test (73-77)
```

### WEB — the per-size grid already in place (relabel + add client validation here)
```tsx
// SOURCE: web/components/ProductForm.tsx:312-348 (grid) + 111-119 (updateMeasure)
{sizeLabels.length > 0 && (
  <div className="space-y-2" role="group" aria-labelledby="pf-measure-label">
    <Label id="pf-measure-label">Size measurements (cm, optional)</Label>   {/* -> "Size chart (cm, optional)" */}
    {sizeLabels.map((label) => { /* one MeasureRow of 4 number Inputs per size */ })}
  </div>
)}
const updateMeasure = useCallback((label, field, value) =>
  setMeasures((prev) => ({ ...prev, [label]: { ...(prev[label] ?? EMPTY_ROW), [field]: value } })), []);
```

### WEB — vitest component test style (mirror for ProductForm.test.tsx)
```tsx
// SOURCE: web/__tests__/components/SizeSelector.test.tsx:1-3,27-37
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
it("calls onSubmit with measurements", () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<ProductForm mode="create" onSubmit={onSubmit} />);
  // ...fill name/price/sizes + a measurement cell, submit, assert measurements[] shape
});
```

### WEB — semantic tokens only (residue-scan gate rejects hardcoded colors)
```tsx
// SOURCE: ProductForm.tsx:383-402 — use bg-destructive/10 text-destructive, bg-brand hover:bg-brand-hover
// NEVER introduce stone-*, bg-white, bg-[#hex], purple-*, rose-* outside globals.css/components/ui
```

---

## Files to Change

### PR-A — Worker
| File | Action | Justification |
|---|---|---|
| `worker/providers/fit_accuracy.py` | CREATE | Pure, dependency-free scorer + `FIT_ACCURACY_MAX_HEIGHT_ERROR_CM` threshold + `validate_fit_accuracy(payload)` |
| `worker/tests/test_fit_accuracy.py` | CREATE | Ground-truth harness: measurement→expected-height set; threshold assertions; skipif real-SMPL-X path |
| `worker/providers/smplx_provider.py` | UPDATE | Import + use the shared threshold constant (single source of truth) in the emitted block |
| `worker/main.py` | UPDATE | Call `validate_fit_accuracy` on the avatar payload; WARN (non-fatal) when over threshold |
| `worker/CLAUDE.md` | UPDATE | Document the validated metric + threshold; changelog + test counts |

### PR-B — Server
| File | Action | Justification |
|---|---|---|
| `server/src/main/java/com/iyae/service/SizeRecommendationService.java` | UPDATE | `recommend` Tier-1 falls back to `product_size_measurements` when `size_chart` is null; retire both TODOs |
| `server/src/test/java/com/iyae/service/SizeRecommendationServiceTest.java` | UPDATE | New tests: fallback fires `MEASUREMENT_CHART`; JSON present still takes precedence; length_cm ignored in match |
| `server/CLAUDE.md` | UPDATE | Document the unified Tier-1 source; changelog + test counts |

### PR-C — Web
| File | Action | Justification |
|---|---|---|
| `web/components/ProductForm.tsx` | UPDATE | Relabel grid → "Size chart"; add inline "cleared-size drops measurements" hint; helper copy |
| `web/__tests__/components/ProductForm.test.tsx` | CREATE | Fill the coverage gap: grid renders per size, submit builds `measurements[]`, all-null rows dropped, edit round-trip |
| `web/CLAUDE.md` | UPDATE | Note the authoring→recommender connection; test counts |

## NOT Building
- **A trained betas regression model (Measurements2SMPL)** — the harness *validates and thresholds* the existing linear map and adds a real accuracy gate; training a model stays explicit future work (owner-deferred, unchanged).
- **Gating/failing avatar generation on `fit_accuracy`** — the check is a **WARN**, not a hard fail. The dev stub (`SmplxStubProvider`) emits no `fit_accuracy`; a hard gate would break dev/CI. `validate_fit_accuracy` returns `[]` (pass) when the block is absent.
- **A net-new `size_chart` JSON authoring form / DTO plumbing** — reusing the shipped normalized `measurements` UI (see ARCHITECTURE DECISION). No `sizeChart` field is added to `CreateProductRequest`/`UpdateProductRequest`/`ProductResponse`; no positional-constructor test churn.
- **A new Flyway migration** — the primary approach reads existing tables; V16 stays the latest.
- **Calling `recommendForBuyer` from a controller / removing the `size_chart` column** — kept intact and takes precedence; only a fallback is added.

> **If Alt-1 is chosen instead** (author the raw `size_chart` JSON): PR-B adds a `@Valid List<SizeChartEntryDto> sizeChart` to both request DTOs + a `sizeChart` component on `ProductResponse`, an object-serializer overload of `ProductService.toJsonString`, write-time enforcement of `MAX_CHART_ENTRIES=50`, and updates to **every** positional `new CreateProductRequest/UpdateProductRequest/ProductResponse(...)` in `DesignerProductControllerTest` + `ProductServiceTest`; PR-C adds a second grid bound to `sizeChart`. This plan does **not** implement Alt-1.

---

## Step-by-Step Tasks

### PR-A — Worker fit-accuracy validation harness

### Task W1: Extract the fit-accuracy threshold + validator
- **ACTION**: Create `worker/providers/fit_accuracy.py` with the single-source-of-truth threshold and a pure validator.
- **IMPLEMENT**:
  - `FIT_ACCURACY_MAX_HEIGHT_ERROR_CM = 5.0` (document the choice: SMPL-X neutral-shape height reconstruction from linear betas is typically within a few cm at population-typical inputs; 5 cm is a generous non-flaky ceiling — tighten once a trained regressor lands).
  - `def score_height_error(mesh_bbox_min, mesh_bbox_max, input_height_cm) -> float:` returns `abs((bbox_max[1]-bbox_min[1])*100 - input_height_cm)` (mirror `smplx_provider.py:336-343`; keep it a free function so both the provider and the harness call the same code).
  - `def validate_fit_accuracy(payload: dict) -> list[str]:` returns warning strings (empty = pass). Return `[]` when `"fit_accuracy"` is absent (stub path). Warn when `height_error_cm > FIT_ACCURACY_MAX_HEIGHT_ERROR_CM` or `betas_in_range is False`. Mirror the validator return-shape convention (`worker/validator.py` functions return lists).
- **MIRROR**: WORKER pure static numeric core; `validate_*` return-`[]`-on-pass convention.
- **IMPORTS**: none beyond stdlib.
- **GOTCHA**: Do **not** import torch/smplx/trimesh here — this module must be CI-testable with zero heavy deps (that is the whole point of extracting it).
- **VALIDATE**: `cd worker && python -c "from providers.fit_accuracy import validate_fit_accuracy, FIT_ACCURACY_MAX_HEIGHT_ERROR_CM; print(validate_fit_accuracy({}))"` → `[]`.

### Task W2: Ground-truth validation harness (tests)
- **ACTION**: Create `worker/tests/test_fit_accuracy.py` — the "validated metric" deliverable.
- **IMPLEMENT**:
  - An inline ground-truth set: a list of `(measurements_dict, expected_height_cm)` covering population-typical + edge inputs (short/tall, neutral/male/female), following the inline-dict convention (`test_smplx_provider.py:227-235`). No external fixture files (none exist; repo style is inline).
  - Tests over the **pure** path: assert `measurements_to_betas(m, gender)` stays within `[-4,4]` for all ground-truth rows; assert `betas` are near-zero at each gender's population mean (mirror `test_default_measurements_produce_near_zero_betas`).
  - Tests over `validate_fit_accuracy`: passes at `height_error_cm=0`; warns at `height_error_cm > 5.0`; warns on `betas_in_range=False`; passes (empty) when block absent.
  - **Optional real-model check** guarded by `@pytest.mark.skipif(importlib.util.find_spec("smplx") is None ...)`: if SMPL-X is installed, run `SmplxProvider.generate` on the ground-truth set and assert every `fit_accuracy.height_error_cm <= FIT_ACCURACY_MAX_HEIGHT_ERROR_CM`. Skips cleanly in this env (deps absent) — matching the 7 existing env-only skips.
- **MIRROR**: WORKER skipif guard; deterministic mesh injection (`_run_generate(vertices=)`) if exercising `generate` in the mocked path.
- **IMPORTS**: `import importlib.util, pytest`; `from providers.fit_accuracy import ...`; `from providers.smplx_provider import SmplxProvider, BETA_MIN, BETA_MAX`.
- **GOTCHA**: Flat imports (`from providers...`, not `worker.providers...`) — pytest runs with `worker/` as root. No `conftest.py` exists; don't add one.
- **VALIDATE**: `cd worker && pytest tests/test_fit_accuracy.py -q` → all pass (real-model tests skipped).

### Task W3: Wire the check into the avatar path + share the constant
- **ACTION**: Have `main.py` validate `fit_accuracy` after generation (non-fatal), and make `smplx_provider.py` use the shared threshold so there's one source of truth.
- **IMPLEMENT**:
  - In `worker/main.py` avatar path (after `output = avatar_provider.generate(...)`, `main.py:176`, alongside the existing `validate_*` calls at 179-189): `for w in validate_fit_accuracy(output): log.warning("avatar task %s fit-accuracy: %s", task_id, w)`. **Do not** raise/`fail_task` on warnings — generation still completes.
  - In `smplx_provider.py`: `from providers.fit_accuracy import FIT_ACCURACY_MAX_HEIGHT_ERROR_CM` (import for documentation/reuse; the emitted `fit_accuracy` block is unchanged in shape). Keep `_raw_betas`/`measurements_to_betas` byte-for-byte so the near-zero regression test still holds.
- **MIRROR**: `main.py:179-189` validator-call style (iterate warnings / log).
- **IMPORTS**: `from providers.fit_accuracy import validate_fit_accuracy` in `main.py`.
- **GOTCHA**: The stub provider emits no `fit_accuracy`; `validate_fit_accuracy({...no key...})` must return `[]` so stub avatars log nothing (verified in W1).
- **VALIDATE**: `cd worker && python -m py_compile main.py providers/smplx_provider.py providers/fit_accuracy.py`; full `pytest -q`.

### PR-B — Server: connect authored measurements to the recommender

### Task S1: Fallback `recommend` Tier-1 to `product_size_measurements`
- **ACTION**: In `SizeRecommendationService.recommend`, when `parseSizeChart(product.getSizeChart())` yields an empty list, derive `SizeChartEntry`s from the product's `product_size_measurements` rows.
- **IMPLEMENT**:
  - Inject the `ProductSizeMeasurement` repository (it is already used by `ProductService`; add it as a constructor dependency via `@RequiredArgsConstructor`).
  - Add `private List<SizeChartEntry> chartFromMeasurements(Long productId)`: load rows via `findByProductId`, map each to `new SizeChartEntry(row.getSizeLabel(), dims)` where `dims` puts `chestCm/waistCm/hipsCm` (optionally `inseamCm` ← `lengthCm`, but the match uses the shared three). Skip rows with all-null dims.
  - In `recommend`: `List<SizeChartEntry> chart = parseSizeChart(product.getSizeChart()); if (chart.isEmpty()) chart = chartFromMeasurements(product.getId());` — JSON `size_chart` still takes precedence when present (no regression).
  - Retire the two TODO/comment markers (`:60-61` MAX_CHART_ENTRIES javadoc, `:341-344` M4 note) — reword to reflect that a write path now exists (via normalized rows) and the 50-entry cap still bounds the JSON path.
- **MIRROR**: SERVER chart parse seam; reuse the existing match + `SizeRecommendationResponse` construction untouched.
- **IMPORTS**: the `ProductSizeMeasurement` entity + its repository (find exact package in Mandatory Reading P1).
- **GOTCHA**: Keep the match on chest/waist/hips only (Seam A `inseamCm` ≠ Seam B `length_cm` semantically). Don't let a `length_cm`→`inseamCm` mapping skew the fit score.
- **VALIDATE**: `cd server && ./gradlew test --tests '*SizeRecommendationServiceTest'`.

### Task S2: Service tests for the fallback
- **ACTION**: Extend `SizeRecommendationServiceTest`.
- **IMPLEMENT** (mirror `@Spy ObjectMapper` + `@Mock` repos, `SizeRecommendationServiceTest.java:39-41`):
  - `recommend_noSizeChartJson_usesMeasurementRows_returnsMeasurementChartBasis` — product `size_chart` null, `findByProductId` returns S/M/L rows, buyer BodyProfile near M → `basis == "MEASUREMENT_CHART"`, `recommendedSize == "M"`.
  - `recommend_sizeChartJsonPresent_takesPrecedenceOverRows` — both present, different answers → JSON wins (reuse the 73-77 fixture).
  - `recommend_measurementRowsAllNull_fallsThroughToSelfReportedOrNone` — rows exist but dims null → not `MEASUREMENT_CHART`.
- **MIRROR**: SERVER service test with a real mapper.
- **VALIDATE**: `./gradlew test --tests '*SizeRecommendationServiceTest'` green (+3).

### Task S3: Docs + test-count bookkeeping (server)
- **ACTION**: Update `server/CLAUDE.md`.
- **IMPLEMENT**: In the Phase-4/5 sizing notes, document that `recommend` Tier-1 now unifies on `product_size_measurements` when `size_chart` JSON is absent (so the shipped designer measurements UI drives the PDP hint). Bump `SizeRecommendationServiceTest` count and the server total in the test tables + changelog (mirror the existing dated-row format).
- **VALIDATE**: counts in `server/CLAUDE.md` match `./gradlew test` output.

### PR-C — Web: finish the size-chart authoring UX

### Task F1: Relabel + client-validate the size grid
- **ACTION**: In `ProductForm.tsx`, relabel the measurement grid and add an inline hint mirroring the server rule.
- **IMPLEMENT**:
  - Change the grid `<Label>` (line ~316) text to "Size chart (cm, optional)" and the helper `<p>` to "Chest · Waist · Hips · Length — powers your recommended size on the product page. Leave blank to skip." (semantic tokens only; keep `text-muted-foreground`).
  - The grid already derives rows from `sizeLabels`, so a measurement can only be entered for a declared size — the server's "label not in sizes" rejection is structurally unreachable from the UI. Add a defensive inline note near the sizes input: if a designer clears a size that has measurements, show a small `text-muted-foreground` hint that its measurements will be dropped on save (removed-label measurements are already filtered out in submit, `ProductForm.tsx:150-160`).
- **MIRROR**: WEB per-size grid; controlled `Label`+`Input` pattern (`ProductForm.tsx:203-217`); WEB semantic tokens.
- **GOTCHA**: No hardcoded colors — the residue-scan gate rejects `stone-*`/`bg-white`/`bg-[#hex]` outside the allowlist.
- **VALIDATE**: `cd web && npx tsc --noEmit` zero new errors; visual check the label renders.

### Task F2: `ProductForm.test.tsx` (fill the coverage gap)
- **ACTION**: Create `web/__tests__/components/ProductForm.test.tsx` (none exists today).
- **IMPLEMENT** (mirror `SizeSelector.test.tsx` render/fireEvent + `vi.fn()`):
  - Renders the size grid once sizes are entered (one row per label).
  - Filling a measurement cell + submitting calls `onSubmit` with `measurements` containing that size's parsed numbers.
  - A size with all-blank cells is dropped from `measurements` on submit.
  - `mode="edit"` with `initialData.measurements` pre-fills the grid (round-trip).
- **MIRROR**: WEB vitest component test style.
- **GOTCHA**: `onSubmit` must be `vi.fn().mockResolvedValue(undefined)` — submit awaits it (`ProductForm.tsx:187`).
- **VALIDATE**: `cd web && npm run test -- ProductForm` green.

### Task F3: Docs + web test-count bookkeeping
- **ACTION**: Update `web/CLAUDE.md`.
- **IMPLEMENT**: Note the authoring→recommender connection (designer measurements now drive `MEASUREMENT_CHART`); add `ProductForm.test.tsx` to the web test tables and bump counts. (Optional, out of this plan: correct the stale `iyae_token`→`clossette_token` note if you touch that section.)
- **VALIDATE**: counts match `npm run test` output.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `validate_fit_accuracy` pass | `{height_error_cm:0, betas_in_range:true}` | `[]` | — |
| `validate_fit_accuracy` warn | `{height_error_cm:9.9, betas_in_range:true}` | one warning string | ✅ over threshold |
| `validate_fit_accuracy` absent | `{}` (stub payload) | `[]` | ✅ stub path |
| betas in range over ground truth | each ground-truth measurement row | all betas ∈ [-4,4] | ✅ extreme inputs |
| real-model height error | ground-truth rows (SMPL-X installed) | `height_error_cm ≤ 5.0` | skipped when deps absent |
| `recommend` fallback | `size_chart=null` + M-ish rows + BodyProfile | `basis=MEASUREMENT_CHART`, size `M` | core |
| `recommend` precedence | JSON chart + rows disagree | JSON wins | ✅ both present |
| `recommend` null rows | rows all-null dims | not `MEASUREMENT_CHART` | ✅ degrade |
| `ProductForm` submit | fill S/M cells | `measurements` has S,M; blanks dropped | — |
| `ProductForm` edit round-trip | `initialData.measurements` | grid pre-filled | ✅ edit mode |

### Edge Cases Checklist
- [ ] Stub avatar (no `fit_accuracy`) → no warning, avatar completes
- [ ] `height_error_cm` exactly at threshold (5.0) → pass (strict `>`)
- [ ] `betas_in_range=false` but height ok → still warns
- [ ] Product with neither `size_chart` JSON nor measurement rows → `basis` `SELF_REPORTED`/`NONE`, no crash
- [ ] Buyer with no BodyProfile → recommender returns `availableSizes` + `NONE` (existing behavior preserved)
- [ ] Designer clears a size that had measurements → dropped silently on save (already filtered)
- [ ] SMPL-X not installed → real-model harness test skips (not fails)

---

## Validation Commands

### Static Analysis
```bash
cd web && npx tsc --noEmit                                  # EXPECT: zero errors in changed files
cd worker && python -m py_compile main.py providers/fit_accuracy.py providers/smplx_provider.py
```
EXPECT: Zero type/compile errors.

### Unit Tests (per workstream)
```bash
cd worker && pytest tests/test_fit_accuracy.py -q
cd server && ./gradlew test --tests '*SizeRecommendationServiceTest'
cd web && npm run test -- ProductForm
```
EXPECT: All pass (worker real-model tests skipped when SMPL-X absent).

### Full Test Suite
```bash
cd worker && pytest -q          # EXPECT: 308 + new, all green (1 pre-existing env failure + 7 skips unchanged)
cd server && ./gradlew test     # EXPECT: 349 + 3, 0 failures
cd web && npm run test          # EXPECT: 230 + new, no regressions (useOutfitRiggingStatus pre-existing hang unchanged)
```
EXPECT: No regressions vs the counts in each module's CLAUDE.md.

### Database Validation
```bash
ls server/src/main/resources/db/migration/   # EXPECT: latest still V16 — NO new migration in the primary approach
```
EXPECT: Schema unchanged (primary approach reads existing tables).

### Browser Validation (manual)
```bash
./dev.sh start   # then, as a DESIGNER, create a product with per-size measurements;
                 # as a BUYER with a BodyProfile, open that PDP
```
EXPECT: PDP shows "Your recommended size: <size>" with `basis: MEASUREMENT_CHART` (was previously unreachable).

### Manual Validation
- [ ] Designer studio → new/edit product → enter S/M/L chest·waist·hips → save; reopen edit → values round-trip
- [ ] Buyer PDP (authed, has measurements) → recommended-size hint shows `MEASUREMENT_CHART` basis
- [ ] Buyer PDP with no product measurements → hint hidden or `SELF_REPORTED` (no crash)
- [ ] Worker log (real SMPL-X env) → `fit-accuracy` WARN only when height error > 5 cm; stub avatars silent

---

## Acceptance Criteria
- [ ] All tasks completed
- [ ] All validation commands pass
- [ ] Tests written and passing (worker harness, server fallback, web ProductForm)
- [ ] No type errors; no new lint/residue-scan violations
- [ ] Matches UX: PDP `MEASUREMENT_CHART` reachable from designer input

## Completion Checklist
- [ ] Code follows discovered patterns (flat worker imports, `@Spy ObjectMapper`, WEB semantic tokens)
- [ ] Error handling matches codebase style (validator returns warning lists; non-fatal WARN in worker)
- [ ] Logging follows conventions (`log.warning` in `main.py`, `log.warn` in service)
- [ ] Tests follow existing idioms (inline ground-truth dicts; skipif guards; vitest render/fireEvent)
- [ ] No hardcoded values (threshold + colors centralized)
- [ ] Docs updated (worker/server/web CLAUDE.md + PRD Phase-4 status → can move toward complete)
- [ ] No unnecessary scope (no new migration, no DTO churn, no duplicate UI)
- [ ] Self-contained — no further codebase searching needed

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Owner actually wanted the raw `size_chart` **JSON** authoring path (Alt-1), not row reuse | M | M | ARCHITECTURE DECISION documents both; Alt-1 delta captured in NOT Building — switch is localized to PR-B/PR-C |
| `inseamCm` vs `length_cm` field mismatch skews the fit match | M | M | Match on chest/waist/hips only (shared dims); don't map length into the score |
| Chosen 5 cm threshold is too loose/tight → metric not meaningful | M | L | Documented as provisional + non-fatal WARN; tighten when a trained regressor lands |
| Changing `recommend` Tier-1 source regresses an existing `size_chart`-JSON product | L | M | JSON takes precedence when present; covered by the precedence test (S2) |
| Adding a repo dependency to `SizeRecommendationService` breaks its unit test wiring | L | L | Add as `@Mock` in the existing `@ExtendWith(MockitoExtension)` setup |

## Notes
- **Why this is the right "remaining Phase 4" slice**: Phase 4's committed scope shipped and merged; the report's only genuine engineering remainders were the fit-accuracy validation and a size-chart authoring path. The non-obvious discovery this plan captures — the designer measurement UI already exists but writes a table the PDP recommender never reads — reframes "build a size-chart UI" into "connect the seam," which is both smaller and more correct.
- **Verified-stale doc**: `web` JWT localStorage key is `clossette_token`, not `iyae_token` as CLAUDE.md states — noted for a future doc-sync, out of scope here.
- **Provider/model-path inconsistency (worker)**: `main.py:59-65` constructs `SmplxProvider` with only `output_base_dir`; `SMPLX_MODELS_PATH` is read only by `python_rigging_provider.py:205`. Not in scope, but relevant if the real-model harness test is ever run in CI.
