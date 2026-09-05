package com.iyae.service;

import com.iyae.dto.GenerationStatusResponse;
import com.iyae.entity.GarmentAsset;
import com.iyae.entity.ModelGenerationTask;
import com.iyae.entity.Product;
import com.iyae.entity.User;
import com.iyae.entity.enums.TaskStatus;
import com.iyae.repository.GarmentAssetRepository;
import com.iyae.repository.ModelGenerationTaskRepository;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class GenerationService {

    private final ModelGenerationTaskRepository taskRepository;
    private final GarmentAssetRepository garmentAssetRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Value("${MODEL_GENERATION_PROVIDER:mock}")
    private String modelGenerationProvider;

    @Transactional(readOnly = true)
    public GenerationStatusResponse getStatus(Long productId, String userEmail) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
        checkOwnership(product, userEmail);

        List<ModelGenerationTask> tasks = taskRepository.findByProductIdOrderByCreatedAtDesc(productId);
        if (tasks.isEmpty()) {
            return new GenerationStatusResponse("NONE", null, null, null, 0);
        }
        ModelGenerationTask latest = tasks.get(0);

        // Map internal MATERIALIZED status to external READY (PRD E6.6)
        String externalStatus = latest.getStatus() == TaskStatus.MATERIALIZED
                ? "READY" : latest.getStatus().name();

        String glbUrl = null;
        String usdzUrl = null;
        if ((latest.getStatus() == TaskStatus.READY || latest.getStatus() == TaskStatus.MATERIALIZED)
                && latest.getOutputPayload() != null) {
            glbUrl = extractField(latest.getOutputPayload(), "glb_url");
            usdzUrl = extractField(latest.getOutputPayload(), "usdz_url");
        }
        return new GenerationStatusResponse(
                externalStatus,
                glbUrl,
                usdzUrl,
                latest.getErrorMessage(),
                latest.getAttemptCount() != null ? latest.getAttemptCount() : 0
        );
    }

    @Transactional
    public GenerationStatusResponse regenerate(Long productId, String email) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
        checkOwnership(product, email);

        // Validate product has an image before scheduling generation (Issue #6)
        String imageUrl = extractFirstMediaUrl(product.getMedia());
        if (imageUrl == null) {
            throw new IllegalArgumentException("Product has no image for 3D generation");
        }

        // Supersede all active tasks (PRD E7.4)
        supersedeActiveTasks(productId);

        String inputPayload = buildInputPayload(product);
        ModelGenerationTask task = ModelGenerationTask.builder()
                .product(product)
                .status(TaskStatus.PENDING)
                .provider(resolveProvider())
                .inputPayload(inputPayload)
                .attemptCount(0)
                .build();
        ModelGenerationTask saved = taskRepository.save(task);

        return new GenerationStatusResponse(saved.getStatus().name(), null, null, null, 0);
    }

    private void supersedeActiveTasks(Long productId) {
        List<ModelGenerationTask> tasks = taskRepository.findByProductIdOrderByCreatedAtDesc(productId);
        for (ModelGenerationTask t : tasks) {
            if (t.getStatus() == TaskStatus.PENDING || t.getStatus() == TaskStatus.RUNNING) {
                t.setStatus(TaskStatus.FAILED);
                t.setErrorMessage("Superseded by regeneration");
                taskRepository.save(t);
            }
        }
    }

    @Transactional
    public GenerationStatusResponse retry(Long productId, String email) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
        checkOwnership(product, email);

        // Validate product has an image before scheduling generation (Issue #6)
        String imageUrl = extractFirstMediaUrl(product.getMedia());
        if (imageUrl == null) {
            throw new IllegalArgumentException("Product has no image for 3D generation");
        }

        ModelGenerationTask failedTask = taskRepository
                .findFirstByProductIdAndStatusOrderByCreatedAtDesc(productId, TaskStatus.FAILED)
                .orElseThrow(() -> new IllegalArgumentException("No failed task found for product: " + productId));

        String inputPayload = buildInputPayload(product);

        failedTask.setStatus(TaskStatus.PENDING);
        failedTask.setErrorMessage(null);
        failedTask.setProvider(resolveProvider());
        failedTask.setInputPayload(inputPayload);
        ModelGenerationTask saved = taskRepository.save(failedTask);

        return new GenerationStatusResponse(
                saved.getStatus().name(),
                null,
                null,
                null,
                saved.getAttemptCount() != null ? saved.getAttemptCount() : 0
        );
    }

    @Transactional
    public void processReadyTasks() {
        List<ModelGenerationTask> readyTasks = taskRepository.findByStatus(TaskStatus.READY);
        for (ModelGenerationTask task : readyTasks) {
            try {
                materializeGarmentAsset(task);
            } catch (Exception e) {
                log.error("Failed to materialize GarmentAsset for task {}: {}", task.getId(), e.getMessage());
            }
        }
    }

    private void materializeGarmentAsset(ModelGenerationTask task) {
        if (task.getOutputPayload() == null) {
            return;
        }

        // Idempotency: only materialize if this is the latest READY task for the product
        List<ModelGenerationTask> productTasks = taskRepository.findByProductIdOrderByCreatedAtDesc(task.getProduct().getId());
        ModelGenerationTask latestReady = productTasks.stream()
                .filter(t -> t.getStatus() == TaskStatus.READY)
                .findFirst()
                .orElse(null);
        if (latestReady == null || !latestReady.getId().equals(task.getId())) {
            log.info("Skipping materialization for task {} — not the latest READY task for product {}",
                    task.getId(), task.getProduct().getId());
            return;
        }

        String glbUrl = extractField(task.getOutputPayload(), "glb_url");
        String usdzUrl = extractField(task.getOutputPayload(), "usdz_url");

        GarmentAsset asset = GarmentAsset.builder()
                .product(task.getProduct())
                .glbUrl(glbUrl)
                .usdzUrl(usdzUrl)
                .status("READY")
                .build();
        garmentAssetRepository.save(asset);
        task.setStatus(TaskStatus.MATERIALIZED);
        taskRepository.save(task);
    }

    private void checkOwnership(Product product, String userEmail) {
        User owner = product.getDesignerProfile().getUser();
        if (!owner.getEmail().equals(userEmail)) {
            throw new AccessDeniedException("Access denied: product does not belong to current user");
        }
    }

    private String resolveProvider() {
        if ("tripo3d".equalsIgnoreCase(modelGenerationProvider)) {
            return "tripo3d";
        }
        if ("meshy".equalsIgnoreCase(modelGenerationProvider)) {
            return "meshy";
        }
        return "mock";
    }

    private String buildInputPayload(Product product) {
        String imageUrl = extractFirstMediaUrl(product.getMedia());
        try {
            return objectMapper.writeValueAsString(Map.of("image_url", imageUrl != null ? imageUrl : ""));
        } catch (Exception e) {
            log.warn("Failed to serialize input_payload for product {}", product.getId());
            return "{\"image_url\":\"\"}";
        }
    }

    private String extractFirstMediaUrl(String mediaJson) {
        if (mediaJson == null || mediaJson.isBlank()) {
            return null;
        }
        try {
            JsonNode node = objectMapper.readTree(mediaJson);
            if (node.isArray() && node.size() > 0) {
                JsonNode first = node.get(0);
                if (first.isTextual()) {
                    return first.asText();
                }
                JsonNode urlNode = first.get("url");
                if (urlNode != null && !urlNode.isNull()) {
                    return urlNode.asText();
                }
            }
        } catch (Exception e) {
            log.warn("Failed to parse media JSON for product");
        }
        return null;
    }

    private String extractField(String json, String fieldName) {
        try {
            JsonNode node = objectMapper.readTree(json);
            JsonNode field = node.get(fieldName);
            return field != null && !field.isNull() ? field.asText() : null;
        } catch (Exception e) {
            log.warn("Failed to extract field '{}' from JSON payload", fieldName);
            return null;
        }
    }
}
