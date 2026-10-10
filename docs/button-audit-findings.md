# Button audit findings — 2026-10-09

Produced by `web/e2e/button-smoke.spec.ts`, which walks every reachable route
for three personas (guest, shopper, designer — see `web/e2e/seed-users.ts`),
enumerates each visible `button` / `[role="button"]` / `input[type=submit]`,
and clicks them one at a time with a fresh page load before each click.

```bash
cd web && PLAYWRIGHT_BASE_URL=http://localhost:3010 \
  npx playwright test e2e/button-smoke.spec.ts --workers=3
```

## Result after the fix pass

| | before | after |
|---|---|---|
| Route × persona combinations | 39 | 39 |
| Interactive elements probed | 272 | 272 |
| Behaved correctly | 250 | 234 |
| Dead buttons | 11 | **0** |
| Console-error warnings | 0 (hidden by the prod build) | 27 |
| Skipped (destructive / Stripe) | 11 | 11 |

Nothing crashed, raised an uncaught exception, or produced a 5xx in either run.
The 27 console-error warnings are pre-existing React warnings that only a *dev*
build emits — the first run went against the production container, which strips
them. They are catalogued under "Open" below.

## Fixed

### 1. Hover-opened account menu made the rest of the page unclickable

`web/components/design-system/SiteHeader.tsx:183-197`

The avatar menu opens on `onMouseEnter` while the Radix `DropdownMenu` was left
in its default **modal** mode. Opening it set `body { pointer-events: none }`
and marked the rest of the document `aria-hidden`, so while the pointer merely
rested over the avatar **every other button on the page stopped responding**:

| state | `body` pointer-events | `[data-aria-hidden]` nodes | other buttons clickable |
|---|---|---|---|
| fresh load | `auto` | 0 | yes |
| pointer over avatar | `none` | 10 | no (clicks time out) |

Fixed with `modal={false}`, which keeps the hover UX. This one defect accounted
for 17 of the 18 route failures in the first audit run; the harness now also
parks the pointer at `(0,0)` before each navigation so a single header bug can
no longer mask every other route.

### 2. Every "Save" button in the shop grid was inert

`web/app/products/page.tsx`, `web/components/design-system/ProductCard.tsx`

`ProductCard` called `onToggleSave?.()` and the shop grid never passed the prop,
so all 20 hearts did nothing — verified by clicking all 20 and counting
`aria-pressed` transitions: **0 of 20 flipped**.

Two changes:

- `ProductCard` no longer renders a *clickable* heart without a handler. With
  `saved` and no handler it renders a non-interactive indicator instead. That
  removes the whole defect class rather than this one call site (the dashboard
  "Saved for you" grid had the same dead heart).
- New `web/lib/saved-products.ts` backs the wishlist. **The server has no
  "save a product" capability** — `/api/looks` persists outfit *recommendations*
  (`recommendationId` is required), not catalogue items — so saves live in
  localStorage next to the other demo layers, exposed through a
  `useSyncExternalStore`-based `useSavedProductIds()` that also syncs across
  tabs. **Since resolved**: V21 added a real `saved_products` table and
  `/api/saved-products`; localStorage is now a cache of it, not the store.

### 3. Social login buttons were visual placeholders

`web/app/login/page.tsx` — `GOOGLE` and `APPLE` had no `onClick` and no
`disabled` state. No OAuth provider is configured server-side, so they were
first made disabled with an explanatory note rather than silently swallowing
clicks. **The product call has since been made**: the buttons and the "or
continue with" divider are deleted, keeping only the line that sets the
expectation. A control a user can never operate is worse than its absence, and
the divider promised alternatives that were not there.

### 4. Active filter chip exposed no selected state

`web/app/designer/products/page.tsx` — the status chips marked themselves with
`aria-current="page"`. A filter is a toggle, not a location: changed to
`aria-pressed`, which is what conveys "this filter is on".

### 5. `Cancel` on `/outfits/new` could leave the app

`web/app/outfits/new/page.tsx` — both Cancel buttons called `router.back()`.
Reached directly (shared link, new tab) that walks the user out of the
application. Now pushes `/outfits`.

