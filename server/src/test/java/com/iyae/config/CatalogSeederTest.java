package com.iyae.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iyae.dto.CreateProductRequest;
import com.iyae.dto.ProductResponse;
import com.iyae.dto.UpdateProductRequest;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.service.ProductService;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * B-11, second half: a fresh production instance must not serve an empty storefront.
 *
 * <p>The behaviours worth pinning here are the ones that make this safe to leave enabled on every
 * boot — idempotence by name, publishing only what asks to be published, and never taking the
 * application down over a manifest it cannot read.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CatalogSeederTest {

    @Mock ProductService productService;

    private CatalogSeeder seeder;
    private final ObjectMapper objectMapper = new ObjectMapper();
    // The real validator, not a mock: the point of validating here is that CreateProductRequest
    // annotations are enforced on a path that does not go through @Valid, so a stubbed validator
    // would test nothing.
    private final Validator validator =
            Validation.buildDefaultValidatorFactory().getValidator();

    @TempDir Path tempDir;

    @BeforeEach
    void setUp() {
        seeder = new CatalogSeeder(productService, objectMapper, validator);
    }

    private void configure(String manifestPath, String operatorEmail) {
        ReflectionTestUtils.setField(seeder, "seedManifestPath", manifestPath);
        ReflectionTestUtils.setField(seeder, "operatorEmail", operatorEmail);
    }

    private Path writeManifest(String json) throws IOException {
        Path file = tempDir.resolve("catalog-seed.json");
        Files.writeString(file, json);
        return file;
    }

    private static ProductResponse productNamed(Long id, String name) {
        return new ProductResponse(
                id, 1L, "IYAE Admin", name, "desc",
                new BigDecimal("148.00"), "CAD", "Tops",
                Collections.emptyList(), Collections.emptyList(), List.of("S", "M"),
                Collections.emptyList(), null, ProductStatus.DRAFT,
                Instant.now(), Instant.now(), null, null, null,
                false, null, null, null);
    }

    private static final String TWO_PRODUCTS = """
            {"products":[
              {"name":"Charcoal Linen Shirt","price":148.00,"currency":"CAD","category":"Tops",
               "sizes":["S","M"],"publish":true},
              {"name":"Wide-Leg Trouser","price":196.00,"currency":"CAD","category":"Bottoms",
               "sizes":["S","M"],"publish":true}
            ]}""";

    @Test
    void seedsNothingWhenNoManifestIsConfigured() {
        // The default. Every existing deployment boots through this branch.
        configure("", "ops@iyae.ca");

        seeder.run();

        verifyNoInteractions(productService);
    }

    @Test
    void seedsNothingWhenThereIsNoOperatorAccountToOwnTheListings() throws IOException {
        // A manifest with no ADMIN_BOOTSTRAP_EMAIL has nothing to hang the products off: the
        // operator profile AdminBootstrap creates is the only one in a fresh instance.
        configure(writeManifest(TWO_PRODUCTS).toString(), "");

        seeder.run();

        verifyNoInteractions(productService);
    }

    @Test
    void createsAndPublishesEveryListingInTheManifest() throws IOException {
        configure(writeManifest(TWO_PRODUCTS).toString(), "ops@iyae.ca");
        when(productService.getDesignerProducts("ops@iyae.ca")).thenReturn(List.of());
        when(productService.createProduct(eq("ops@iyae.ca"), any()))
                .thenReturn(productNamed(1L, "Charcoal Linen Shirt"))
                .thenReturn(productNamed(2L, "Wide-Leg Trouser"));

        seeder.run();

        ArgumentCaptor<CreateProductRequest> created = ArgumentCaptor.forClass(CreateProductRequest.class);
        verify(productService, times(2)).createProduct(eq("ops@iyae.ca"), created.capture());
        assertThat(created.getAllValues()).extracting(CreateProductRequest::name)
                .containsExactly("Charcoal Linen Shirt", "Wide-Leg Trouser");
        assertThat(created.getAllValues()).extracting(CreateProductRequest::category)
                .containsExactly("Tops", "Bottoms");

        // createProduct always writes DRAFT, and a DRAFT is invisible to GET /api/products — so
        // without the follow-up publish the storefront would still be empty.
        ArgumentCaptor<UpdateProductRequest> published = ArgumentCaptor.forClass(UpdateProductRequest.class);
        verify(productService, times(2)).updateProduct(eq("ops@iyae.ca"), anyLong(), published.capture());
        assertThat(published.getAllValues()).allSatisfy(req -> {
            assertThat(req.status()).isEqualTo(ProductStatus.PUBLISHED);
            // Partial update: everything else must stay null or the publish would also overwrite
            // fields the operator may already have edited.
            assertThat(req.name()).isNull();
            assertThat(req.price()).isNull();
            assertThat(req.measurements()).isNull();
        });
    }

    @Test
    void leavesAListingInDraftWhenTheManifestDoesNotAskForPublication() throws IOException {
        // Default-false, so a manifest that forgets the flag stages content instead of pushing it
        // live over the operator's head.
        configure(writeManifest("""
                {"products":[{"name":"Unreleased Coat","price":420.00,"category":"Outerwear"}]}""")
                .toString(), "ops@iyae.ca");
        when(productService.getDesignerProducts("ops@iyae.ca")).thenReturn(List.of());
        when(productService.createProduct(eq("ops@iyae.ca"), any()))
                .thenReturn(productNamed(1L, "Unreleased Coat"));

        seeder.run();

        verify(productService).createProduct(eq("ops@iyae.ca"), any());
        verify(productService, never()).updateProduct(anyString(), anyLong(), any());
    }

    @Test
    void isIdempotent_skipsAListingThatAlreadyExistsUnderTheOperator() throws IOException {
        // Runs on every boot. Re-creating would duplicate the catalogue once per restart.
        configure(writeManifest(TWO_PRODUCTS).toString(), "ops@iyae.ca");
        when(productService.getDesignerProducts("ops@iyae.ca"))
                .thenReturn(List.of(productNamed(1L, "Charcoal Linen Shirt")));
        when(productService.createProduct(eq("ops@iyae.ca"), any()))
                .thenReturn(productNamed(2L, "Wide-Leg Trouser"));

        seeder.run();

        ArgumentCaptor<CreateProductRequest> created = ArgumentCaptor.forClass(CreateProductRequest.class);
        verify(productService, times(1)).createProduct(eq("ops@iyae.ca"), created.capture());
        assertThat(created.getValue().name()).isEqualTo("Wide-Leg Trouser");
    }

    @Test
    void doesNotRepublishOrOverwriteAnExistingListing() throws IOException {
        // Once the operator edits a seeded listing — including archiving it — the manifest is no
        // longer the truth for it, and a re-run must not drag it back.
        configure(writeManifest(TWO_PRODUCTS).toString(), "ops@iyae.ca");
        when(productService.getDesignerProducts("ops@iyae.ca")).thenReturn(List.of(
                productNamed(1L, "Charcoal Linen Shirt"), productNamed(2L, "Wide-Leg Trouser")));

        seeder.run();

        verify(productService, never()).createProduct(anyString(), any());
        verify(productService, never()).updateProduct(anyString(), anyLong(), any());
    }

    @Test
    void oneFailingEntryDoesNotAbandonTheRest() throws IOException {
        // A half-seeded catalogue the operator can finish by hand beats an empty one, and the
        // next boot retries the entry that failed.
        configure(writeManifest(TWO_PRODUCTS).toString(), "ops@iyae.ca");
        when(productService.getDesignerProducts("ops@iyae.ca")).thenReturn(List.of());
        when(productService.createProduct(eq("ops@iyae.ca"), any()))
                .thenThrow(new IllegalArgumentException("Price must be at least 0.01"))
                .thenReturn(productNamed(2L, "Wide-Leg Trouser"));

        seeder.run();

        verify(productService, times(2)).createProduct(eq("ops@iyae.ca"), any());
        verify(productService, times(1)).updateProduct(eq("ops@iyae.ca"), eq(2L), any());
    }

    @Test
    void anUnreadableManifestIsLoggedRatherThanThrown() {
        // Refusing to boot over a bad manifest would take a running instance down on redeploy.
        // `prod_deploy.sh health` is what turns an empty storefront into a visible failure.
        configure(tempDir.resolve("does-not-exist.json").toString(), "ops@iyae.ca");

        seeder.run();

        verifyNoInteractions(productService);
    }

    @Test
    void malformedJsonIsLoggedRatherThanThrown() throws IOException {
        configure(writeManifest("{\"products\": [ this is not json").toString(), "ops@iyae.ca");

        seeder.run();

        verifyNoInteractions(productService);
    }

    @Test
    void anEntryWithNoNameIsSkippedRatherThanCreated() throws IOException {
        // Name is the idempotence key, so a nameless entry would be re-created on every boot.
        configure(writeManifest("""
                {"products":[
                  {"name":"  ","price":10.00},
                  {"name":"Real Listing","price":20.00,"publish":true}
                ]}""").toString(), "ops@iyae.ca");
        when(productService.getDesignerProducts("ops@iyae.ca")).thenReturn(List.of());
        when(productService.createProduct(eq("ops@iyae.ca"), any()))
                .thenReturn(productNamed(1L, "Real Listing"));

        seeder.run();

        ArgumentCaptor<CreateProductRequest> created = ArgumentCaptor.forClass(CreateProductRequest.class);
        verify(productService, times(1)).createProduct(eq("ops@iyae.ca"), created.capture());
        assertThat(created.getValue().name()).isEqualTo("Real Listing");
    }

    @Test
    void rejectsAnEntryThatViolatesTheSameRulesTheDesignerEndpointEnforces() throws IOException {
        // Found by the security review pass. This path builds CreateProductRequest and calls the
        // service directly, so the DTO's @NotBlank / @DecimalMin("0.01") — enforced by
        // @Valid @RequestBody at the controller — do not fire on their own. Without the explicit
        // validator a manifest typo would seed a listing no designer endpoint could have created:
        // a negative price reaches Product.builder().price(...) and renders on the storefront.
        configure(writeManifest("""
                {"products":[
                  {"name":"Negative Price","price":-50.00,"category":"Tops","publish":true},
                  {"name":"Free Shirt","price":0.00,"category":"Tops","publish":true},
                  {"name":"No Price At All","category":"Tops","publish":true},
                  {"name":"Valid Listing","price":20.00,"category":"Tops","publish":true}
                ]}""").toString(), "ops@iyae.ca");
        when(productService.getDesignerProducts("ops@iyae.ca")).thenReturn(List.of());
        when(productService.createProduct(eq("ops@iyae.ca"), any()))
                .thenReturn(productNamed(1L, "Valid Listing"));

        seeder.run();

        ArgumentCaptor<CreateProductRequest> created = ArgumentCaptor.forClass(CreateProductRequest.class);
        verify(productService, times(1)).createProduct(eq("ops@iyae.ca"), created.capture());
        assertThat(created.getValue().name()).isEqualTo("Valid Listing");
    }

    @Test
    void aFailedPublishLeavesTheCreatedListingAndKeepsGoing() throws IOException {
        // Coverage gap found by the java-reviewer pass. createProduct commits its own
        // transaction, so a publish failure is NOT a failed seed — the listing exists, as a
        // DRAFT, and its name is in the idempotence set from then on, which means no later boot
        // will publish it. The two outcomes are reported separately for exactly that reason.
        configure(writeManifest(TWO_PRODUCTS).toString(), "ops@iyae.ca");
        when(productService.getDesignerProducts("ops@iyae.ca")).thenReturn(List.of());
        when(productService.createProduct(eq("ops@iyae.ca"), any()))
                .thenReturn(productNamed(1L, "Charcoal Linen Shirt"))
                .thenReturn(productNamed(2L, "Wide-Leg Trouser"));
        when(productService.updateProduct(eq("ops@iyae.ca"), eq(1L), any()))
                .thenThrow(new IllegalStateException("status transition refused"));
        when(productService.updateProduct(eq("ops@iyae.ca"), eq(2L), any()))
                .thenReturn(productNamed(2L, "Wide-Leg Trouser"));

        seeder.run();

        // Both were created, and the first one's publish failure did not abandon the second.
        verify(productService, times(2)).createProduct(eq("ops@iyae.ca"), any());
        verify(productService).updateProduct(eq("ops@iyae.ca"), eq(1L), any());
        verify(productService).updateProduct(eq("ops@iyae.ca"), eq(2L), any());
    }

    @Test
    void doesNotRetryPublishingAListingItAlreadyCreated() throws IOException {
        // The second boot after the partial failure above. The DRAFT is in `existing`, so the
        // entry is skipped entirely — no create, and deliberately no publish either, because a
        // DRAFT is indistinguishable from one the operator unpublished on purpose.
        configure(writeManifest(TWO_PRODUCTS).toString(), "ops@iyae.ca");
        when(productService.getDesignerProducts("ops@iyae.ca")).thenReturn(List.of(
                productNamed(1L, "Charcoal Linen Shirt"), productNamed(2L, "Wide-Leg Trouser")));

        seeder.run();

        verify(productService, never()).createProduct(anyString(), any());
        verify(productService, never()).updateProduct(anyString(), anyLong(), any());
    }

    @Test
    void seedsNothingWhenTheOperatorHasNoDesignerProfileYet() throws IOException {
        // ProductService.resolveDesignerProfile throws IllegalArgumentException for an account
        // with no profile. Bailing out beats letting the per-entry catch log one error per
        // listing for a cause that is the same every time.
        configure(writeManifest(TWO_PRODUCTS).toString(), "ops@iyae.ca");
        when(productService.getDesignerProducts("ops@iyae.ca"))
                .thenThrow(new IllegalArgumentException("Designer profile not found for user: ops@iyae.ca"));

        seeder.run();

        verify(productService, never()).createProduct(anyString(), any());
    }

    @Test
    void normalisesTheConfiguredOperatorEmail() throws IOException {
        // AdminBootstrap lower-cases and trims the address it creates the account under, so the
        // two have to agree or the lookup misses.
        configure(writeManifest(TWO_PRODUCTS).toString(), "  OPS@IYAE.CA  ");
        when(productService.getDesignerProducts("ops@iyae.ca")).thenReturn(List.of());
        when(productService.createProduct(eq("ops@iyae.ca"), any()))
                .thenReturn(productNamed(1L, "Charcoal Linen Shirt"));

        seeder.run();

        verify(productService, times(2)).createProduct(eq("ops@iyae.ca"), any());
    }

    @Test
    void theCheckedInExampleManifestIsValidAndUsable() throws IOException {
        // The example is what an operator copies on cutover day. If it stops parsing — or ships a
        // listing that would be rejected, or one that is silently left in DRAFT — they find out
        // on the deploy. Note it carries a `_comment` key, which only parses because Spring Boot
        // disables FAIL_ON_UNKNOWN_PROPERTIES; this case is what pins that.
        Path example = Path.of("..", "deploy", "catalog-seed.example.json");
        assertThat(example).exists();

        configure(example.toString(), "ops@iyae.ca");
        when(productService.getDesignerProducts("ops@iyae.ca")).thenReturn(List.of());
        when(productService.createProduct(eq("ops@iyae.ca"), any()))
                .thenReturn(productNamed(1L, "seeded"));

        seeder.run();

        ArgumentCaptor<CreateProductRequest> created = ArgumentCaptor.forClass(CreateProductRequest.class);
        verify(productService, times(3)).createProduct(eq("ops@iyae.ca"), created.capture());
        assertThat(created.getAllValues()).allSatisfy(req -> {
            assertThat(req.name()).isNotBlank();
            // @DecimalMin("0.01") on CreateProductRequest.price — Bean Validation does not run on
            // a direct service call, so a zero here would reach the database rather than 400.
            assertThat(req.price()).isNotNull().isGreaterThan(new BigDecimal("0.00"));
            assertThat(req.category()).isNotBlank();
            assertThat(req.sizes()).isNotEmpty();
        });
        // Every example listing is published, or copying the file still yields an empty shop.
        verify(productService, times(3)).updateProduct(eq("ops@iyae.ca"), anyLong(), any());
    }
}
