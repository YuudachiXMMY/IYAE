# Plan: Toronto Physical Touchpoints + Shipping (Phase 8, lightweight v1)

## Summary
Add a **fulfillment choice at checkout** — in-city **Toronto pickup** or **multi-carrier shipping** — to the existing Stripe cart-checkout path. The buyer picks *Ship* (choosing from ≥2 carriers, never Canada-Post-only) or *Pickup* (choosing a seeded Toronto location) before the Stripe redirect; the choice + fee are persisted on the order and surfaced on the order/success pages. This is a **lightweight v1** (flat-rate carrier options, no live-rate APIs / label generation / tracking), mirroring the Phase 7 resale precedent.

## User Story
As a **Toronto Gen Z shopper**, I want to **choose in-city pickup or pick my shipping carrier at checkout**, so that **I can get my order the way that suits me and never depend on a single (possibly striking) carrier**.

## Problem → Solution
**Current state:** `POST /api/checkout` takes no body; every order is implicitly "shipped" with no carrier, no pickup option, and no shipping fee. The web checkout page just says "Taxes and shipping are computed at the secure payment step." There is no `pickup_locations` table, no carrier concept, and orders carry no fulfillment data. → **Desired state:** The buyer explicitly selects `SHIP` (with a carrier from a multi-carrier list) or `PICKUP` (with a Toronto location); the order records `fulfillment_method`, `pickup_location_id`, `shipping_carrier`, `shipping_fee`; shipping appears as a Stripe line item and in the order total; a Toronto order can be picked up in-city; the carrier list is never Canada-Post-only.

## Metadata
- **Complexity**: Large (~20 files: 1 migration, 2 enums, 1 entity, 1 repo, 3 DTOs, 1 service, 1 controller; modify Order/CheckoutService/CheckoutController/OrderResponse/OrderService/SecurityConfig; web api.ts + checkout page + order pages + success page + tests)
- **Source PRD**: `.claude/PRPs/prds/iyae.prd.md`
- **PRD Phase**: Phase 8 — Toronto Physical Touchpoints + Shipping
- **Estimated Files**: ~20 (12 server + ~8 web/test)

---

## UX Design