### 6. Browser writes 403'd whenever `WEB_PORT` was not 3000

`docker-compose.yml`, `.env.example`

Found while checking whether the login button works. `CORS_ORIGINS` listed only
`localhost:3000`, but the local `.env` maps the web container to `WEB_PORT=3010`.
Browsers attach `Origin` to every POST/PUT/DELETE even same-origin, the Next.js
rewrite forwards it, and Spring rejected it:

| Origin | `POST /api/auth/login` | `GET /api/products` |
|---|---|---|
| `http://localhost:3000` | 200 | 200 |
| `http://localhost:3010` | **403 Invalid CORS request** | 403 |

Same-origin GETs carry no `Origin`, so pages rendered data fine and the failure
only showed up on writes — login, add-to-cart, checkout, post creation, product
create. In the browser it surfaced as the opaque message "Request failed",
because `lib/api.ts:47` falls back to that when an error body is not JSON and
the CORS rejection is plain text.

`docker-compose.yml` now always appends `http://localhost:${WEB_PORT}` to
`CORS_ORIGINS`. **Takes effect on the next `./dev.sh restart server`** — the
running container still has the old value.

### 7. Duplicate React keys in the catalogue after "LOAD MORE"

`web/app/products/page.tsx` — pagination appended with
`[...prev, ...result.content]`. React Strict Mode double-invokes the fetching
effect in dev, so the same page was appended twice and collided `key={product.id}`.
Now appends by id.

## Resolved in the follow-up pass

The three items this report previously left open were measured directly (a
throwaway spec that dumped every console warning verbatim on the affected
routes). **Two of the three root causes stated below were wrong** — both had
been inferred from the symptom rather than observed. The corrected findings:

### Duplicate React keys on `/community` — FIXED

Previously attributed to repeated post ids in `state.posts`. Measured: post ids
are unique (`dupes: []`). The duplicate key was the **tag string `Everyday`**:
`buildCurrentUserSeedPost` built `tags: [aesthetic, "Everyday", "Personal
archive"]`, and `aesthetic` falls back to `"Everyday"` for a user who has set no
style aesthetics — so the array repeated itself. Five render sites use
`key={tag}`, all correctly; a tag list has to be unique at the data layer.

`lib/community-feed.ts` now dedupes the tag list. The existing tests only ever
passed `'Minimalist'` / `'Streetwear'`, neither of which collides, which is why
this slipped through; `__tests__/lib/community-feed.test.ts` gains a case for
every aesthetic that does.

Measured after: `/community` emits 0 console warnings.

### "Cannot update a component while rendering a different component" — FIXED

Previously attributed to `setViewerError` at `app/profile/avatar/page.tsx:132,136`.
That was wrong: `ViewerErrorBoundary.componentDidCatch` is commit-phase and
entirely legitimate, and the warning never named it. The actual text is

    Cannot update a component (`Loader`) while rendering a different
    component (`EnvironmentCube`)

`EnvironmentCube` is `@react-three/drei`'s `<Environment preset="studio">`. It
starts its HDR load during render, which synchronously writes drei's global
`useProgress` store — and `AvatarViewer`'s own `Loader` (the `<Suspense>`
fallback, `components/AvatarViewer.tsx:54`) subscribes to that store from inside
the same boundary.

`AvatarViewer` now calls `useEnvironment.preload({ preset })` at module scope,
so the lookup is a cache hit and nothing is written mid-render. Measured after:
the warning is gone from both `/profile/avatar` and `/ar-visualization`. What
remains on those routes is upstream three.js deprecation noise (`THREE.Clock`,
`PCFSoftShadowMap`, a `GLTFLoader` POSITION min/max notice on a static asset)
and GPU performance messages — no React errors.

### The existing E2E specs — RE-ALIGNED

All 7 login-dependent specs now pass: **106 passed, 0 failed, 5 skipped** across
the whole Playwright suite (the 5 are pre-existing `test.fixme` pose tests that
need a seeded rigged outfit). Selector drift was only part of it; three
structural problems mattered more.

