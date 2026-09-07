# Plan: Resale / Circular / Trade-in (Phase 7 — lightweight v1)

## Summary
Add a lightweight peer-to-peer resale layer so a buyer can re-list an item they already purchased as a "pre-loved" listing, and other shoppers can browse and buy it. Resale is a **self-contained vertical**: a new `resale_listings` table + `ResaleListing` entity + `ResaleService` + `ResaleController` + a small web surface (`/resale` browse, `/resale/[id]` buy, `/resale/sell` create). It **reuses** the existing `StripeCheckoutGateway`, the `Order` record, and the existing Stripe webhook for the money path, and **does not touch** the shared cart/checkout hot path (which Phase 9 KPI instrumentation depends on).

## User Story
As a **Toronto Gen-Z shopper who already bought a piece on IYAE**, I want to **re-list that piece as pre-loved and have others buy it**, so that **I recover value, extend the garment's life, and shop more affordably/sustainably**.

## Problem → Solution
**Current state:** Every product is a designer's first-hand catalog item; once a buyer owns a piece there is no path to resell it, so there is no circular/affordability layer (a "Should" v1 capability in the PRD, sustainability being a core Gen-Z value).
**Desired state:** A buyer can turn any owned order-item into a pre-loved `resale_listing` (condition + asking price + optional photos), browse a resale feed, and buy a listing through the existing Stripe money path; the unique second-hand unit can be sold exactly once.

## Metadata
- **Complexity**: **Medium–Large** (~1 migration + 2 enums + 1 entity + 1 repo + ~5 DTOs + 1 new service + small `CheckoutService`/`SchedulerConfig`/`SecurityConfig` edits + `api.ts` client + 3 pages + 1 card + tests)
- **Source PRD**: `.claude/PRPs/prds/iyae.prd.md`
- **PRD Phase**: Phase 7 — Resale / Circular / Trade-in (`pending` → planned here)
- **Scope decision (owner-confirmed)**: **Lightweight v1** — buyers reselling their own purchased items; **no** trade-in store credit, **no** condition-authentication workflow, **no** separate resale marketplace/logistics. (Deferred alternatives listed under *NOT Building*.)
- **Estimated Files**: ~14 new, ~6 edited

---

## UX Design

### Before
```
┌──────────────────────────────────────────────┐
│  /orders/[id]  →  "Order #12 · DELIVERED"      │
│  Linen Shirt (M) ……………………… $59.99          │
│  [ no way to do anything with an owned item ]  │
└──────────────────────────────────────────────┘
```