### Before
```
┌─────────────────────────────────────────┐
│  Checkout                                │
│  Review your order before placing it.    │
│  ─────────────────────────────────────   │
│  [ cart items … ]                         │
│  Subtotal            $X                   │
│  Shipping   "computed at payment step"    │
│  ─────────────────────────────────────   │
│  [ Place order ] ──► Stripe (no choice)   │
└─────────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────────┐
│  Checkout                                │
│  ─────────────────────────────────────   │
│  How do you want it?                      │
│   ( ) Ship it        (•) Pick it up       │
│                                           │
│   ┌── if Ship ──────────────────────┐     │
│   │ ( ) UPS            $12.99        │     │
│   │ (•) Purolator      $10.99        │     │
│   │ ( ) FedEx          $14.99        │     │
│   │ ( ) Canada Post    $9.99         │     │
│   └─────────────────────────────────┘     │
│   ┌── if Pickup ────────────────────┐     │
│   │ (•) IYAE Studio — 401 Queen St W │     │
│   │ ( ) Inland Market — 213 Sterling │     │
│   │     Free · usually ready in 24h  │     │
│   └─────────────────────────────────┘     │
│  ─────────────────────────────────────   │
│  Subtotal            $X                   │
│  Shipping            $10.99 / Free        │
│  Total               $X + fee             │
│  [ Place order ] ──► Stripe (with choice) │
└─────────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Checkout page | Single "Place order" | Ship/Pickup toggle + carrier radios / location radios, live total | Choice sent as `POST /api/checkout` body |
| `POST /api/checkout` | No body | Optional `CheckoutRequest` body (method + carrier / pickupLocationId) | Null body defaults to SHIP + default carrier (backward-compatible) |
| Stripe session | Items only | Items + a "Shipping — {carrier}" line item (0 for pickup) | Mirrors resale's custom-label line item |
| Order history / detail | status + total only | + fulfillment method, carrier or pickup location, shipping fee | New `OrderResponse` fields |
| Success page | Generic | Pickup → shows location + "we'll email when ready"; Ship → shows carrier | Reads order after redirect |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `server/src/main/java/com/iyae/service/CheckoutService.java` | 66–139, 281–330 | The exact Stripe line-item + Order-build + stub pattern to extend; `initiateCheckout` is the method to modify |
| P0 | `server/src/main/java/com/iyae/entity/Order.java` | all | Add 4 fulfillment columns here (mirror `resaleListingId` nullable-field style, lines 49–51) |
| P0 | `server/src/main/resources/db/migration/V16__resale_listings.sql` | all | The exact DDL style to mirror for V17 (CREATE TABLE + FK + indexes + ALTER orders ADD COLUMN) |
| P0 | `server/src/main/java/com/iyae/service/ResaleService.java` | 1–52, 305–312 | Canonical service shape: `@Service @RequiredArgsConstructor @Slf4j`, `requireUser`, ownership/validation via `IllegalArgumentException` |
| P0 | `server/src/main/java/com/iyae/controller/ResaleController.java` | all | Controller shape: `@RestController`, `Authentication`, public GET vs authed, `ResponseEntity` |
| P1 | `server/src/main/java/com/iyae/entity/enums/ResaleStatus.java` | all | Enum file style + javadoc convention |
| P1 | `server/src/main/java/com/iyae/entity/ResaleListing.java` | 40–63 | `@Enumerated(EnumType.STRING)` + `@Column(length=…)` + reserved-word avoidance (`cond`) pattern |
| P1 | `server/src/main/java/com/iyae/dto/CreateResaleListingRequest.java` | all | Jakarta validation record DTO style (`@NotNull`, `@DecimalMin`, `@Size`) |
| P1 | `server/src/main/java/com/iyae/dto/ResaleListingResponse.java` | all | Response record + static `from(...)` factory pattern |
| P1 | `server/src/main/java/com/iyae/controller/CheckoutController.java` | all | Where to add optional `@RequestBody CheckoutRequest`; email-verification gate stays |
| P1 | `server/src/main/java/com/iyae/dto/OrderResponse.java` | all | Extend this record + `from(Order)` |
| P1 | `server/src/main/java/com/iyae/config/SecurityConfig.java` | 35–51 | Add `permitAll` GET for `/api/fulfillment/**` (mirror line 43 resale) |
| P1 | `server/src/test/java/com/iyae/service/ResaleServiceTest.java` | 1–60 | Mockito test scaffold (`@Mock`/`@InjectMocks`/`@Spy ObjectMapper`) |
| P2 | `web/app/checkout/page.tsx` | 1–120 | The page to add the fulfillment selector to; `api.post("/api/checkout")` call at ~L60 |
| P2 | `web/lib/api.ts` | 195–258 | The `resale` typed-client + type block to mirror for a `fulfillment` client + `Order` type |
| P2 | `server/src/main/java/com/iyae/config/SchedulerConfig.java` | 27, 45–82 | (Reference only) how services are wired; **no new scheduled task needed** for this phase |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Stripe Checkout line items (Java) | Already used in `CheckoutService` (`SessionCreateParams.LineItem.builder()...setPriceData(...).setProductData(...)`) | Add shipping as another `LineItem` with a custom `ProductData` name and `setQuantity(1L)`; `unitAmount` in cents (fee × 100, `HALF_UP`) — no new API surface, mirror lines 84–100 |
| Stripe native `shipping_options` | (Alternative considered — rejected) | Stripe has `SessionCreateParams.setShippingOptions(...)` that also collects an address, but the codebase never uses it; adding shipping as a plain line item is the lower-risk mirror and keeps `order.totalAmount = items + fee` consistent |

> No external research needed beyond the above — feature uses established internal patterns (Flyway migration, JPA entity, Stripe line item, typed web client). Flat-rate carriers avoid any live-rate API integration.

---

## Patterns to Mirror

### NAMING_CONVENTION — enum with embedded data
// SOURCE: server/.../entity/enums/ResaleStatus.java + ResaleCondition (enum-per-file, javadoc, UPPER_SNAKE values)
```java
package com.iyae.entity.enums;

/** Shipping carriers offered at checkout. Intentionally multi-carrier — the marketplace is
 *  never Canada-Post-only (strike-resilience). Flat CAD rates for lightweight v1 (no live quotes). */
public enum ShippingCarrier {
    UPS("UPS", "12.99"),
    PUROLATOR("Purolator", "10.99"),
    FEDEX("FedEx", "14.99"),
    CANADA_POST("Canada Post", "9.99");

    private final String displayName;
    private final java.math.BigDecimal flatFee;
    ShippingCarrier(String displayName, String flatFee) {
        this.displayName = displayName;
        this.flatFee = new java.math.BigDecimal(flatFee);
    }
    public String getDisplayName() { return displayName; }
    public java.math.BigDecimal getFlatFee() { return flatFee; }
}
```

### ERROR_HANDLING
// SOURCE: server/.../service/ResaleService.java:279-308 (validation via IllegalArgumentException → 400 by GlobalExceptionHandler)
```java
User user = userRepository.findByEmail(email)
        .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
