package com.iyae.service;

import com.iyae.dto.CreateProductRequest;
import com.iyae.dto.PagedResponse;
import com.iyae.dto.ProductResponse;
import com.iyae.dto.SizeMeasurementDto;
import com.iyae.dto.UpdateProductRequest;
import com.iyae.entity.DesignerProfile;
import com.iyae.entity.GarmentAsset;
import com.iyae.entity.ModelGenerationTask;
import com.iyae.entity.Product;
import com.iyae.entity.ProductSizeMeasurement;
import com.iyae.entity.User;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.entity.enums.TaskStatus;
import com.iyae.repository.DesignerProfileRepository;
import com.iyae.repository.GarmentAssetRepository;
import com.iyae.repository.ModelGenerationTaskRepository;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.ProductSizeMeasurementRepository;
import com.iyae.repository.ProductSpecifications;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {

    private static final int MAX_PAGE_SIZE = 100;

    private final ProductRepository productRepository;
    private final DesignerProfileRepository designerProfileRepository;
    private final UserRepository userRepository;
    private final GarmentAssetRepository garmentAssetRepository;
    private final ModelGenerationTaskRepository modelGenerationTaskRepository;
    private final ProductSizeMeasurementRepository productSizeMeasurementRepository;
    private final SizeRecommendationService sizeRecommendationService;
    private final ObjectMapper objectMapper;

    // -------------------------------------------------------------------------
    // Public catalog
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PagedResponse<ProductResponse> getPublicCatalog(int page, int size, String category, String q, boolean localOnly) {
        int clampedSize = Math.min(size, MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(page, clampedSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<Product> result = productRepository.findAll(
                ProductSpecifications.catalog(ProductStatus.PUBLISHED, category, q, localOnly), pageable);

        List<Product> products = result.getContent();
        Map<Long, String> taskStatusMap = buildTaskStatusFallbackMap(products);
        Map<Long, GarmentAsset> assetMap = buildAssetMap(products);
        return PagedResponse.from(result.map(p -> buildProductResponse(p, assetMap.get(p.getId()), taskStatusMap.get(p.getId()))));
    }

    @Transactional(readOnly = true)
    public ProductResponse getProductById(Long id, String email) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + id));

        if (product.getStatus() != ProductStatus.PUBLISHED) {
            // Non-published: only the owner may access
            if (email == null) {
                throw new IllegalArgumentException("Product not found: " + id);
            }
            DesignerProfile profile = resolveDesignerProfile(email);
            if (!product.getDesignerProfile().getId().equals(profile.getId())) {
                throw new IllegalArgumentException("Product not found: " + id);
            }
        }

        ProductResponse base = buildProductResponseWithTaskFallback(product);
        List<ProductSizeMeasurement> rows = productSizeMeasurementRepository.findByProductId(id);
        List<SizeMeasurementDto> measurements = (rows == null || rows.isEmpty())
                ? null
                : rows.stream().map(SizeMeasurementDto::from).toList();
        String recommendedSize = sizeRecommendationService.recommendForBuyer(rows, email);
        return base.withRecommendation(recommendedSize, measurements);
    }

    @Transactional(readOnly = true)
    public List<String> getPublishedCategories() {
        return productRepository.findDistinctCategoriesByStatus(ProductStatus.PUBLISHED);
    }

    // -------------------------------------------------------------------------
    // Designer CRUD
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ProductResponse> getDesignerProducts(String email) {
        DesignerProfile profile = resolveDesignerProfile(email);
        List<Product> products = productRepository.findByDesignerProfileId(profile.getId());
        Map<Long, String> taskStatusMap = buildTaskStatusFallbackMap(products);
        Map<Long, GarmentAsset> assetMap = buildAssetMap(products);
        return products.stream()
                .map(p -> buildProductResponse(p, assetMap.get(p.getId()), taskStatusMap.get(p.getId())))
                .toList();
    }

    @Transactional
    public ProductResponse createProduct(String email, CreateProductRequest request) {
        DesignerProfile profile = resolveDesignerProfile(email);

        Product product = Product.builder()
                .designerProfile(profile)
                .name(request.name())
                .description(request.description())
                .price(request.price())
                .currency(request.currency() != null ? request.currency() : "CAD")
                .category(request.category())
                .styleTags(toJsonString(request.styleTags()))
                .colorTags(toJsonString(request.colorTags()))
                .sizes(toJsonString(request.sizes()))
                .media(toJsonString(request.media()))
                .glbUrl(request.glbUrl())
                .status(ProductStatus.DRAFT)
                .build();

        Product saved = productRepository.save(product);
        replaceMeasurements(saved, request.measurements());
        return ProductResponse.from(saved);
    }

    @Transactional
    public ProductResponse updateProduct(String email, Long id, UpdateProductRequest request) {
        DesignerProfile profile = resolveDesignerProfile(email);
        Product product = requireOwnedProduct(id, profile);

        if (request.name() != null) {
            product.setName(request.name());
        }
        if (request.description() != null) {
            product.setDescription(request.description());
        }
        if (request.price() != null) {
            product.setPrice(request.price());
        }
        if (request.currency() != null) {
            product.setCurrency(request.currency());
        }
        if (request.category() != null) {
            product.setCategory(request.category());
        }
        if (request.styleTags() != null) {
            product.setStyleTags(toJsonString(request.styleTags()));
        }
        if (request.colorTags() != null) {
            product.setColorTags(toJsonString(request.colorTags()));
        }
        if (request.sizes() != null) {
            product.setSizes(toJsonString(request.sizes()));
        }
        if (request.media() != null) {
            product.setMedia(toJsonString(request.media()));
        }
        if (request.glbUrl() != null) {
            product.setGlbUrl(request.glbUrl());
        }
        if (request.status() != null) {
            product.setStatus(request.status());
        }

        Product saved = productRepository.save(product);
        replaceMeasurements(saved, request.measurements());
        return ProductResponse.from(saved);
    }

    @Transactional
    public void deleteProduct(String email, Long id) {
        DesignerProfile profile = resolveDesignerProfile(email);
        Product product = requireOwnedProduct(id, profile);
        productRepository.delete(product);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Delete-then-insert the product's per-size measurements. A null list means "no change"
     * (create with no measurements, or an update that omits them). Rows with an unknown size
     * label are rejected; rows with all-null dims are skipped (no empty rows persisted).
     */
    private void replaceMeasurements(Product product, List<SizeMeasurementDto> measurements) {
        if (measurements == null) {
            return;
        }
        productSizeMeasurementRepository.deleteByProductId(product.getId());
        // Force the DELETE before the INSERTs so the (product_id, size_label) unique key holds
        // (Hibernate otherwise orders deletes last within a single flush).
        productSizeMeasurementRepository.flush();
        if (measurements.isEmpty()) {
            return;
        }
        List<String> declaredSizes = parseProductSizes(product);
        for (SizeMeasurementDto dto : measurements) {
            if (dto == null || dto.sizeLabel() == null || dto.sizeLabel().isBlank()) {
                continue;
            }
            String label = dto.sizeLabel().trim();
            if (!declaredSizes.isEmpty() && !declaredSizes.contains(label)) {
                throw new IllegalArgumentException(
                        "Measurement size '" + label + "' is not one of the product sizes: " + declaredSizes);
            }
            boolean allNull = dto.chestCm() == null && dto.waistCm() == null
                    && dto.hipsCm() == null && dto.lengthCm() == null;
            if (allNull) {
                continue; // no signal — don't persist an empty row
            }
            productSizeMeasurementRepository.save(ProductSizeMeasurement.builder()
                    .product(product)
                    .sizeLabel(label)
                    .chestCm(dto.chestCm())
                    .waistCm(dto.waistCm())
                    .hipsCm(dto.hipsCm())
                    .lengthCm(dto.lengthCm())
                    .build());
        }
    }

    private List<String> parseProductSizes(Product product) {
        String json = product.getSizes();
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    private GarmentAsset resolveAsset(Long productId) {
        // Prefer ACTIVE (materialized from READY task); fall back to any latest asset for status
        return garmentAssetRepository
                .findTopByProductIdAndStatusOrderByCreatedAtDesc(productId, "ACTIVE")
                .or(() -> garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(productId))
                .orElse(null);
    }

    private Map<Long, GarmentAsset> buildAssetMap(List<Product> products) {
        if (products.isEmpty()) {
            return Map.of();
        }
        List<Long> ids = products.stream().map(Product::getId).toList();
        // Fetch all assets ordered by createdAt DESC so first-wins in merge = most recent
        List<GarmentAsset> assets = garmentAssetRepository.findByProductIdInOrderByCreatedAtDesc(ids);
        // Group by productId; always prefer ACTIVE; ties resolved by createdAt DESC (list order)
        return assets.stream().collect(Collectors.toMap(
                a -> a.getProduct().getId(),
                a -> a,
                (existing, newer) -> "ACTIVE".equals(existing.getStatus()) ? existing : newer
        ));
    }

    /**
     * For products with no GarmentAsset, surface the status of the latest PENDING or RUNNING
     * ModelGenerationTask so the UI can show progress.
     */
    private Map<Long, String> buildTaskStatusFallbackMap(List<Product> products) {
        if (products.isEmpty()) {
            return Map.of();
        }
        Map<Long, String> map = new java.util.HashMap<>();
        for (Product product : products) {
            List<ModelGenerationTask> tasks =
                    modelGenerationTaskRepository.findByProductIdOrderByCreatedAtDesc(product.getId());
            if (!tasks.isEmpty()) {
                TaskStatus status = tasks.get(0).getStatus();
                if (status == TaskStatus.PENDING || status == TaskStatus.RUNNING) {
                    map.put(product.getId(), status.name());
                }
            }
        }
        return map;
    }

    private ProductResponse buildProductResponseWithTaskFallback(Product product) {
        GarmentAsset asset = resolveAsset(product.getId());
        if (asset != null) {
            return ProductResponse.from(product, asset);
        }
        List<ModelGenerationTask> tasks =
                modelGenerationTaskRepository.findByProductIdOrderByCreatedAtDesc(product.getId());
        if (!tasks.isEmpty()) {
            TaskStatus status = tasks.get(0).getStatus();
            if (status == TaskStatus.PENDING || status == TaskStatus.RUNNING) {
                return ProductResponse.from(product, null).withAssetStatus(status.name());
            }
        }
        return ProductResponse.from(product, null);
    }

    private ProductResponse buildProductResponse(Product product, GarmentAsset asset, String fallbackTaskStatus) {
        if (asset != null) {
            return ProductResponse.from(product, asset);
        }
        if (fallbackTaskStatus != null) {
            return ProductResponse.from(product, null).withAssetStatus(fallbackTaskStatus);
        }
        return ProductResponse.from(product, null);
    }

    private DesignerProfile resolveDesignerProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return designerProfileRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Designer profile not found for user: " + email));
    }

    private Product requireOwnedProduct(Long productId, DesignerProfile profile) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
        if (!product.getDesignerProfile().getId().equals(profile.getId())) {
            throw new IllegalArgumentException("Product not found: " + productId);
        }
        return product;
    }

    private String toJsonString(List<String> list) {
        if (list == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Failed to serialize list to JSON", e);
        }
    }
}
