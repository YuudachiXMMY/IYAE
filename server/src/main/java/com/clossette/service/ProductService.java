package com.clossette.service;

import com.clossette.dto.CreateProductRequest;
import com.clossette.dto.PagedResponse;
import com.clossette.dto.ProductResponse;
import com.clossette.dto.UpdateProductRequest;
import com.clossette.entity.DesignerProfile;
import com.clossette.entity.GarmentAsset;
import com.clossette.entity.ModelGenerationTask;
import com.clossette.entity.Product;
import com.clossette.entity.User;
import com.clossette.entity.enums.ProductStatus;
import com.clossette.entity.enums.TaskStatus;
import com.clossette.repository.DesignerProfileRepository;
import com.clossette.repository.GarmentAssetRepository;
import com.clossette.repository.ModelGenerationTaskRepository;
import com.clossette.repository.ProductRepository;
import com.clossette.repository.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final ObjectMapper objectMapper;

    // -------------------------------------------------------------------------
    // Public catalog
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PagedResponse<ProductResponse> getPublicCatalog(int page, int size, String category, String q) {
        int clampedSize = Math.min(size, MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(page, clampedSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        boolean hasCategory = category != null && !category.isBlank();
        boolean hasQ = q != null && !q.isBlank();

        Page<Product> result;
        if (hasCategory && hasQ) {
            result = productRepository.findByStatusAndCategoryAndSearch(ProductStatus.PUBLISHED, category, q, pageable);
        } else if (hasCategory) {
            result = productRepository.findByStatusAndCategory(ProductStatus.PUBLISHED, category, pageable);
        } else if (hasQ) {
            result = productRepository.findByStatusAndSearch(ProductStatus.PUBLISHED, q, pageable);
        } else {
            result = productRepository.findByStatus(ProductStatus.PUBLISHED, pageable);
        }

        List<Product> products = result.getContent();
        Map<Long, String> taskStatusMap = buildTaskStatusFallbackMap(products);
        Map<Long, GarmentAsset> assetMap = buildAssetMap(products);
        return PagedResponse.from(result.map(p -> buildProductResponse(p, assetMap.get(p.getId()), taskStatusMap.get(p.getId()))));
    }

    @Transactional(readOnly = true)
    public ProductResponse getProductById(Long id, String email) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + id));

        if (product.getStatus() == ProductStatus.PUBLISHED) {
            return buildProductResponseWithTaskFallback(product);
        }

        // Non-published: only the owner may access
        if (email == null) {
            throw new IllegalArgumentException("Product not found: " + id);
        }

        DesignerProfile profile = resolveDesignerProfile(email);
        if (!product.getDesignerProfile().getId().equals(profile.getId())) {
            throw new IllegalArgumentException("Product not found: " + id);
        }

        return buildProductResponseWithTaskFallback(product);
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
                .currency(request.currency() != null ? request.currency() : "USD")
                .category(request.category())
                .styleTags(toJsonString(request.styleTags()))
                .colorTags(toJsonString(request.colorTags()))
                .sizes(toJsonString(request.sizes()))
                .media(toJsonString(request.media()))
                .glbUrl(request.glbUrl())
                .status(ProductStatus.DRAFT)
                .build();

        return ProductResponse.from(productRepository.save(product));
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

        return ProductResponse.from(productRepository.save(product));
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
        // Batch-fetch via per-product query is acceptable here; task rows are few per product.
        // Results keyed by productId; only store PENDING/RUNNING entries.
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
                return buildProductResponse(product, null, status.name());
            }
        }
        return ProductResponse.from(product, null);
    }

    private ProductResponse buildProductResponse(Product product, GarmentAsset asset, String fallbackTaskStatus) {
        if (asset != null) {
            return ProductResponse.from(product, asset);
        }
        if (fallbackTaskStatus != null) {
            // Reuse from(product, null) to get parsed JSON list fields, then override assetStatus
            ProductResponse base = ProductResponse.from(product, null);
            return new ProductResponse(
                    base.id(),
                    base.designerProfileId(),
                    base.designerDisplayName(),
                    base.name(),
                    base.description(),
                    base.price(),
                    base.currency(),
                    base.category(),
                    base.styleTags(),
                    base.colorTags(),
                    base.sizes(),
                    base.media(),
                    base.glbUrl(),
                    base.status(),
                    base.createdAt(),
                    base.updatedAt(),
                    null,
                    null,
                    fallbackTaskStatus
            );
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