// ...
if (listing.getSeller().getId().equals(buyer.getId())) {
    throw new IllegalArgumentException("You can't buy your own listing");
}
```
> Use `IllegalArgumentException` for all invalid-input / not-found cases (maps to 400). Do NOT invent new exceptions.

### LOGGING_PATTERN
// SOURCE: server/.../service/CheckoutService.java:302 (@Slf4j, log.info/log.warn/log.error with args)
```java
log.info("STRIPE_SECRET_KEY not configured — created stub order {} for user {}", order.getId(), user.getEmail());
```

### REPOSITORY_PATTERN
// SOURCE: existing `OrderRepository` / `ResaleListingRepository` (Spring Data JPA interface, no impl)
```java
public interface PickupLocationRepository extends JpaRepository<PickupLocation, Long> {
    java.util.List<PickupLocation> findByActiveTrueOrderByIdAsc();
}
```

### SERVICE_PATTERN
// SOURCE: server/.../service/ResaleService.java:49-63 (class annotations + constructor injection)
```java
@Slf4j
@Service
@RequiredArgsConstructor
public class FulfillmentService {
    private final PickupLocationRepository pickupLocationRepository;
    // read-only queries use @Transactional(readOnly = true)
}
```

### DTO_PATTERN — request record with validation
// SOURCE: server/.../dto/CreateResaleListingRequest.java
```java
public record CheckoutRequest(
        @NotNull(message = "fulfillmentMethod is required") FulfillmentMethod fulfillmentMethod,
        Long pickupLocationId,          // required iff PICKUP
        ShippingCarrier shippingCarrier // required iff SHIP
) {}
```

### DTO_PATTERN — response record with `from(...)`
// SOURCE: server/.../dto/OrderResponse.java + ResaleListingResponse.from(...)
```java
public static PickupLocationResponse from(PickupLocation loc) {
    return new PickupLocationResponse(loc.getId(), loc.getName(), loc.getAddressLine(),
            loc.getCity(), loc.getInstructions());
}
```

### CONTROLLER_PATTERN
// SOURCE: server/.../controller/ResaleController.java (public GET + authed via Authentication)
```java
@RestController
@RequestMapping("/api/fulfillment")
@RequiredArgsConstructor
public class FulfillmentController {
    private final FulfillmentService fulfillmentService;

    @GetMapping("/pickup-locations")
    public ResponseEntity<List<PickupLocationResponse>> pickupLocations() {
        return ResponseEntity.ok(fulfillmentService.listActivePickupLocations());
    }

    @GetMapping("/shipping-options")
    public ResponseEntity<List<ShippingOptionResponse>> shippingOptions() {
        return ResponseEntity.ok(fulfillmentService.listShippingOptions());
    }
}
```

### TEST_STRUCTURE
// SOURCE: server/.../service/ResaleServiceTest.java:38-60 (Mockito extension, @Mock/@InjectMocks)
```java
@ExtendWith(MockitoExtension.class)
class FulfillmentServiceTest {
    @Mock PickupLocationRepository pickupLocationRepository;
    @InjectMocks FulfillmentService service;
    // ...
}
```

### MIGRATION_PATTERN
// SOURCE: server/.../db/migration/V16__resale_listings.sql (CREATE TABLE + FK + index + ALTER orders)
```sql
CREATE TABLE pickup_locations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    address_line VARCHAR(255) NOT NULL,
    city VARCHAR(80) NOT NULL DEFAULT 'Toronto',
    instructions VARCHAR(500) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO pickup_locations (name, address_line, city, instructions) VALUES
  ('IYAE Studio — Queen West', '401 Queen St W', 'Toronto', 'Ring the studio buzzer; usually ready within 24h.'),
  ('Inland Market Pop-up', '213 Sterling Rd', 'Toronto', 'Weekend pickup at the IYAE booth.');
ALTER TABLE orders
    ADD COLUMN fulfillment_method VARCHAR(16) NOT NULL DEFAULT 'SHIP',
    ADD COLUMN pickup_location_id BIGINT NULL,
    ADD COLUMN shipping_carrier VARCHAR(24) NULL,
    ADD COLUMN shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    ADD CONSTRAINT fk_orders_pickup_location FOREIGN KEY (pickup_location_id)
        REFERENCES pickup_locations(id) ON DELETE SET NULL;
