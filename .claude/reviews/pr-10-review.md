# PR Review: #10 — feat(phase5): Marketplace + Local Designers + ADMIN

**Reviewed**: 2026-09-05
**Author**: YuudachiXMMY (Jadyn Wu)
**Branch**: worktree-iyae-phase5-prp-plan → main
**Decision**: REQUEST_CHANGES (draft PR) — 1 HIGH data-loss bug + 1 MEDIUM moderation-authz gap; 4 test-adequacy gaps
**Method**: adversarial multi-dimension review (5 dimensions: security/authz, correctness, data/migration, frontend, test-coverage) → per-finding refutation pass → synthesis. 9 candidate findings; 2 refuted (the "duplicate size label → HTTP 500" claim was downgraded/refuted: it surfaces as a handled 409, not a 500), 7 confirmed.

> **Finding IDs use a single global sequential counter, ordered by severity then impact** (same convention as `pr-3-review.md`). LOW findings land at L6/L7, so there is no literal "L1"; the user's "H1/L1" shorthand = the first HIGH (**H1**) and the first LOW (**L6**).

## Summary

Phase 5 introduces one live data-loss bug and one durable-moderation authorization gap, plus four test-adequacy gaps around the new measurement/recommendation and filtering features. The most serious is a frontend round-trip defect (**H1**) where editing any product silently deletes all its per-size measurements: the designer product path never returns measurements, so the edit grid loads blank and the client always PUTs an empty array, which the server treats as "clear". A second live issue (**M2**) lets a designer override admin `ARCHIVED` moderation via the ordinary product-update path, since `ARCHIVED` is a designer-writable status with no moderation lock. The remaining findings are coverage gaps that let real regressions ship green (Specification-based catalog/`localOnly` filtering, the `replaceMeasurements` write path + `getProductById` enrichment, the asymmetric size-recommendation weighting, and admin posts/promotions endpoints).

## Findings

### CRITICAL
None.

### HIGH

**H1 — Editing any product silently wipes all its per-size measurements.** ✅ **FIXED in branch `fix/pr10-h1-l6-measurements`**
`web/app/designer/products/[id]/edit/page.tsx:49-54,84,138`; `web/components/ProductForm.tsx:156-170`; `server/.../service/ProductService.java:201-210`.
The edit page loads via `GET /api/designer/products` → `ProductService.getDesignerProducts` → `buildProductResponse` → `ProductResponse.from`, which always leaves `measurements=null` (only `getProductById` enriched it). So `initialData.measurements` is `[]` and `ProductForm` renders a blank measurement grid. On submit, `ProductForm.handleSubmit` always builds a measurements array (never null) and `edit/page.tsx:84` sends `measurements: data.measurements ?? []` (the `??` never fires → `[]`). `replaceMeasurements` treats a non-null empty list as "replace with nothing": it runs `deleteByProductId` + `flush`, then returns on `isEmpty()` without re-inserting. **Net effect: any edit save destroys measurements the designer never saw** (e.g. seeded `lunaTop1` with 4 rows XS/S/M/L), and the PDP loses its "Your recommended size" output.
*Failure scenario:* designer opens edit for a product with measurements → changes only the price → Save → all `product_size_measurements` rows for that product are permanently deleted.
*Fix applied:* enrich the designer list response with per-size measurements (batched `findByProductIdIn`, grouped by product id) so `ProductForm` pre-fills and saving round-trips them. The `[]`-means-clear contract is intentionally preserved (blanking all rows still clears). Regression test: `ProductServiceTest.getDesignerProducts_enrichesMeasurements`.

### MEDIUM

**M2 — Admin `ARCHIVED` moderation is reversible by the owning designer via `PUT /api/designer/products/{id}`.** ✅ **FIXED in branch `fix/pr10-h1-l6-measurements`**
`server/.../service/ProductService.java:176-177` (updateProduct status handling); interacts with `AdminModerationService.setProductStatus` (`AdminModerationService.java:53-62`).
The PR's only mechanism for admin catalog hiding is forcing `ProductStatus=ARCHIVED`. But `ProductStatus` is a designer-writable field on `UpdateProductRequest`, and `updateProduct` applies it after only an ownership check (no distinction between a self-imposed archive and an admin-imposed one, no moderation-lock flag). So the content owner can instantly override any admin decision.
*Failure scenario:* admin `PUT /api/admin/products/5/status {"status":"ARCHIVED"}` hides product 5; the owning designer `PUT /api/designer/products/5 {"status":"PUBLISHED"}` and the policy-violating listing immediately reappears in the public catalog. (Post moderation is safe by contrast — owners have no path back to `ACTIVE`.)
*Fix applied:* added a server-internal `products.moderation_locked` flag (V12 migration + `Product.moderationLocked`). `AdminModerationService.setProductStatus` sets it on an admin `ARCHIVED` and clears it on any un-hide (`PUBLISHED`/`DRAFT`); `ProductService.updateProduct` throws `AccessDeniedException` (403) when the owning designer attempts a status transition *out of* a locked product, while all non-status edits (name/price/media/measurements) still pass and a same-status no-op is allowed. The flag stays server-internal (`ProductResponse` and its call sites unchanged). Tests: `ProductServiceTest.updateProduct_moderationLocked_rejectsStatusChangeOutOfArchived` / `_allowsNonStatusEdit` / `updateProduct_notLocked_allowsSelfArchive`; `AdminModerationServiceTest.setProductStatus_archived_setsModerationLocked` / `_published_clearsModerationLocked`.

