package com.iyae.service;

import com.iyae.entity.BodyProfile;
import com.iyae.entity.ProductSizeMeasurement;
import com.iyae.entity.User;
import com.iyae.repository.BodyProfileRepository;
import com.iyae.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SizeRecommendationServiceTest {

    @Mock
    UserRepository userRepository;

    @Mock
    BodyProfileRepository bodyProfileRepository;

    @InjectMocks
    SizeRecommendationService service;

    private static ProductSizeMeasurement size(String label, Double chest, Double waist, Double hips) {
        return ProductSizeMeasurement.builder()
                .sizeLabel(label).chestCm(chest).waistCm(waist).hipsCm(hips).build();
    }

    private static BodyProfile body(Double chest, Double waist, Double hips) {
        return BodyProfile.builder().chestCm(chest).waistCm(waist).hipsCm(hips).build();
    }

    // ---- pure pickBestFit ----

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
        // Asserting "B" kills the TIGHT_WEIGHT 2.0 -> 1.0 mutant.
        List<ProductSizeMeasurement> sizes = List.of(
                size("A", 86.0, null, null),
                size("B", 96.0, null, null));

        assertThat(SizeRecommendationService.pickBestFit(sizes, body(90.0, null, null))).isEqualTo("B");
    }

    @Test
    void pickBestFit_scoreTie_returnsSmallerSize() {
        // PR#10 M5: two sizes with identical fit score must resolve to the smaller size (lower
        // total declared magnitude), per the documented ascending tie-break. Both carry chest 95
        // (score 5 vs body 90); "L" adds a waist that the body lacks — it raises the magnitude but
        // not the score. Asserting "M" kills a reversed-sort mutant (which would return "L").
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
        User user = User.builder().id(7L).email("buyer@example.com").build();
        List<ProductSizeMeasurement> sizes = List.of(size("M", 92.0, 76.0, 96.0));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(bodyProfileRepository.findByUserId(7L)).thenReturn(Optional.empty());

        assertThat(service.recommendForBuyer(sizes, "buyer@example.com")).isNull();
    }

    @Test
    void recommendForBuyer_withBodyProfile_returnsBestFit() {
        User user = User.builder().id(7L).email("buyer@example.com").build();
        List<ProductSizeMeasurement> sizes = List.of(
                size("S", 84.0, 68.0, 88.0),
                size("M", 92.0, 76.0, 96.0));
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(user));
        when(bodyProfileRepository.findByUserId(7L)).thenReturn(Optional.of(body(92.0, 76.0, 96.0)));

        assertThat(service.recommendForBuyer(sizes, "buyer@example.com")).isEqualTo("M");
    }
}
