# Implementation Report: Toronto Physical Touchpoints + Shipping (Phase 8)

## Summary

Phase 8 adds a **fulfillment choice at checkout** — in-city **Toronto pickup** or **multi-carrier flat-rate shipping** — to the existing Stripe cart-checkout path, as a lightweight v1 mirroring the Phase 7 resale precedent. The buyer picks *Ship* (choosing a carrier from a deliberately multi-carrier list — UPS / Purolator / FedEx / Canada Post, **never Canada-Post-only**) or *Pickup* (choosing a seeded Toronto location); the choice + flat CAD fee are validated server-side, recorded on the order (`fulfillment_method`, `pickup_location_id`, `shipping_carrier`, `shipping_fee`), added as a Stripe shipping line item, and surfaced on the order/success pages. A new V17 migration creates `pickup_locations` (with 2 Toronto seed rows) and the four `orders` fulfillment columns. A new `FulfillmentService` resolves/validates the request and a public `FulfillmentController` (`GET /api/fulfillment/**`) serves the pickup-location and shipping-option reference lists for the checkout selector. No live rates, labels, or tracking were built (explicitly out of scope). Full server suite is green (528 tests, 0 failures); the new web `fulfillment.test.ts` passes 2/2.

## Assessment vs Reality

| Dimension | Predicted | Actual |
|---|---|---|
| Complexity | Large (~20 files) | 28 files (12 new server + 6 edited server + 4 new/edited test-support + 6 web) |
| Confidence | (plan did not state) | n/a |
| Files Changed | ~20 | 28 |

## Tasks Completed

| # | Task | Status |
|---|------|--------|
| 1 | V17 migration — `pickup_locations` table + 2 Toronto seed rows + 4 `orders` fulfillment columns + FK (`ON DELETE SET NULL`) | Complete |
| 2 | Enums `FulfillmentMethod {SHIP, PICKUP}` + `ShippingCarrier {UPS, PUROLATOR, FEDEX, CANADA_POST}` (display name + flat CAD fee) | Complete |
| 3 | `PickupLocation` entity + `PickupLocationRepository.findByActiveTrueOrderByIdAsc()` | Complete |
| 4 | DTOs — `CheckoutRequest`, `PickupLocationResponse`, `ShippingOptionResponse` | Complete |
| 5 | `FulfillmentService` — `listActivePickupLocations` / `listShippingOptions` / `resolve` (validate SHIP vs PICKUP, compute fee) | Complete |
| 6 | `FulfillmentController` (`GET /api/fulfillment/pickup-locations`, `/shipping-options`) + `SecurityConfig` permitAll | Complete |
| 7 | Extend `Order` entity (+4 fulfillment fields, `@Builder.Default` on method + fee) | Complete |
| 8 | Wire fulfillment into `CheckoutService.initiateCheckout(email, CheckoutRequest)` (shipping line item + persisted fields; real + stub paths) and `CheckoutController` (optional `@RequestBody`) | Complete |
| 9 | `FulfillmentServiceTest` (validation matrix + never-Canada-Post-only guardrail) | Complete |
| 10 | `FulfillmentControllerTest` (`@WebMvcTest`, public GET endpoints) | Complete |
| 11 | Extend `CheckoutServiceTest` (+3: SHIP fee line item + fields, PICKUP fee 0 + location, invalid combo) | Complete |
| 12 | `OrderResponse` (+fulfillment fields + `pickupLocationName`), `OrderService` name resolution, and web surfaces (api client, checkout selector, success + orders pages) | Complete |
| 13 | Docs sync (server/CLAUDE.md counts + endpoints + enums + migration + changelog; root CLAUDE.md changelog; PRD phase status; this report; plan archival) | Complete |

## Validation Results

| Check | Result | Notes |
|---|---|---|
| Static Analysis (web `tsc --noEmit`) | PASS | Clean for all changed files. 2 PRE-EXISTING errors in unmodified `useGenerationStatus.test.ts` (out of scope). |
| Server Unit Tests (`./gradlew test`) | PASS | 528 tests, 0 failures. |
| Build | PASS | Server + web build clean. |
| Web Vitest (`npm run test`) | PASS | `fulfillment.test.ts` 2/2. One pre-existing flaky worker-fork timeout on unmodified `useOutfitRiggingStatus.test.ts` (not introduced here). |
| Lint | PASS | 100 pre-existing baseline issues, none in changed files. |

## Files Changed

### Created (13)