### After
```
┌──────────────────────────────────────────────┐   ┌──────────────────────────────────────────────┐
│  /resale/sell  (Sell a pre-loved piece)        │   │  /resale  (Pre-loved feed)                     │
│  Eligible from your orders:                    │   │  ┌───────┐ ┌───────┐ ┌───────┐                 │
│   ○ Linen Shirt (M)   ○ Wool Coat (L)          │   │  │ IMG   │ │ IMG   │ │ IMG   │  … grid         │
│   → condition: [Excellent ▾]                   │   │  │Pre-loved│ …    │ │Good   │                  │
│   → asking price: [$ 32.00 ] CAD               │   │  │Linen Sh.│      │ │$32 CAD│                  │
│   → photos (optional)  [ List it ]             │   │  └───────┘ └───────┘ └───────┘                 │
└──────────────────────────────────────────────┘   └───────────────────┬──────────────────────────┘
                                                                        │  click card
                                                          ┌─────────────▼───────────────────────────┐
                                                          │  /resale/[id]  (pre-loved PDP)            │
                                                          │  Linen Shirt · size M · Excellent          │
                                                          │  Sold by @emma · $32.00 CAD                │
                                                          │  [ Buy now ] → Stripe → order + SOLD        │
                                                          └──────────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| NavBar | Shop / Community / Style Lab | + **Resale** ("Pre-loved") link | mirror existing NavBar links |
| Order detail `/orders/[id]` | terminal view | + **"Sell this piece"** entry → `/resale/sell` | optional deep-link with productId prefilled |
| New `/resale` | — | Pre-loved catalog grid (LISTED only) | mirrors `/products` browse + `ProductListItem` card |
| New `/resale/[id]` | — | Pre-loved PDP with **Buy now** | dedicated (a listing ≠ a catalog product) |
| New `/resale/sell` | — | Pick eligible owned item → condition/price/photos → list | eligibility derived from paid orders |
| Buy | cart → `/api/checkout` | **buy-now** → `/api/resale/listings/{id}/checkout` → Stripe | reuses `StripeCheckoutGateway` + webhook |

---

## Mandatory Reading

Read before implementing. All paths repo-relative.

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `server/src/main/java/com/iyae/service/ProductService.java` | 40–214, 385–410 | The CRUD + ownership (`requireOwnedProduct`, `resolveDesignerProfile`) + JSON-list serialize patterns to mirror in `ResaleService` |
| P0 | `server/src/main/java/com/iyae/service/CheckoutService.java` | 35–232 | Stripe session build + `Order` create + `itemsSnapshot` shape + webhook fulfillment; resale checkout + SOLD-marking hook here |
| P0 | `server/src/main/java/com/iyae/service/ReviewService.java` | 22–110 | Cleanest ownership create/delete + duplicate-guard (`DataIntegrityViolationException`→`IllegalArgumentException`) |
| P0 | `server/src/main/resources/db/migration/V15__community_feeds_share_report.sql` | all | Latest migration; exact DDL style (CREATE TABLE + FK + UNIQUE + INDEX). **Next version = V16.** |
| P0 | `server/src/main/resources/db/migration/V12__marketplace_local_and_measurements.sql` | all | Child-table + FK + index style to mirror |
| P0 | `server/src/main/java/com/iyae/config/SecurityConfig.java` | 34–55 | Route-matcher ordering (first-match wins) — where to add `/api/resale/**` rules |
| P1 | `server/src/main/java/com/iyae/entity/Product.java` | all | Entity annotation conventions (Lombok, `@Enumerated(EnumType.STRING)`, JSON/TEXT columns, timestamps) |
| P1 | `server/src/main/java/com/iyae/entity/Order.java` | all | Add `resaleListingId`; `itemsSnapshot` is a JSON string column |
| P1 | `server/src/main/java/com/iyae/repository/ProductRepository.java` | all | Spring-Data + `JpaSpecificationExecutor` pattern for `ResaleListingRepository` |
| P1 | `server/src/main/java/com/iyae/repository/ProductSpecifications.java` | all | Dynamic filter `Specification` to mirror for resale browse |
| P1 | `server/src/main/java/com/iyae/dto/CreateProductRequest.java` + `dto/ReviewRequest.java` | all | Jakarta validation on record DTOs |
| P1 | `server/src/main/java/com/iyae/dto/ProductResponse.java` | 15–106 | `record` response + static `from(...)` mapping + JSON parse helper |
| P1 | `server/src/main/java/com/iyae/config/SchedulerConfig.java` | all | Where/how to add the stale-reservation release task (see server `CLAUDE.md` "Scheduled Tasks") |
| P1 | `server/src/main/java/com/iyae/controller/DesignerProductController.java` + `controller/OrderController.java` | all | Controller shape (`Authentication authentication` → `authentication.getName()`, `@Valid @RequestBody`, `ResponseEntity` codes) |
| P0 | `web/lib/api.ts` | 56–65, 268–273, 416–458 | `request()` core + a resource-client object (`promotions`, `posts`) to mirror for a `resale` client |
| P1 | `web/components/ProductListItem.tsx` | all | Card to mirror for `ResaleListingCard` (semantic tokens, `Local` badge → `Pre-loved`/condition badge) |
| P1 | `web/app/orders/page.tsx` | all | Authenticated list-page pattern (`useRequireAuth`, `api.get`, skeleton/empty/error states, `PageShell`) |
| P1 | `web/app/products/page.tsx` | all | Catalog browse page + **Suspense boundary** pattern (required for `useSearchParams`) |
| P1 | `web/components/ProductForm.tsx` | all | Designer form pattern to mirror for `ResaleListingForm` (inputs, shadcn primitives, submit) |
| P2 | `server/src/test/java/com/iyae/testsupport/{MockAuthenticationFactory,TestUsers,WebMvcSecurityConfig}.java` | all | Controller-test scaffolding |
| P2 | `server/src/test/java/com/iyae/controller/DesignerProductControllerTest.java` | all | `@WebMvcTest` + `@WithMockUser` + `csrf()` pattern |
| P2 | `server/src/test/java/com/iyae/repository/ProductSpecificationsDataJpaTest.java` | all | `@DataJpaTest` single-repository slice pattern (avoids the `consumeToken` boot bug) |
| P2 | `server/src/test/java/com/iyae/service/OrderServiceTest.java` + `service/ProductServiceTest.java` | all | Mockito service-test structure + ownership-denied assertions |
| P2 | `web/__tests__/lib/api.test.ts` | all | Vitest client-test structure |
| P2 | `server/src/main/java/com/iyae/service/AnalyticsService.java` | 66–90 | `record(userId, EventType, productId, orderId, sizeBracket, metadata)` — reuse for resale funnel events |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| Next.js 16 (App Router, client pages) | `web/node_modules/next/dist/docs/` (read before touching Next APIs; see `web/AGENTS.md`) | Conventions differ from training data; `useSearchParams` needs a `<Suspense>` boundary |
| Stripe Checkout Session (Java SDK) | already vendored: `com.stripe.param.checkout.SessionCreateParams` (see `CheckoutService`) | Reuse the exact builder in `CheckoutService.initiateCheckout`; no new dependency |

> No further external research needed — feature uses established internal patterns (JPA/Flyway/Spring-Security/Stripe-gateway on the server; typed `api.ts` client + `"use client"` pages on the web).

---

## Patterns to Mirror

Real snippets copied from the codebase. Follow exactly.

### ENTITY_PATTERN
```java
// SOURCE: server/src/main/java/com/iyae/entity/Product.java:12-76
@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "designer_profile_id", nullable = false)
    private DesignerProfile designerProfile;

    @Column(name = "price", nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "media", columnDefinition = "json")
    private String media;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ProductStatus status;

    @CreationTimestamp @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @UpdateTimestamp @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
```

### ENUM_PATTERN
```java
// SOURCE: server/src/main/java/com/iyae/entity/enums/ProductStatus.java (+ OrderStatus.java)
package com.iyae.entity.enums;
public enum ProductStatus { DRAFT, PUBLISHED, ARCHIVED }
```

### MIGRATION_PATTERN
```sql
-- SOURCE: server/src/main/resources/db/migration/V12__marketplace_local_and_measurements.sql
CREATE TABLE product_size_measurements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    size_label VARCHAR(32) NOT NULL,
    chest_cm DOUBLE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_product_size (product_id, size_label),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
-- SOURCE: V15 — adding a nullable FK column to an existing table:
ALTER TABLE posts
    ADD COLUMN saved_look_id BIGINT NULL,
    ADD CONSTRAINT fk_posts_saved_look FOREIGN KEY (saved_look_id) REFERENCES saved_looks(id) ON DELETE SET NULL;
CREATE INDEX idx_post_reports_status ON post_reports(status, created_at DESC);
```
> **GOTCHA:** the test profile runs H2 with **Flyway disabled** (schema from Hibernate `ddl-auto`), so the migration is only exercised against real MySQL via `./dev.sh`. Entity ↔ column parity is validated at boot (`ddl-auto: validate`). Keep the `ResaleListing` entity and the V16 DDL in exact lockstep. `columnDefinition = "json"` is fine on H2 (mirrors `Product.media`).

### SERVICE_PATTERN + OWNERSHIP_CHECK
```java
// SOURCE: server/src/main/java/com/iyae/service/ProductService.java:40-53, 385-399
@Service
@RequiredArgsConstructor
public class ProductService {
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    // ...
    private DesignerProfile resolveDesignerProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return designerProfileRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Designer profile not found for user: " + email));
    }
    private Product requireOwnedProduct(Long productId, DesignerProfile profile) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
        if (!product.getDesignerProfile().getId().equals(profile.getId())) {
            throw new IllegalArgumentException("Product not found: " + productId); // info-leak-safe
        }
        return product;
    }
}
```
> **Ownership convention:** service-layer only (never controller). Not-found / not-owner both throw `IllegalArgumentException("... not found")` (→ 400, info-leak-safe). Use `AccessDeniedException` (→ 403) only for a *deliberate* "you may not do this to a thing you can see" (e.g. `ProductService.updateProduct` moderation lock at `:197-200`).

### DUPLICATE_GUARD (unique-key contention)
```java
// SOURCE: server/src/main/java/com/iyae/service/ReviewService.java:48-53
try {
    return ReviewResponse.from(reviewRepository.save(review));
} catch (DataIntegrityViolationException ex) {
    throw new IllegalArgumentException("You have already reviewed this product");
}
```

### ATOMIC_STATE_TRANSITION (reserve/sell a unique unit — mirror `consumeToken`)
```java
// PATTERN SOURCE: PasswordResetTokenRepository.consumeToken (atomic UPDATE to avoid a race),
// noted in server/CLAUDE.md "PasswordResetToken has atomic consumeToken to prevent race conditions".
// New code for ResaleListingRepository:
@Modifying
@Query("UPDATE ResaleListing l SET l.status = :reserved, l.reservedAt = :now " +
       "WHERE l.id = :id AND l.status = :listed")
int reserve(@Param("id") Long id, @Param("reserved") ResaleStatus reserved,
            @Param("listed") ResaleStatus listed, @Param("now") Instant now);
```
Caller treats `reserve(...) == 1` as success, `== 0` as "no longer available" (`IllegalArgumentException`).

### STRIPE_SESSION + ORDER (reuse verbatim)
```java
// SOURCE: server/src/main/java/com/iyae/service/CheckoutService.java:82-124, 216-231
List<SessionCreateParams.LineItem> lineItems = /* one line for the listing */;
SessionCreateParams params = SessionCreateParams.builder()
        .setMode(SessionCreateParams.Mode.PAYMENT)
        .setSuccessUrl(frontendBaseUrl + "/checkout/success?session_id={CHECKOUT_SESSION_ID}")
        .setCancelUrl(frontendBaseUrl + "/resale/" + listingId)
        .addAllLineItem(lineItems)
        .putMetadata("userId", String.valueOf(user.getId()))
        .build();
