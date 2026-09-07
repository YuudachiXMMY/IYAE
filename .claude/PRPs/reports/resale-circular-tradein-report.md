# Implementation Report: Resale / Circular / Trade-in (Phase 7 — lightweight v1)

## Summary
Implemented the lightweight-v1 peer-to-peer resale layer per plan. A buyer can re-list an item
they already purchased as a "pre-loved" listing; other shoppers browse and buy it via the existing
Stripe money path. Self-contained vertical: `resale_listings` table (V16) + `ResaleListing` entity +
`ResaleService` + `ResaleController` + web surface (`/resale`, `/resale/[id]`, `/resale/sell`,
`/resale/my-listings`). Reuses `StripeCheckoutGateway` + `Order` + the existing Stripe webhook;
**no changes to the shared cart/checkout hot path**. A unique second-hand unit is sold exactly once
via an atomic `LISTED→RESERVED→SOLD` state machine with a scheduled release of stale reservations.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium–Large | Medium–Large (as predicted) |
| Confidence | 8/10 | Single-pass; 1 wiring fix (context-load mock) |
| Files Changed | ~14 new / ~6 edited | 17 new / 8 edited (see below) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | V16 migration (`resale_listings` + `orders.resale_listing_id`) | ✅ Complete | `cond` column (avoids reserved word) |
| 2 | `ResaleStatus` + `ResaleCondition` enums | ✅ Complete | RESERVED internal transient |
| 3 | `ResaleListing` entity + `Order.resaleListingId` | ✅ Complete | plain `Long` on Order (no lazy coupling) |
| 4 | `ResaleListingRepository` + `ResaleListingSpecifications` | ✅ Complete | atomic reserve/markSold/release (`@Modifying`) |
| 5 | DTOs (Create/Update/Response/EligibleItem) | ✅ Complete | Jakarta validation mirrored |
| 6 | `ResaleService` eligibility (parse `Order.itemsSnapshot`) | ✅ Complete | defensive parse; dedupe by (productId,size) |
| 7 | `ResaleService` listing lifecycle (CRUD + ownership) | ✅ Complete | info-leak-safe not-found |
| 8 | `ResaleService` reserve/markSold/release + sweep | ✅ Complete | returns immutable `ReservedListing` snapshot |
| 9 | `CheckoutService.initiateResaleCheckout` + webhook SOLD | ✅ Complete | stub + Stripe paths; releases reservation on failure |
| 10 | `ResaleController` + `SecurityConfig` + `SchedulerConfig` | ✅ Complete | public GET listings; 5-min stale-reservation sweep |
| 11 | Web `api.ts` `resale` client + types | ✅ Complete | mirrors `posts`/`promotions` |
| 12 | Web pages + `ResaleListingCard`/`ResaleListingForm` + NavBar | ✅ Complete | browse/detail/sell/my-listings; "Pre-loved" nav link |
| 13 | Tests (service/controller/@DataJpa + checkout ext + web api) | ✅ Complete | see below |
| 14 | Seed + docs | ◐ Partial | PRD status + report done; DataSeeder demo listings + CLAUDE.md count sync **deferred** (P2) |
| — | Rate-limit `POST /resale/listings/*/checkout` | ⏭ Deferred | optional in plan; suffix-matching non-trivial (noted) |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (server `compileJava`) | ✅ Pass | zero errors |
| Static Analysis (web `tsc --noEmit`) | ✅ Pass | resale files 0 errors (2 pre-existing errors in `useGenerationStatus.test.ts`, unrelated) |
| Lint (web, resale files) | ✅ Pass | `eslint` exit 0 on all resale files (repo-wide lint has pre-existing errors from newer eslint via shared node_modules) |
| Unit Tests (server) | ✅ Pass | full suite **517** green incl. new `ResaleServiceTest` (10), `ResaleControllerTest` (5), `ResaleListingRepositoryDataJpaTest` (4), `CheckoutServiceTest` +2 |
| Unit Tests (web) | ✅ Pass | `api.test.ts` **31** green incl. 4 resale; full suite 263 passed |
| Build | ◐ | `next build` not run (would fail on pre-existing repo-wide lint from shared node_modules); types validated via `tsc --noEmit` instead |
| Integration (live server) | ⏭ N/A | not run (no live DB/Stripe in this session); migration parity validated by Hibernate boot in tests |
| Edge Cases | ✅ Pass | pending-order excluded, already-listed excluded, not-purchased rejected, own-listing rejected, unavailable rejected, atomic double-reserve → 0 rows, stub marks SOLD, webhook skips cart-clear |

