# Plan: PR #10 follow-up — M2 moderation-lock authz fix + M3/M4/M5/L7 test coverage

## Summary
Close the one remaining live security defect from the PR #10 review (M2: a designer can reverse an admin `ARCHIVED` moderation via the ordinary product-update path) by introducing a `moderation_locked` flag (V12 migration + entity + service enforcement), and eliminate the four test-adequacy gaps (M3 catalog `Specification`/`localOnly`, M4 measurement write-path + `getProductById` enrichment, M5 asymmetric size-recommendation weighting, L7 admin posts/promotions endpoints) so future regressions fail the build instead of shipping green.

## User Story
As the marketplace operator (ADMIN), I want an admin `ARCHIVED` decision to stay in force so a designer cannot silently republish a policy-violating listing; and as a maintainer, I want the new Phase-5 filtering/sizing/moderation logic pinned by tests so mutations are caught.

## Problem → Solution
- **M2 (live authz bug)**: `updateProduct` applies `request.status()` after only an ownership check → owner overrides admin `ARCHIVED`. → Add a `moderationLocked` flag the admin path sets on ARCHIVE (and clears on un-hide); `updateProduct` refuses a designer status transition *out of* ARCHIVED while locked (403).
- **M3/M4/M5/L7 (coverage gaps)**: predicate builder, measurement write path, asymmetric weighting, and 5 admin endpoints have zero/insufficient executing coverage → mutations pass. → Add a `@DataJpaTest` for the Specification, service tests for the write path + recommender, and controller/service tests for the admin endpoints.

## Metadata
- **Complexity**: Medium (Large-ish test surface, Small production change)
- **Source PRD**: N/A (driven by `.claude/reviews/pr-10-review.md`)
- **PRD Phase**: Phase 5 follow-up (Marketplace + Local Designers + ADMIN)
- **Base branch / HEAD**: `fix/pr10-h1-l6-measurements` @ `b0d4922` (H1/L6 already fixed on disk)
- **Estimated Files**: ~9 (1 migration, 1 entity, 2 services, 1 new test file, 4 existing test files)
- **Estimated new tests**: ~22 (server suite 364 → ~386)

---

## UX Design

### Before / After
Internal + admin-facing change — no buyer-facing UX transformation. The only observable behavioral change: a designer `PUT /api/designer/products/{id}` that tries to move an **admin-archived** product to `PUBLISHED`/`DRAFT` now returns **403** instead of silently succeeding. Editing non-status fields (name/price/media/measurements) of a locked product still succeeds.

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| `PUT /api/designer/products/{id}` with `status` change on an admin-archived product | 200, republished | 403 (`AccessDeniedException`) | Lock enforced in `ProductService.updateProduct` |
| `PUT /api/admin/products/{id}/status` → `ARCHIVED` | sets status | sets status **and** `moderation_locked=true` | Durable moderation |
| `PUT /api/admin/products/{id}/status` → `PUBLISHED`/`DRAFT` | sets status | sets status **and** `moderation_locked=false` | Admin un-hide releases the lock |
| Designer self-archives (`status=ARCHIVED` via designer path) | sets status | unchanged — **not** locked (only admin path locks) | Designer may still republish their own self-archive |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `server/.../service/ProductService.java` | 151-193 | `updateProduct` — where the status-lock guard is inserted |
| P0 | `server/.../service/AdminModerationService.java` | 53-63 | `setProductStatus` — where the lock is set/cleared |
| P0 | `server/.../entity/Product.java` | 59-61 | status column; add `moderationLocked` beside it |
| P0 | `server/.../repository/ProductSpecifications.java` | 21-43 | The predicate under test (M3) |
| P0 | `server/src/test/.../service/ProductServiceTest.java` | 52-150, 353-443 | Mockito setup, fixtures, existing measurement regressions (M2/M4 tests append here) |
| P0 | `server/src/test/.../controller/AdminControllerTest.java` | 31-102 | `@WebMvcTest` + `WithMockUser` pattern; `sampleProduct()` 24-arg ctor (L7 tests append here) |
| P0 | `server/src/test/.../service/AdminModerationServiceTest.java` | 34-148 | Service test pattern (M2 lock tests + L7 gaps append here) |
| P1 | `server/.../config/GlobalExceptionHandler.java` | (AccessDenied→403, IllegalArgument→400) | Confirms exception→status mapping for M2 |
| P1 | `server/.../service/SizeRecommendationService.java` | 25-96 | `TIGHT_WEIGHT=2.0` asymmetry (M5 target) |
| P1 | `server/src/test/.../service/SizeRecommendationServiceTest.java` | 32-73 | `size()`/`body()` fixtures reused by M5 |
| P1 | `server/.../dto/ProductResponse.java` | 15-94 | 24-field record — **unchanged** by this plan (keep blast radius small) |
| P1 | `server/.../dto/{AdminPostResponse,PromotionResponse,PromotionSlotUpdateRequest}.java` | all | Ctors for L7 controller mock returns |
| P2 | `server/src/main/resources/db/migration/V11__marketplace_local_and_measurements.sql` | all | Migration style to mirror for V12 |
| P2 | `server/.../controller/AdminController.java` | 46-74 | Exact admin posts/promotions routes (L7) |

