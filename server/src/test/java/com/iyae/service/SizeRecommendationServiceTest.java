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
