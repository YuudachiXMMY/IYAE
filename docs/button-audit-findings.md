# Button audit findings — 2026-10-09

Produced by `web/e2e/button-smoke.spec.ts`, which walks every reachable route
for three personas (guest, shopper `emma@iyae.ca`, designer `luna@iyae.ca`),
enumerates each visible `button` / `[role="button"]` / `input[type=submit]`,
and clicks them one at a time with a fresh page load before each click.

```bash
cd web && PLAYWRIGHT_BASE_URL=http://localhost:3010 \
  npx playwright test e2e/button-smoke.spec.ts --workers=3
```

## Coverage

| | |
|---|---|
| Route × persona combinations | 39 |
| Interactive elements probed | 272 |
| Behaved correctly | 250 |
| Dead / suspicious | 11 |
| Skipped (destructive or hands off to Stripe) | 11 |

No button crashed the app, raised an uncaught exception, or produced a 5xx.

## Confirmed defects

### 1. Hover-opened account menu makes the rest of the page unclickable (high)

`web/components/design-system/SiteHeader.tsx:183-191`

The avatar menu opens on `onMouseEnter`, but the Radix `DropdownMenu` is left in
its default **modal** mode. Opening it sets `body { pointer-events: none }` and
marks the rest of the document `aria-hidden`, so while the pointer merely rests
over the avatar **every other button on the page stops responding**. Measured
directly:

| state | `body` pointer-events | `[data-aria-hidden]` nodes | floating assistant clickable |
|---|---|---|---|
| fresh load | `auto` | 0 | yes |
| pointer over avatar | `none` | 10 | no (click times out) |

This affects every authenticated route for both personas. It is also what made
17 of 18 route failures in an earlier run look like independent bugs — the test
harness now parks the pointer at `(0,0)` before each navigation so this single
defect no longer masks the rest of the audit.

Fix direction: pass `modal={false}` to `DropdownMenu`, or drop the hover trigger
and open on click only.

### 2. Every "Save" button in the shop grid is inert (high)

`web/app/products/page.tsx:245-250`

`ProductCard` calls `onToggleSave?.()`, and the shop grid never passes that prop.
All 20 cards render a heart button that does nothing: no request, no state
change, `aria-pressed` stays `false`. Verified by clicking all 20 and counting
`aria-pressed` transitions — **0 of 20 flipped**.

The audit reports only the first four because clicking a card lower in the grid
scrolls it into view and triggers the pagination fetch, which the heuristic reads
as "something happened".

### 3. Social login buttons are visual placeholders (medium)

`web/app/login/page.tsx:171-178`

The `GOOGLE` and `APPLE` buttons carry no `onClick` and no `disabled` state.
A shopper can click them indefinitely with no feedback.

## Lower severity

### 4. Active filter chip exposes no selected state (a11y)

`/designer/products` — the `All 14` chip shows selection through background
colour only; `aria-pressed`, `aria-selected` and `data-state` are all absent, so
assistive tech cannot tell which filter is active. The audit flags it as "dead"
for the same reason: there is no state for it to observe.

### 5. `Cancel` on `/outfits/new` can leave the app

`web/app/outfits/new/page.tsx:176,199` — both Cancel buttons call
`router.back()`. Reached directly (shared link, new tab) that walks the user out
of the application instead of to `/outfits`.

## Pre-existing blocker in the E2E suite

`auth.spec.ts`, `designer-crud.spec.ts` and the other login-dependent specs
authenticate as `emma@example.com` / `designer@example.com`. `DataSeeder` derives
seed emails from `app.brand.domain`, so the real accounts are `emma@iyae.ca` and
`luna@iyae.ca` (password unchanged). Every login-dependent spec currently fails
at the sign-in step. Not changed here to keep this commit scoped.

## Deliberately not clicked

`Sign out` (ends the session), `Delete` / `Archived` on `/profile/avatar`,
`/designer/promotions` and `/designer/products` (destroys seed data), and the
Stripe hand-off on `/checkout`. The denylist lives in `SKIP_LABEL`.
