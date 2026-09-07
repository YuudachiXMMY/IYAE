# Plan: Phase 9 Completion — WCAG 2.1 AA Finish + KPI Loose Ends

## Summary
Phase 9 (Hardening, A11y & KPI Instrumentation) landed Units **A** (email verification), **B** (rate-limit CIDR), **D** (KPI events/cohorts slice), and **E** (checkout audit) on `main`. Unit **C** (WCAG 2.1 AA) shipped only its low-risk foundation (skip-link, `<main>` landmark, `AvatarViewer` semantics + announced load, reduced-motion, descriptive alt). This plan finishes the **deferred C2 a11y work** (focus-trap + `ARViewer`, `PoseSelector` roving-tabindex, secondary-viewer live status, form error association, automated axe scan) and closes the **two KPI loose ends** (correct the stale DESIGNER gate comment — the endpoint is already ADMIN-gated — and wire the client `analytics.track` emitter into the PDP view / add-to-cart surfaces).

## User Story
As **the IYAE founder relaunching an independent company**, I want the hero 3D/AR try-on and all forms to be fully keyboard- and screen-reader-operable and covered by an automated a11y scan, and I want product-view / add-to-cart events actually flowing into the cohort KPI pipeline, so that the relaunch clears WCAG 2.1 AA and the conversion funnel is measurable end-to-end from day one.

## Problem → Solution
**Current state (verified on `main`):**
- `web/lib/hooks/useFocusTrap.ts` **does not exist**; `ARViewer.tsx` has **no** focus trap, no Escape handler, no `role="alert"` on unsupported, and AR placement is **tap-only** (no keyboard path).
- `PoseSelector.tsx` has **no** roving-tabindex and **no** arrow-key navigation (only click + `aria-pressed`).
- `SmartARViewer.tsx`, `DemoOutfitModel.tsx`, `outfits/OutfitBuilderPreview.tsx` have **no** `role="status"` / `aria-busy` on their loading/fallback states.
- Forms (`login`, `register`, `checkout`, product PDP) render a **form-level error banner only** — no per-field `aria-invalid` / `aria-describedby` association.
- **No** `@axe-core/playwright` dependency and **no** `e2e/a11y.spec.ts`.
- `AnalyticsController.kpis()` carries a **stale comment** ("interim: DESIGNER; move to ADMIN once the Phase-5 role lands"), but `SecurityConfig:50` already routes `/api/admin/**` → `hasRole("ADMIN")`, so `/api/admin/kpis` **is already ADMIN-gated** — only the comment (and a confirming test) lag reality.
- `web/lib/api.ts` exports `analytics.track` and `web/lib/hooks/useTrackEvent.ts` exists, but **no component calls them** — PDP view and add-to-cart emit nothing (client funnel is dark; server emission for checkout/paid is authoritative and already wired).

**Desired state:** All 3D/AR viewers and the pose toolbar are keyboard-operable with announced status and a trapped, Escape-able AR overlay; invalid form fields are programmatically associated with their error text; an automated axe scan gates the key routes at serious/critical; the KPI endpoint's ADMIN gate is documented in-code and test-asserted; and the client emits advisory `VIEW` + `ADD_TO_CART` events. Green against the existing regression nets plus new tests.

## Metadata
- **Complexity**: **Medium** (one focused a11y sweep across ~8 web files + 2 KPI touch-ups; no new backend subsystem, no migration)
- **Source PRD**: `.claude/PRPs/prds/iyae.prd.md`
- **PRD Phase**: Phase 9 — Hardening, A11y & KPI Instrumentation (in-progress; A/B/D/E complete, C partial)
- **Predecessor plan**: `.claude/PRPs/plans/hardening-a11y-kpi-instrumentation.plan.md` (Units A–E) + report `.claude/PRPs/reports/hardening-a11y-kpi-instrumentation-report.md`
- **Estimated Files**: ~15 (web: 1 new hook + ~9 edits + 2 new tests + 1 new e2e + `package.json`; server: 1 edit + 1 test edit)
- **Delivery unit**: One branch, two logical groups — **C-fin** (a11y completion) and **D-fin** (KPI loose ends). Each group ends green independently.

---

## UX Design

