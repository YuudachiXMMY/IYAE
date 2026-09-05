package com.iyae.service;

import com.iyae.dto.SizeRecommendationResponse;
import com.iyae.entity.BodyProfile;
import com.iyae.entity.Product;
import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import com.iyae.repository.BodyProfileRepository;
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
}