```

### WEB_TYPED_CLIENT
// SOURCE: web/lib/api.ts:232-258 (typed client object + interfaces)
```ts
export type FulfillmentMethod = "SHIP" | "PICKUP";
export interface PickupLocation { id: number; name: string; addressLine: string; city: string; instructions: string | null; }
export interface ShippingOption { carrier: string; displayName: string; fee: number; }
export const fulfillment = {
  pickupLocations: (signal?: AbortSignal) =>
    api.get<PickupLocation[]>("/api/fulfillment/pickup-locations", { signal }),
  shippingOptions: (signal?: AbortSignal) =>
    api.get<ShippingOption[]>("/api/fulfillment/shipping-options", { signal }),
};
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `server/src/main/resources/db/migration/V17__fulfillment_and_shipping.sql` | CREATE | `pickup_locations` table + seed rows; 4 fulfillment columns on `orders` |
| `server/src/main/java/com/iyae/entity/enums/FulfillmentMethod.java` | CREATE | `{ SHIP, PICKUP }` |
| `server/src/main/java/com/iyae/entity/enums/ShippingCarrier.java` | CREATE | Multi-carrier enum w/ display name + flat CAD fee |
| `server/src/main/java/com/iyae/entity/PickupLocation.java` | CREATE | JPA entity for the new table |
| `server/src/main/java/com/iyae/repository/PickupLocationRepository.java` | CREATE | `findByActiveTrueOrderByIdAsc()` |
| `server/src/main/java/com/iyae/dto/CheckoutRequest.java` | CREATE | Checkout body (method + carrier/pickup) |
| `server/src/main/java/com/iyae/dto/PickupLocationResponse.java` | CREATE | Public pickup-location DTO |
| `server/src/main/java/com/iyae/dto/ShippingOptionResponse.java` | CREATE | Carrier option DTO (carrier, displayName, fee) |
| `server/src/main/java/com/iyae/service/FulfillmentService.java` | CREATE | List locations/options; resolve + validate a `CheckoutRequest`, return the fee |
| `server/src/main/java/com/iyae/controller/FulfillmentController.java` | CREATE | `GET /api/fulfillment/pickup-locations`, `GET /api/fulfillment/shipping-options` |
| `server/src/main/java/com/iyae/entity/Order.java` | UPDATE | Add `fulfillmentMethod`, `pickupLocationId`, `shippingCarrier`, `shippingFee` |
| `server/src/main/java/com/iyae/service/CheckoutService.java` | UPDATE | `initiateCheckout(email, req)`: validate via FulfillmentService, add shipping line item, set order fields, total += fee (real + stub paths) |
| `server/src/main/java/com/iyae/controller/CheckoutController.java` | UPDATE | Accept optional `@RequestBody CheckoutRequest`; pass through |
| `server/src/main/java/com/iyae/dto/OrderResponse.java` | UPDATE | Expose the 4 fulfillment fields (+ pickup location name via lookup or store denormalized) |
| `server/src/main/java/com/iyae/service/OrderService.java` | UPDATE | If OrderResponse needs the pickup-location name, resolve it here (batch/lookup) |
| `server/src/main/java/com/iyae/config/SecurityConfig.java` | UPDATE | `permitAll` `GET /api/fulfillment/**` |
| `server/src/test/java/com/iyae/service/FulfillmentServiceTest.java` | CREATE | Validation matrix (ship needs carrier; pickup needs valid location; guardrail ≥2 carriers, not CP-only) |
| `server/src/test/java/com/iyae/controller/FulfillmentControllerTest.java` | CREATE | `@WebMvcTest` GET endpoints (public) |
| `server/src/test/java/com/iyae/service/CheckoutServiceTest.java` | UPDATE | New cases: ship adds fee line item + sets fields; pickup fee 0 + location set; invalid combos rejected |
| `web/lib/api.ts` | UPDATE | `fulfillment` client + types; `Order` type gains fulfillment fields; checkout call sends body |
| `web/app/checkout/page.tsx` | UPDATE | Ship/Pickup selector, carrier/location radios, live total, pass body to `/api/checkout` |
| `web/app/checkout/success/page.tsx` | UPDATE | Show pickup instructions or carrier post-redirect |
| `web/app/orders/page.tsx` + `web/app/orders/[id]/page.tsx` | UPDATE | Render fulfillment method / carrier / pickup location |
| `web/__tests__/...` (fulfillment) | CREATE | Vitest: fulfillment client + checkout selector logic |

## NOT Building
- **Live carrier rate quotes** (UPS/Purolator/Canada Post rate APIs) — flat CAD rates only in v1.
- **Label generation, tracking numbers, shipment status** — order stores the *chosen* carrier, nothing downstream.
- **Real same-day courier dispatch / delivery windows** — pickup "usually ready in 24h" copy only; no scheduling/time-slots/QR codes.
- **Address book / address entry UI** — Stripe hosted checkout collects the shipping address when needed; we don't build address management.
- **Resale (Phase 7) fulfillment** — `initiateResaleCheckout` stays unchanged; peer-to-peer pre-loved logistics is a separate concern (deferred).
- **Admin CRUD for pickup locations** — locations are seeded via migration; no admin UI in v1.
- **Tax calculation** — unchanged from current behavior.

---

## Step-by-Step Tasks

### Task 1: V17 migration (schema + seed)
- **ACTION**: Create `server/src/main/resources/db/migration/V17__fulfillment_and_shipping.sql`.
- **IMPLEMENT**: `pickup_locations` table + 2 seed INSERTs + `ALTER TABLE orders ADD` the 4 columns + FK to `pickup_locations` (`ON DELETE SET NULL`), per MIGRATION_PATTERN.
- **MIRROR**: `V16__resale_listings.sql` (DDL style, DEFAULT CURRENT_TIMESTAMP, `ON DELETE SET NULL`).
- **GOTCHA**: `orders.fulfillment_method` must be `NOT NULL DEFAULT 'SHIP'` so existing/legacy rows validate under Hibernate `ddl-auto: validate`. Column types must match the JPA `@Column` exactly (VARCHAR lengths, DECIMAL(10,2)).
- **VALIDATE**: `flywayValidate` is not configured; instead rely on `./gradlew bootRun` against a fresh MySQL applying V1–V17, or the full test suite (H2 auto-DDL) — see Task 12.