**Rate limiting.** `POST /api/auth/login` allows 5 requests per minute per IP
(`RateLimitFilter.RULES`). Every spec drove the sign-in form in `beforeEach`, so
a full run 429s regardless of selector correctness. New `e2e/session.ts` seeds a
JWT via `addInitScript`, and `e2e/global-setup.ts` mints one token per role for
the entire run (workers are separate processes, so a per-worker cache still cost
one login each). `auth.spec.ts` keeps the real form — it owns that journey — as
does the invalid-credentials contrast check in `a11y.spec.ts`.
`button-smoke.spec.ts` carried a second copy of this logic and now shares the one
in `session.ts`.

**Tests that silently skipped.** `/community`'s default Discover tab is a server
feed, and `feedPosts ?? localPosts` does not fall back on a *successful empty*
response — so with no posts on the server the page renders its empty state and
four interaction tests skipped rather than failed. `community.spec.ts` now seeds
its own post through the API (unique caption per run) and removes it afterwards.
`cart.spec.ts` had five `test.skip()` branches guarded by an instant
`isVisible()` against asynchronously-loaded rows; those are now real waits and
real assertions.

**Shared mutable state.** The seed shopper owns one server-side cart, so
`cart.spec.ts`'s parallel tests deleted each other's items — that file and
`checkout-flow.spec.ts` are now `mode: 'serial'`. `community.spec.ts` resets the
follow edge its own follow test creates, which otherwise pushed the fixture post
into the Following feed and broke the next run.

Selector corrections, verified against current source: `Welcome Back` →
`Welcome back.`; `Browse Products` → `Pieces, considered for you.`; `/\d+ items/`
→ `/\d+ pieces?/`; `Create one` → `Create an account`; `Join IYAE` → the step's
own `Create your account.`; wizard `Basics`/`Style` → `ACCOUNT`/`STYLE PROFILE`
scoped to `<main>` (SiteHeader also has an `ACCOUNT` link); `Next` →
`CONTINUE`/`BUILD MY PROFILE` behind one helper; `Style Aesthetics` → `What feels
most like you?`; suggestion group `/suggestions/i` → `/suggested responses/i`;
`IYAE Community` → `Style, in real life.`; the `/chat?event=shop` contract →
`/outfits?…&source=shop`; `New Product` is a `CardTitle` (a `div`), not a
heading. Three `community.spec.ts` tests lost their subject entirely when the
creator `<aside>` rail was removed — the creator-search test is deleted (no
replacement exists) and Follow is re-anchored to the in-card button.

Also fixed while verifying: `getByText('Your Cart')` matched `Your cart is
empty.` as a substring in 7 places (now `getByRole('heading')`), and the
dark-patterns total check asserted `total === subtotal`, which a correct page
fails since Phase 8 added shipping (now `total === subtotal + shipping`, reading
the existing `checkout-shipping` testid).

## Still open

### CORS config needs a server restart to take effect in your stack

`docker-compose.yml` now always appends `http://localhost:${WEB_PORT}` to
`CORS_ORIGINS`, but a running container keeps the old value. Verified after
recreating the server with the widened list:

    Origin localhost:3000 -> POST /api/auth/login 200
    Origin localhost:3010 -> 200   (was 403)
    Origin localhost:3011 -> 200
    Origin evil.example   -> 403   (still correctly rejected)

Note the failure is not limited to writes: any request that carries a
non-allowlisted `Origin` is rejected, including authenticated GETs such as
`/api/avatar` and `/api/body-profile`.

### Resolved: product saves are now server-side

The follow-up pass added V21 `saved_products` and
`GET`/`PUT`/`DELETE /api/saved-products`. `lib/saved-products.ts` treats the
server as the source of truth when signed in, with localStorage demoted to a
cache and replayed up on first sign-in, so a save survives a change of device.

## Deliberately not clicked

`Sign out`, `Delete` / `Archived` on `/profile/avatar`, `/designer/promotions`
and `/designer/products`, and the Stripe hand-off on `/checkout`. The denylist
is `SKIP_LABEL`; the Next.js dev-overlay controls are dropped via
`DEV_OVERLAY_LABEL` so the audit reads the same against `next dev` and a
production build.
