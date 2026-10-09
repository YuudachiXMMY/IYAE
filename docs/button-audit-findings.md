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
  tabs. Promoting this to a real table is a follow-up.

### 3. Social login buttons were visual placeholders

`web/app/login/page.tsx:171-178` — `GOOGLE` and `APPLE` had no `onClick` and no
`disabled` state. No OAuth provider is configured server-side, so they are now
disabled with an explanatory note rather than silently swallowing clicks.
**Product call**: if social sign-in is not on the roadmap, delete the block.

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

## Open

### Duplicate React keys on `/community` (18 warnings)

Fires on load for both shopper and designer, so `state.posts` contains repeated
ids. The render site (`app/community/page.tsx:509`, `key={post.id}`) is correct;
the duplication comes from the localStorage demo layer
(`buildInitialCommunityPosts` / `migrateCommunityState` in `lib/community-feed.ts`).
Deduplicating at the render boundary would hide a data bug, so this is left for
a pass that fixes the generation instead. Not touched by this diff.

### "Cannot update a component while rendering a different component" (9 warnings)

`/profile/avatar` (7) and `/ar-visualization` (2), on load. `setViewerError` at
`app/profile/avatar/page.tsx:132,136` is reached during another component's
render. `ViewerErrorBoundary.componentDidCatch` is commit-phase and legitimate,
so the caller is further down (a `dynamic()` boundary or an R3F loader path).
Needs its own investigation. Not touched by this diff.

### The existing E2E specs are stale beyond credentials

Seed logins are now centralised in `web/e2e/seed-users.ts` (derived from
`app.brand.domain`, so `emma@example.com` → `emma@iyae.ca` and
`designer@example.com` → `luna@iyae.ca`). That removes one blocker, but it does
**not** make those specs pass: their selectors have drifted from the current UI.
`e2e/auth.spec.ts:57` still expects a `Browse Products` heading that the
redesigned `/products` no longer has. Re-deriving selectors across the 7
login-dependent specs is a separate job.

## Deliberately not clicked

`Sign out`, `Delete` / `Archived` on `/profile/avatar`, `/designer/promotions`
and `/designer/products`, and the Stripe hand-off on `/checkout`. The denylist
is `SKIP_LABEL`; the Next.js dev-overlay controls are dropped via
`DEV_OVERLAY_LABEL` so the audit reads the same against `next dev` and a
production build.