### Task 2: Enums `FulfillmentMethod` + `ShippingCarrier`
- **ACTION**: Create both enum files under `entity/enums/`.
- **IMPLEMENT**: `FulfillmentMethod { SHIP, PICKUP }`; `ShippingCarrier` with `displayName` + `BigDecimal flatFee` per NAMING_CONVENTION.
- **MIRROR**: `ResaleStatus.java` (file layout, javadoc) + `ResaleCondition` (enum with fields, if it carries data — check it).
- **GOTCHA**: The carrier list MUST contain ≥2 carriers with at least one non-Canada-Post (the "never Canada-Post-only" guardrail); the guardrail is asserted in Task 9's test.
- **VALIDATE**: compiles; `ShippingCarrier.values().length >= 2`.

### Task 3: `PickupLocation` entity + repository
- **ACTION**: Create `entity/PickupLocation.java` and `repository/PickupLocationRepository.java`.
- **IMPLEMENT**: Fields `id, name, addressLine (address_line), city, instructions, active, createdAt` with Lombok `@Getter/@Setter/@Builder/@NoArgsConstructor/@AllArgsConstructor`, `@Entity @Table(name="pickup_locations")`, `@CreationTimestamp`. Repo: `findByActiveTrueOrderByIdAsc()`.
- **MIRROR**: `ResaleListing.java` (annotations, `@Column(name=…)` snake_case mapping) + any existing Spring Data repo.
- **GOTCHA**: Map `addressLine` → `@Column(name = "address_line")`; `active` is `boolean` (primitive) with DB default TRUE.
- **VALIDATE**: entity fields ↔ V17 columns 1:1 (name, type, nullability).

### Task 4: DTOs — `CheckoutRequest`, `PickupLocationResponse`, `ShippingOptionResponse`
- **ACTION**: Create 3 record DTOs under `dto/`.
- **IMPLEMENT**: `CheckoutRequest(FulfillmentMethod fulfillmentMethod, Long pickupLocationId, ShippingCarrier shippingCarrier)` with `@NotNull` on `fulfillmentMethod` only (cross-field rules live in the service). `PickupLocationResponse` + static `from(PickupLocation)`. `ShippingOptionResponse(String carrier, String displayName, BigDecimal fee)`.
- **MIRROR**: `CreateResaleListingRequest` (validation) + `ResaleListingResponse.from(...)`.
- **IMPORTS**: `jakarta.validation.constraints.NotNull`, `java.math.BigDecimal`.
- **GOTCHA**: Do NOT put `@NotNull` on `pickupLocationId`/`shippingCarrier` — they're conditionally required; enforce in `FulfillmentService.resolve`.
- **VALIDATE**: compiles.

### Task 5: `FulfillmentService`
- **ACTION**: Create `service/FulfillmentService.java`.
- **IMPLEMENT**:
  - `listActivePickupLocations()` → `pickupLocationRepository.findByActiveTrueOrderByIdAsc()` mapped via `PickupLocationResponse.from`.
  - `listShippingOptions()` → `Arrays.stream(ShippingCarrier.values()).map(c -> new ShippingOptionResponse(c.name(), c.getDisplayName(), c.getFlatFee()))`.
  - `record ResolvedFulfillment(FulfillmentMethod method, Long pickupLocationId, ShippingCarrier carrier, BigDecimal fee)`.
  - `resolve(CheckoutRequest req)` → if `req == null` default to `SHIP` + a `DEFAULT_CARRIER` (first non-Canada-Post, e.g. `PUROLATOR`), fee = its flatFee. If `PICKUP`: `pickupLocationId` required + must exist among active locations; `carrier` must be null; fee = `ZERO`. If `SHIP`: `carrier` required; `pickupLocationId` must be null; fee = carrier.flatFee. Throw `IllegalArgumentException` on any violation.
- **MIRROR**: `ResaleService` class annotations + guard clauses; SERVICE_PATTERN.
- **IMPORTS**: `java.math.BigDecimal`, `java.util.Arrays`, `org.springframework.transaction.annotation.Transactional`.
- **GOTCHA**: Keep `FulfillmentService` free of any dependency on `CheckoutService` (one-way, mirrors the Resale/Checkout separation at `ResaleService.java:46-48`).
- **VALIDATE**: unit test in Task 9.

### Task 6: `FulfillmentController` + SecurityConfig
- **ACTION**: Create `controller/FulfillmentController.java`; edit `SecurityConfig.java`.
- **IMPLEMENT**: Two public `@GetMapping`s per CONTROLLER_PATTERN. In `SecurityConfig`, add `.requestMatchers(HttpMethod.GET, "/api/fulfillment/**").permitAll()` **before** `.anyRequest().authenticated()` (place near line 43, the resale permitAll).
- **MIRROR**: `ResaleController` GET methods; `SecurityConfig.java:43`.
- **GOTCHA**: These are catalog-like reference reads — public (no auth) so the checkout page can load options for guests browsing; the actual checkout still requires auth.
- **VALIDATE**: `FulfillmentControllerTest` (Task 10) — GET returns 200 unauthenticated.

