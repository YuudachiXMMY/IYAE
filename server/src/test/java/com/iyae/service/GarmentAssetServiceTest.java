package com.iyae.service;

import com.iyae.entity.GarmentAsset;
import com.iyae.repository.GarmentAssetRepository;
import com.iyae.testsupport.TestProducts;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GarmentAssetServiceTest {

    @Mock
    GarmentAssetRepository garmentAssetRepository;

    @InjectMocks
    GarmentAssetService garmentAssetService;

    @Test
    void findByProductId_returnsAllAssets() {
        var product = TestProducts.aPublishedProduct();
        GarmentAsset asset = buildAsset(1L, "READY");
        when(garmentAssetRepository.findByProductId(product.getId())).thenReturn(List.of(asset));

        List<GarmentAsset> result = garmentAssetService.findByProductId(product.getId());

        assertThat(result).hasSize(1);
    }

    @Test
    void findReadyByProductId_filtersNonReadyAssets() {
        GarmentAsset ready = buildAsset(1L, "READY");
        GarmentAsset pending = buildAsset(2L, "PENDING");
        GarmentAsset active = buildAsset(3L, "ACTIVE");
        when(garmentAssetRepository.findByProductId(1L)).thenReturn(List.of(ready, pending, active));

        List<GarmentAsset> result = garmentAssetService.findReadyByProductId(1L);

        assertThat(result).hasSize(2);
        assertThat(result).extracting(GarmentAsset::getStatus).containsExactlyInAnyOrder("READY", "ACTIVE");
    }

    @Test
    void findById_existing_returnsAsset() {
        GarmentAsset asset = buildAsset(5L, "READY");
        when(garmentAssetRepository.findById(5L)).thenReturn(Optional.of(asset));

        GarmentAsset result = garmentAssetService.findById(5L);

        assertThat(result.getId()).isEqualTo(5L);
    }

    @Test
    void findById_notFound_throwsIllegalArgumentException() {
        when(garmentAssetRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> garmentAssetService.findById(99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Garment asset not found");
    }

    // -------------------------------------------------------------------------

    private GarmentAsset buildAsset(Long id, String status) {
        return GarmentAsset.builder()
                .id(id)
                .product(TestProducts.aPublishedProduct())
                .glbUrl("/assets/model.glb")
                .status(status)
                .build();
    }
}