**M3 — Catalog filter tests stub `findAll(any(Specification))`, so `ProductSpecifications` predicate logic (incl. `localOnly`) is never exercised.** ✅ **FIXED in branch `fix/pr10-h1-l6-measurements`**
`server/src/test/java/com/iyae/service/ProductServiceTest.java:170-234`.
When the four named catalog queries were replaced by `ProductSpecifications.catalog(...)`, every catalog test was re-pointed to `findAll(any(Specification.class), ...)`. Because the Specification is matched with `any()` and the mock returns a fixed page, the predicate builder never runs; assertions merely reflect the stubbed product. `ProductSpecifications.java` (incl. the new `designerProfile` join for `isLocal`) has zero executing coverage.
*Failure scenario:* mutate the `localOnly` branch (e.g. drop `cb.isTrue(designer.get("isLocal"))`) — every catalog test still passes, so non-local products can leak into the "Local Designers" filter with no failing server test.
*Fix applied:* added `server/src/test/java/com/iyae/repository/ProductSpecificationsDataJpaTest.java` (`@DataJpaTest`) that persists local + non-local designers/products and runs the real predicate: `localOnly=true` returns only the local product (kills a dropped `cb.isTrue(designer.get("isLocal"))`), `localOnly=false` returns both, plus status, case-insensitive category, and `q` (matching name-only and description-only) cases. The slice is scoped via `@EnableJpaRepositories` to only `ProductRepository` to avoid eagerly validating an unrelated, pre-existing broken query (`PasswordResetTokenRepository.consumeToken`, `CURRENT_TIMESTAMP`→`Instant`) that Hibernate 6.6 rejects. (Added `com.h2database:h2` as a `testRuntimeOnly` dependency — the configured H2 test datasource was not previously on the classpath.)