| File | Action |
|---|---|
| `server/src/main/resources/db/migration/V17__fulfillment_and_shipping.sql` | CREATED |
| `server/src/main/java/com/iyae/entity/enums/FulfillmentMethod.java` | CREATED |
| `server/src/main/java/com/iyae/entity/enums/ShippingCarrier.java` | CREATED |
| `server/src/main/java/com/iyae/entity/PickupLocation.java` | CREATED |
| `server/src/main/java/com/iyae/repository/PickupLocationRepository.java` | CREATED |
| `server/src/main/java/com/iyae/dto/CheckoutRequest.java` | CREATED |
| `server/src/main/java/com/iyae/dto/PickupLocationResponse.java` | CREATED |
| `server/src/main/java/com/iyae/dto/ShippingOptionResponse.java` | CREATED |
| `server/src/main/java/com/iyae/service/FulfillmentService.java` | CREATED |
| `server/src/main/java/com/iyae/controller/FulfillmentController.java` | CREATED |
| `server/src/test/java/com/iyae/service/FulfillmentServiceTest.java` | CREATED |
| `server/src/test/java/com/iyae/controller/FulfillmentControllerTest.java` | CREATED |
| `web/__tests__/lib/fulfillment.test.ts` | CREATED |

### Modified (16)

| File | Action |
|---|---|
| `server/src/main/java/com/iyae/entity/Order.java` | UPDATED (+4 fulfillment fields) |
| `server/src/main/java/com/iyae/service/CheckoutService.java` | UPDATED (`initiateCheckout(email, CheckoutRequest)`, shipping line item, persist fields, stub path) |
| `server/src/main/java/com/iyae/controller/CheckoutController.java` | UPDATED (optional `@RequestBody CheckoutRequest`) |
| `server/src/main/java/com/iyae/dto/OrderResponse.java` | UPDATED (+fulfillment fields + `pickupLocationName`) |
| `server/src/main/java/com/iyae/service/OrderService.java` | UPDATED (batch-resolve pickup-location names) |
| `server/src/main/java/com/iyae/config/SecurityConfig.java` | UPDATED (`GET /api/fulfillment/**` permitAll) |
| `server/src/test/java/com/iyae/service/CheckoutServiceTest.java` | UPDATED (+3 fulfillment cases) |
| `server/src/test/java/com/iyae/service/OrderServiceTest.java` | UPDATED (signature/fixture changes) |
| `server/src/test/java/com/iyae/controller/CheckoutControllerTest.java` | UPDATED (new checkout body) |
| `server/src/test/java/com/iyae/controller/OrderControllerTest.java` | UPDATED (new OrderResponse fields) |
| `server/src/test/java/com/iyae/IyaeApplicationTests.java` | UPDATED (context wiring for new beans) |
| `web/lib/api.ts` | UPDATED (`fulfillment` typed client + `Order`/`CheckoutRequest` types) |
| `web/app/checkout/page.tsx` | UPDATED (Ship/Pickup selector, carrier/location radios, live total) |
| `web/app/checkout/success/page.tsx` | UPDATED (show pickup instructions / carrier post-redirect) |
| `web/app/orders/page.tsx` | UPDATED (render fulfillment method / carrier / pickup location) |
| `web/app/orders/[id]/page.tsx` | UPDATED (render fulfillment detail) |

## Deviations from Plan

1. **`FulfillmentService` as a read-only resolver.** Implemented `resolve(...)` on a `@Transactional(readOnly = true)` service (list + validate + fee) rather than folding the logic into `CheckoutService`, keeping the one-way Checkout→Fulfillment dependency the plan called for.
2. **`OrderResponse` overload for pickup name.** `OrderResponse` gained an overloaded `from(Order, pickupLocationName)` factory and `OrderService` batch-resolves the pickup-location names (avoids a lazy fetch / N+1) rather than exposing only the id.
3. **3 extra pre-existing tests updated for the new signatures.** `CheckoutControllerTest`, `OrderControllerTest`, and `IyaeApplicationTests` needed touch-ups for the changed checkout body and the added `OrderResponse` fields / new beans — beyond the plan's named test edits.
4. **NPE guard in `OrderService.getOrders`.** Fixed a `Map.of().get(null)` NPE guard when resolving pickup-location names for orders that have no `pickupLocationId` (SHIP orders).

## Tests Written

| Test | Count | Covers |
|---|---|---|
| `FulfillmentServiceTest` | 8 | resolve ship+carrier / pickup+location / null-default; reject ship-no-carrier, pickup-no-location, unknown-location, mutually-exclusive; guardrail ≥2 options & never Canada-Post-only |
| `FulfillmentControllerTest` | 2 | `GET /api/fulfillment/pickup-locations` + `/shipping-options` return 200 unauthenticated (public) |
| `CheckoutServiceTest` (added) | +3 | SHIP adds fee line item + sets fields (total = items + fee); PICKUP fee 0 + location set + carrier null; invalid combo rejected |
| `web/__tests__/lib/fulfillment.test.ts` | 2 | Fulfillment typed client + checkout selector logic |

## Next Steps

- Code review (server + web diff; local uncommitted changes).
- Open a PR for the Phase 8 branch once review passes.
