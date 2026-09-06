package com.iyae.service;

import com.iyae.dto.SizeRecommendationResponse;
import com.iyae.entity.BodyProfile;
import com.iyae.entity.DesignerProfile;
import com.iyae.entity.Product;
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
}