Session session = stripeGateway.createSession(params, stripeSecretKey);
Order order = Order.builder()
        .user(user).status(OrderStatus.PENDING).totalAmount(total)
        .stripeSessionId(session.getId()).paymentStatus("PENDING")
        .itemsSnapshot(snapshot)              // reuse ObjectMapper snapshot pattern
        .resaleListingId(listingId)           // NEW column added in this plan
        .build();
```
> **GOTCHA:** the currency string is lowercase `"cad"` in the Stripe builder (`:87`) but `"CAD"` on `Product`/`Order`. Match `CheckoutService` exactly. `unitAmount` = price × 100, `setScale(0, RoundingMode.HALF_UP)`.

### CONTROLLER_PATTERN
```java
// SOURCE: server/src/main/java/com/iyae/controller/DesignerProductController.java:16-53
@RestController
@RequestMapping("/api/designer/products")
@RequiredArgsConstructor
public class DesignerProductController {
    private final ProductService productService;

    @PostMapping
    public ResponseEntity<ProductResponse> createProduct(
            @Valid @RequestBody CreateProductRequest request, Authentication authentication) {
        ProductResponse response = productService.createProduct(authentication.getName(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(@PathVariable Long id, Authentication authentication) {
        productService.deleteProduct(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
```

### DTO_VALIDATION
```java
// SOURCE: server/src/main/java/com/iyae/dto/CreateProductRequest.java + ReviewRequest.java
public record CreateProductRequest(
    @NotBlank(message = "Product name is required") String name,
    @NotNull @DecimalMin(value = "0.01", message = "Price must be at least 0.01") BigDecimal price,
    @Valid List<SizeMeasurementDto> measurements
) {}
```

### SECURITY_MATCHERS (first-match wins — order matters)
```java
// SOURCE: server/src/main/java/com/iyae/config/SecurityConfig.java:34-51
.authorizeHttpRequests(auth -> auth
    // public GET must PRECEDE the catch-all authenticated() rule
    .requestMatchers(HttpMethod.GET, "/api/products/*/recommended-size").authenticated()
    .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()
    // ...
    .requestMatchers("/api/designer/**").hasRole("DESIGNER")
    .requestMatchers("/api/admin/**").hasRole("ADMIN")
    .anyRequest().authenticated()
)
```

### SPECIFICATION_PATTERN (resale browse filters)
```java
// SOURCE: server/src/main/java/com/iyae/repository/ProductSpecifications.java:21-43
public static Specification<Product> catalog(ProductStatus status, String category, String q, boolean localOnly) {
    return (root, query, cb) -> {
        List<Predicate> predicates = new ArrayList<>();
        predicates.add(cb.equal(root.get("status"), status));
        if (q != null && !q.isBlank()) {
            String pattern = "%" + q.toLowerCase() + "%";
            predicates.add(cb.or(cb.like(cb.lower(root.get("name")), pattern), /* ... */));
        }
        return cb.and(predicates.toArray(new Predicate[0]));
    };
}
```

### WEB_API_CLIENT
```ts
// SOURCE: web/lib/api.ts:268-273, 416-432 — a resource client object to mirror
export const promotions = {
  list: () => api.get<PromotionResponse[]>("/api/promotions"),
  create: (data: CreatePromotionRequest) => api.post<PromotionResponse>("/api/promotions", data),
  delete: (id: number) => api.delete(`/api/promotions/${id}`),
};
export const posts = {
  feed: (feed, page = 0, size = 20, signal?: AbortSignal) =>
    api.get<Paged<Post>>(`/api/posts?feed=${feed}&page=${page}&size=${size}`, { signal }),
  create: (payload: CreatePostPayload) => api.post<Post>("/api/posts", payload),
};
```

### WEB_CARD
```tsx
// SOURCE: web/components/ProductListItem.tsx:40-116 — semantic tokens only; mirror for ResaleListingCard.
// The "Local" badge (:98-102) is the model for a "Pre-loved" + condition badge.
<Link href={`/products/${product.id}`}
  className={cn("group flex flex-col overflow-hidden rounded-card bg-card shadow-soft", ...)}>
  <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted"> {/* <Image .../> */} </div>
  <div className="flex flex-1 flex-col gap-2 p-4">
    <span className="w-fit rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] ... text-brand">Local</span>
    <h3 className="line-clamp-2 text-sm font-medium text-foreground">{product.name}</h3>
    <p className="mt-auto font-display text-lg font-semibold text-foreground">
      {formatPrice(product.price, product.currency)}
    </p>
  </div>
</Link>
```

### WEB_AUTHED_PAGE
```tsx
// SOURCE: web/app/orders/page.tsx:89-118 — authed list page skeleton
export default function OrdersPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (authLoading || !user) return;
    api.get<Order[]>("/api/orders").then(setOrders)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Failed to load orders."))
      .finally(() => setLoading(false));
  }, [authLoading, user]);
  // ... <NavBar/> <PageShell> skeleton / error / empty / list </PageShell> <Footer/>
}
```

### SERVICE_TEST + CONTROLLER_TEST
```java
// SERVICE — SOURCE: pattern from service tests (Mockito)
@ExtendWith(MockitoExtension.class)
class ResaleServiceTest {
    @Mock ResaleListingRepository resaleRepo;
    @Mock OrderRepository orderRepo;
    @Mock UserRepository userRepo;
    @InjectMocks ResaleService service;
    // given/when/then; assert ownership-denied throws IllegalArgumentException
}
// CONTROLLER — SOURCE: server/src/test/java/com/iyae/controller/DesignerProductControllerTest.java:31-124
@WebMvcTest(ResaleController.class)
@Import(WebMvcSecurityConfig.class)
class ResaleControllerTest {
    @Autowired MockMvc mockMvc;
    @MockBean ResaleService resaleService;

    @Test @WithMockUser(username = "buyer@example.com", roles = "BUYER")
    void createListing_returns201() throws Exception {
        mockMvc.perform(post("/api/resale/listings").with(csrf())
            .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isCreated());
    }
    @Test // no @WithMockUser → browse is public
    void browse_isPublic_returns200() throws Exception {
        mockMvc.perform(get("/api/resale/listings")).andExpect(status().isOk());
    }
}
```

### DATA_JPA_TEST (single-repo slice — avoids the `consumeToken` boot bug)
```java
// SOURCE: server/src/test/java/com/iyae/repository/ProductSpecificationsDataJpaTest.java:34-58
@DataJpaTest
@ActiveProfiles("test")
@EnableJpaRepositories(basePackageClasses = ResaleListingRepository.class,
    excludeFilters = @ComponentScan.Filter(type = FilterType.REGEX,
        pattern = "com\\.iyae\\.repository\\.(?!ResaleListingRepository).*"))
class ResaleListingRepositoryDataJpaTest {
    @Autowired TestEntityManager em;
    @Autowired ResaleListingRepository repo;
    // persist listings; assert browse Specification + atomic reserve() rows-affected
}
```
> **GOTCHA:** the single-repo `excludeFilters` slice is **mandatory** — a full-repo `@DataJpaTest` eagerly validates `PasswordResetTokenRepository.consumeToken`, which Hibernate 6.6 rejects (`CURRENT_TIMESTAMP` → `Instant`), failing the whole slice. Copy the exact `@EnableJpaRepositories` incantation.

### WEB_TEST
```ts
// SOURCE: web/__tests__/lib/api.test.ts — add cases asserting the resale client hits the right paths.
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `server/src/main/resources/db/migration/V16__resale_listings.sql` | CREATE | `resale_listings` table + `orders.resale_listing_id` nullable FK |
| `server/src/main/java/com/iyae/entity/enums/ResaleStatus.java` | CREATE | `DRAFT, LISTED, RESERVED, SOLD, REMOVED` |
| `server/src/main/java/com/iyae/entity/enums/ResaleCondition.java` | CREATE | `NEW_WITH_TAGS, EXCELLENT, GOOD, FAIR` |
| `server/src/main/java/com/iyae/entity/ResaleListing.java` | CREATE | JPA entity mirroring `Product` conventions |
| `server/src/main/java/com/iyae/entity/Order.java` | UPDATE | add `Long resaleListingId` mapped to the new nullable column |
| `server/src/main/java/com/iyae/repository/ResaleListingRepository.java` | CREATE | Spring-Data + `JpaSpecificationExecutor` + atomic `reserve`/`markSold`/`release` |
| `server/src/main/java/com/iyae/repository/ResaleListingSpecifications.java` | CREATE | dynamic browse filters (mirror `ProductSpecifications`) |
| `server/src/main/java/com/iyae/dto/CreateResaleListingRequest.java` | CREATE | validated create payload |
| `server/src/main/java/com/iyae/dto/UpdateResaleListingRequest.java` | CREATE | partial update (price/condition/description/media/publish) |
| `server/src/main/java/com/iyae/dto/ResaleListingResponse.java` | CREATE | response record + `from(...)` |
| `server/src/main/java/com/iyae/dto/ResaleEligibleItemResponse.java` | CREATE | "items you can resell" row (productId/name/size/media) |
| `server/src/main/java/com/iyae/service/ResaleService.java` | CREATE | eligibility + listing lifecycle + reserve/release + markSold (state only) |
| `server/src/main/java/com/iyae/service/CheckoutService.java` | UPDATE | `initiateResaleCheckout(...)` + webhook marks listing SOLD when `order.resaleListingId != null` |
| `server/src/main/java/com/iyae/controller/ResaleController.java` | CREATE | `/api/resale/**` endpoints |
| `server/src/main/java/com/iyae/config/SecurityConfig.java` | UPDATE | public `GET /api/resale/listings/**`; rest authenticated |
| `server/src/main/java/com/iyae/config/SchedulerConfig.java` | UPDATE | 5-min `releaseStaleResaleReservations()` sweep |
| `server/src/main/java/com/iyae/config/RateLimitFilter.java` | UPDATE (optional) | rate-limit `POST /api/resale/listings/*/checkout` (mirror `/api/checkout` 5/60s) |
| `web/lib/api.ts` | UPDATE | `resale` typed client + types |
| `web/app/resale/page.tsx` | CREATE | pre-loved browse grid (Suspense) |
| `web/app/resale/[id]/page.tsx` | CREATE | pre-loved PDP + Buy now |
| `web/app/resale/sell/page.tsx` | CREATE | eligible-items picker → `ResaleListingForm` |
| `web/app/resale/my-listings/page.tsx` | CREATE (P1) | manage own listings (remove) |
| `web/components/ResaleListingCard.tsx` | CREATE | pre-loved card (mirror `ProductListItem`) |
| `web/components/ResaleListingForm.tsx` | CREATE | condition/price/photos form (mirror `ProductForm`) |
| `web/components/NavBar.tsx` | UPDATE | add "Resale" link |
| `server/src/test/java/com/iyae/service/ResaleServiceTest.java` | CREATE | eligibility/create/ownership/reserve/markSold |
| `server/src/test/java/com/iyae/controller/ResaleControllerTest.java` | CREATE | public-vs-authed + CRUD + checkout |
| `server/src/test/java/com/iyae/repository/ResaleListingRepositoryDataJpaTest.java` | CREATE | Specification + atomic reserve |
| `server/src/test/java/com/iyae/service/CheckoutServiceTest.java` | UPDATE | resale checkout + webhook SOLD-marking |
| `web/__tests__/lib/api.test.ts` | UPDATE | resale client paths |

## NOT Building

- **Trade-in store credit / wallet / credit ledger** — the "mid" option was explicitly not chosen. No `credit_ledger`, no checkout credit application.
- **Condition-authentication / approval workflow** — seller-declared condition is trusted in v1 (no admin grading, no photo verification).
- **A separate resale marketplace, resale-specific shipping labels, or take-back/circular logistics.**
- **Per-unit quantity tracking** — a buyer who bought quantity ≥ 2 of the same (product, size) may hold **one active listing at a time** for that pair in v1 (documented limitation; eligibility dedupes by `(productId, sizeLabel)`).
- **Reselling items not purchased on IYAE** — eligibility is strictly derived from the seller's own paid orders.
- **Designer/first-party resale or consignment** — buyers reselling their own purchases only.
- **Cart co-mingling** — resale is **buy-now only**; no changes to `cart_items` or the shared `/api/checkout` path.
- **Admin moderation of resale listings** — out of scope for v1 (a later hardening item; `REMOVED` status exists but only the owner sets it).

---

## Step-by-Step Tasks

### Task 1: V16 migration
- **ACTION**: Create `server/src/main/resources/db/migration/V16__resale_listings.sql`.
- **IMPLEMENT**:
  ```sql
  -- Phase 7: Resale / Circular / Trade-in (lightweight v1). Mirrors V12/V15 DDL style.
  CREATE TABLE resale_listings (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      seller_id BIGINT NOT NULL,
      product_id BIGINT NOT NULL,
      original_order_id BIGINT NULL,
      size_label VARCHAR(32) NOT NULL,
      cond VARCHAR(20) NOT NULL,               -- ResaleCondition (avoid reserved word "condition")
      asking_price DECIMAL(10,2) NOT NULL,
      currency CHAR(3) NOT NULL DEFAULT 'CAD',
      seller_note TEXT NULL,
      media JSON NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
      reserved_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (original_order_id) REFERENCES orders(id) ON DELETE SET NULL
  );
  CREATE INDEX idx_resale_status_created ON resale_listings(status, created_at DESC);
  CREATE INDEX idx_resale_seller ON resale_listings(seller_id);
  CREATE INDEX idx_resale_reserved ON resale_listings(status, reserved_at);

  ALTER TABLE orders
      ADD COLUMN resale_listing_id BIGINT NULL,
      ADD CONSTRAINT fk_orders_resale_listing FOREIGN KEY (resale_listing_id)
          REFERENCES resale_listings(id) ON DELETE SET NULL;
  ```
- **MIRROR**: MIGRATION_PATTERN.
- **GOTCHA**: column named `cond` not `condition` (MySQL reserved-ish; avoids quoting). Entity maps `@Column(name = "cond")`. `orders.resale_listing_id` FK is added **after** `resale_listings` exists (order matters within the file).
- **VALIDATE**: `./dev.sh start` boots with `ddl-auto: validate` (no schema-mismatch error); `SHOW TABLES` includes `resale_listings`.

### Task 2: Enums
- **ACTION**: Create `ResaleStatus` and `ResaleCondition` in `entity/enums/`.
- **IMPLEMENT**: `public enum ResaleStatus { DRAFT, LISTED, RESERVED, SOLD, REMOVED }` · `public enum ResaleCondition { NEW_WITH_TAGS, EXCELLENT, GOOD, FAIR }`.
- **MIRROR**: ENUM_PATTERN.
- **GOTCHA**: `RESERVED` is an internal transient (mirrors `TaskStatus.MATERIALIZED` being internal) — required to prevent double-sale; surface it to clients as `RESERVED` (a listing that's mid-checkout is not buyable). Document alongside the owner-stated `DRAFT/LISTED/SOLD/REMOVED` set.
- **VALIDATE**: compiles.

### Task 3: `ResaleListing` entity + `Order.resaleListingId`
- **ACTION**: Create `entity/ResaleListing.java`; add field to `Order`.
- **IMPLEMENT**: entity fields mirroring the migration — `id`, `@ManyToOne(LAZY) User seller` (`@JoinColumn("seller_id")`), `@ManyToOne(LAZY) Product product` (`@JoinColumn("product_id")`), `Long originalOrderId`, `String sizeLabel`, `@Enumerated(STRING) @Column(name="cond") ResaleCondition condition`, `BigDecimal askingPrice (precision=10,scale=2)`, `String currency`, `@Column(columnDefinition="TEXT") String sellerNote`, `@Column(columnDefinition="json") String media`, `@Enumerated(STRING) ResaleStatus status`, `Instant reservedAt`, `@CreationTimestamp createdAt`, `@UpdateTimestamp updatedAt`. On `Order`: `@Column(name = "resale_listing_id") private Long resaleListingId;`.
- **MIRROR**: ENTITY_PATTERN.
- **GOTCHA**: store `resaleListingId` as a bare `Long` on `Order` (like `stripeSessionId`) — no `@ManyToOne` — to avoid lazy-load coupling in the webhook path. Enum column names must match the migration (`cond`, `status`).
- **VALIDATE**: `./gradlew compileJava`; boot validates entity↔schema.

### Task 4: `ResaleListingRepository` + `ResaleListingSpecifications`
- **ACTION**: Create both.
- **IMPLEMENT**: interface extends `JpaRepository<ResaleListing, Long>, JpaSpecificationExecutor<ResaleListing>`. Methods: `List<ResaleListing> findBySellerIdOrderByCreatedAtDesc(Long sellerId)`; `List<ResaleListing> findBySellerIdAndStatusIn(Long sellerId, Collection<ResaleStatus> statuses)`; `List<ResaleListing> findByStatusAndReservedAtBefore(ResaleStatus status, Instant cutoff)`; the atomic `@Modifying reserve(...)` and `@Modifying markSold(...)` and `@Modifying release(...)` updates (see ATOMIC_STATE_TRANSITION). `ResaleListingSpecifications.browse(ResaleStatus status, String q, String category)` mirroring `ProductSpecifications` (join `product` for name/category filters: `root.join("product")`).
- **MIRROR**: `ProductRepository`, `ProductSpecifications`, ATOMIC_STATE_TRANSITION.
- **GOTCHA**: `@Modifying` methods need `@Transactional` on the calling service method. Return `int` rows-affected. Enum values passed as `@Param` (don't inline in JPQL).
- **VALIDATE**: covered by `ResaleListingRepositoryDataJpaTest` (Task 13).

### Task 5: DTOs
- **ACTION**: Create `CreateResaleListingRequest`, `UpdateResaleListingRequest`, `ResaleListingResponse`, `ResaleEligibleItemResponse`.
- **IMPLEMENT**:
  - `CreateResaleListingRequest(@NotNull Long productId, @NotBlank @Size(max=32) String sizeLabel, @NotNull ResaleCondition condition, @NotNull @DecimalMin("0.01") BigDecimal askingPrice, @Size(max=2000) String sellerNote, List<String> media)`.
  - `UpdateResaleListingRequest(BigDecimal askingPrice, ResaleCondition condition, String sellerNote, List<String> media, ResaleStatus status)` — all nullable; only `status ∈ {LISTED, REMOVED}` allowed (publish/unlist).
  - `ResaleListingResponse(Long id, Long productId, String productName, List<String> productMedia, String sellerUsername, String sizeLabel, ResaleCondition condition, BigDecimal askingPrice, String currency, ResaleStatus status, String sellerNote, List<String> media, Instant createdAt)` + static `from(ResaleListing, Product)` with a JSON-list parse helper.
  - `ResaleEligibleItemResponse(Long productId, String productName, String sizeLabel, List<String> productMedia, Long orderId)`.
- **MIRROR**: DTO_VALIDATION, `ProductResponse.from`/`parseJsonList`.
- **GOTCHA**: reuse `ProductResponse`-style `parseJsonList` for `media`/`productMedia`. `sellerUsername` comes from `seller.getUsername()` (redact email — mirror `PublicUserSummary` philosophy).
- **VALIDATE**: compiles; validation exercised in controller test.

### Task 6: `ResaleService` — eligibility
- **ACTION**: Add `listEligibleItems(String email)`.
- **IMPLEMENT**: resolve user; `orderRepository.findByUserIdOrderByCreatedAtDesc(userId)`; keep orders whose `status != PENDING` (owned = PAID/PROCESSING/SHIPPED/DELIVERED); parse each `order.getItemsSnapshot()` with `ObjectMapper` into a list of `{productId, productName, selectedSize}` (defensive try/catch → skip on parse failure, mirroring `ProductResponse.parseJsonList`); collect distinct `(productId, sizeLabel)`; **exclude** pairs the seller already has an active listing for (`findBySellerIdAndStatusIn(userId, [DRAFT, LISTED, RESERVED, SOLD])`); enrich each with the product's first media image; return `List<ResaleEligibleItemResponse>`.
- **MIRROR**: `OrderService.getOrders` (order fetch), `CheckoutService.buildItemsSnapshot` (the exact snapshot field names: `productId`, `productName`, `quantity`, `unitPrice`, `selectedSize`).
- **GOTCHA**: `itemsSnapshot` field names are fixed by `CheckoutService.ItemSnapshot` (`server/.../CheckoutService.java:65`). Parse into a matching shape. A missing/empty snapshot → empty list, never throw.
- **VALIDATE**: `ResaleServiceTest` — a paid order with two items yields two eligible rows; a PENDING order yields none; an already-listed pair is excluded.

### Task 7: `ResaleService` — listing lifecycle
- **ACTION**: `createListing`, `getMyListings`, `getListing`, `browse`, `updateListing`, `removeListing`.
- **IMPLEMENT**:
  - `createListing(email, req)`: resolve user; **verify ownership** — the `(productId, sizeLabel)` must appear in one of the user's owned orders (reuse the eligibility scan; throw `IllegalArgumentException("You can only resell items you've purchased")` otherwise); load `Product`; build `ResaleListing` with `status = LISTED` (v1 lists immediately; `DRAFT` reserved for future draft-save), `currency = "CAD"`, `originalOrderId` = the matching order; save; return `from(...)`.
  - `getMyListings(email)`: `findBySellerIdOrderByCreatedAtDesc`.
  - `getListing(id)`: public; `findById` → not-found `IllegalArgumentException`. (Return REMOVED/SOLD too so a stale link shows state; browse filters them out.)
  - `browse(page, size, q, category)`: `resaleRepo.findAll(ResaleListingSpecifications.browse(LISTED, q, category), pageable)` sorted `createdAt DESC`, mapped to `PagedResponse<ResaleListingResponse>`.
  - `updateListing(email, id, req)`: ownership (`seller.id == user.id` else `IllegalArgumentException("... not found")`); apply non-null fields; `status` transition limited to LISTED/REMOVED.
  - `removeListing(email, id)`: ownership; set `status = REMOVED` (soft — keep row for provenance/order FK).
- **MIRROR**: SERVICE_PATTERN, OWNERSHIP_CHECK, ProductService CRUD.
- **GOTCHA**: never `AccessDeniedException` for not-owner here — use info-leak-safe `IllegalArgumentException("Resale listing not found: " + id)`. A SOLD/RESERVED listing cannot be edited (guard).
- **VALIDATE**: `ResaleServiceTest` ownership-denied + create-without-purchase-denied.

### Task 8: `ResaleService` — reserve/markSold/release (state only)
- **ACTION**: `reserve(listingId, buyerEmail)`, `markSold(listingId)`, `releaseStaleReservations()`.
- **IMPLEMENT**:
  - `reserve`: load listing; reject if `seller` is the buyer (`"You can't buy your own listing"`); call atomic `resaleRepo.reserve(id, RESERVED, LISTED, Instant.now())`; if `0` → `IllegalArgumentException("This item is no longer available")`.
  - `markSold`: `resaleRepo.markSold(id, SOLD, RESERVED)` (idempotent; `0` rows if already SOLD → log + no-op).
  - `releaseStaleReservations()`: `findByStatusAndReservedAtBefore(RESERVED, now - TTL)`; for each, `release(id, LISTED, RESERVED)`; log count. TTL constant e.g. 30 min.
- **MIRROR**: ATOMIC_STATE_TRANSITION; worker stale-task reclaim philosophy (server `CLAUDE.md` "Scheduled Tasks").
- **GOTCHA**: all three are `@Transactional`. `markSold`/`release` are idempotent (rows-affected 0 is fine). Do the buyer-≠-seller check **before** reserving.
- **VALIDATE**: `ResaleServiceTest` reserve returns available/unavailable; `ResaleListingRepositoryDataJpaTest` asserts concurrent-style rows-affected.

### Task 9: `CheckoutService` — resale checkout + webhook SOLD
- **ACTION**: Add `initiateResaleCheckout(email, listingId)`; extend `handleWebhook`.
- **IMPLEMENT**:
  - Inject `ResaleService` into `CheckoutService` (constructor field; `@RequiredArgsConstructor`).
  - `initiateResaleCheckout`: resolve user; `resaleService.reserve(listingId, email)`; load listing + product; build a **one-line** Stripe session priced from `listing.askingPrice` (name = `product.name + " (pre-loved, " + condition + ")"`), or `stubCheckout`-style path when `STRIPE_SECRET_KEY` blank; build `itemsSnapshot` (reuse `buildItemsSnapshot` shape with the listing's product/size/price); create `Order` with `resaleListingId = listingId`; `analyticsService.record(userId, CHECKOUT_INITIATED, productId, orderId, sizeLabel, "resale")`; return `{sessionId, url}`. **On any exception after reserve, release the reservation** (`resaleService` release or set back to LISTED) so a failed session doesn't strand the listing.
  - `handleWebhook`: after `order.setStatus(PAID)` + `analyticsService.record(..., ORDER_PAID, ...)`, add: `if (order.getResaleListingId() != null) { resaleService.markSold(order.getResaleListingId()); } else { /* existing cart-clear */ }` — resale orders have no cart to clear.
- **MIRROR**: STRIPE_SESSION + ORDER; `CheckoutService.stubCheckout:182-209`.
- **GOTCHA**: currency `"cad"` (lowercase) in the Stripe builder. The stub path immediately marks the order PAID **and** emits `ORDER_PAID` — so in stub mode `markSold` must also run in the stub path (call it right after the stub order is PAID). Don't clear the cart for resale orders.
- **VALIDATE**: `CheckoutServiceTest` — resale checkout reserves + creates a resale order; webhook (and stub) mark the listing SOLD.

### Task 10: `ResaleController` + `SecurityConfig` + `SchedulerConfig` (+ optional rate limit)
- **ACTION**: Create controller; wire routes + scheduled sweep.
- **IMPLEMENT** (`@RestController @RequestMapping("/api/resale")`):
  - `GET /listings` → `browse(page,size,q,category)` (public)
  - `GET /listings/{id}` → `getListing` (public)
  - `GET /eligible-items` → `listEligibleItems` (authed)
  - `GET /my-listings` → `getMyListings` (authed)
  - `POST /listings` → `createListing` → 201 (authed)
  - `PUT /listings/{id}` → `updateListing` (authed)
  - `DELETE /listings/{id}` → `removeListing` → 204 (authed)
  - `POST /listings/{id}/checkout` → `checkoutService.initiateResaleCheckout` (authed)
  - `SecurityConfig`: **before** `anyRequest().authenticated()`, add `.requestMatchers(HttpMethod.GET, "/api/resale/listings", "/api/resale/listings/*").permitAll()`. `GET /api/resale/eligible-items` + `/my-listings` are **not** under `/listings/*`, so they fall through to `authenticated()` — verify the matcher patterns don't accidentally expose them.
  - `SchedulerConfig`: add `@Scheduled(fixedDelayString = "300000", initialDelay = 30000) void releaseStaleResaleReservations()` calling `resaleService.releaseStaleReservations()`, wrapped in try/catch + log (mirror the other scheduled tasks).
  - (Optional) `RateLimitFilter`: add a rule for `POST /api/resale/listings/*/checkout` at 5/60s (mirror `/api/checkout`). If the suffix-matching is non-trivial, note it and defer.
- **MIRROR**: CONTROLLER_PATTERN, SECURITY_MATCHERS, `SchedulerConfig` (existing 5s tasks).
- **GOTCHA**: matcher ordering is first-match-wins (SecurityConfig comment at `:39`). Put the resale public GETs before the catch-all. `PUT/DELETE/POST` under `/api/resale/**` must remain authenticated.
- **VALIDATE**: `ResaleControllerTest` public-vs-authed; boot has no ambiguous-mapping error.

### Task 11: Web `api.ts` resale client
- **ACTION**: Add `resale` object + types to `web/lib/api.ts`.
- **IMPLEMENT**:
  ```ts
  export type ResaleCondition = "NEW_WITH_TAGS" | "EXCELLENT" | "GOOD" | "FAIR";
  export type ResaleStatus = "DRAFT" | "LISTED" | "RESERVED" | "SOLD" | "REMOVED";
  export interface ResaleListing {
    id: number; productId: number; productName: string; productMedia: string[];
    sellerUsername: string; sizeLabel: string; condition: ResaleCondition;
    askingPrice: number; currency: string; status: ResaleStatus;
    sellerNote: string | null; media: string[]; createdAt: string;
  }
  export interface ResaleEligibleItem { productId: number; productName: string; sizeLabel: string; productMedia: string[]; orderId: number; }
  export interface CreateResaleListingPayload { productId: number; sizeLabel: string; condition: ResaleCondition; askingPrice: number; sellerNote?: string; media?: string[]; }
  export const resale = {
    browse: (page = 0, size = 20, signal?: AbortSignal) => api.get<Paged<ResaleListing>>(`/api/resale/listings?page=${page}&size=${size}`, { signal }),
    get: (id: number, signal?: AbortSignal) => api.get<ResaleListing>(`/api/resale/listings/${id}`, { signal }),
    eligibleItems: (signal?: AbortSignal) => api.get<ResaleEligibleItem[]>("/api/resale/eligible-items", { signal }),
    myListings: (signal?: AbortSignal) => api.get<ResaleListing[]>("/api/resale/my-listings", { signal }),
    create: (payload: CreateResaleListingPayload) => api.post<ResaleListing>("/api/resale/listings", payload),
    remove: (id: number) => api.delete<void>(`/api/resale/listings/${id}`),
    checkout: (id: number) => api.post<{ sessionId: string; url: string }>(`/api/resale/listings/${id}/checkout`),
  };
  ```
- **MIRROR**: WEB_API_CLIENT (`promotions`/`posts`), `Paged<T>` (`api.ts:329`).
- **GOTCHA**: use the exported `Paged<T>` envelope; `checkout` returns `{sessionId,url}` — redirect the browser to `url` (Stripe or the stub `/checkout/success?...`).
- **VALIDATE**: `web/__tests__/lib/api.test.ts` cases for `resale.browse/create/checkout` paths.

### Task 12: Web pages + components
- **ACTION**: Create `ResaleListingCard`, `ResaleListingForm`, `/resale`, `/resale/[id]`, `/resale/sell`, `/resale/my-listings` (P1), NavBar link.
- **IMPLEMENT**:
  - `ResaleListingCard.tsx`: mirror `ProductListItem` — image from `productMedia[0]` (or seller `media[0]`), a `Pre-loved` + `condition` badge (mirror the `Local` badge classes), name, `formatPrice(askingPrice, currency)`. Links to `/resale/${id}`.
  - `/resale/page.tsx`: `"use client"`, browse grid via `resale.browse`, `SearchFilterBar`-style optional; wrap in `<Suspense>` if it reads `useSearchParams` (see `products/page.tsx`). `<NavBar/> <PageShell> grid </PageShell> <Footer/>`.
  - `/resale/[id]/page.tsx`: fetch `resale.get(id)`; show product image, size, condition, seller, price, `sellerNote`; **Buy now** button → `resale.checkout(id)` → `window.location.href = res.url`. Disable when `status !== "LISTED"` ("No longer available").
  - `/resale/sell/page.tsx`: `useRequireAuth`; fetch `resale.eligibleItems`; render a selectable list; on select, mount `ResaleListingForm` (condition `<select>`, price input, optional note, optional photos via existing `ImageUploader`); submit `resale.create` → toast + route to `/resale/my-listings`.
  - `/resale/my-listings/page.tsx` (P1): `resale.myListings`; each row shows status; `Remove` → `resale.remove(id)`.
  - `NavBar.tsx`: add a "Resale" link (mirror existing links).
- **MIRROR**: WEB_CARD, WEB_AUTHED_PAGE, `products/page.tsx` (Suspense), `ProductForm.tsx`, `ImageUploader`.
- **GOTCHA**: semantic tokens only — **no** `stone-*`/`bg-white`/raw hex/`purple-*`/`rose-*` (a residue-scan gate rejects them; see web `CLAUDE.md` "Dark mode colors"). 3D not needed here. `formatPrice` uses `Intl.NumberFormat("en-CA", {style:"currency", currency})` (copy from `ProductListItem:33-38`).
- **VALIDATE**: `npm run lint`, `npm run build`; manual click-through.

### Task 13: Tests
- **ACTION**: Create `ResaleServiceTest`, `ResaleControllerTest`, `ResaleListingRepositoryDataJpaTest`; extend `CheckoutServiceTest` and `web/__tests__/lib/api.test.ts`.
- **IMPLEMENT**: per SERVICE_TEST / CONTROLLER_TEST / DATA_JPA_TEST / WEB_TEST snippets and the Testing Strategy table below.
- **MIRROR**: `OrderServiceTest`, `DesignerProductControllerTest`, `ProductSpecificationsDataJpaTest`, `api.test.ts`.
- **GOTCHA**: the `@DataJpaTest` **must** use the single-repo `excludeFilters` slice or the `consumeToken` boot bug fails it. Controller tests need `@Import(WebMvcSecurityConfig.class)` + `.with(csrf())` on mutating requests.
- **VALIDATE**: `./gradlew test` + `npm run test` green.

### Task 14: Seed + docs (P2)
- **ACTION**: (optional) seed 1–2 demo resale listings in `DataSeeder`; update `CLAUDE.md` counts + changelog + PRD Phase 7 status.
- **IMPLEMENT**: seed a LISTED listing referencing an existing seed product + a seed buyer; bump server/web test counts + migration list (V15→V16, entities 22→23, enums 13→15, controllers, services 28→29, DTOs) in root/server/web `CLAUDE.md`; flip PRD Phase 7 row `pending`→`in-progress` with the plan link.
- **MIRROR**: existing `CLAUDE.md` changelog entries.
- **VALIDATE**: docs match reality; `git grep -n resale` shows a coherent surface.

---

## Testing Strategy

### Unit / Slice Tests

| Test | Input | Expected | Edge? |
|---|---|---|---|
| `ResaleServiceTest.eligible_fromPaidOrders` | user with 1 PAID order (2 items) | 2 eligible rows | — |
| `ResaleServiceTest.eligible_excludesPending` | only a PENDING order | empty | ✓ |
| `ResaleServiceTest.eligible_excludesAlreadyListed` | owned pair already has active listing | that pair omitted | ✓ |
| `ResaleServiceTest.create_requiresPurchase` | product/size not in any owned order | `IllegalArgumentException` | ✓ |
| `ResaleServiceTest.create_ok` | eligible pair | listing saved, `status=LISTED` | — |
| `ResaleServiceTest.remove_notOwner` | other user's listing id | `IllegalArgumentException("... not found")` | ✓ |
| `ResaleServiceTest.reserve_ownListing` | seller buys own listing | `IllegalArgumentException` | ✓ |
| `ResaleServiceTest.reserve_unavailable` | repo `reserve` returns 0 | `IllegalArgumentException("no longer available")` | ✓ |
| `ResaleListingRepositoryDataJpaTest.browse_onlyListed` | LISTED + SOLD + REMOVED rows | only LISTED returned | ✓ |
| `ResaleListingRepositoryDataJpaTest.reserve_atomic` | LISTED row | `reserve()` → 1 then 0 (second call) | ✓ |
| `CheckoutServiceTest.resaleCheckout_reservesAndCreatesOrder` | LISTED listing (stub mode) | order has `resaleListingId`; listing SOLD | ✓ |
| `CheckoutServiceTest.webhook_marksResaleSold` | PAID webhook for resale order | `resaleService.markSold` called; cart **not** cleared | ✓ |
| `ResaleControllerTest.browse_public_200` | anonymous GET `/api/resale/listings` | 200 | ✓ |
| `ResaleControllerTest.eligible_unauth_403` | anonymous GET `/eligible-items` | 401/403 | ✓ |
| `ResaleControllerTest.create_buyer_201` | `@WithMockUser BUYER` POST | 201 | — |
| `api.test.ts resale.*` | mocked fetch | correct method+path+body | — |

### Edge Cases Checklist
- [ ] Empty/malformed `itemsSnapshot` → eligibility returns empty, never throws
- [ ] Reselling an item bought quantity ≥ 2 → one active listing allowed (documented)
- [ ] Two buyers race to buy the same listing → exactly one reserve succeeds
- [ ] Stripe session created but never paid → reservation released by the sweep after TTL
- [ ] Stub checkout (no `STRIPE_SECRET_KEY`) still marks the listing SOLD
- [ ] Buyer tries to buy own listing → rejected
- [ ] Edit/delete another user's listing → info-leak-safe not-found
- [ ] Product referenced by a listing is later deleted → FK `product_id` is `RESTRICT`-by-default; note: designers deleting a product with active resale listings will fail the delete (acceptable v1; document)

---

## Validation Commands

### Static Analysis
```bash
cd server && ./gradlew compileJava compileTestJava
cd web && npx tsc --noEmit && npm run lint
```
EXPECT: zero errors.

### Unit Tests
```bash
cd server && ./gradlew test --tests '*Resale*' --tests 'CheckoutServiceTest'
cd web && npm run test -- api.test
```
EXPECT: all pass.

### Full Test Suite
```bash
cd server && ./gradlew test
cd web && npm run test
```
EXPECT: no regressions (server 494+ green including new resale tests; web 230+ green).

### Database / Migration Validation
```bash
./dev.sh start        # boots server with ddl-auto: validate against MySQL + Flyway V16
./dev.sh logs server  # no "Schema-validation" errors; Flyway shows "Migrating ... V16"
```
EXPECT: V16 applied; `resale_listings` + `orders.resale_listing_id` present.

### Browser Validation
```bash
cd web && npm run dev   # + server + MySQL running
```
- [ ] `/resale` renders the pre-loved grid (LISTED only)
- [ ] Buy a seeded/created listing (stub mode) → order created, listing → SOLD, no longer in `/resale`
- [ ] `/resale/sell` lists eligible owned items; create a listing → appears in `/resale`
- [ ] Non-owner cannot edit/delete another's listing

### Manual Validation
- [ ] KPI: a resale purchase emits `CHECKOUT_INITIATED` + `ORDER_PAID` (visible in `/api/analytics` KPI summary cohorts)
- [ ] Reservation sweep releases an abandoned RESERVED listing after TTL

---

## Acceptance Criteria
- [ ] All tasks completed
- [ ] All validation commands pass
- [ ] Server + web tests written and green; no regressions
- [ ] No type/lint errors; no color-residue-scan violations on new web files
- [ ] V16 migration applies cleanly; entity↔schema validate at boot
- [ ] A buyer can list an owned item; another user can buy it exactly once; abandoned reservations self-heal

## Completion Checklist
- [ ] Code follows discovered patterns (entity/service/controller/DTO/migration/test)
- [ ] Ownership enforced in the service layer with info-leak-safe not-found
- [ ] Errors map via `GlobalExceptionHandler` (400 `IllegalArgumentException`, 403 `AccessDenied`, 409 `DataIntegrity`)
- [ ] Money path reuses `StripeCheckoutGateway` + the existing webhook; cart untouched
- [ ] Analytics events reuse `AnalyticsService.record` so resale is in the KPI funnel
- [ ] Docs updated (root/server/web `CLAUDE.md`, PRD Phase 7 status)
- [ ] No unnecessary scope (no trade-in credit / authentication / logistics)
- [ ] Self-contained — no codebase searching needed during implementation

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Double-sale of a unique second-hand unit | M | H (double charge) | atomic `LISTED→RESERVED` conditional UPDATE (rows-affected guard); `RESERVED→SOLD` on payment; scheduled release of stale reservations |
| Reservation leak (session abandoned) | M | M (item stuck unbuyable) | `releaseStaleReservations()` sweep every 5 min, TTL 30 min (mirrors worker stale-task reclaim) |
| Eligibility trusts `itemsSnapshot` JSON shape | L | M | parse defensively (try/catch → skip); field names pinned to `CheckoutService.ItemSnapshot` |
| Adding `ResaleService` dep into `CheckoutService` creates a cycle | L | M | one-way dependency (`CheckoutService → ResaleService`); `ResaleService` must NOT depend on `CheckoutService` (keep money logic in `CheckoutService`) |
| `@DataJpaTest` fails on the pre-existing `consumeToken` boot bug | M | L | single-repo `excludeFilters` slice (copied incantation) |
| Deleting a product that has active resale listings | L | L | FK default RESTRICT blocks it; documented v1 behavior |

## Notes
- **Why not reuse the shared cart?** Threading resale through `cart_items` would require changing the `(cart_id, product_id, selected_size)` unique key, branching `CheckoutService` line-item pricing, and forcing quantity=1 — all on the exact path Phase 9 KPI instrumentation depends on. Buy-now via a dedicated `/api/resale/listings/{id}/checkout` reuses the `StripeCheckoutGateway` + `Order` + webhook with **zero** changes to the cart, at the cost of one extra endpoint. This is the lighter, safer seam for a single-owner v1.
- **`RESERVED` beyond the owner-stated status set** — the owner named `DRAFT/LISTED/SOLD/REMOVED`. `RESERVED` is an internal transient added purely for payment-safety (mirrors `TaskStatus.MATERIALIZED`). Flagged for owner awareness; it never appears as a browseable state.
- **`DRAFT`** is defined for forward-compat (save-without-publish) but v1 `createListing` goes straight to `LISTED`; wire a draft-save toggle later if desired.
- **Trade-in / credit** (the "mid" option) and **full circular lifecycle** (authentication, take-back, logistics) remain future phases — the `resale_listings` schema is a clean base to extend (e.g. add a `credit_ledger` later without reworking listings).
- **Token key drift (unrelated):** `web/lib/api.ts` reads `localStorage["clossette_token"]` while docs say `iyae_token` — pre-existing, out of scope; do not "fix" it in this plan.