### Before
```
┌─ AR overlay (fixed inset-0) ───────────────────────┐  Tab escapes the overlay into the
│  [tap canvas to place]  [exit ✕ (mouse only)]      │  page behind it; no Escape; no
│  <XRNotSupported> = silent <div>                    │  keyboard placement; unsupported
└─────────────────────────────────────────────────────┘  state not announced.

┌─ PoseSelector (toolbar) ───────────────────────────┐  Every button is tabbable; no arrow
│  [Stand][Walk][Warrior][Sit] … aria-pressed only    │  navigation → slow keyboard travel.
└─────────────────────────────────────────────────────┘

Forms: one error banner at top; a blind user tabbing a field never hears its specific error.
Secondary viewers: Skeleton spinners with no role → screen reader hears nothing while loading.
KPIs: server records checkout/paid; PDP views & add-to-cart emit nothing (client funnel dark).
```

### After
```
┌─ AR overlay (focus-trapped) ───────────────────────┐  Tab cycles only overlay controls;
│  [Place model ⌨/tap]  [exit ✕]  focus trapped       │  Escape exits + restores focus to
│  <XRNotSupported role="alert"> announced            │  the trigger; unsupported announced;
└─────────────────────────────────────────────────────┘  keyboard "Place model" path.

┌─ PoseSelector (APG toolbar) ───────────────────────┐  One tab stop; ←/→ move focus AND
│  [Stand][Walk*][Warrior][Sit]  roving-tabindex      │  selection (roving-tabindex).
└─────────────────────────────────────────────────────┘

Forms: invalid field gets aria-invalid + aria-describedby → error text with role="alert".
Secondary viewers: loading wrapped in role="status" aria-busy → announced.
KPIs: client emits VIEW on PDP mount + ADD_TO_CART on add; advisory alongside server funnel.
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| AR fullscreen overlay | No focus trap / Escape; tap-only place | Focus-trapped, Escape-to-exit, focus restored, keyboard "Place model" button, `role="alert"` on unsupported | `ARViewer` `fixed inset-0 z-50` |
| Pose toolbar | Each button tabbable; click-only | Roving-tabindex, `←/→` move focus+selection (APG toolbar) | `PoseSelector` |
| Secondary viewers | Silent Skeleton/fallback | `role="status"` + `aria-busy` announced loading/fallback | `SmartARViewer`, `DemoOutfitModel`, `OutfitBuilderPreview` |
| Form fields (login/register/checkout/product) | Top-level banner only | `aria-invalid` + `aria-describedby` on invalid field; error text `role="alert"` | WCAG 3.3.1 / 4.1.3 |
| A11y coverage | None automated | `@axe-core/playwright` scan on key routes (serious/critical gate) | New `e2e/a11y.spec.ts` |
| KPI endpoint | ADMIN-gated (stale comment says "interim DESIGNER") | Same enforcement, comment corrected + test asserts ADMIN 200 / DESIGNER 403 | No behavior change, locks it in |
| PDP analytics | Nothing emitted | `VIEW` on mount, `ADD_TO_CART` on add (fire-and-forget) | Advisory; server remains authoritative |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| **C-fin — accessibility** ||||
| P0 | `web/components/AvatarViewer.tsx` | 1-45, 255-275 | The **already-shipped** a11y exemplar: `useProgress` + `sr-only role="status" aria-live` + `role="img"`+`aria-label`. Mirror this exactly for the rest. |
| P0 | `web/components/ARViewer.tsx` | all | Fullscreen overlay to trap: find the exit handler, the `handleCanvasClick` placement path, the `XRNotSupported` branch, and the `pointer-events` layering |
| P0 | `web/components/PoseSelector.tsx` | all | Toolbar to extend with roving-tabindex + arrow keys; already has `role`/`aria-pressed` |
| P0 | `web/components/SizeSelector.tsx` | all | A11y exemplar (role/group/aria-pressed/44px hit area) — pattern reference |
| P1 | `web/components/SmartARViewer.tsx` | all | Router + Skeleton loader → add `role="status"`/`aria-busy` |
| P1 | `web/components/DemoOutfitModel.tsx` | all | Fallback state → `role="status"` |
| P1 | `web/components/outfits/OutfitBuilderPreview.tsx` | all | Loading/fallback → `role="status"` |
| P1 | `web/lib/hooks/usePrefersReducedMotion.ts` | all | **Already-shipped** hook shape (SSR-safe `matchMedia`) — mirror it for `useFocusTrap` conventions |
| P1 | `web/lib/hooks/useGenerationStatus.ts` | all | Hook shape (`useEffect` + cleanup) to mirror for `useFocusTrap` |
| P0 | `web/app/login/page.tsx` | 60-95 | Form-level error banner today (`error` state, `<Input>`); add per-field association |
| P1 | `web/app/register/page.tsx` | all | Multi-step form fields to associate |
| P1 | `web/app/checkout/page.tsx` | all | Any validated field error surfaces |
| P1 | `web/app/products/[id]/page.tsx` | 111-215 | `useCart` + `handleAddToCart` (`:194`) + product-load `useEffect` (`:124/151/172`) — the two client emit points; `selectedSize` + `product.id` available |
| P0 | `web/__tests__/components/SizeSelector.test.tsx` | all | The a11y-asserting Vitest pattern to replicate for a viewer/pose test |
| P1 | `web/e2e/pose-selector.spec.ts` | all | Role/`aria-pressed` e2e + the 15s viewer-mount wait; add arrow-key + host the axe scan pattern |
| P1 | `web/playwright.config.ts` | all | Confirms no auto `webServer` (a11y spec needs live dev+API — document in header) |
| **D-fin — KPI loose ends** ||||
| P0 | `server/src/main/java/com/iyae/controller/AnalyticsController.java` | 38-50 | Stale "interim DESIGNER" comment on `kpis()` to correct |
| P0 | `server/src/main/java/com/iyae/config/SecurityConfig.java` | 44-52 | Confirms `/api/admin/**` → `hasRole("ADMIN")` already covers `/api/admin/kpis` |
| P1 | `server/src/test/java/com/iyae/controller/AnalyticsControllerTest.java` | all | Existing controller test (DESIGNER-era gate assertion) to update to ADMIN 200 / DESIGNER 403 / buyer 403 |
| P0 | `web/lib/api.ts` | 70-90 | `analytics.track` + `TrackEventPayload` type already exported |
| P0 | `web/lib/hooks/useTrackEvent.ts` | all | Already-shipped emitter hook — just call it from the PDP |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| WAI-ARIA APG — toolbar | https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/ | Roving-tabindex: exactly one control `tabIndex=0`, rest `-1`; `←/→` move focus (and here, selection) |
| WAI-ARIA APG — focus management / dialog | https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | Trap Tab within the overlay, Escape closes, restore focus to the invoking element |
| `@axe-core/playwright` | https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright | `new AxeBuilder({ page }).analyze()` → assert no serious/critical `violations` |
| WCAG 2.1 AA target SCs | https://www.w3.org/WAI/WCAG21/quickref/?levels=aa | This finishes: 2.1.1 (keyboard), 2.4.3 (focus order), 3.3.1 (error identification), 4.1.2/4.1.3 (name/role/status message). **2.5.8 target-size is WCAG 2.2 — out of scope for 2.1 AA.** |

**External research note:** Only the a11y unit needs external references (APG toolbar/dialog + axe wiring), captured above. The KPI loose ends use only established internal patterns.

---

## Patterns to Mirror

### A11Y_LIVE_STATUS — the already-shipped exemplar (mirror for every viewer)
```tsx
// SOURCE: web/components/AvatarViewer.tsx:30-33, 260-261
const { active, progress } = useProgress();
<span className="sr-only" role="status" aria-live="polite">
  {active ? `Loading 3D model, ${Math.round(progress)}%` : "3D model ready"}
</span>
// container:
<div role="img" aria-label="Interactive 3D preview of your outfit on the avatar. Drag to rotate, scroll to zoom.">
```

### A11Y_TARGET_COMPONENT — SizeSelector (role/group/aria-pressed)
```tsx
// SOURCE: web/components/SizeSelector.tsx
<div role="group" aria-label="Select a size">
  {sizes.map((size) => (
    <button type="button" aria-pressed={selectedSize === size} onClick={() => onSelect(size)}>{size}</button>
  ))}
</div>
```

### REDUCED_MOTION_HOOK — SSR-safe matchMedia (mirror conventions for useFocusTrap)
```tsx
// SOURCE: web/lib/hooks/usePrefersReducedMotion.ts
"use client";
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
```

### WEB_API_HELPER + EMITTER — already shipped, just call it
```ts
// SOURCE: web/lib/api.ts:78 + web/lib/hooks/useTrackEvent.ts
export const analytics = { track: (payload: TrackEventPayload) => api.post("/api/events", payload).catch(() => {}) };
// hook:
const track = useTrackEvent();
track({ type: "VIEW", productId: product.id });
```

### E2E_ROLE_ASSERTION — pose-selector (extend with arrow keys + axe)
```ts
// SOURCE: web/e2e/pose-selector.spec.ts
await expect(page.getByRole("button", { name: /warrior/i })).toHaveAttribute("aria-pressed", "true");
// ADD arrow-key: focus toolbar, press ArrowRight, assert next button focused + selected
// ADD axe:      const r = await new AxeBuilder({ page }).analyze();
//               expect(r.violations.filter(v => ["serious","critical"].includes(v.impact))).toEqual([]);
```

### CONTROLLER_ROLE_GATE_TEST — mirror for KPI ADMIN assertion
```java
// SOURCE: server/src/test/java/com/iyae/controller/AnalyticsControllerTest.java (existing gate test)
// @WithMockUser(roles = "ADMIN")  → GET /api/admin/kpis → 200
// @WithMockUser(roles = "DESIGNER") → 403 ; @WithMockUser(roles = "BUYER") → 403
```

---

## Files to Change

### Group C-fin — WCAG 2.1 AA completion (web)
| File | Action | Justification |
|---|---|---|
| `web/lib/hooks/useFocusTrap.ts` | CREATE | Shared focus-trap + Escape + restore hook (deferred from C5) |
| `web/components/ARViewer.tsx` | UPDATE | Focus-trap overlay, Escape-to-exit, `role="alert"` on unsupported, keyboard "Place model" button |
| `web/components/PoseSelector.tsx` | UPDATE | Roving-tabindex + `←/→` arrow-key nav (APG toolbar) |
| `web/components/SmartARViewer.tsx` | UPDATE | Skeleton loader → `role="status"` + `aria-busy` |
| `web/components/DemoOutfitModel.tsx` | UPDATE | Fallback → `role="status"` announcement |
| `web/components/outfits/OutfitBuilderPreview.tsx` | UPDATE | Loading/fallback → `role="status"` |
| `web/app/login/page.tsx` | UPDATE | `aria-invalid` + `aria-describedby` on invalid fields; error text `role="alert"` + id |
| `web/app/register/page.tsx` | UPDATE | Same field-error association |
| `web/app/checkout/page.tsx` | UPDATE | Same field-error association (any validated inputs) |
| `web/app/products/[id]/page.tsx` | UPDATE | Field-error association (size-required, etc.) — also the client-emit site (D-fin) |
| `web/package.json` | UPDATE | Add `@axe-core/playwright` devDependency |
| `web/e2e/a11y.spec.ts` | CREATE | Axe scans of key routes (home, shop, PDP, cart, checkout, try-on) — serious/critical gate |
| `web/e2e/pose-selector.spec.ts` | UPDATE | Arrow-key nav assertions |
| `web/__tests__/components/ARViewer.a11y.test.tsx` | CREATE | Focus-trap / Escape / `role="alert"` unit assertions (mirror `SizeSelector.test.tsx`) |

### Group D-fin — KPI loose ends (server + web)
| File | Action | Justification |
|---|---|---|
| `server/src/main/java/com/iyae/controller/AnalyticsController.java` | UPDATE | Correct the stale "interim DESIGNER" comment on `kpis()` (endpoint is already ADMIN-gated via `/api/admin/**`) |
| `server/src/test/java/com/iyae/controller/AnalyticsControllerTest.java` | UPDATE | Assert `GET /api/admin/kpis` → ADMIN 200, DESIGNER 403, BUYER 403 |
| `web/app/products/[id]/page.tsx` | UPDATE | Emit `VIEW` on product-load `useEffect`; `ADD_TO_CART` in `handleAddToCart` via `useTrackEvent` |

## NOT Building
- **Icon-button 44px target size** — WCAG **2.2** SC 2.5.8 / 2.1 **AAA** SC 2.5.5, **not** 2.1 AA. Explicitly out of scope for this AA-targeted phase (36px already conforms to AA). Tracked as a future 2.2 uplift.
- **Returns/RMA workflow** — `ORDER_RETURNED` event type exists so return-rate is computable; the refund/RMA lifecycle belongs to Phase 7/8.
- **Analytics dashboard / charts UI** — data + API + emission only; no BI frontend.
- **New server analytics endpoints or migration** — the V14 slice is complete; this only wires the client and fixes a comment/test.
- **`@theme inline` dark-mode structural fix** — validate + log contrast only; structural refactor is Phase 2 (see memory `theme-inline-dark-mode-broken`).
- **Moving other endpoints' role gates** — only the KPI comment/test is touched; the ADMIN role and `/api/admin/**` rule already exist.

---

## Step-by-Step Tasks

> Recommended order: **D-fin first** (tiny, high-value, unblocks the funnel), then **C-fin** (the a11y sweep). Each group ends green.

### Group D-fin — KPI loose ends

#### Task D-1: Correct the KPI gate comment + assert ADMIN in test
- **ACTION**: Update the stale comment in `AnalyticsController.kpis()` and add/adjust the controller test to assert the ADMIN gate.
- **IMPLEMENT**: Replace the Javadoc "interim: DESIGNER; move to ADMIN once the Phase-5 role lands" with a note that `/api/admin/kpis` is ADMIN-gated by the `/api/admin/**` rule in `SecurityConfig`. In `AnalyticsControllerTest`, ensure three cases exist: `@WithMockUser(roles="ADMIN")` → 200, `@WithMockUser(roles="DESIGNER")` → 403, `@WithMockUser(roles="BUYER")` → 403 (update the existing DESIGNER-era assertion accordingly).
- **MIRROR**: CONTROLLER_ROLE_GATE_TEST.
- **GOTCHA**: `/api/admin/kpis` matches **only** the `/api/admin/**` rule (line 50), not `/api/designer/**` or `/api/promotions/**` — no matcher-ordering change is needed. Do **not** add a `@PreAuthorize` (the URL rule already enforces it; double-gating risks a 500 vs 403 mismatch in `@WebMvcTest`).
- **VALIDATE**: `cd server && ./gradlew test --tests AnalyticsControllerTest`.

#### Task D-2: Wire client VIEW + ADD_TO_CART on the PDP
- **ACTION**: Emit advisory client events from the product detail page.
- **IMPLEMENT**: In `web/app/products/[id]/page.tsx`, call `const track = useTrackEvent();`. On successful product load (inside the product-fetch `useEffect`, guarded so it fires once per product id), `track({ type: "VIEW", productId: product.id })`. In `handleAddToCart` (after the item is added), `track({ type: "ADD_TO_CART", productId: product.id, sizeBracket: sizeToSend })`. Import `useTrackEvent` from `@/lib/hooks/useTrackEvent`.
- **MIRROR**: WEB_API_HELPER + EMITTER.
- **GOTCHA**: Fire-and-forget only — `analytics.track` already swallows errors; never `await` it in a way that blocks the add-to-cart UX. Guard the `VIEW` emit against React StrictMode double-invocation / re-renders (emit keyed on `product.id`, e.g. a ref or an effect dep of `[product?.id]`). Match the `TrackEventPayload` field names exactly (`type`, `productId`, `sizeBracket`) — `sizeBracket`, not `selectedSize`. Confirm the server `EventType` enum accepts `VIEW` and `ADD_TO_CART` before using those literals.
- **VALIDATE**: `cd web && npm run test`; manually: DevTools Network shows fire-and-forget `POST /api/events` on PDP load and on add-to-cart; a forced failure stays silent.

### Group C-fin — WCAG 2.1 AA completion

#### Task C-1: `useFocusTrap` hook
- **ACTION**: Create the shared focus-trap hook (deferred C5 item).
- **IMPLEMENT**: `web/lib/hooks/useFocusTrap.ts`, `"use client"`. Signature `useFocusTrap(active: boolean, containerRef: RefObject<HTMLElement>, onEscape: () => void)`. On activate: record `document.activeElement`, query focusable descendants (`a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])`), focus the first; add a `keydown` listener that wraps Tab/Shift+Tab within the set and calls `onEscape()` on `Escape`. On deactivate/unmount: remove the listener and restore focus to the recorded element.
- **MIRROR**: REDUCED_MOTION_HOOK conventions + `useGenerationStatus` cleanup shape.
- **GOTCHA**: Guard `typeof document !== "undefined"` (SSR). Re-query focusable elements on each Tab (AR controls mount/unmount). Do nothing when `active` is false.
- **VALIDATE**: `cd web && npx tsc --noEmit` on the file; covered indirectly by the ARViewer test (C-6).

#### Task C-2: `ARViewer` focus trap + Escape + announced unsupported + keyboard placement
- **ACTION**: Make the fullscreen AR overlay keyboard-safe.
- **IMPLEMENT**: Attach `useFocusTrap(isOpen, overlayRef, exitHandler)` to the `fixed inset-0 z-50` overlay; wire Escape to the existing exit/close handler and restore focus to the trigger. Give the `XRNotSupported` branch `role="alert"`. Add a visible **"Place model"** `<button>` (in a `pointer-events-auto` subtree) that invokes the same logic as `handleCanvasClick` so placement has a keyboard path. Add the `sr-only role="status" aria-live` load/error region (mirror AvatarViewer) if not already present.
- **MIRROR**: A11Y_LIVE_STATUS + `useFocusTrap` (C-1); Radix dialog focus semantics.
- **GOTCHA**: HUD siblings are `pointer-events-none` — focusable controls must live in a `pointer-events-auto` subtree or Tab order skips them. Only trap when the overlay is actually open.
- **VALIDATE**: `cd web && npm run test`; manually: enter AR via keyboard, Tab cycles overlay controls only, Escape exits, focus returns to trigger.

#### Task C-3: `PoseSelector` roving-tabindex + arrow keys
- **ACTION**: Complete the APG toolbar pattern.
- **IMPLEMENT**: Only the active pose button gets `tabIndex={0}`, the rest `tabIndex={-1}`. On `ArrowRight`/`ArrowLeft` (and optionally Home/End), move focus to the adjacent button and select it (call the existing select handler). Keep `role="toolbar"` on the container and `aria-pressed` on buttons.
- **MIRROR**: WAI-ARIA APG toolbar; SizeSelector role/aria-pressed.
- **GOTCHA**: Focus must follow selection (roving) — after arrow-move, `.focus()` the newly-active button. Wrap or clamp at the ends consistently (pick one and note it). Don't break the existing click path or the 15s-mount e2e.
- **VALIDATE**: `cd web && npm run test`; arrow-key through poses in the browser.

#### Task C-4: Secondary viewers — announced status
- **ACTION**: Sweep the three remaining viewers for live-region status.
- **IMPLEMENT**: Wrap the loading/fallback UI of `SmartARViewer` (Skeleton), `DemoOutfitModel` (fallback), and `outfits/OutfitBuilderPreview` (loading/fallback) in `role="status"` + `aria-busy` (on active loaders), with a concise `sr-only` label ("Loading 3D preview" / "Preview unavailable").
- **MIRROR**: A11Y_LIVE_STATUS.
- **GOTCHA**: One live region per viewer; don't nest inside drei `<Html>` (portals into canvas, unreliable for AT) — keep it in normal DOM.
- **VALIDATE**: `cd web && npm run test`; screen reader announces loading on mount.

#### Task C-5: Form error association
- **ACTION**: Associate validation errors with their fields on login/register/checkout/product.
- **IMPLEMENT**: For each field that can show an error, set `aria-invalid={!!error}` and `aria-describedby={error ? "<id>-error" : undefined}`; give the error element `id="<id>-error"` and `role="alert"`. Where today there is only a top-level banner (e.g. `login/page.tsx`), keep the banner but also mark the relevant input(s) `aria-invalid` and point `aria-describedby` at the banner's id.
- **MIRROR**: A11Y_LIVE_STATUS (`role="alert"` announcement).
- **GOTCHA**: Only set `aria-describedby` when an error exists (dangling ids confuse AT). `<Input>` is the shadcn primitive — pass the aria props through as normal props (do not edit `components/ui/input.tsx`).
- **VALIDATE**: submit an invalid form; screen reader announces the field error; axe (C-6) reports no label/aria violations.

#### Task C-6: axe scans + ARViewer a11y test + pose arrow-key e2e
- **ACTION**: Add automated a11y coverage.
- **IMPLEMENT**: `npm i -D @axe-core/playwright`. Create `web/e2e/a11y.spec.ts`: for `/`, `/products`, `/products/[id]`, `/cart`, `/checkout`, and a try-on route — `const r = await new AxeBuilder({ page }).analyze(); expect(r.violations.filter(v => ["serious","critical"].includes(v.impact))).toEqual([])`, with a header note that it needs a live dev server + API (no auto `webServer`) and the 15s viewer-mount wait on 3D routes. Add `ARViewer.a11y.test.tsx` asserting the overlay traps focus, Escape calls the exit handler, and `role="alert"` renders when unsupported (mock the XR-unsupported path). Extend `pose-selector.spec.ts` with ArrowRight/ArrowLeft focus+selection assertions.
- **MIRROR**: E2E_ROLE_ASSERTION; SizeSelector.test.tsx.
- **GOTCHA**: Scope the axe gate to **serious/critical** initially; log moderate findings as tracked TODOs (don't block the phase on non-AA-blocking moderate items — see Risks). axe on 3D routes needs the mount wait already used in `pose-selector.spec.ts`.
- **VALIDATE**: `cd web && npm run test`; with dev+API up, `npm run test:e2e -- a11y.spec.ts pose-selector.spec.ts` → zero serious/critical violations, arrow-key assertions pass.

---

## Testing Strategy

### Unit / Component Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `kpis_admin_returns200` | `@WithMockUser(roles="ADMIN")` GET `/api/admin/kpis` | 200 + summary | No |
| `kpis_designer_forbidden` | `roles="DESIGNER"` | 403 | Yes |
| `kpis_buyer_forbidden` | `roles="BUYER"` | 403 | Yes |
| `ARViewer_trapsFocus` | overlay open | Tab stays within overlay controls | Yes |
| `ARViewer_escapeExits` | Escape keydown | exit handler called, focus restored | Yes |
| `ARViewer_unsupported_alert` | XR unsupported | `role="alert"` present | Yes |
| `PoseSelector_arrowMovesSelection` | ArrowRight from active | next button focused + `aria-pressed=true` | Yes |
| PDP `VIEW` emit | product loads | one `POST /api/events {type:VIEW}` per id | Yes (StrictMode double-mount) |
| PDP `ADD_TO_CART` emit | add-to-cart click | `POST /api/events {type:ADD_TO_CART, sizeBracket}` | No |

### Edge Cases Checklist
- [ ] AR overlay closed → no focus trap active, no stray listeners
- [ ] Keyboard-only user can place a model (no mouse) and exit via Escape
- [ ] PoseSelector arrow nav clamps/wraps consistently at both ends
- [ ] `VIEW` emitted once per product despite React StrictMode double-invoke
- [ ] Analytics POST failure is fully silent (no console error, no UI change)
- [ ] Form with no error → no `aria-describedby`, `aria-invalid` absent/false
- [ ] axe scan on all key routes → zero serious/critical
- [ ] Reduced-motion still respected on landing viewer (regression check — already shipped)

---

## Validation Commands

### Static Analysis
```bash
cd server && ./gradlew compileJava compileTestJava
cd web && npx tsc --noEmit
```
EXPECT: Zero compile/type errors on touched files (2 pre-existing errors in `useGenerationStatus.test.ts` are untouched/known).

### Unit Tests
```bash
cd server && ./gradlew test --tests AnalyticsControllerTest      # D-fin
cd web && npm run test                                           # C-fin + PDP emit
```
EXPECT: All pass.

### Full Test Suite (regression)
```bash
cd server && ./gradlew test        # full suite green (no regression)
cd web && npm run test             # full suite green
cd worker && pytest                # unaffected — sanity only
```
EXPECT: No regressions.

### Browser / A11y Validation (needs live dev + API)
```bash
./dev.sh start                     # or: cd web && npm run dev  +  server running
cd web && npm run test:e2e -- a11y.spec.ts pose-selector.spec.ts checkout-flow.spec.ts
```
EXPECT: Axe zero serious/critical; arrow-key + checkout assertions pass.

### Manual Validation
- [ ] Tab into AR → controls trapped; Escape exits; focus returns to trigger; "Place model" works by keyboard.
- [ ] Arrow-key through PoseSelector selects poses; one tab stop.
- [ ] VoiceOver/NVDA announces loading on SmartARViewer / DemoOutfitModel / OutfitBuilderPreview.
- [ ] Submit invalid login/register/checkout/product form → field error announced.
- [ ] PDP load + add-to-cart emit `POST /api/events`; failures silent.
- [ ] `GET /api/admin/kpis` as ADMIN → 200; as DESIGNER/BUYER → 403.

---

## Acceptance Criteria
- [ ] `useFocusTrap` created; `ARViewer` is focus-trapped, Escape-able, keyboard-placeable, unsupported state announced
- [ ] `PoseSelector` implements roving-tabindex + arrow-key nav (APG toolbar)
- [ ] `SmartARViewer`, `DemoOutfitModel`, `OutfitBuilderPreview` announce loading/fallback via `role="status"`
- [ ] Login/register/checkout/product forms associate field errors (`aria-invalid` + `aria-describedby` + `role="alert"`)
- [ ] `@axe-core/playwright` added; `e2e/a11y.spec.ts` passes at serious/critical on key routes
- [ ] KPI endpoint ADMIN gate documented in-code + test-asserted (ADMIN 200 / DESIGNER 403 / BUYER 403)
- [ ] PDP emits advisory `VIEW` + `ADD_TO_CART` (fire-and-forget)
- [ ] Tests written and passing; no type/lint errors; no regressions

## Completion Checklist
- [ ] Mirrors the shipped a11y exemplar (`AvatarViewer` live-status, `SizeSelector` roles, `usePrefersReducedMotion` SSR guard)
- [ ] Analytics emits are fire-and-forget and never surface errors
- [ ] No shadcn primitive edited (aria props passed through `<Input>`)
- [ ] No new backend endpoint/migration; icon-44px correctly excluded (WCAG 2.2, not AA)
- [ ] Docs: mark Phase 9 Unit C complete in the report; PRD Phase 9 status updated when the phase closes
- [ ] Self-contained — no codebase searching needed during implementation

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| axe surfaces pre-existing **moderate** violations across many routes | High | Med | Gate on serious/critical only; log moderate as tracked TODOs; don't block the phase on non-AA-blocking items |
| Focus-trap edge cases (dynamic AR controls mount/unmount mid-trap) | Med | Med | Re-query focusable elements on each Tab; unit-test open/close/Escape; only trap when open |
| PDP `VIEW` double-emits under React StrictMode | Med | Low | Key the emit on `product.id` via ref/effect dep; advisory event so a rare dup is harmless |
| a11y e2e needs live dev+API (no auto webServer) → CI friction | Med | Low | Document the prerequisite in the spec header; run locally against `./dev.sh start`; keep unit/component a11y tests CI-runnable |
| Enlarging keyboard scope in `ARViewer` shifts pointer-events layering | Low | Med | Put focusable controls in a `pointer-events-auto` subtree; manual keyboard pass |

## Notes
- **Corrects the report vs `main` drift**: the report (written in `worktree-iyae-phase9-prp-plan`) predates Phase 5 merging the **ADMIN role** and the analytics slice landing as **V14** (not V11). On `main` today, `SecurityConfig:50` already routes `/api/admin/**` → `hasRole("ADMIN")`, so `/api/admin/kpis` **is already ADMIN-gated** — D-1 is a comment + test correction, not an enforcement change.
- **Explicitly deferred (not this phase)**: icon-button 44px target-size is WCAG **2.2**/AAA, not 2.1 AA — excluded by design.
- **Delivery**: one branch, two groups (D-fin then C-fin), each independently green; open one draft PR. On completion, update `hardening-a11y-kpi-instrumentation-report.md` (Unit C → complete) and the PRD Phase 9 row.
