package com.iyae.service;

import com.iyae.entity.GarmentAsset;
import com.iyae.repository.GarmentAssetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class GarmentAssetService {

    private final GarmentAssetRepository garmentAssetRepository;

    @Transactional(readOnly = true)
    public List<GarmentAsset> findByProductId(Long productId) {
        return garmentAssetRepository.findByProductId(productId);
    }

    @Transactional(readOnly = true)
    public List<GarmentAsset> findReadyByProductId(Long productId) {
        return garmentAssetRepository.findByProductId(productId)
                .stream()
                .filter(asset -> "READY".equalsIgnoreCase(asset.getStatus())
                        || "ACTIVE".equalsIgnoreCase(asset.getStatus()))
                .toList();
    }

    @Transactional(readOnly = true)
    public GarmentAsset findById(Long id) {
        return garmentAssetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Garment asset not found: " + id));
    }
}