### Task 7: Extend `Order` entity
- **ACTION**: Edit `entity/Order.java`.
- **IMPLEMENT**: Add `@Enumerated(EnumType.STRING) @Column(name="fulfillment_method", nullable=false) @Builder.Default private FulfillmentMethod fulfillmentMethod = FulfillmentMethod.SHIP;`, `@Column(name="pickup_location_id") private Long pickupLocationId;`, `@Enumerated(EnumType.STRING) @Column(name="shipping_carrier") private ShippingCarrier shippingCarrier;`, `@Column(name="shipping_fee", precision=10, scale=2) @Builder.Default private BigDecimal shippingFee = BigDecimal.ZERO;`.
- **MIRROR**: `Order.resaleListingId` nullable-Long field (lines 49–51) + `ResaleListing` `@Enumerated(EnumType.STRING)` usage.
- **GOTCHA**: `@Builder.Default` is required on `fulfillmentMethod` and `shippingFee` or the builder sets them null and breaks the NOT NULL columns.
- **VALIDATE**: full test suite (existing `CheckoutServiceTest` builds Orders via builder).

### Task 8: Wire fulfillment into `CheckoutService` + `CheckoutController`
- **ACTION**: Edit `CheckoutService.initiateCheckout` and `CheckoutController.checkout`.
- **IMPLEMENT**:
  - Controller: `checkout(@RequestBody(required = false) CheckoutRequest request, Authentication auth)` → pass `request` into `checkoutService.initiateCheckout(email, request)`.
  - Service: change signature to `initiateCheckout(String email, CheckoutRequest req)`. Call `var f = fulfillmentService.resolve(req)` early. In the real Stripe path: after building item `lineItems`, if `f.fee()` > 0 add a shipping `LineItem` (`setQuantity(1L)`, name `"Shipping — " + f.carrier().getDisplayName()`, unitAmount `fee×100 HALF_UP`). Set `total = itemsTotal.add(f.fee())`. On the `Order.builder()` add `.fulfillmentMethod(f.method()).pickupLocationId(f.pickupLocationId()).shippingCarrier(f.carrier()).shippingFee(f.fee())`. Apply the same to `stubCheckout` (thread `f` through — add a param).
  - Inject `FulfillmentService` via the constructor (`@RequiredArgsConstructor` picks it up).
- **MIRROR**: existing line-item + Order-build in `CheckoutService.java:84-125` and the stub at `281-308`.
- **GOTCHA**: `stubCheckout(User)` currently takes only the user — change to `stubCheckout(User, ResolvedFulfillment)` so the stub order also records fulfillment (dev/analytics parity). Keep the existing `analyticsService.record(...)` calls unchanged.
- **GOTCHA**: `initiateResaleCheckout` must NOT change signature — it keeps the no-fulfillment behavior (out of scope).
- **VALIDATE**: `CheckoutServiceTest` new cases (Task 11).

### Task 9: `FulfillmentServiceTest`
- **ACTION**: Create the service unit test.
- **IMPLEMENT**: cases — ship-with-carrier resolves fee=carrier flatFee & pickup null; pickup-with-valid-location resolves fee=0 & carrier null; ship-without-carrier → IllegalArgumentException; pickup-without-location → IAE; pickup-with-unknown-location → IAE; ship-with-pickupLocation set → IAE (mutually exclusive); null request → SHIP default carrier & non-zero fee; **guardrail**: `listShippingOptions()` has ≥2 options and contains a non-`CANADA_POST` carrier.
- **MIRROR**: `ResaleServiceTest` scaffold (TEST_STRUCTURE).
- **VALIDATE**: `./gradlew test --tests '*FulfillmentServiceTest'`.

### Task 10: `FulfillmentControllerTest`
- **ACTION**: Create `@WebMvcTest(FulfillmentController.class)`.
- **IMPLEMENT**: GET `/api/fulfillment/pickup-locations` → 200 JSON array (unauthenticated); GET `/api/fulfillment/shipping-options` → 200 with ≥2 items. Mock `FulfillmentService`. Include the `WebMvcSecurityConfig` test support + a `BrandProperties` mock if the security config requires it (check how `SizeRecommendationControllerTest` wires `@WebMvcTest`).
- **MIRROR**: `SizeRecommendationControllerTest` / `ResaleControllerTest`.
- **VALIDATE**: `./gradlew test --tests '*FulfillmentControllerTest'`.