**M4 — `replaceMeasurements` write path and `getProductById` recommendation/measurement enrichment have no service-level test coverage.** ✅ **FIXED in branch `fix/pr10-h1-l6-measurements`**
`server/.../service/ProductService.java:201-230`.
`createProduct` tests pass `measurements=null` (early-return branch) and there was no `updateProduct` test at all, so the write path was uncovered: unknown-size-label rejection (400), all-null-dims skip, and delete→flush→insert ordering. `getProductById` was changed to enrich `recommendedSize`/`measurements` yet no test stubbed `findByProductId`/`recommendForBuyer` or asserted those fields.
*Fix applied:* on top of the H1/L6 `updateProduct` measurement tests, `ProductServiceTest` now adds `createProduct_withMeasurements_persistsRows` (asserts the delete→flush→insert write path and the persisted row's label/chest), `createProduct_unknownSizeLabel_throws400` (label ∉ product sizes → `IllegalArgumentException` "not one of the product sizes"), and `getProductById_enrichesRecommendationAndMeasurements` (stubs `findByProductId`/`recommendForBuyer` and asserts `recommendedSize` + `measurements`).

**M5 — `SizeRecommendationService` asymmetric tight-penalty and tie-break-to-smaller are unpinned by any distinguishing test.** ✅ **FIXED in branch `fix/pr10-h1-l6-measurements`**
`server/src/test/java/com/iyae/service/SizeRecommendationServiceTest.java:54-63`.
The recommender's whole point is the asymmetric penalty (`TIGHT_WEIGHT=2.0` penalizes too-tight twice as hard). But `pickBestFit_betweenSizes` picks the same winner under symmetric and asymmetric weighting, and the other tests have unique zero-penalty winners.
*Failure scenario:* mutate `TIGHT_WEIGHT` 2.0→1.0 — all tests still pass, and the recommender silently starts preferring too-tight garments.
*Fix applied:* added `SizeRecommendationServiceTest.pickBestFit_tightWeightFlipsToLooserSize` — body chest 90 with candidates 86 (tight, −4) and 96 (loose, +6): under the 2.0 tight weight the looser 96 wins (6 < 8) but under symmetric weighting the tighter 86 would win (4 < 6), so asserting the looser size kills the `TIGHT_WEIGHT` 2.0→1.0 mutant — plus `pickBestFit_scoreTie_returnsSmallerSize` (two equal-score sizes resolve to the smaller magnitude, killing a reversed ascending sort).

### LOW

**L6 — Shrinking product sizes while omitting measurements leaves orphan measurement rows, so `getProductById` can recommend a size no longer offered.** ✅ **FIXED in branch `fix/pr10-h1-l6-measurements`**
`server/.../service/ProductService.java:201-205`.
`measurements==null` means "leave untouched", but size removal is applied independently, so the measurement table could retain labels no longer valid as product sizes — there was no reconciliation. Orphans surface downstream as an invalid `recommendedSize`/measurement.
*Failure scenario:* product with sizes `[S,M,L]` + measurements; a later API `PUT` sends `sizes=[S,M]` and omits measurements → the `L` row persists → a buyer matching `L` gets `recommendedSize=L`, which `SizeSelector` (S/M only) can't render but is carried into cart-add.
*Fix applied:* the `measurements==null` branch of `replaceMeasurements` now prunes rows whose `sizeLabel` is no longer in the product's declared sizes (conservative: skips pruning when sizes are absent/unparseable to avoid wiping on a JSON parse hiccup). Regression tests: `updateProduct_shrinkSizesOmitMeasurements_prunesOrphanMeasurements` and `updateProduct_priceOnlyOmitMeasurements_keepsAllMeasurements`.

**L7 — Admin posts/promotions moderation endpoints lack controller tests; `AdminModerationServiceTest` omits `listPostsForModeration` and `setPromotionSlot` not-found.** ✅ **FIXED in branch `fix/pr10-h1-l6-measurements`**
`server/src/test/java/com/iyae/controller/AdminControllerTest.java:1-102`.
`AdminControllerTest` covers only `GET /products` and `PUT /products/{id}/status`. The five other admin endpoints (`GET /posts`, `PUT /posts/{id}/archive`, `PUT /posts/{id}/remove`, `GET /promotions`, `PUT /promotions/{id}/slot`) have no controller-layer test, so their routing, `@Valid` body binding and serialization are unverified.
*Failure scenario:* rename `PromotionSlotUpdateRequest.slotType()` or change a `@PathVariable` name — build stays green while the endpoint 400s/404s in production, breaking a destructive moderation action.
*Fix applied:* `AdminControllerTest` now covers all five endpoints — `GET /posts`, `PUT /posts/{id}/archive`, `PUT /posts/{id}/remove`, `GET /promotions`, `PUT /promotions/{id}/slot` (admin 200) — plus a non-admin (DESIGNER) 403 on the promotion-slot mutation. `AdminModerationServiceTest` adds `listPostsForModeration_nullStatus_returnsAllOrdered`, `listPostsForModeration_withStatus_filters`, and `setPromotionSlot_notFound_throwsIllegalArgumentException`.

## Fixes applied in this branch (`fix/pr10-h1-l6-measurements`)

Per the instruction to open a fix branch for H1 and the first LOW (L6):

- **`server/.../repository/ProductSizeMeasurementRepository.java`** — added `findByProductIdIn(List<Long>)` for batched enrichment.
- **`server/.../service/ProductService.java`** — `getDesignerProducts` now enriches each response with per-size measurements via a single batched query grouped by product id (H1); `replaceMeasurements` prunes orphan measurement rows on the `measurements==null` path instead of returning immediately (L6).
- **`server/.../service/ProductServiceTest.java`** — 3 regression tests (H1 enrichment; L6 prune-on-shrink; L6 no-over-delete on price-only edit).

No frontend change was required for H1: `ProductListItem.Product` already carries `measurements`, and `edit/page.tsx` already reads `product.measurements ?? []`; once the server returns them, the grid round-trips correctly.

## Validation Results

| Check | Result |
|---|---|
| Server tests (`./gradlew test`) | **Pass** — 364 tests, 0 failures on JDK 22.0.2 (was 361; +3 regression tests) |
| Web typecheck / vitest / build | Not re-run (no web code changed in the fix) |
| Docker relaunch smoke | Not run (no Docker in env) |

## Files Reviewed (48)

Server (source): `SecurityConfig`, `AdminController`, `ProductController`, `AdminModerationService`, `ProductService`, `SizeRecommendationService`, `AuthService`, `DataSeeder`, `ProductSpecifications`, `ProductRepository`, `PostRepository`, `ProductSizeMeasurementRepository`, entities (`DesignerProfile`, `ProductSizeMeasurement`, `Role`), DTOs (`AdminPostResponse`, `CreateProductRequest`, `ProductResponse`, `ProductStatusUpdateRequest`, `PromotionSlotUpdateRequest`, `SizeMeasurementDto`, `UpdateProductRequest`), `V11__marketplace_local_and_measurements.sql`
Server (tests): `AdminControllerTest`, `DesignerProductControllerTest`, `ProductControllerTest`, `AdminModerationServiceTest`, `AuthServiceTest`, `ProductServiceTest`, `SizeRecommendationServiceTest`, `IyaeApplicationTests`
Web: `admin/page.tsx`, `designer/products/[id]/edit/page.tsx`, `designer/products/new/page.tsx`, `products/[id]/page.tsx`, `products/page.tsx`, `NavBar.tsx`, `ProductForm.tsx`, `ProductListItem.tsx`, `SearchFilterBar.tsx`, `lib/api.ts`, `lib/auth-context.tsx`, `lib/hooks/useRequireAuth.ts`, `SearchFilterBar.test.tsx`, `api.test.ts`
Docs: root/server `CLAUDE.md`, `marketplace-local-designers-admin-report.md`
