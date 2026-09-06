package com.iyae.service;

import com.iyae.dto.SizeRecommendationResponse;
import com.iyae.entity.BodyProfile;
import com.iyae.entity.DesignerProfile;
import com.iyae.entity.Product;
import com.iyae.entity.ProductSizeMeasurement;
import com.iyae.entity.User;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.entity.enums.Role;
import com.iyae.repository.BodyProfileRepository;
import com.iyae.repository.DesignerProfileRepository;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SizeRecommendationServiceTest {

    @Mock ProductRepository productRepository;
    @Mock DesignerProfileRepository designerProfileRepository;
    @Mock BodyProfileRepository bodyProfileRepository;
    @Mock UserRepository userRepository;

    @Spy ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks SizeRecommendationService service;

    private User user;

    @BeforeEach
    void setUp() {
        user = User.builder()
                .id(1L).email("buyer@example.com").name("Buyer").role(Role.BUYER).build();
    }

    private Product product(String category, String sizes, String sizeChart) {
        return Product.builder()
                .id(100L)
                .name("Test Product")
                .category(category)
                .sizes(sizes)
                .sizeChart(sizeChart)
                .status(ProductStatus.PUBLISHED)
                .build();
    }

    private static ProductSizeMeasurement size(String label, Double chest, Double waist, Double hips) {
        return ProductSizeMeasurement.builder()
                .sizeLabel(label).chestCm(chest).waistCm(waist).hipsCm(hips).build();
    }

    private static BodyProfile body(Double chest, Double waist, Double hips) {
        return BodyProfile.builder().chestCm(chest).waistCm(waist).hipsCm(hips).build();
    }

    @Test
    void recommend_measurementChart_picksNearestSize() {
        String sizeChart = "["
                + "{\"size\":\"S\",\"chestCm\":84,\"waistCm\":68,\"hipsCm\":88},"
                + "{\"size\":\"M\",\"chestCm\":92,\"waistCm\":76,\"hipsCm\":96},"
                + "{\"size\":\"L\",\"chestCm\":100,\"waistCm\":84,\"hipsCm\":104}"
                + "]";
        Product product = product("tops", "[\"S\",\"M\",\"L\"]", sizeChart);
        BodyProfile profile = BodyProfile.builder()
                .id(5L).user(user)
                .chestCm(90.0).waistCm(75.0).hipsCm(95.0)
                .build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(profile));

        SizeRecommendationResponse result = service.recommend(100L, "buyer@example.com");

        assertThat(result.recommendedSize()).isEqualTo("M");
        assertThat(result.basis()).isEqualTo("MEASUREMENT_CHART");
        assertThat(result.confidence()).isGreaterThan(0.0);
        assertThat(result.availableSizes()).containsExactly("S", "M", "L");
    }

    @Test
    void recommend_selfReported_returnsTopSizeForTopsCategory() {
        Product product = product("tops", "[\"S\",\"M\",\"L\"]", null);
        BodyProfile profile = BodyProfile.builder()
                .id(5L).user(user)
                .topSize("M")
                .build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(profile));

        SizeRecommendationResponse result = service.recommend(100L, "buyer@example.com");

        assertThat(result.recommendedSize()).isEqualTo("M");
        assertThat(result.basis()).isEqualTo("SELF_REPORTED");
        assertThat(result.availableSizes()).containsExactly("S", "M", "L");
    }

    @Test
    void recommend_categoryMapping_dressUsesDressSize() {
        Product product = product("dresses", "[\"6\",\"8\",\"10\"]", null);
        BodyProfile profile = BodyProfile.builder()
                .id(5L).user(user)
                .dressSize("8").topSize("M")
                .build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(profile));

        SizeRecommendationResponse result = service.recommend(100L, "buyer@example.com");

        assertThat(result.recommendedSize()).isEqualTo("8");
        assertThat(result.basis()).isEqualTo("SELF_REPORTED");
    }

    @Test
    void recommend_noBodyProfile_returnsNoneWithZeroConfidence() {
        Product product = product("tops", "[\"S\",\"M\",\"L\"]", null);

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.empty());

        SizeRecommendationResponse result = service.recommend(100L, "buyer@example.com");

        assertThat(result.recommendedSize()).isNull();
        assertThat(result.basis()).isEqualTo("NONE");
        assertThat(result.confidence()).isEqualTo(0.0);
        assertThat(result.availableSizes()).containsExactly("S", "M", "L");
    }

    @Test
    void recommend_selfReportedSizeNotAvailable_returnsNone() {
        Product product = product("tops", "[\"S\",\"M\",\"L\"]", null);
        BodyProfile profile = BodyProfile.builder()
                .id(5L).user(user)
                .topSize("XXL")
                .build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(profile));

        SizeRecommendationResponse result = service.recommend(100L, "buyer@example.com");

        assertThat(result.recommendedSize()).isNull();
        assertThat(result.basis()).isEqualTo("NONE");
        assertThat(result.confidence()).isEqualTo(0.0);
    }

    @Test
    void recommend_productNotFound_throwsIllegalArgumentException() {
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.recommend(999L, "buyer@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Product not found");
    }

    // H1: non-PUBLISHED product must not leak to a non-owner.
    @Test
    void recommend_nonPublishedProductRequestedByNonOwner_throwsProductNotFound() {
        DesignerProfile ownerProfile = DesignerProfile.builder().id(999L).build();
        Product product = product("tops", "[\"S\",\"M\",\"L\"]", null);
        product.setStatus(ProductStatus.DRAFT);
        product.setDesignerProfile(ownerProfile);

        DesignerProfile callerProfile = DesignerProfile.builder().id(5L).build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(callerProfile));

        assertThatThrownBy(() -> service.recommend(100L, "buyer@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Product not found: 100");
    }

    // H1: a buyer with no designer profile gets the same "Product not found" as a missing
    // product, so the error message cannot reveal that the DRAFT product exists.
    @Test
    void recommend_nonPublishedProductRequestedByBuyerWithoutProfile_throwsProductNotFound() {
        DesignerProfile ownerProfile = DesignerProfile.builder().id(999L).build();
        Product product = product("tops", "[\"S\",\"M\",\"L\"]", null);
        product.setStatus(ProductStatus.DRAFT);
        product.setDesignerProfile(ownerProfile);

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.recommend(100L, "buyer@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Product not found: 100");
    }

    // H1: the owning designer may still get a recommendation for their own DRAFT product.
    @Test
    void recommend_draftProductRequestedByOwner_returnsRecommendation() {
        DesignerProfile ownerProfile = DesignerProfile.builder().id(5L).build();
        Product product = product("tops", "[\"S\",\"M\",\"L\"]", null);
        product.setStatus(ProductStatus.DRAFT);
        product.setDesignerProfile(ownerProfile);

        BodyProfile profile = BodyProfile.builder()
                .id(7L).user(user)
                .topSize("M")
                .build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(designerProfileRepository.findByUserId(1L)).thenReturn(Optional.of(ownerProfile));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(profile));

        SizeRecommendationResponse result = service.recommend(100L, "buyer@example.com");

        assertThat(result.recommendedSize()).isEqualTo("M");
        assertThat(result.basis()).isEqualTo("SELF_REPORTED");
    }

    // M1: a chart-matched size that is not one of the available sizes must not be recommended;
    // the logic falls through to Tier-2/NONE instead.
    @Test
    void recommend_chartBestSizeNotAvailable_fallsThroughInsteadOfRecommendingIt() {
        String sizeChart = "["
                + "{\"size\":\"S\",\"chestCm\":84,\"waistCm\":68,\"hipsCm\":88},"
                + "{\"size\":\"M\",\"chestCm\":92,\"waistCm\":76,\"hipsCm\":96},"
                + "{\"size\":\"L\",\"chestCm\":100,\"waistCm\":84,\"hipsCm\":104}"
                + "]";
        // Best chart match for these measurements is "M", but "M" is NOT offered.
        Product product = product("tops", "[\"XS\"]", sizeChart);
        BodyProfile profile = BodyProfile.builder()
                .id(5L).user(user)
                .chestCm(90.0).waistCm(75.0).hipsCm(95.0)
                .build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(profile));

        SizeRecommendationResponse result = service.recommend(100L, "buyer@example.com");

        assertThat(result.recommendedSize()).isNull();
        assertThat(result.basis()).isEqualTo("NONE");
        assertThat(result.basis()).isNotEqualTo("MEASUREMENT_CHART");
        assertThat(result.availableSizes()).containsExactly("XS");
    }

    // M2: selection uses RMS (per-dimension), not raw Euclidean distance. Entry "S" matches on
    // ONE dim (raw 10, rms 10); entry "M" matches on THREE dims (raw ~13.86, rms 8) — RMS picks
    // "M" whereas the old raw-distance metric would have picked "S".
    @Test
    void recommend_rmsSelectionBeatsRawDistanceAcrossDifferingDimCounts() {
        String sizeChart = "["
                + "{\"size\":\"S\",\"chestCm\":100},"
                + "{\"size\":\"M\",\"chestCm\":98,\"waistCm\":83,\"hipsCm\":103}"
                + "]";
        Product product = product("tops", "[\"S\",\"M\"]", sizeChart);
        BodyProfile profile = BodyProfile.builder()
                .id(5L).user(user)
                .chestCm(90.0).waistCm(75.0).hipsCm(95.0)
                .build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(profile));

        SizeRecommendationResponse result = service.recommend(100L, "buyer@example.com");

        assertThat(result.recommendedSize()).isEqualTo("M");
        assertThat(result.basis()).isEqualTo("MEASUREMENT_CHART");
    }

    // M2 tie-break: two entries with equal RMS — the FIRST in chart order wins (strict '<').
    @Test
    void recommend_equalRmsTie_firstEntryWins() {
        String sizeChart = "["
                + "{\"size\":\"S\",\"chestCm\":100},"   // |90-100| = 10
                + "{\"size\":\"M\",\"chestCm\":80}"      // |90-80|  = 10 (same rms)
                + "]";
        Product product = product("tops", "[\"S\",\"M\"]", sizeChart);
        BodyProfile profile = BodyProfile.builder()
                .id(5L).user(user).chestCm(90.0).build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(profile));

        SizeRecommendationResponse result = service.recommend(100L, "buyer@example.com");

        assertThat(result.recommendedSize()).isEqualTo("S");
        assertThat(result.basis()).isEqualTo("MEASUREMENT_CHART");
    }

    // M11: malformed size_chart JSON falls through to Tier-2 (self-reported), not an error.
    @Test
    void recommend_malformedSizeChart_fallsThroughToSelfReported() {
        Product product = product("tops", "[\"S\",\"M\",\"L\"]", "{not valid json");
        BodyProfile profile = BodyProfile.builder()
                .id(5L).user(user).topSize("M").build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(profile));

        SizeRecommendationResponse result = service.recommend(100L, "buyer@example.com");

        assertThat(result.recommendedSize()).isEqualTo("M");
        assertThat(result.basis()).isEqualTo("SELF_REPORTED");
    }

    // M11: empty size_chart array falls through to Tier-2 (self-reported).
    @Test
    void recommend_emptySizeChartArray_fallsThroughToSelfReported() {
        Product product = product("tops", "[\"S\",\"M\",\"L\"]", "[]");
        BodyProfile profile = BodyProfile.builder()
                .id(5L).user(user).topSize("L").build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(profile));

        SizeRecommendationResponse result = service.recommend(100L, "buyer@example.com");

        assertThat(result.recommendedSize()).isEqualTo("L");
        assertThat(result.basis()).isEqualTo("SELF_REPORTED");
    }

    // L7: an oversized size_chart (>50 entries) is capped at parse time; a valid early match
    // is still returned (the capped loop does not crash or drop the leading entries).
    @Test
    void recommend_oversizedSizeChart_isCappedButStillMatches() {
        StringBuilder sb = new StringBuilder("[");
        sb.append("{\"size\":\"M\",\"chestCm\":90,\"waistCm\":75,\"hipsCm\":95}");
        for (int i = 0; i < 100; i++) {
            sb.append(",{\"size\":\"X").append(i)
              .append("\",\"chestCm\":10,\"waistCm\":10,\"hipsCm\":10}");
        }
        sb.append("]");
        Product product = product("tops", "[\"M\"]", sb.toString());
        BodyProfile profile = BodyProfile.builder()
                .id(5L).user(user).chestCm(90.0).waistCm(75.0).hipsCm(95.0).build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(profile));

        SizeRecommendationResponse result = service.recommend(100L, "buyer@example.com");

        assertThat(result.recommendedSize()).isEqualTo("M");
        assertThat(result.basis()).isEqualTo("MEASUREMENT_CHART");
    }

    // ---- pure pickBestFit (cm-measurement normalization, Marketplace) ----

    @Test
    void pickBestFit_exactMatch_picksThatSize() {
        List<ProductSizeMeasurement> sizes = List.of(
                size("S", 84.0, 68.0, 88.0),
                size("M", 92.0, 76.0, 96.0),
                size("L", 100.0, 84.0, 104.0));

        assertThat(SizeRecommendationService.pickBestFit(sizes, body(92.0, 76.0, 96.0))).isEqualTo("M");
    }

    @Test
    void pickBestFit_betweenSizes_prefersSmallerThatStillFits() {
        // Body chest 88 sits between S(84) and M(90); M and L both fit (>= body), M has less ease.
        List<ProductSizeMeasurement> sizes = List.of(
                size("S", 84.0, 64.0, 84.0),
                size("M", 90.0, 72.0, 92.0),
                size("L", 96.0, 80.0, 100.0));

        assertThat(SizeRecommendationService.pickBestFit(sizes, body(88.0, 70.0, 90.0))).isEqualTo("M");
    }

    @Test
    void pickBestFit_noMeasurements_returnsNull() {
        assertThat(SizeRecommendationService.pickBestFit(List.of(), body(90.0, 76.0, 96.0))).isNull();
    }

    @Test
    void pickBestFit_allNullDims_returnsNull() {
        List<ProductSizeMeasurement> sizes = List.of(size("M", null, null, null));
        assertThat(SizeRecommendationService.pickBestFit(sizes, body(90.0, 76.0, 96.0))).isNull();
    }

    @Test
    void pickBestFit_tightWeightFlipsToLooserSize() {
        // PR#10 M5: asymmetric weighting (TIGHT_WEIGHT=2.0) must penalize a too-tight garment
        // more than an equally-off loose one. Body chest 90; only chest is comparable.
        //   A chest 86 (tight, diff -4)  -> asymmetric 4*2.0 = 8 ; symmetric 4*1.0 = 4
        //   B chest 96 (loose, diff +6)  -> 6*1.0 = 6 in both weightings
        // Asymmetric picks the looser B (6 < 8); symmetric would pick the tighter A (4 < 6).
        List<ProductSizeMeasurement> sizes = List.of(
                size("A", 86.0, null, null),
                size("B", 96.0, null, null));

        assertThat(SizeRecommendationService.pickBestFit(sizes, body(90.0, null, null))).isEqualTo("B");
    }

    @Test
    void pickBestFit_scoreTie_returnsSmallerSize() {
        // PR#10 M5: two sizes with identical fit score must resolve to the smaller size (lower
        // total declared magnitude), per the documented ascending tie-break.
        List<ProductSizeMeasurement> sizes = List.of(
                size("M", 95.0, null, null),
                size("L", 95.0, 80.0, null));

        assertThat(SizeRecommendationService.pickBestFit(sizes, body(90.0, null, null))).isEqualTo("M");
    }

    // ---- recommendForBuyer (loading path) ----

    @Test
    void recommendForBuyer_noEmail_returnsNull() {
        List<ProductSizeMeasurement> sizes = List.of(size("M", 92.0, 76.0, 96.0));
        assertThat(service.recommendForBuyer(sizes, null)).isNull();
    }

    @Test
    void recommendForBuyer_noMeasurements_returnsNull() {
        assertThat(service.recommendForBuyer(List.of(), "buyer@example.com")).isNull();
    }

    @Test
    void recommendForBuyer_noBodyProfile_returnsNull() {
        User buyer = User.builder().id(7L).email("buyer@example.com").build();
        List<ProductSizeMeasurement> sizes = List.of(size("M", 92.0, 76.0, 96.0));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(buyer));
        when(bodyProfileRepository.findByUserId(7L)).thenReturn(Optional.empty());

        assertThat(service.recommendForBuyer(sizes, "buyer@example.com")).isNull();
    }

    @Test
    void recommendForBuyer_withBodyProfile_returnsBestFit() {
        User buyer = User.builder().id(7L).email("buyer@example.com").build();
        List<ProductSizeMeasurement> sizes = List.of(
                size("S", 84.0, 68.0, 88.0),
                size("M", 92.0, 76.0, 96.0));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(buyer));
        when(bodyProfileRepository.findByUserId(7L)).thenReturn(Optional.of(body(92.0, 76.0, 96.0)));

        assertThat(service.recommendForBuyer(sizes, "buyer@example.com")).isEqualTo("M");
    }
}