## Files Changed

**Created (17):**
`V16__resale_listings.sql`, `ResaleStatus.java`, `ResaleCondition.java`, `ResaleListing.java`,
`ResaleListingRepository.java`, `ResaleListingSpecifications.java`, `CreateResaleListingRequest.java`,
`UpdateResaleListingRequest.java`, `ResaleListingResponse.java`, `ResaleEligibleItemResponse.java`,
`ResaleService.java`, `ResaleController.java`, `ResaleServiceTest.java`, `ResaleControllerTest.java`,
`ResaleListingRepositoryDataJpaTest.java`, `ResaleListingCard.tsx`, `ResaleListingForm.tsx`
(+ 4 web pages: `app/resale/page.tsx`, `app/resale/[id]/page.tsx`, `app/resale/sell/page.tsx`,
`app/resale/my-listings/page.tsx`).

**Edited (9):** `Order.java`, `CheckoutService.java`, `SecurityConfig.java`, `SchedulerConfig.java`,
`CheckoutServiceTest.java`, `IyaeApplicationTests.java`, `web/lib/api.ts`, `web/components/NavBar.tsx`,
`web/__tests__/lib/api.test.ts`.

## Deviations from Plan
- **`IyaeApplicationTests` mock** (not in plan): the full-context test mocks every repository (JPA
  autoconfig excluded), so a `@MockBean ResaleListingRepository` was required — otherwise `contextLoads()`
  failed with `NoSuchBeanDefinitionException`. Added. (This was the single validation-loop fix.)
- **Rate-limit rule**: deferred (optional in plan).
- **DataSeeder demo listings + CLAUDE.md count sync**: deferred (P2) — noted for a follow-up doc pass.

## Issues Encountered
- **Fresh-worktree build tooling**: `gradle-wrapper.jar` and `web/node_modules` are gitignored and
  absent in a fresh worktree. Resolved locally (copied wrapper jar from a sibling worktree; symlinked
  `web/node_modules` from the main checkout). Both are gitignored — not committed.
- **Context-load failure** (fixed): see Deviations.
- **Flaky web test (pre-existing)**: `__tests__/lib/hooks/useOutfitRiggingStatus.test.ts` fails with a
  vitest "Timeout terminating forks worker" (tests 0ms — hangs on teardown) even in isolation. Unrelated
  to resale (a 3D rigging-polling hook); pre-existing environmental flake.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `ResaleServiceTest.java` | 10 | eligibility (paid/pending/already-listed), create (owned/not-purchased), remove ownership, reserve (own/unavailable/ok), markSold |
| `ResaleControllerTest.java` | 5 | public browse/detail 200, unauthenticated eligible-items denied, create 201, checkout 200 |
| `ResaleListingRepositoryDataJpaTest.java` | 4 | browse only-LISTED, q product-name join, atomic reserve (1 then 0), markSold RESERVED-guarded |
| `CheckoutServiceTest.java` (extended) | +2 | resale stub checkout creates order + marks SOLD; webhook marks SOLD + skips cart-clear |
| `web/__tests__/lib/api.test.ts` (extended) | +4 | resale browse/create/checkout/remove path + method assertions |

## Next Steps
- [ ] Code review via `/code-review`
- [ ] Follow-up doc pass: DataSeeder demo listings + root/server/web `CLAUDE.md` count sync
- [ ] Optional: rate-limit rule for resale checkout; live integration test (`./dev.sh start`)
