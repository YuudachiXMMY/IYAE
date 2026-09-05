package com.iyae.config;

import com.iyae.entity.Product;
import com.iyae.repository.ProductRepository;
import com.iyae.util.GlbPlaceholderGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Ensures GLB placeholder assets exist on disk for all products.
 * Runs in ALL profiles (including production) to backfill missing
 * files after volume wipes or fresh container deployments.
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class GlbAssetInitializer implements CommandLineRunner {

    private final ProductRepository productRepository;

    @Value("${worker.output-dir:/var/iyae/assets}")
    private String assetsOutputDir;

    @Override
    public void run(String... args) {
        ensurePlaceholderAssets();
        ensureGlbAssets();
    }

    private void ensurePlaceholderAssets() {
        Path glbPath = Path.of(assetsOutputDir, "models", "placeholder.glb");
        if (Files.exists(glbPath)) {
            log.debug("GlbAssetInitializer: placeholder GLB already exists at {}, skipping.", glbPath);
            return;
        }
        if (GlbPlaceholderGenerator.writeGlbFile(glbPath)) {
            log.info("GlbAssetInitializer: wrote placeholder GLB to {}", glbPath);
        } else {
            log.warn("GlbAssetInitializer: could not write placeholder GLB to {} — 3D viewers will show fallback", glbPath);
        }
    }

    private void ensureGlbAssets() {
        List<Product> products = productRepository.findAll();
        int generated = 0;
        for (Product product : products) {
            String url = product.getGlbUrl();
            if (url == null || !url.startsWith("/assets/models/")) {
                continue;
            }
            String relative = url.substring("/assets/".length());
            Path glbPath = Path.of(assetsOutputDir, relative);
            if (!Files.exists(glbPath)) {
                if (GlbPlaceholderGenerator.writeGlbFile(glbPath, product.getCategory())) {
                    generated++;
                    log.debug("GlbAssetInitializer: wrote {} GLB for product {} at {}", product.getCategory(), product.getId(), glbPath);
                } else {
                    log.warn("GlbAssetInitializer: could not write GLB for product {} at {}", product.getId(), glbPath);
                }
            }
        }
        if (generated > 0) {
            log.info("GlbAssetInitializer: backfilled {} missing GLB file(s).", generated);
        }
    }
}
