package com.iyae.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.iyae.dto.CreateProductRequest;
import com.iyae.dto.ProductResponse;
import com.iyae.dto.UpdateProductRequest;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.service.ProductService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * B-11, second half. Seeds a starter catalogue from a checked-in manifest so a fresh production
 * instance is not a dead storefront.
 *
 * <p>Cutover on an empty database used to leave 0 products, 0 designer profiles and 0 promotions:
 * Flyway inserts no content, {@link DataSeeder} is {@code @Profile({"dev","test"})}, and nothing
 * else authors a listing. {@code GET /api/products} answered an empty page, so {@code /products}
 * rendered "No pieces found" for every visitor, and {@code OutfitService} happily persisted an
 * outfit with zero slots — handing the user an empty recommendation rather than an error.
 *
 * <p><b>Why not a Flyway migration.</b> A starter catalogue is content, not schema. In a migration
 * it could not be re-run or corrected, it would be pinned into the schema history of every
 * environment, and it would execute in dev/test/CI too — where {@code DataSeeder} already owns the
 * catalogue and the counts that CI's readiness probe waits on.
 *
 * <p>Idempotent by product name within the operator's own profile, so a re-run after a failed
 * <em>create</em> fills in what is missing and touches nothing that is already there. Deliberately
 * does <em>not</em> update an existing row: once the operator edits a seeded listing in the studio,
 * the manifest is no longer the truth and a re-run must not overwrite them.
 *
 * <p>That cuts one way worth stating plainly, because the two failure modes are not symmetric. A
 * failed create commits nothing and is retried. A create that succeeds and then fails to
 * <em>publish</em> leaves a committed DRAFT whose name is from then on in the idempotence set — so
 * it is skipped on every later boot and never published. It is reported separately and loudly for
 * that reason; auto-publishing a DRAFT later would be indistinguishable from overriding an
 * operator who unpublished a seeded listing on purpose.
 *
 * <p>Writes through {@link ProductService} rather than the repository so the seed path shares
 * {@code validatedGlbUrl}'s traversal guard and the tag/size JSON encoding with the live designer
 * endpoints — a second mapping implementation here is exactly how the two would drift.
 */
@Slf4j
@Component
// After DataSeeder (@Order(2)) rather than alongside AdminBootstrap, so the ordering is total:
// equal-order CommandLineRunners have no guaranteed relative order, and this one depends on
// AdminBootstrap (@Order(0)) having created the operator's DesignerProfile.
@Order(3)
@RequiredArgsConstructor
public class CatalogSeeder implements CommandLineRunner {

    private final ProductService productService;
    private final ObjectMapper objectMapper;

    /**
     * Bean Validation has to be invoked by hand here. {@link CreateProductRequest} carries
     * {@code @NotBlank} on the name and {@code @DecimalMin("0.01")} on the price, but those are
     * enforced by {@code @Valid @RequestBody} at the controller — and this path calls the service
     * directly, so a manifest with a null or negative price would otherwise reach
     * {@code Product.builder().price(...)} and seed a listing no designer endpoint could have
     * created.
     */
    private final Validator validator;

    /** Filesystem path to the manifest. Blank — the default — seeds nothing. */
    @Value("${app.catalog.seed-manifest:}")
    private String seedManifestPath;

    /**
     * Shared with {@link AdminBootstrap}: the operator account is the one that owns the seeded
     * listings, and it is the only account in a fresh instance with a DesignerProfile to own them.
     */
    @Value("${app.admin.bootstrap-email:}")
    private String operatorEmail;

    /**
     * One listing in the manifest. Mirrors {@link CreateProductRequest} minus the fields a starter
     * catalogue has no use for ({@code measurements} is authored in the studio, where the per-size
     * grid that drives the PDP size hint lives).
     *
     * @param publish whether to move the listing to PUBLISHED; createProduct always writes DRAFT,
     *                and a DRAFT is invisible to {@code GET /api/products}. Defaults to false, so
     *                a manifest that forgets the flag stages content rather than publishing it.
     */
    record SeedProduct(
            String name,
            String description,
            BigDecimal price,
            String currency,
            String category,
            List<String> styleTags,
            List<String> colorTags,
            List<String> sizes,
            List<String> media,
            String glbUrl,
            boolean publish
    ) {}

    record SeedManifest(List<SeedProduct> products) {}