## External Documentation
No external research needed — feature uses established internal patterns (Spring Data JPA `Specification`, `@DataJpaTest`, `@WebMvcTest`, Mockito STRICT_STUBS, Flyway `ALTER TABLE`).

---

## Patterns to Mirror

### MIGRATION_STYLE
```sql
-- SOURCE: server/src/main/resources/db/migration/V11__marketplace_local_and_measurements.sql:5-8
ALTER TABLE designer_profiles ADD COLUMN is_local BOOLEAN NOT NULL DEFAULT FALSE;
```

### ENTITY_BOOLEAN_COLUMN
```java
// SOURCE: server/.../entity/DesignerProfile.java:39-40
@Column(name = "is_local", nullable = false)
private boolean isLocal;
```

### SERVICE_STATUS_MUTATION (the exact block to guard)
```java
// SOURCE: server/.../service/ProductService.java:186-188
if (request.status() != null) {
    product.setStatus(request.status());
}
```

### ADMIN_SET_STATUS
```java
// SOURCE: server/.../service/AdminModerationService.java:53-63
@Transactional
public ProductResponse setProductStatus(Long productId, ProductStatus status) {
    if (status == null) { throw new IllegalArgumentException("Status is required"); }
    Product product = productRepository.findById(productId)
            .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
    product.setStatus(status);
    log.info("Admin forced product {} to status {}", productId, status);
    return ProductResponse.from(productRepository.save(product));
}
```

### SERVICE_TEST_MOCKITO (M2/M4/M5)
```java
// SOURCE: server/src/test/.../service/AdminModerationServiceTest.java:59-69
@Test
void setProductStatus_archivesProductNotOwnedByActor_noAccessDenied() {
    Product product = ownedByOther();
    when(productRepository.findById(100L)).thenReturn(Optional.of(product));
    when(productRepository.save(any(Product.class))).thenAnswer(inv -> inv.getArgument(0));
    ProductResponse result = service.setProductStatus(100L, ProductStatus.ARCHIVED);
    assertThat(result.status()).isEqualTo(ProductStatus.ARCHIVED);
    assertThat(product.getStatus()).isEqualTo(ProductStatus.ARCHIVED);
}
```

### CONTROLLER_TEST_WEBMVC (L7)
```java
// SOURCE: server/src/test/.../controller/AdminControllerTest.java:80-91
@Test
@WithMockUser(username = "admin@iyae.ca", roles = "ADMIN")
void setProductStatus_admin_returns200() throws Exception {
    when(adminModerationService.setProductStatus(eq(1L), eq(ProductStatus.ARCHIVED)))
            .thenReturn(sampleProduct());
    mockMvc.perform(put("/api/admin/products/1/status")
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(new ProductStatusUpdateRequest(ProductStatus.ARCHIVED))))
            .andExpect(status().isOk());
}
```

