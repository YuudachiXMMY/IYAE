# Plan: PR #8 Post-Merge Hardening (H1 + M1–M9 + L1–L8)

## Summary
Close the residual findings from the **independent post-merge review** of PR #8 (Phase 4 Virtual Fitting + Fit/Size), captured in `.claude/PRPs/reviews/pr-8-review-postmerge.md`. These are a *second, fresh* set of findings that survived the earlier follow-up hardening (commit `2483d3d`, which addressed the DRAFT review `pr-8-review.md`). The centerpiece is **H1** — a triangle-count cap bypass via a negative accessor `count` in the worker's new GLB geometry validator — plus 9 MEDIUM and 8 LOW defense-in-depth / correctness / a11y / test-coverage items across worker, server, and web.

## User Story
As a **maintainer of IYAE**, I want the post-merge review findings resolved (negative-count guard, streaming download caps, honest bbox fail-closed behavior, web pre-select validation, abort-on-unmount, consistent delete guards, and the missing tests), so that the 3D-validation and size-recommendation paths cannot be bypassed by a malicious/MITM'd model provider and the web try-on surface has no latent unmount/consistency traps.

## Problem → Solution
- **Negative `accessor.count` makes `triangle_count` go negative → upper-bound-only cap passes** → clamp `count` non-negative in `_tris_for_mode` **and** add a `triangle_count < 0` check in `validate_glb_geometry`. *(H1, L2)*
- **Download cap runs after the whole body is buffered** → stream with `stream=True` + incremental byte cap over `iter_content`. *(M1)*
- **bbox/NaN check silently skipped when POSITION min/max omitted** → treat "geometry present but bounds absent" as an error (fail closed), distinct from "no geometry". *(M2)*
- **`GLTF2.load` retains the whole BIN blob per task; Tripo download uncapped** → cap Tripo downloads uniformly (streaming), matching Meshy. *(M3)*
- **Recommended size pre-selected without membership check against `product.sizes`** → validate before `setSelectedSize`. *(M5, M9)*
- **`useAvatarStatus.refresh` resolves after unmount (no AbortController)** → thread an `AbortSignal`, abort on unmount. *(M6)*
- **Delete-while-generating guard inconsistent (dialog not gated)** → gate the dialog trigger too. *(M7)*
- **`AvatarStatus` type owned by the hook, re-exported from `api.ts`** → move the canonical interface into `api.ts`. *(M8)*
- **Defense-in-depth / polish** → `size_chart` length cap at write-time note (M4), accessory→`null` category default (L1), typing/annotations (L3), optimistic UI + error-message toasts + a11y attrs (L5–L8).

## Metadata
- **Complexity**: Large (cross-module: ~6 worker, ~2 server, ~6 web incl. tests)
- **Source PRD**: N/A (driven by review artifact `.claude/PRPs/reviews/pr-8-review-postmerge.md`)
- **PRD Phase**: Phase 4 — Virtual Fitting (Full 3D) + Fit/Size — **post-merge** hardening
- **Estimated Files**: ~16 (6 worker, 2 server, 6 web, 2 docs)
- **Priority**: H1 is the only near-blocker (a new-control incompleteness); everything else is MEDIUM/LOW defense-in-depth or polish.

### Target branch / worktree — READ FIRST
PR #8 **already merged to `origin/main`** (merge commit `6608b92`, 2026-09-06). The local `main` working tree is **behind** at `1d8c33a` (the pre-branch base) and **does not contain the Phase 4 files** — do not implement there. The merged Phase 4 code (with the first round of follow-up hardening) lives at:
- `origin/main` (remote, authoritative), and
- the existing worktree `.claude/worktrees/iyae-phase4-prp-plan` @ `2483d3d` (identical file state to origin/main pre-merge-commit).