### Task 11: Extend `CheckoutServiceTest`
- **ACTION**: Add cases to the existing test.
- **IMPLEMENT**: (a) SHIP request → saved Order has `fulfillmentMethod=SHIP`, `shippingCarrier` set, `shippingFee>0`, `totalAmount = items + fee`; (b) PICKUP request → `fee=0`, `pickupLocationId` set, `shippingCarrier=null`; (c) invalid combo bubbles up as IAE (or delegate — assert `fulfillmentService.resolve` is invoked). Mock the new `FulfillmentService` dependency.
- **MIRROR**: existing `CheckoutServiceTest` size-in-line-items assertions.
- **GOTCHA**: Adding a `@Mock FulfillmentService` to the test means all existing tests must stub `resolve(...)` (use a lenient default in `@BeforeEach` returning a SHIP default) or they'll NPE.
- **VALIDATE**: `./gradlew test --tests '*CheckoutServiceTest'`.

### Task 12: `OrderResponse` + web surfaces
- **ACTION**: Edit `OrderResponse` (+ `OrderService` if a location name lookup is needed); edit `web/lib/api.ts`, `web/app/checkout/page.tsx`, `checkout/success/page.tsx`, `orders/page.tsx`, `orders/[id]/page.tsx`.
- **IMPLEMENT**:
  - `OrderResponse`: add `fulfillmentMethod`, `shippingCarrier` (nullable), `shippingFee`, `pickupLocationId` (and optionally a resolved `pickupLocationName` — resolve in `OrderService` via `PickupLocationRepository` to avoid a lazy fetch; keep it simple: expose id only if name-resolution adds complexity).
  - `api.ts`: `fulfillment` client + types (WEB_TYPED_CLIENT); extend `Order` interface; change the checkout call to `api.post<CheckoutResponse>("/api/checkout", body)` where `body: CheckoutRequest`.
  - `checkout/page.tsx`: `useState` for method + carrier + pickupLocationId; fetch options on mount (`fulfillment.shippingOptions` / `.pickupLocations` with an AbortController — mirror existing hook usage in the repo); radios; recompute displayed total = cart + selected fee; block "Place order" until a valid selection exists.
- **MIRROR**: `web/lib/api.ts:232-258` (client), `checkout/page.tsx` existing state/handlers, resale sell page (`web/app/resale/sell/page.tsx`) for a form-with-options layout.
- **GOTCHA**: All web pages are `"use client"`; use semantic tokens (`bg-card`, `text-foreground`, `border-border`) — no hardcoded `stone-*`/`bg-white` (see CLAUDE.md web conventions).
- **VALIDATE**: `cd web && npm run test && npx tsc --noEmit && npm run build`.

### Task 13: Docs sync
- **ACTION**: Update `server/CLAUDE.md` (migration list → V17, controllers/services/DTOs/enums counts, endpoint table) and root `CLAUDE.md` changelog + PRD phase status.
- **IMPLEMENT**: Add V17 to the migration table; add `FulfillmentController`/`FulfillmentService`/`PickupLocation`; add `GET /api/fulfillment/**` to the public endpoints table; add `FulfillmentMethod`/`ShippingCarrier` to the enums table; append a changelog row.
- **MIRROR**: existing changelog rows.
- **VALIDATE**: counts match the actual file tree.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| resolve ship+carrier | `CheckoutRequest(SHIP, null, UPS)` | fee=12.99, carrier=UPS, pickup=null | No |
| resolve pickup+location | `(PICKUP, 1L, null)` w/ location 1 active | fee=0, pickupLocationId=1, carrier=null | No |
| resolve ship no carrier | `(SHIP, null, null)` | IllegalArgumentException | Yes |
| resolve pickup no location | `(PICKUP, null, null)` | IllegalArgumentException | Yes |
| resolve pickup bad location | `(PICKUP, 999L, null)` not active | IllegalArgumentException | Yes |
| resolve mutually-exclusive | `(SHIP, 1L, UPS)` | IllegalArgumentException | Yes |
| resolve null request | `null` | SHIP + default carrier, fee>0 | Yes |
| shipping options guardrail | `listShippingOptions()` | size≥2 AND ∃ carrier ≠ CANADA_POST | Yes (resilience invariant) |
| checkout ship total | cart $X + UPS | order.totalAmount = X + 12.99, fee line item present | No |
| checkout pickup total | cart $X + pickup | order.totalAmount = X, fee=0, no fee line item | No |
| controller GET options | unauthenticated | 200 + array | Yes (public) |

### Edge Cases Checklist
- [ ] Null / missing checkout body → defaults to SHIP + default carrier (backward compatible)
- [ ] PICKUP with a carrier set, or SHIP with a pickupLocationId set → rejected (mutually exclusive)
- [ ] Inactive/unknown pickup location → rejected
- [ ] Empty cart still rejected before fulfillment fee applied (existing guard runs first)
- [ ] Stub checkout (no `STRIPE_SECRET_KEY`) records fulfillment fields too
- [ ] Shipping-options list never degrades to Canada-Post-only (guardrail test)
- [ ] Resale checkout path unchanged (no fulfillment fields, no regression)