    @Override
    public void run(String... args) {
        if (seedManifestPath == null || seedManifestPath.isBlank()) {
            return;
        }
        if (operatorEmail == null || operatorEmail.isBlank()) {
            log.error("CATALOG_SEED_MANIFEST is set to {} but ADMIN_BOOTSTRAP_EMAIL is empty — "
                    + "there is no operator account to own the seeded listings. Seeding nothing.",
                    seedManifestPath);
            return;
        }

        SeedManifest manifest;
        try {
            // Unknown keys tolerated explicitly, not inherited. The manifest is a hand-edited
            // operator file — the shipped example carries a `_comment` block — and Spring Boot's
            // injected mapper happens to disable FAIL_ON_UNKNOWN_PROPERTIES globally. Depending on
            // that would mean the example parses in production for a reason unrelated to this
            // code, and stops parsing the day someone tightens the application-wide mapper.
            manifest = objectMapper.readerFor(SeedManifest.class)
                    .without(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                    .readValue(Files.readAllBytes(Path.of(seedManifestPath)));
        } catch (IOException e) {
            // Loud and non-fatal: refusing to boot over a bad manifest would take down an
            // already-running instance on a redeploy, and the catalogue check in
            // `prod_deploy.sh health` is what turns an empty storefront into a failure.
            log.error("Could not read the catalogue seed manifest at {} — seeding nothing. "
                    + "The storefront will be empty unless it already has content.",
                    seedManifestPath, e);
            return;
        }

        if (manifest == null || manifest.products() == null || manifest.products().isEmpty()) {
            log.warn("Catalogue seed manifest {} contains no products — seeding nothing.",
                    seedManifestPath);
            return;
        }

        String email = operatorEmail.trim().toLowerCase();
        Set<String> existing;
        try {
            existing = productService.getDesignerProducts(email).stream()
                    .map(ProductResponse::name)
                    .collect(Collectors.toUnmodifiableSet());
        } catch (RuntimeException e) {
            log.error("Could not list the operator's existing products for {} — seeding nothing. "
                    + "This usually means AdminBootstrap has not created the account or its "
                    + "DesignerProfile yet; check the lines it logged above.", email, e);
            return;
        }

        int created = 0;
        int skipped = 0;
        int unpublished = 0;
        for (SeedProduct seed : manifest.products()) {
            if (seed == null || seed.name() == null || seed.name().isBlank()) {
                log.warn("Skipping a catalogue seed entry with no name.");
                continue;
            }
            if (existing.contains(seed.name())) {
                skipped++;
                continue;
            }
            CreateProductRequest request = new CreateProductRequest(
                    seed.name(), seed.description(), seed.price(), seed.currency(),
                    seed.category(), seed.styleTags(), seed.colorTags(), seed.sizes(),
                    seed.media(), seed.glbUrl(), null);

            Set<ConstraintViolation<CreateProductRequest>> violations = validator.validate(request);
            if (!violations.isEmpty()) {
                // The same rules the designer endpoint enforces, applied by hand because this
                // path does not go through @Valid. Skipping beats seeding a listing the live
                // API would have rejected with a 400.
                log.error("Skipping catalogue seed product '{}': {}", seed.name(),
                        violations.stream()
                                .map(v -> v.getPropertyPath() + " " + v.getMessage())
                                .sorted()
                                .collect(Collectors.joining("; ")));
                continue;
            }

            ProductResponse product;
            try {
                product = productService.createProduct(email, request);
            } catch (RuntimeException e) {
                // One bad entry must not abandon the rest: a half-seeded catalogue the operator
                // can finish by hand beats an empty one. Nothing was committed, so the next boot
                // genuinely does retry this entry.
                log.error("Failed to create catalogue product '{}' — nothing was written for it, "
                        + "and the next boot will try again. Continuing with the rest.",
                        seed.name(), e);
                continue;
            }
            created++;

            if (!seed.publish()) {
                continue;
            }
            try {
                // Separate call because createProduct always writes DRAFT. Every field but
                // status is null: updateProduct is a partial update, so this changes nothing
                // else. measurements stays null, which only prunes rows orphaned by a size
                // change — there are none on a row created a statement ago.
                productService.updateProduct(email, product.id(), new UpdateProductRequest(
                        null, null, null, null, null, null, null, null, null, null,
                        ProductStatus.PUBLISHED, null));
            } catch (RuntimeException e) {
                // Deliberately NOT retried on the next boot, and reported separately from a
                // create failure because the outcome is different in a way the operator has to
                // know about: createProduct has already committed its own transaction, so the
                // listing exists as a DRAFT. Its name is therefore in `existing` from here on
                // (getDesignerProducts does not filter by status) and the idempotence check will
                // skip it every time.
                //
                // Auto-publishing a DRAFT on a later boot is the wrong repair: it is
                // indistinguishable from the operator having unpublished a seeded listing
                // deliberately, and this seeder's contract is that it never overrides their
                // edits. So the fix is to make the state legible instead of guessing.
                unpublished++;
                log.error("Created catalogue product '{}' but could not publish it. It exists as "
                        + "a DRAFT and is therefore invisible to shoppers; this will NOT be "
                        + "retried on the next boot. Publish it from /designer/products.",
                        seed.name(), e);
            }
        }

        if (unpublished > 0) {
            log.error("Catalogue seed from {}: {} created ({} of them left as unpublished DRAFTs "
                    + "— publish them by hand), {} already present.",
                    seedManifestPath, created, unpublished, skipped);
        } else {
            log.info("Catalogue seed from {}: {} created, {} already present.",
                    seedManifestPath, created, skipped);
        }
    }
}