**Recommended**: create a **fresh worktree branched from `origin/main`** (`git fetch origin && git worktree add ... origin/main`) and open a **new draft PR** for this post-merge follow-up (unlike the previous round, PR #8 is closed/merged so a new PR is correct). Every line/path reference below was verified against `iyae-phase4-prp-plan@2483d3d`, which matches `origin/main`.

---

## UX Design

### Before (M5 — recommended-size pre-select)
```
Open PDP → size recommendation loads → recommendedSize written to
selectedSize UNCHECKED. If that size is not in product.sizes (casing
mismatch, or a size-chart entry not stocked), SizeSelector shows NOTHING
highlighted (case-sensitive ===) yet [Add to Cart] is enabled →
cart line carries an unstocked size.
```

### After (M5)
```
Open PDP → recommendation loads → recommendedSize applied ONLY if it is a
member of product.sizes (exact match against the same array SizeSelector
renders). Non-member → no pre-select; user picks a real size. Add-to-Cart
never carries an unstocked/mis-cased size.
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| PDP size pre-select | `setSelectedSize(prev ?? rec)` unchecked | pre-select only if `rec ∈ product.sizes` | `app/products/[id]/page.tsx:175-177` |
| Delete body data (dashboard dialog) | trigger enabled during avatar generation (M7) | trigger disabled while generating | `ProfileSettingsDialog.tsx` — mirror avatar page's `disabled={isGenerating}` |
| Delete two-step confirm (L8) | no `aria-expanded` | `aria-expanded={confirmingDelete}` on trigger | additive a11y; focus-move + `aria-live` already present |
| Worker / server internals | — | — | no user-facing change (H1, M1–M4, L1–L3) |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `worker/glb_geometry.py` | 19–99 | H1 lives at line 29 (`count // 3`, no clamp); shared helper both validator + meshy use |
| P0 | `worker/validator.py` | 118–186 | `validate_glb_geometry`: add `triangle_count < 0` (H1/L2) + bounds-absent fail-closed (M2); thresholds at lines 10–12 |
| P0 | `worker/providers/meshy_generator.py` | 17–40, 200–224 | `_enforce_download_cap` + the two `requests.get(...)` (M1: no `stream=True`) |
| P0 | `worker/providers/tripo_generator.py` | 60–80 | Uncapped `requests.get` download (M3) |
| P0 | `web/app/products/[id]/page.tsx` | 121–200, 329–340 | Pre-select effect (M5); `product.sizes` is in scope |
| P0 | `web/lib/hooks/useAvatarStatus.ts` | full (1–73) | `fetchStatus`/`refresh` no signal (M6); `AvatarStatus` interface owner (M8) |
| P1 | `web/lib/api.ts` | 1, 139–153 | Re-exports `AvatarStatus` from the hook (M8); `avatar.getStatus(signal)` already takes a signal |
| P1 | `web/components/profile/ProfileSettingsDialog.tsx` | 103–111, 216–232, 424–458 | Delete confirm; no `isGenerating` gate (M7); `confirmingDelete` for L8 |
| P1 | `web/app/profile/avatar/page.tsx` | 216–232, 228, 492 | `handleDeleteBodyData` fire-and-forget `refresh()` (M6); `disabled={isGenerating}` pattern to mirror (M7) |
| P1 | `worker/tests/test_glb_geometry.py` | 1–99 | Test pattern (SimpleNamespace fakes) to extend for H1/M2 |
| P2 | `web/__tests__/components/ProfileSettingsDialog.test.tsx` | 1–30 | Vitest + `vi.mock("@/lib/api")` pattern for new web tests (M9) |
| P2 | `server/.../service/SizeRecommendationService.java` | 48, 181–198, ~231 | `MAX_CHART_ENTRIES` (M4), `selfReportedSizeForCategory` default (L1) |

## External Documentation
No external research needed — all findings use established internal patterns. One library note:

| Topic | Source | Key Takeaway |
|---|---|---|
| `requests` streaming | internal usage | `requests.get(url, stream=True)` + `resp.iter_content(chunk_size=…)` yields bytes incrementally; accumulate length and abort past the cap. Must still `raise_for_status()` before iterating. |
| `pygltflib` | worker code | `GLTF2.load()` loads header+JSON+BIN. `accessor.count` is a plain int with **no** `≥ 0` validation → the H1 vector. |

---

## Patterns to Mirror

### CLAMP_IN_HELPER (H1)
```python
# SOURCE: worker/glb_geometry.py:25-29  (STRIP/FAN already clamps; TRIANGLES does not)
    if mode in (0, 1, 2, 3):        # points / lines contribute no triangles
        return 0
    if mode in (5, 6):              # strip / fan
        return max(0, count - 2)
    return count // 3               # 4 TRIANGLES (and the None default)  ← H1: no max(0, …)
```

### VALIDATOR_ERROR_APPEND (H1/M2 — fail closed by appending, then valid = len(errors)==0)
```python
# SOURCE: worker/validator.py:161-186
    if triangle_count > MAX_TRIANGLE_COUNT:
        result["errors"].append(
            f"triangle_count {triangle_count} exceeds limit of {MAX_TRIANGLE_COUNT}"
        )
    if stats["bounds_found"]:
        # ... bbox NaN/dim checks ...
    result["valid"] = len(result["errors"]) == 0
    return result
```

### DOWNLOAD_CAP (M1/M3 — extend to streaming)
```python
# SOURCE: worker/providers/meshy_generator.py:207-211  (buffers whole body BEFORE cap)
        glb_resp = requests.get(glb_url, timeout=60)
        glb_resp.raise_for_status()
        _enforce_download_cap(glb_resp, glb_url)   # Content-Length + resp.content only
        with open(glb_path, "wb") as f:
            f.write(glb_resp.content)
```

### WEB_ABORT_ON_UNMOUNT (M6 — the api layer already accepts a signal)
```typescript
// SOURCE: web/lib/api.ts:152  avatar.getStatus already threads a signal
  getStatus: (signal?: AbortSignal) => api.get<AvatarStatus>("/api/avatar/status", { signal }),
// and PDP already does the effect-scoped AbortController correctly (page.tsx effect):
//   const ac = new AbortController(); ...; return () => ac.abort();
```

### WEB_TEST_MOCK (M9)
```typescript
// SOURCE: web/__tests__/components/ProfileSettingsDialog.test.tsx:1-30
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/api", () => ({ api: { get: vi.fn().mockResolvedValue({}), post: vi.fn() }, /* … */ }));
```

### WORKER_TEST_FAKE (H1/M2)
```python
# SOURCE: worker/tests/test_glb_geometry.py:6-9
from types import SimpleNamespace
from glb_geometry import compute_glb_geometry_stats, _tris_for_mode
# Build gltf = SimpleNamespace(accessors=[SimpleNamespace(count=…, min=…, max=…)],
#                              meshes=[SimpleNamespace(primitives=[SimpleNamespace(
#                                 attributes=SimpleNamespace(POSITION=0), indices=0, mode=4)])])
```

---

## Files to Change

| File | Action | Findings |
|---|---|---|
| `worker/glb_geometry.py` | UPDATE | H1 — clamp `count` in `_tris_for_mode` (or guard at call site) |
| `worker/validator.py` | UPDATE | H1/L2 — `triangle_count < 0` check; M2 — bounds-absent fail-closed |
| `worker/providers/meshy_generator.py` | UPDATE | M1 — streaming cap (GLB + USDZ) |
| `worker/providers/tripo_generator.py` | UPDATE | M3 — streaming cap on GLB download |
| `worker/tests/test_glb_geometry.py` | UPDATE | H1 test (negative count), M2-adjacent |
| `worker/tests/test_validator.py` | UPDATE | H1 (`triangle_count < 0` rejected), M2 (geometry-present-no-bounds fails) |
| `web/app/products/[id]/page.tsx` | UPDATE | M5 — membership check before `setSelectedSize` |
| `web/lib/hooks/useAvatarStatus.ts` | UPDATE | M6 — thread `AbortSignal`; M8 — import `AvatarStatus` from `api.ts` |
| `web/lib/api.ts` | UPDATE | M8 — define canonical `AvatarStatus` here |
| `web/components/profile/ProfileSettingsDialog.tsx` | UPDATE | M7 — gate trigger while generating; L8 — `aria-expanded` |
| `web/app/profile/avatar/page.tsx` | UPDATE | M6 — abort `refresh()` on unmount; L5 — optimistic clear; L6 — surface `ApiError.message` |
| `web/__tests__/components/*` (new PDP + OutfitCard test) | CREATE/UPDATE | M9 — pre-select membership + try-on abort smoke test |
| `server/.../service/SizeRecommendationService.java` | UPDATE | L1 — accessory/bag/jewelry → `null` (not `topSize`); M4 note |
| `worker/CLAUDE.md`, `web/CLAUDE.md` | UPDATE | Changelog rows (H1, streaming caps, M5/M6/M7/M8) |

## NOT Building
- **M4 write-time `size_chart` length enforcement beyond the current parse cap** — no write path/DTO field for `size_chart` exists today (grep-confirmed: not attacker-reachable). Leave a `// TODO(size-chart-authoring)` at the parse cap; enforce when authoring lands. Do **not** invent a write endpoint.
- **M3 buffer-level anti-forgery (decoding bufferView bytes)** — explicitly out of scope; the honest-docstring stance (already shipped) stays. Only the download **cap** is in scope.
- Any new avatar/size **features**, provider integrations, or schema/migration changes.
- Re-raising the earlier DRAFT review's H1/H2 — verified fixed in merged code; not in scope.
- Backporting Phase 4 to local `main` — orthogonal; work off `origin/main`.

---

## Step-by-Step Tasks

### Task 1: H1 — clamp negative accessor count (worker)
- **ACTION**: Guard the TRIANGLES branch of `_tris_for_mode` and add a lower-bound check in the validator.
- **IMPLEMENT**:
  - `worker/glb_geometry.py:29` → `return max(0, count) // 3` (mirrors the STRIP/FAN clamp on line 28). This makes every branch non-negative, so the aggregate `triangle_count` can never be dragged negative by a crafted `count = -2_100_000`.
  - `worker/validator.py` (after the `triangle_count > MAX_TRIANGLE_COUNT` block, ~line 163) → add:
    ```python
    if triangle_count < 0:
        result["errors"].append(f"triangle_count {triangle_count} is negative")
    ```
    (Belt-and-suspenders in case any future caller bypasses the helper; addresses L2 too.)
- **MIRROR**: CLAMP_IN_HELPER, VALIDATOR_ERROR_APPEND.
- **IMPORTS**: none new.
- **GOTCHA**: Fix the **helper**, not just the validator — `meshy_generator._compute_glb_metadata` reuses `compute_glb_geometry_stats`, so both defense layers must be closed at the source. Do not touch the STRIP/FAN line (already correct).
- **VALIDATE**: `cd worker && pytest tests/test_glb_geometry.py tests/test_validator.py` (after Task 2 adds cases).

### Task 2: H1/M2 — negative-count + bounds-absent tests (worker)
- **ACTION**: Add regression tests.
- **IMPLEMENT**:
  - In `test_glb_geometry.py`: a primitive with `accessors[i].count = -2_100_000`, mode 4 → assert `stats["triangle_count"] >= 0` (specifically `== 0` for that primitive). Add a multi-primitive case (A `count=2_000_000`, B `count=-2_100_000`) → assert aggregate `>= 0`.
  - In `test_validator.py`: (a) craft stats yielding a negative aggregate (or monkeypatch `compute_glb_geometry_stats` to return `{"triangle_count": -33334, "bounds_found": False, ...}`) → assert `valid is False`; (b) M2: `triangle_count > 0` **and** `bounds_found is False` → assert `valid is False` with a "bounds absent" error.
- **MIRROR**: WORKER_TEST_FAKE (SimpleNamespace).
- **IMPORTS**: `from types import SimpleNamespace`.
- **GOTCHA**: `pygltflib`/`torch`/`igl` may be absent locally — the geometry tests use fakes and do **not** import them; keep it that way (the review env ran H1 in a scratch venv only).
- **VALIDATE**: both files pass; the negative-count test **fails before** Task 1's clamp and passes after.

### Task 3: M2 — fail closed when geometry present but bounds absent (worker)
- **ACTION**: In `validate_glb_geometry`, distinguish "no geometry at all" (pass — the stub empty-scene GLB) from "geometry present, bounds omitted" (fail).
- **IMPLEMENT**: replace the `if stats["bounds_found"]:` block guard so that when `not stats["bounds_found"]` **and** `triangle_count > 0`, append an error like `"geometry present but POSITION min/max bounds absent — cannot validate bbox"`. Keep the empty-scene case (`triangle_count == 0`, no bounds) passing.
- **MIRROR**: VALIDATOR_ERROR_APPEND.
- **GOTCHA**: The stub GLB (`stub_generator`) is an empty scene → `triangle_count == 0`, `bounds_found == False`; it must still pass. Gate the new error on `triangle_count > 0`.
- **VALIDATE**: `pytest tests/test_validator.py`; confirm the stub-GLB "empty geometry passes" test is unaffected.

### Task 4: M1 — streaming download cap for Meshy (worker)
- **ACTION**: Stream the GLB and USDZ downloads and enforce the byte cap incrementally.
- **IMPLEMENT**: For both `requests.get(...)` sites (`meshy_generator.py:207` GLB, `:219` USDZ): pass `stream=True`, `raise_for_status()`, then still short-circuit on the `Content-Length` header, and write via `iter_content(chunk_size=1<<20)` accumulating a running total; raise the existing `RuntimeError` (same message shape as `_enforce_download_cap`) once the total exceeds `MAX_DOWNLOAD_BYTES`. Either extend `_enforce_download_cap` with a streaming variant (e.g. `_stream_to_file_capped(resp, path, url)`) or inline. Preserve the header short-circuit so an honest oversized `Content-Length` fails before any bytes are written.
- **MIRROR**: DOWNLOAD_CAP.
- **IMPORTS**: none new.
- **GOTCHA**: With `stream=True`, `resp.content` is **not** pre-buffered — do not call it. Existing tests mock `requests.get` returning an object with `.content`/`.headers`; if you add a streaming helper, keep `_enforce_download_cap` intact so the current 4 L2 tests still pass, and add a streaming test with a fake `iter_content`.
- **VALIDATE**: `pytest tests/test_meshy_generator.py`.

### Task 5: M3 — cap Tripo download (worker)
- **ACTION**: Apply the same streaming cap to `TripoGenerator`'s uncapped GLB download.
- **IMPLEMENT**: `tripo_generator.py:69` → reuse the streaming helper from Task 4 (import from `providers.meshy_generator` or, cleaner, lift the streaming cap into a shared spot — but keep scope small: importing the helper is acceptable and mirrors how `glb_geometry` is shared). `stream=True` + incremental cap.
- **MIRROR**: DOWNLOAD_CAP.
- **GOTCHA**: Tripo has no USDZ path — GLB only. Do not add `_compute_glb_metadata` here (Tripo already returns provider metadata; out of scope).
- **VALIDATE**: `pytest tests/` (worker); no Tripo download test exists — add a minimal one mirroring the Meshy streaming test if cheap, else note it in the report.

### Task 6: M8 — move canonical `AvatarStatus` into `api.ts` (web)
- **ACTION**: Invert the type ownership so `api.ts` defines `AvatarStatus` and the hook imports it.
- **IMPLEMENT**: cut the `export interface AvatarStatus {…}` (`useAvatarStatus.ts:5-10`) into `web/lib/api.ts` (near the other response types, ~line 139); in `useAvatarStatus.ts` add `import type { AvatarStatus } from "../api";` and drop the local definition; delete the re-export shim `export type { AvatarStatus };` (`api.ts:140-142`) since it now originates here.
- **MIRROR**: existing api.ts response-type placement.
- **GOTCHA**: Both files import from each other today (`api.ts:1` imports from the hook). After the move, the hook imports from `api.ts` only — verify no circular-import type error. Update any other importers of `AvatarStatus` (grep first: `rg "AvatarStatus" web/`).
- **VALIDATE**: `cd web && npx tsc --noEmit` → zero **new** errors in changed files.

### Task 7: M6 — abort `useAvatarStatus.refresh` on unmount (web)
- **ACTION**: Thread an `AbortSignal` into the status fetch and abort on unmount.
- **IMPLEMENT**: change `fetchStatus` to accept `(opts?: { silent?: boolean; signal?: AbortSignal })`, pass `signal` into `avatar.getStatus(signal)` (already supported — `api.ts:152`); in the mount effect create an `AbortController`, pass its signal, and `return () => ac.abort()`; swallow `AbortError` (do not `setStatus(null)` on abort). At the `handleDeleteBodyData` call site (`avatar/page.tsx:228`), the fire-and-forget `refresh()` should also be unmount-safe — either guard with a `mountedRef` or route through the aborted controller.
- **MIRROR**: WEB_ABORT_ON_UNMOUNT; the PDP effect's `new AbortController()` + `return () => ac.abort()` pattern.
- **GOTCHA**: The 5s poll effect (`useAvatarStatus.ts:35-40`) also calls `fetchStatus` — give it its own controller/cleanup so aborting one doesn't kill the other. Resolve-after-unmount `setStatus` is a silent no-op in React 19 but a real gap now that `refresh` is public.
- **VALIDATE**: `tsc --noEmit`; `vitest` for the hook if a test exists; add mount/unmount abort assertion (Task 11).

### Task 8: M5 — validate recommended size against `product.sizes` (web)
- **ACTION**: Only pre-select the recommended size if it is a member of `product.sizes`.
- **IMPLEMENT**: `page.tsx:175-177` → before `setSelectedSize`, guard: `if (rec.recommendedSize && product.sizes?.includes(rec.recommendedSize)) { setSelectedSize(prev => prev ?? rec.recommendedSize); }`. Prefer `rec.availableSizes` if the DTO exposes it (verify `SizeRecommendationResponse` shape) — otherwise `product.sizes`.
- **MIRROR**: `product.sizes` is already used to render `SizeSelector` (`page.tsx:339`), so the membership test uses the exact same source of truth (`===` casing).
- **GOTCHA**: Keep `prev ?? …` so a user's manual pick is never overwritten by a later recommendation resolve. `product.sizes` may be `undefined` for one-size items — use optional chaining and skip pre-select.
- **VALIDATE**: `tsc --noEmit`; new PDP test (Task 11).

### Task 9: M7 + L8 — consistent delete-while-generating guard + a11y (web)
- **ACTION**: Gate the dashboard dialog's delete trigger while avatar generation is in flight, matching the avatar page.
- **IMPLEMENT**: In `ProfileSettingsDialog.tsx`, obtain generating state (call `useAvatarStatus()` and derive `isGenerating = status?.status === "PENDING" || status?.status === "RUNNING"`, mirroring `avatar/page.tsx`) and add `disabled={isGenerating || deletingData}` to the delete trigger (line ~442). L8: add `aria-expanded={confirmingDelete}` to the two-step trigger button. (Optionally also enforce server-side in `DELETE /api/avatar` — out of scope unless trivial.)
- **MIRROR**: `avatar/page.tsx:492` `disabled={isGenerating}`.
- **GOTCHA**: `ProfileSettingsDialog` does **not** currently call `useAvatarStatus` — adding it triggers an extra `/api/avatar/status` fetch on mount; acceptable (the dialog is user-opened), but confirm it does not double-poll with the page. Focus-move + `aria-live` already exist (do not regress them).
- **VALIDATE**: `tsc --noEmit`; `vitest __tests__/components/ProfileSettingsDialog.test.tsx`.

### Task 10: L1 / L5 / L6 — server category default + web polish (server + web)
- **ACTION**: Small correctness/UX fixes.
- **IMPLEMENT**:
  - **L1** `SizeRecommendationService.selfReportedSizeForCategory` (`:181-198`): unrecognized categories (accessory/bag/jewelry) currently fall through to `topSize` — return `null` instead so the caller emits a proper "no recommendation" response.
  - **L5** `handleDeleteBodyData` (`avatar/page.tsx:216-232`): optimistically clear `avatarStatus`/local avatar state **before** awaiting `refresh()` so no brief stale "Ready"/3D shows after the success toast.
  - **L6** delete-failure toasts (`avatar/page.tsx:229`, `ProfileSettingsDialog.tsx`): surface `err instanceof ApiError ? err.message : <generic>` instead of a flat generic string.
  - **M4 note**: add `// TODO(size-chart-authoring): enforce array length at write time` at the `MAX_CHART_ENTRIES` parse cap.
- **MIRROR**: ApiError message extraction pattern already used in `useAvatarStatus.generate` (`useAvatarStatus.ts:48-52`).
- **GOTCHA**: L1 — confirm the caller of `selfReportedSizeForCategory` handles `null` (returns a NONE/EMPTY basis response) rather than NPE-ing. Check `SizeRecommendationService:103-115`.
- **VALIDATE**: `cd server && ./gradlew test`; `tsc --noEmit`.

### Task 11: M9 — pre-select + try-on abort tests (web)
- **ACTION**: Add the missing web tests.
- **IMPLEMENT**:
  - PDP pre-select test: render the products page (or extract the effect into a testable unit) with a `recommendedSize` **not** in `product.sizes` → assert `selectedSize` stays null / Add-to-Cart uses no unstocked size; and the happy path (member → pre-selected).
  - `OutfitCard` try-on mount/unmount + abort smoke test: mount, trigger lazy try-on, unmount → assert the fetch is aborted (spy on `AbortController.prototype.abort` or the api call's signal).
- **MIRROR**: WEB_TEST_MOCK (`vi.mock("@/lib/api")`), existing `RecommendedSizeHint.test.tsx` / `ProfileSettingsDialog.test.tsx`.
- **GOTCHA**: The PDP page is `"use client"` with several effects — mock `@/lib/api` (`getRecommendedSize`, product fetch) and `next/navigation`. If full-page render is brittle, test the membership predicate as an extracted pure helper.
- **VALIDATE**: `cd web && npm run test`.

### Task 12: Docs sync
- **ACTION**: Record the changes.
- **IMPLEMENT**: Add one Changelog row each to `worker/CLAUDE.md` (H1 negative-count guard + streaming download caps for Meshy & Tripo + M2 bounds-absent fail-closed) and `web/CLAUDE.md` (M5 pre-select validation, M6 abort, M7 delete guard, M8 type ownership). Follow the existing terse changelog style; counts are approximate per repo convention.
- **VALIDATE**: none (docs).

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `_tris_for_mode` negative | `_tris_for_mode(4, -2_100_000)` | `0` (clamped) | Yes (H1) |
| aggregate negative | primitives count `+2_000_000` & `-2_100_000` | aggregate `>= 0` | Yes (H1) |
| validator negative count | stats with `triangle_count = -33334` | `valid False`, "negative" error | Yes (H1) |
| validator bounds absent | `triangle_count > 0`, `bounds_found False` | `valid False`, "bounds absent" error | Yes (M2) |
| validator empty scene | `triangle_count == 0`, no bounds | `valid True` | Yes (M2 boundary) |
| meshy streaming cap | fake `iter_content` exceeding 100 MB | `RuntimeError`, no full buffer | Yes (M1) |
| tripo streaming cap | oversized fake response | `RuntimeError` | Yes (M3) |
| PDP pre-select non-member | `recommendedSize ∉ product.sizes` | `selectedSize` unchanged | Yes (M5) |
| PDP pre-select member | `recommendedSize ∈ product.sizes` | pre-selected (respecting `prev`) | No (M5 happy) |
| OutfitCard unmount abort | mount→try-on→unmount | fetch aborted | Yes (M9) |
| SizeRec accessory category | category = "bag" | NONE/empty basis (not topSize) | Yes (L1) |

### Edge Cases Checklist
- [x] Negative accessor `count` (single + multi-primitive) — H1
- [x] Geometry present, POSITION bounds omitted — M2
- [x] Empty-scene stub GLB still passes — M2 boundary
- [x] Chunked / lying `Content-Length` body — M1/M3
- [x] Recommended size not in `product.sizes` / casing mismatch — M5
- [x] Component unmount mid-fetch — M6/M9
- [x] Delete during in-flight generation from dashboard — M7
- [ ] Concurrent access — N/A (worker is per-task; web is single-user)
- [x] Permission denied — unchanged (ownership already covered)

---

## Validation Commands

### Static Analysis
```bash
cd web && npx tsc --noEmit
```
EXPECT: Zero **new** type errors in changed files (pre-existing non-PR errors in `useGenerationStatus.test.ts` / `e2e/checkout-flow.spec.ts` may remain — they are environmental per the review).

### Unit Tests — worker
```bash
cd worker && pytest tests/test_glb_geometry.py tests/test_validator.py tests/test_meshy_generator.py -q
```
EXPECT: All pass. (Full `pytest` may show pre-existing `smplx`/`igl`/`torch`-gated skips + the known `test_missing_smplx_dir_raises_rigging_error` local-env failure — unrelated.)

### Unit Tests — server
```bash
cd server && ./gradlew test
```
EXPECT: BUILD SUCCESSFUL.

### Unit Tests — web
```bash
cd web && npm run test
```
EXPECT: New geometry/pre-select/abort tests green; full suite unaffected except the pre-existing `useOutfitRiggingStatus.test.ts` fork-worker hang noted in the review.

### Manual Validation
- [ ] Craft a GLB with a negative `accessor.count` (scratch venv w/ `pygltflib`) → `validate_glb_geometry` returns `valid: False`.
- [ ] PDP with a recommendation whose size is not stocked → nothing pre-highlighted, Add-to-Cart forces a real pick.
- [ ] Open dashboard dialog while an avatar is generating → delete trigger disabled.

---

## Acceptance Criteria
- [ ] H1 closed (helper clamp + validator negative check + regression test that fails pre-fix)
- [ ] M1/M3 downloads streamed with incremental caps (Meshy GLB+USDZ, Tripo GLB)
- [ ] M2 fails closed when geometry present but bounds absent; empty scene still passes
- [ ] M5 pre-select validated against `product.sizes`
- [ ] M6 status fetch aborts on unmount
- [ ] M7 delete trigger gated during generation in both surfaces
- [ ] M8 `AvatarStatus` canonical in `api.ts`
- [ ] M9 pre-select + try-on abort tests added
- [ ] L1/L5/L6/L8 + M4 TODO applied
- [ ] All validation commands pass; no new type/lint errors
- [ ] Docs changelog rows added

## Completion Checklist
- [ ] Follows discovered patterns (clamp-in-helper, append-error, AbortController, vi.mock)
- [ ] Error handling matches codebase (append to `errors`; `ApiError.message`)
- [ ] Tests follow existing worker (SimpleNamespace) + web (vitest mock) patterns
- [ ] No hardcoded values (reuse `MAX_TRIANGLE_COUNT`, `MAX_DOWNLOAD_BYTES`)
- [ ] Docs updated; no unnecessary scope (no write-path for M4, no buffer-decode for M3)
- [ ] Self-contained — every path/line verified against `iyae-phase4-prp-plan@2483d3d` = `origin/main`

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| M8 type move creates a circular import | Low | Med | Hook imports `api.ts` one-way; `tsc --noEmit` catches it; grep all `AvatarStatus` importers first |
| Streaming refactor breaks the 4 existing L2 cap tests | Med | Low | Keep `_enforce_download_cap` intact; add a *new* streaming helper + test rather than rewriting |
| `ProfileSettingsDialog` adding `useAvatarStatus` double-polls status | Low | Low | Dialog is user-opened & short-lived; acceptable, or derive from a passed prop |
| Worker deps (`pygltflib`) absent locally → can't run some tests | High | Low | Geometry tests use `SimpleNamespace` fakes (no import); note any skipped live-repro in the report |
| Implementing on wrong tree (local `main` lacks Phase 4) | Med | High | Branch from `origin/main` in a fresh worktree; verified local `main`@`1d8c33a` has no `glb_geometry.py` |

## Notes
- This is the **second** review pass on PR #8. The first (DRAFT `pr-8-review.md`) was already remediated in `2483d3d` (old-numbered M2/M3/M6/M7/M10/M11 + L1–L7) — do not confuse the two numbering schemes. This plan targets the **post-merge** review's own numbering (H1, M1–M9, L1–L8).
- H1's caveat (from the review): **not user-reachable, not a regression** — pre-PR `triangle_count` was hardcoded `30000`. It is an incompleteness in a *new* hardening layer, exploitable only by a malicious/compromised/MITM'd provider (exactly the threat the control targets). Impact bounded to "oversized mesh passes," not compromise. Fix it because the control claims defense-in-depth it doesn't fully deliver.
- Because PR #8 is merged, ship this as a **new draft PR** off `origin/main` (not a continuation of the old branch).