### RECOMMENDER_TEST_FIXTURES (M5)
```java
// SOURCE: server/src/test/.../service/SizeRecommendationServiceTest.java:32-39
private static ProductSizeMeasurement size(String label, Double chest, Double waist, Double hips) {
    return ProductSizeMeasurement.builder().sizeLabel(label).chestCm(chest).waistCm(waist).hipsCm(hips).build();
}
private static BodyProfile body(Double chest, Double waist, Double hips) {
    return BodyProfile.builder().chestCm(chest).waistCm(waist).hipsCm(hips).build();
}
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `server/src/main/resources/db/migration/V12__product_moderation_lock.sql` | CREATE | Add `products.moderation_locked BOOLEAN NOT NULL DEFAULT FALSE` (M2) |
| `server/.../entity/Product.java` | UPDATE | Add `moderationLocked` field mapped to the new column (M2) |
| `server/.../service/AdminModerationService.java` | UPDATE | `setProductStatus` sets lock on ARCHIVE, clears on un-hide (M2) |
| `server/.../service/ProductService.java` | UPDATE | `updateProduct` rejects designer status change out of ARCHIVED while locked (M2) |
| `server/src/test/.../repository/ProductSpecificationsDataJpaTest.java` | CREATE | `@DataJpaTest` exercising the real predicate incl. `localOnly` join (M3) |
| `server/src/test/.../service/ProductServiceTest.java` | UPDATE | M2 lock tests + M4 create-valid/unknown-label-400/getProductById-enrichment |
| `server/src/test/.../service/SizeRecommendationServiceTest.java` | UPDATE | M5 tight-weight-flip + score-tie tests |
| `server/src/test/.../controller/AdminControllerTest.java` | UPDATE | L7 posts/promotions endpoint tests (+ non-admin 403) |
| `server/src/test/.../service/AdminModerationServiceTest.java` | UPDATE | L7 `listPostsForModeration` (null/status) + `setPromotionSlot` not-found |

## NOT Building
- **No `ProductResponse` change** — the 24-field record is left untouched; `moderationLocked` is *not* surfaced to clients (keeps the constructor's ~4 call sites and `AdminControllerTest.sampleProduct()`'s 24-arg literal unchanged). Exposing the flag in the API is a separate, optional enhancement.
- **No frontend change** — admin console / designer edit form need no update for the security fix. Optionally surfacing a "locked by moderation" hint is out of scope.
- **No dedicated moderation-status enum** — the review offered this as an alternative; the boolean lock is the smaller, sufficient fix.
- **No SecurityConfig change** — `/api/admin/**` is already ADMIN-gated; the lock is a service-layer business rule, not a URL rule.
- **No SMPL-X/avatar coupling** in the recommender tests (M5) — respect the existing seam.

---

## Step-by-Step Tasks

### Task 1 (M2): V12 migration — moderation lock column
- **ACTION**: Create `server/src/main/resources/db/migration/V12__product_moderation_lock.sql`.
- **IMPLEMENT**:
  ```sql
  -- PR#10 M2: durable admin moderation. When an admin forces ARCHIVED, lock the product so the
  -- owning designer cannot republish via the ordinary update path. Non-null default so existing rows validate.
  ALTER TABLE products ADD COLUMN moderation_locked BOOLEAN NOT NULL DEFAULT FALSE;
  ```
- **MIRROR**: MIGRATION_STYLE (V11:5-8).
- **GOTCHA**: Hibernate runs `ddl-auto: validate` in dev/prod — the entity column (Task 2) MUST match this DDL exactly (`moderation_locked`, non-null). Test profile uses H2 `create-drop` with Flyway disabled, so V12 is not applied in tests — the column comes from the entity mapping there.
- **VALIDATE**: `./gradlew bootRun` against MySQL starts without a Flyway/Hibernate validation error; column present in `products`.

### Task 2 (M2): Product entity — moderationLocked field
- **ACTION**: Add the field to `Product.java` immediately after the `status` column (line 61).
- **IMPLEMENT**:
  ```java
  @Column(name = "moderation_locked", nullable = false)
  private boolean moderationLocked;
  ```
- **MIRROR**: ENTITY_BOOLEAN_COLUMN (DesignerProfile.isLocal:39-40). Lombok `@Getter/@Setter/@Builder` auto-generate `isModerationLocked()`, `setModerationLocked(...)`, and the builder method — no manual accessors.
- **GOTCHA**: `boolean` (primitive) defaults to `false`, so every existing `Product.builder()...build()` in tests remains valid without setting it.
- **VALIDATE**: `./gradlew test` compiles; `IyaeApplicationTests` context still loads (H2 auto-creates the column).

### Task 3 (M2): AdminModerationService — set/clear the lock
- **ACTION**: In `setProductStatus`, set the lock when archiving, clear it otherwise.
- **IMPLEMENT** (replace the body's mutate line):
  ```java
  product.setStatus(status);
  product.setModerationLocked(status == ProductStatus.ARCHIVED);
  log.info("Admin forced product {} to status {} (moderationLocked={})",
          productId, status, product.isModerationLocked());
  ```
- **MIRROR**: ADMIN_SET_STATUS.
- **GOTCHA**: Clearing the lock on PUBLISHED/DRAFT is intentional — it is the admin's explicit "un-hide", which must hand control back to the designer. Do NOT gate this behind ownership (admin service deliberately skips ownership checks).
- **VALIDATE**: New `AdminModerationServiceTest` cases in Task 8 pass.

### Task 4 (M2): ProductService.updateProduct — enforce the lock
- **ACTION**: Replace the status-application block (ProductService.java:186-188) with a lock-aware guard.
- **IMPLEMENT**:
  ```java
  if (request.status() != null && request.status() != product.getStatus()) {
      if (product.isModerationLocked()) {
          throw new AccessDeniedException(
                  "This product has been archived by moderation and cannot be changed by the designer.");
      }
      product.setStatus(request.status());
  }
  ```
- **IMPORTS**: `import org.springframework.security.access.AccessDeniedException;`
- **MIRROR**: SERVICE_STATUS_MUTATION (the block being replaced).
- **GOTCHA**:
  - Compare with `!=` on the enum and guard on *change* so a locked product receiving `status=ARCHIVED` (no-op) is allowed and only a transition *out* is blocked.
  - `AccessDeniedException` → **403** via `GlobalExceptionHandler.handleAccessDenied` (generic "Access denied" body — that's fine; 403 is the signal). Choosing 403 over 400 marks this as an authorization denial, not a validation error.
  - Non-status edits (name/price/media/measurements) on a locked product still flow through — only the status transition is blocked. `replaceMeasurements` still runs (measurements editing remains allowed while archived).
- **VALIDATE**: New `ProductServiceTest` M2 cases in Task 6 pass; existing `updateProduct_*` measurement tests still pass (they set no status / product unlocked).

### Task 5 (M3): ProductSpecifications `@DataJpaTest`
- **ACTION**: Create `server/src/test/java/com/iyae/repository/ProductSpecificationsDataJpaTest.java` that persists local + non-local designers/products and asserts `catalog(...)` predicates actually filter.
- **IMPLEMENT** (skeleton — fill dims from fixtures):
  ```java
  @DataJpaTest
  @ActiveProfiles("test")
  class ProductSpecificationsDataJpaTest {

      @Autowired TestEntityManager em;
      @Autowired ProductRepository productRepository; // extends JpaSpecificationExecutor<Product>

      private Product persistProduct(String name, String category, boolean local, ProductStatus status) {
          User u = em.persist(User.builder()
                  .email(name + "@ex.com").passwordHash("x").name(name).role(Role.DESIGNER).build());
          DesignerProfile p = em.persist(DesignerProfile.builder()
                  .user(u).displayName(name).shopName(name).isLocal(local).build());
          return em.persist(Product.builder()
                  .designerProfile(p).name(name).description("d").price(new BigDecimal("10.00"))
                  .currency("CAD").category(category).status(status).build());
      }

      @Test
      void catalog_localOnly_returnsOnlyLocalDesignerProducts() {
          persistProduct("LocalTop", "Tops", true, ProductStatus.PUBLISHED);
          persistProduct("RemoteTop", "Tops", false, ProductStatus.PUBLISHED);
          em.flush(); em.clear();
          var page = productRepository.findAll(
                  ProductSpecifications.catalog(ProductStatus.PUBLISHED, null, null, true), Pageable.unpaged());
          assertThat(page).extracting(Product::getName).containsExactly("LocalTop"); // mutation-kill for cb.isTrue(isLocal)
      }

      @Test
      void catalog_statusFilter_excludesNonPublished() { /* PUBLISHED vs DRAFT */ }

      @Test
      void catalog_categoryFilter_matchesCaseInsensitive() { /* "tops" matches "Tops" */ }

      @Test
      void catalog_qFilter_matchesNameOrDescription() { /* q on name and on description */ }
  }
  ```
- **MIRROR**: Entity builders from `ProductServiceTest.setUp` (User/DesignerProfile/Product field sets).
- **GOTCHA**:
  - `@DataJpaTest` auto-configures an embedded DB; pair with `@ActiveProfiles("test")` so the mock-AI/JWT props load and Flyway stays disabled (schema comes from Hibernate `create-drop`). Verified viable because `IyaeApplicationTests` already boots these entities on H2.
  - `Product` has `columnDefinition = "json"` fields (styleTags/etc.) — leave them null in fixtures; H2 accepts the `json` DDL. Do not rely on JSON querying (the Specification never touches those columns).
  - The `localOnly` branch does `root.join("designerProfile")` then `cb.isTrue(designer.get("isLocal"))` — this is exactly what a mock-based test cannot exercise; the persisted rows make it real.
- **VALIDATE**: `./gradlew test --tests ProductSpecificationsDataJpaTest` green; deleting `cb.isTrue(designer.get("isLocal"))` (the mutation) makes `catalog_localOnly_*` fail.
- **FALLBACK** (only if `@DataJpaTest` proves unviable in this H2 config): capture the `Specification` and invoke `.toPredicate(root, query, cb)` with Mockito mocks for `Root`/`CriteriaBuilder`/`Join`, verifying `cb.isTrue(...)` is invoked with the `isLocal` path when `localOnly=true` and never when `false`. Infra-free but weaker (asserts calls, not results).

### Task 6 (M2 + M4): ProductServiceTest additions
- **ACTION**: Append tests to the existing class (fixtures `publishedProduct` id 100, `designerProfile` id 10, `designerUser`, sizes `[S,M,L]` already in `setUp`).
- **IMPLEMENT**:
  - **M2a `updateProduct_moderationLocked_rejectsStatusChangeOutOfArchived`**: set `publishedProduct` status ARCHIVED + `moderationLocked(true)` (rebuild or `setStatus/setModerationLocked`); request `status=PUBLISHED`; stub owner lookups + `findById(100L)`; assert `assertThatThrownBy(...).isInstanceOf(AccessDeniedException.class)`; `verify(productRepository, never()).save(any())` **and** assert product status still ARCHIVED. Do NOT stub `save` (STRICT_STUBS — it must not be called).
  - **M2b `updateProduct_moderationLocked_allowsNonStatusEdit`**: locked ARCHIVED product; request price-only (status null); stub `save` → echo; assert price updated, status still ARCHIVED, no exception.
  - **M2c `updateProduct_notLocked_allowsSelfArchive`** (guards the happy path): unlocked product; request `status=ARCHIVED`; assert status becomes ARCHIVED, no exception (designer self-archive still works).
  - **M4a `createProduct_withMeasurements_persistsRows`**: `CreateProductRequest` with `measurements=List.of(new SizeMeasurementDto("M",90.0,72.0,96.0,60.0))`; `savedProduct` sizes `["S","M"]`; stub `save` → savedProduct; `verify(productSizeMeasurementRepository).deleteByProductId(200L)`, `.flush()`, and `.save(any())` for the "M" row.
  - **M4b `createProduct_unknownSizeLabel_throws400`**: measurement label `"XXL"` not in savedProduct sizes `["S","M"]`; assert `assertThatThrownBy(...).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("not one of the product sizes")`.
  - **M4c `getProductById_enrichesRecommendationAndMeasurements`**: `findById(100L)` → publishedProduct; asset/task lookups empty; `productSizeMeasurementRepository.findByProductId(100L)` → `List.of(mRow "M")`; `sizeRecommendationService.recommendForBuyer(anyList(), eq("buyer@example.com"))` → `"M"`; assert `result.recommendedSize()=="M"` and `result.measurements()` size 1 with label "M".
- **MIRROR**: SERVICE_TEST_MOCKITO; existing `updateProduct_shrinkSizes...`/`getDesignerProducts_enrichesMeasurements` (353-443) for stub shape.
- **IMPORTS**: `AccessDeniedException`, `SizeMeasurementDto` (add to test imports).
- **GOTCHA**:
  - STRICT_STUBS: only stub what each path reads. M2a must not stub `save`/measurement repos (the guard throws before them). M4a/b: `replaceMeasurements` calls `deleteByProductId` + `flush` **before** the label check — so in M4b those two are invoked before the throw; either stub them as no-ops (void → default) or don't verify order.
  - `objectMapper` is a real `@Spy`, so `parseProductSizes` genuinely parses `savedProduct.getSizes()` — ensure the fixture's `sizes` JSON contains the label under test.
- **VALIDATE**: `./gradlew test --tests ProductServiceTest` green (existing 12+ methods + 6 new).

### Task 7 (M5): SizeRecommendationService distinguishing tests
- **ACTION**: Append two tests that only pass under the asymmetric weighting.
- **IMPLEMENT**:
  - **M5a `pickBestFit_tightWeightFlipsToLooserSize`**: construct sizes where, for the given body, the tighter candidate wins under symmetric weighting but the looser candidate wins under `TIGHT_WEIGHT=2.0`. E.g. body chest 90; `A` chest 86 (too tight, diff −4 → penalty 8 at 2.0×), `B` chest 93 (loose, diff +3 → penalty 3 at 1.0×) → expect `B`. Under symmetric (1.0/1.0), A(4) would beat B(3)… choose numbers so the winner *changes* between the two weightings; assert the asymmetric winner. This mutation-kills `TIGHT_WEIGHT 2.0→1.0`.
  - **M5b `pickBestFit_scoreTie_returnsSmallerSize`**: two sizes producing an equal fit score; assert the smaller (by `sizeMagnitude`, ascending sort) is returned — pins the documented tie-break.
- **MIRROR**: RECOMMENDER_TEST_FIXTURES (`size()`/`body()` helpers already in the file).
- **GOTCHA**: Work the arithmetic so M5a's expected winner genuinely differs between symmetric and asymmetric weighting (otherwise the test doesn't kill the mutant). Keep waist/hips null so only chest drives the score (single comparable dim → deterministic).
- **VALIDATE**: `./gradlew test --tests SizeRecommendationServiceTest` green; locally flipping `TIGHT_WEIGHT` to `1.0` makes M5a fail.

### Task 8 (L7): AdminModerationServiceTest gaps
- **ACTION**: Append the three missing service cases.
- **IMPLEMENT**:
  - `listPostsForModeration_nullStatus_returnsAllOrdered`: `postRepository.findAll(any(Sort.class))` → `List.of(post)`; assert size 1. (Import `org.springframework.data.domain.Sort`, `any(Sort.class)`.)
  - `listPostsForModeration_withStatus_filters`: `postRepository.findByStatusOrderByCreatedAtDesc(PostStatus.ARCHIVED)` → `List.of()`; assert empty.
  - `setPromotionSlot_notFound_throwsIllegalArgumentException`: `promotionRepository.findById(404L)` → empty; assert `IllegalArgumentException` "Promotion not found".
  - (Optional M2 companions here or in Task 3's file): `setProductStatus_archived_setsModerationLocked` and `setProductStatus_published_clearsModerationLocked` (start with a locked product, admin sets PUBLISHED → `product.isModerationLocked()` false).
- **MIRROR**: existing `setPromotionSlot_forcesSlotType` / `listAllProducts_*` (127-147).
- **GOTCHA**: `AdminPostResponse.from` reads `post.getUser().getName()/getUsername()` — build `Post` with a `User` that has both set (see existing `archivePost` fixture at 99-102; add `.username("author")`).
- **VALIDATE**: `./gradlew test --tests AdminModerationServiceTest` green.

### Task 9 (L7): AdminControllerTest endpoint coverage
- **ACTION**: Append controller tests for the 5 uncovered admin endpoints (+ a non-admin 403 on a mutating one).
- **IMPLEMENT** (mock `adminModerationService`):
  - `listPosts_admin_returns200`: `listPostsForModeration(any())` → `List.of(sampleAdminPost())`; `get("/api/admin/posts")` → 200.
  - `archivePost_admin_returns200`: `archivePost(eq(7L))` → sampleAdminPost; `put("/api/admin/posts/7/archive").with(csrf())` → 200.
  - `removePost_admin_returns200`: `removePost(eq(7L))` → sampleAdminPost; `put(".../posts/7/remove").with(csrf())` → 200.
  - `listPromotions_admin_returns200`: `listPromotions()` → `List.of(samplePromotion())`; `get("/api/admin/promotions")` → 200.
  - `setPromotionSlot_admin_returns200`: `setPromotionSlot(eq(3L), eq(SlotType.FEATURED))` → samplePromotion; `put(".../promotions/3/slot").with(csrf()).content(json(new PromotionSlotUpdateRequest(SlotType.FEATURED)))` → 200.
  - `setPromotionSlot_designer_returns403`: same request under `roles="DESIGNER"` → 403 (mutating-endpoint gate check).
  - Add fixtures: `sampleAdminPost()` → `new AdminPostResponse(1L,1L,"Author","author","hi",PostStatus.ACTIVE,Instant.now())`; `samplePromotion()` → `new PromotionResponse(3L,5L,SlotType.FEATURED,10,null,null)`.
- **MIRROR**: CONTROLLER_TEST_WEBMVC; existing `AdminControllerTest` header (`@WebMvcTest(AdminController.class)` + `@Import(WebMvcSecurityConfig.class)` + `@MockBean AdminModerationService`).
- **IMPORTS**: `AdminPostResponse`, `PromotionResponse`, `PromotionSlotUpdateRequest`, `SlotType`, `PostStatus`.
- **GOTCHA**: PUT endpoints need `.with(csrf())` (pattern already in the file). Role gating is by URL rule in `WebMvcSecurityConfig` for `/api/admin/**` — the non-admin 403 verifies it applies to the promotion route too.
- **VALIDATE**: `./gradlew test --tests AdminControllerTest` green.

### Task 10: Full suite + docs
- **ACTION**: Run the full server suite; update `.claude/reviews/pr-10-review.md` to mark M2/M3/M4/M5/L7 addressed; bump test counts in root + server `CLAUDE.md` changelog.
- **VALIDATE**: `cd server && ./gradlew test` → 0 failures (~386 tests).

---

## Testing Strategy

### Unit / Slice Tests
| Test | Input | Expected | Kills mutation |
|---|---|---|---|
| M2a rejectStatusChangeWhenLocked | locked ARCHIVED + `status=PUBLISHED` | `AccessDeniedException` (403), status stays ARCHIVED | removing the lock guard |
| M2b allowNonStatusEditWhenLocked | locked + price-only | 200, price updated, still ARCHIVED | over-broad guard that blocks all edits |
| M2c allowSelfArchiveWhenUnlocked | unlocked + `status=ARCHIVED` | 200, ARCHIVED | guard firing on unlocked products |
| M2 admin set/clear lock | admin ARCHIVE / PUBLISH | `moderationLocked` true / false | lock never set, or never cleared |
| M3 localOnly | 1 local + 1 remote product | only local returned | dropping `cb.isTrue(isLocal)` |
| M4a create+measurements | valid `SizeMeasurementDto` | row persisted (delete→flush→save) | skipping insert |
| M4b unknown label | label ∉ sizes | 400 "not one of the product sizes" | removing the label check |
| M4c getProductById enrich | rows + recommender="M" | `recommendedSize`/`measurements` populated | dropping enrichment |
| M5a tight-weight flip | body between a tight and a loose size | looser size wins | `TIGHT_WEIGHT 2.0→1.0` |
| M5b score tie | equal-fit sizes | smaller returned | reversing the ascending sort |
| L7 admin endpoints | admin & non-admin requests | 200 / 403 | route rename, `@PathVariable`/body binding break |

### Edge Cases Checklist
- [x] Locked product, status = same ARCHIVED (no-op) → allowed
- [x] Locked product, non-status edit → allowed
- [x] Unlocked self-archive → allowed (no regression)
- [x] Admin un-hide releases lock
- [x] `localOnly=false` returns both local and remote (M3 status/category/q cases)
- [x] Unknown measurement label rejected; all-null-dim row skipped (existing behavior)
- [x] Non-admin hits admin mutating endpoint → 403

---

## Validation Commands

### Compile + targeted tests
```bash
cd server && ./gradlew test --tests ProductSpecificationsDataJpaTest \
  --tests ProductServiceTest --tests SizeRecommendationServiceTest \
  --tests AdminModerationServiceTest --tests AdminControllerTest
```
EXPECT: all green.

### Full suite (no regressions)
```bash
cd server && ./gradlew test
```
EXPECT: 0 failures (~386 tests, up from 364).

### Migration / schema validation (real MySQL)
```bash
cd server && ./gradlew bootRun    # requires MySQL on :3306
```
EXPECT: Flyway applies V12; Hibernate `validate` passes (entity column matches).

> Note: `gradle-wrapper.jar` is gitignored and absent from fresh worktrees. Copy it in before running gradle:
> `cp /Users/jadyn/Development/IYAE/.claude/worktrees/iyae-phase4-prp-plan/server/gradle/wrapper/gradle-wrapper.jar server/gradle/wrapper/` (stays untracked).

### Manual Validation (optional, real stack)
- [ ] Admin `PUT /api/admin/products/{id}/status {"status":"ARCHIVED"}` → product hidden from catalog.
- [ ] Designer `PUT /api/designer/products/{id} {"status":"PUBLISHED"}` → **403**, product stays hidden.
- [ ] Admin `PUT .../status {"status":"PUBLISHED"}` → visible again; designer can now edit status.

---

## Acceptance Criteria
- [ ] Tasks 1-10 complete
- [ ] `moderation_locked` present in V12 + `Product` entity (names match; `nullable=false`)
- [ ] Designer cannot move an admin-archived product out of ARCHIVED (403); can still edit other fields
- [ ] Admin ARCHIVE sets the lock; admin un-hide clears it
- [ ] Real `Specification` predicate covered by `@DataJpaTest` (M3)
- [ ] Measurement write path + `getProductById` enrichment covered (M4)
- [ ] Asymmetric weighting + tie-break pinned (M5)
- [ ] All 5 admin posts/promotions endpoints have controller tests + service gaps closed (L7)
- [ ] `./gradlew test` green; review report + CLAUDE.md changelog updated

## Completion Checklist
- [ ] New code mirrors discovered patterns (migration, entity, Mockito, WebMvc, DataJpaTest)
- [ ] STRICT_STUBS respected (no unused stubs; unstubbed collection returns = empty)
- [ ] `ProductResponse` and its call sites untouched
- [ ] No hardcoded values leaking; exception→status mapping deliberate (403 for lock, 400 for bad label)
- [ ] Docs updated (review report, root + server CLAUDE.md changelog + test counts)

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `@DataJpaTest` friction with H2 + `columnDefinition="json"` | Low | Med | `IyaeApplicationTests` already boots these entities on H2; leave json fields null; FALLBACK = capture-and-invoke the `Specification` with mocks (Task 5 fallback) |
| M5a arithmetic doesn't actually flip between weightings | Med | Low | Work the numbers so symmetric vs asymmetric pick *different* sizes; single comparable dim (chest) for determinism |
| `GlobalExceptionHandler.handleAccessDenied` returns generic "Access denied" (custom message lost) | Low | Low | Acceptable — 403 status is the contract; message is not asserted |
| Existing `Product.builder()` test fixtures break | Very Low | Low | `moderationLocked` is primitive `boolean` (defaults false); no fixture edits needed |
| Locking blocks legitimate designer edits | Low | Med | Guard fires ONLY on a status *transition out of* ARCHIVED while locked; all other field edits pass |

## Notes
- **Base state confirmed on disk** (`fix/pr10-h1-l6-measurements` @ `b0d4922`): H1 (`getDesignerProducts` enriches measurements, ProductService.java:112-125) and L6 (`replaceMeasurements` prunes orphans, :213-217) are already present. (CodeGraph's index showed a stale pre-fix snapshot; the Read tool is authoritative.)
- **M4 is partially pre-covered** by the existing `getDesignerProducts_enrichesMeasurements` + two `updateProduct_*` prune tests (ProductServiceTest:353-443); this plan adds only the *remaining* create-valid / unknown-label-400 / `getProductById`-enrichment assertions.
- **Sequencing**: Tasks 1-4 (M2 production) can land as one commit; Tasks 5-9 (tests) as a second; both target this branch (and thus PR #11 / eventually PR #10). M2 is the only behavior change — everything else is test-only and low-risk.
- **Confidence**: 8/10 for single-pass implementation (the one unknown is `@DataJpaTest` viability, which has a documented fallback).