---

## Validation Commands

### Static Analysis
```bash
cd web && npx tsc --noEmit
```
EXPECT: Zero type errors

### Unit Tests (server, affected)
```bash
cd server && ./gradlew test --tests '*FulfillmentServiceTest' --tests '*FulfillmentControllerTest' --tests '*CheckoutServiceTest'
```
EXPECT: All pass

### Full Test Suite
```bash
cd server && ./gradlew test        # JUnit 5 (H2 auto-DDL validates entity↔schema shape)
cd web && npm run test             # Vitest
```
EXPECT: No regressions (server currently ~517 green incl. resale; web api ~31)

### Database Validation
```bash
# Fresh MySQL boot applies V1–V17 and Hibernate ddl-auto:validate confirms entity↔schema match
cd server && ./gradlew bootRun     # (against a running MySQL) — must start without a Flyway/validate error
```
EXPECT: Boots clean; `pickup_locations` seeded; `orders` has the 4 new columns

### Browser Validation
```bash
./dev.sh start && cd web && npm run dev
```
EXPECT: Checkout page shows Ship/Pickup selector; choosing Pickup shows a Toronto location and $0 shipping; choosing Ship lists ≥2 carriers; total updates; placing an order (stub mode) records the choice; order detail shows it.

### Manual Validation
- [ ] Load `/checkout` with items → Ship/Pickup toggle renders, options load
- [ ] Pick "Pickup — IYAE Studio" → total shows Free shipping → place order → success page shows pickup instructions
- [ ] Pick "Ship — Purolator" → total adds $10.99 → order detail shows carrier + fee
- [ ] `GET /api/fulfillment/shipping-options` returns ≥2 carriers unauthenticated

---

## Acceptance Criteria
- [ ] A Toronto order can be placed for **in-city pickup** at a seeded location (PRD success signal)
- [ ] Checkout offers **multiple carriers**; the option set is **never Canada-Post-only** (PRD success signal, guardrail test)
- [ ] Order persists `fulfillment_method` / `pickup_location_id` / `shipping_carrier` / `shipping_fee`; total includes shipping
- [ ] All validation commands pass; no regressions in existing checkout/resale/order tests
- [ ] No type errors; web build succeeds
- [ ] Web uses semantic tokens (dark-mode safe)

## Completion Checklist
- [ ] Code follows discovered patterns (migration/enum/entity/DTO/service/controller/typed-client)
- [ ] Error handling uses `IllegalArgumentException` (→400) as in the codebase
- [ ] Logging via `@Slf4j` `log.*` with parameterized messages
- [ ] Tests follow the Mockito `@Mock/@InjectMocks` + `@WebMvcTest` patterns
- [ ] No hardcoded values in web (semantic tokens; CAD via `Intl.NumberFormat("en-CA")`)
- [ ] Docs updated (server/CLAUDE.md + root changelog + PRD phase status)
- [ ] No unnecessary scope additions (no live rates / labels / tracking / address book)
- [ ] Self-contained — no further codebase searching needed

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Adding `@Mock FulfillmentService` NPEs existing `CheckoutServiceTest` cases | M | M | Lenient `@BeforeEach` stub of `resolve(any())` returning a SHIP default |
| `orders` new NOT NULL column fails Hibernate `validate` on legacy rows / test H2 | M | H | `DEFAULT 'SHIP'`/`DEFAULT 0.00` in DDL + `@Builder.Default` on entity; H2 create-drop regenerates from entity |
| Changing `POST /api/checkout` to accept a body breaks the current no-body web call | L | M | `@RequestBody(required=false)` + null → SHIP default; update web call in the same change |
| Stripe line-item shipping vs native `shipping_options` divergence | L | L | Documented decision: plain line item keeps `total = items + fee` consistent; no address-collection dependency |
| Scope creep into real carrier integration | M | M | Explicit NOT-Building list; flat-rate enum only |

## Notes
- **Phase selection rationale**: The PRD table marks Phase 5 `pending`, but it is fully implemented in code (`AdminController`, `AdminModerationService`, `SizeRecommendationService`, `ProductSpecifications.localOnly`, migrations V11–V13 — confirmed this session). Phases 6 and 7 are merged (PR #15/#16). Phase 8 is the genuinely-unbuilt next phase; its dependency (Phase 5) is satisfied in code. This plan therefore targets **Phase 8**. (Recommend also correcting the PRD Phase 5 status to `complete` in a follow-up.)
- **Lightweight-v1 framing** deliberately mirrors Phase 7 resale: ship a real, testable fulfillment choice + Toronto pickup + multi-carrier resilience now; defer live rates / labels / tracking / same-day dispatch, exactly as Phase 7 deferred trade-in credit / authentication / logistics.
- **Currency**: all money stays CAD (`Intl.NumberFormat("en-CA")` on web; `"cad"` in Stripe; `BigDecimal` server-side) — consistent with the Phase 1 CAD single-source decision.
