package com.clossette.service;

import com.clossette.dto.RiggingStatusResponse;
import com.clossette.entity.GarmentAsset;
import com.clossette.entity.Product;
import com.clossette.entity.RiggingTask;
import com.clossette.entity.User;
import com.clossette.entity.enums.GarmentSlotHint;
import com.clossette.entity.enums.TaskStatus;
import com.clossette.repository.GarmentAssetRepository;
import com.clossette.repository.ProductRepository;
import com.clossette.repository.RiggingTaskRepository;
import com.clossette.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RiggingService {

    private final RiggingTaskRepository riggingTaskRepository;
    private final GarmentAssetRepository garmentAssetRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public RiggingStatusResponse requestRigging(Long productId, String email) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
        checkOwnership(product, email);

        GarmentAsset asset = garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(productId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No garment asset found for product: " + productId));

        if (asset.getGlbUrl() == null || asset.getGlbUrl().isBlank()) {
            throw new IllegalArgumentException(
                    "Garment asset has no GLB URL for product: " + productId);
        }

        // Supersede any active rigging tasks for this asset
        supersedeActiveTasks(asset.getId());

        GarmentSlotHint slotHint = resolveSlotHint(asset.getSlotHint());

        String inputPayloadJson;
        try {
            inputPayloadJson = objectMapper.writeValueAsString(java.util.Map.of(
                    "source_glb_url", asset.getGlbUrl(),
                    "slot_hint", slotHint.name()
            ));
        } catch (Exception e) {
            throw new RuntimeException("Failed to serialize rigging input payload", e);
        }

        RiggingTask task = RiggingTask.builder()
                .garmentAsset(asset)
                .product(product)
                .user(null)
                .sourceGlbUrl(asset.getGlbUrl())
                .slotHint(slotHint)
                .inputPayload(inputPayloadJson)
                .status(TaskStatus.PENDING)
                .attemptCount(0)
                .build();
        riggingTaskRepository.save(task);

        asset.setRiggingStatus("PENDING");
        garmentAssetRepository.save(asset);

        return new RiggingStatusResponse("PENDING", null, null, null, 0);
    }

    @Transactional(readOnly = true)
    public RiggingStatusResponse getStatus(Long productId, String email) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
        checkOwnership(product, email);

        GarmentAsset asset = garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(productId)
                .orElse(null);
        if (asset == null) {
            return new RiggingStatusResponse("NONE", null, null, null, 0);
        }

        List<RiggingTask> tasks = riggingTaskRepository.findByGarmentAssetIdOrderByCreatedAtDesc(asset.getId());
        if (tasks.isEmpty()) {
            return new RiggingStatusResponse("NONE", null, null, null, 0);
        }

        RiggingTask latest = tasks.get(0);

        // Map internal MATERIALIZED status to external READY (consistent with GenerationService)
        String externalStatus = latest.getStatus() == TaskStatus.MATERIALIZED
                ? "READY" : latest.getStatus().name();

        String riggedGlbUrl = null;
        if ((latest.getStatus() == TaskStatus.READY || latest.getStatus() == TaskStatus.MATERIALIZED)
                && latest.getOutputPayload() != null) {
            riggedGlbUrl = extractField(latest.getOutputPayload(), "rigged_glb_url");
        }

        return new RiggingStatusResponse(
                externalStatus,
                riggedGlbUrl,
                latest.getErrorMessage(),
                latest.getFailureCode(),
                latest.getAttemptCount() != null ? latest.getAttemptCount() : 0
        );
    }

    @Transactional
    public RiggingStatusResponse retry(Long productId, String email) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
        checkOwnership(product, email);

        GarmentAsset asset = garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(productId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No garment asset found for product: " + productId));

        RiggingTask failedTask = riggingTaskRepository
                .findFirstByGarmentAssetIdAndStatusOrderByCreatedAtDesc(asset.getId(), TaskStatus.FAILED)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No failed rigging task found for product: " + productId));

        // Backfill input_payload if missing (legacy tasks created before the fix)
        if (failedTask.getInputPayload() == null || failedTask.getInputPayload().isBlank()) {
            try {
                GarmentSlotHint slotHint = resolveSlotHint(asset.getSlotHint());
                failedTask.setInputPayload(objectMapper.writeValueAsString(java.util.Map.of(
                        "source_glb_url", asset.getGlbUrl(),
                        "slot_hint", slotHint.name()
                )));
            } catch (Exception e) {
                throw new RuntimeException("Failed to serialize rigging input payload", e);
            }
        }

        failedTask.setStatus(TaskStatus.PENDING);
        failedTask.setErrorMessage(null);
        failedTask.setFailureCode(null);
        failedTask.setAttemptCount(failedTask.getAttemptCount() != null
                ? failedTask.getAttemptCount() + 1 : 1);
        riggingTaskRepository.save(failedTask);

        asset.setRiggingStatus("PENDING");
        garmentAssetRepository.save(asset);

        return new RiggingStatusResponse(
                "PENDING",
                null,
                null,
                null,
                failedTask.getAttemptCount()
        );
    }

    @Transactional
    public void processReadyTasks() {
        List<RiggingTask> readyTasks = riggingTaskRepository.findByStatus(TaskStatus.READY);
        for (RiggingTask task : readyTasks) {
            try {
                materializeRiggedAsset(task);
            } catch (Exception e) {
                log.error("Failed to materialize rigged asset for task {}: {}",
                        task.getId(), e.getMessage());
            }
        }
    }

    private void materializeRiggedAsset(RiggingTask task) {
        if (task.getOutputPayload() == null) {
            return;
        }

        // Idempotency: only materialize if this is the latest READY task for the asset
        List<RiggingTask> assetTasks = riggingTaskRepository
                .findByGarmentAssetIdOrderByCreatedAtDesc(task.getGarmentAsset().getId());
        RiggingTask latestReady = assetTasks.stream()
                .filter(t -> t.getStatus() == TaskStatus.READY)
                .findFirst()
                .orElse(null);
        if (latestReady == null || !latestReady.getId().equals(task.getId())) {
            log.info("Skipping materialization for rigging task {} — not the latest READY task for asset {}",
                    task.getId(), task.getGarmentAsset().getId());
            return;
        }

        String riggedGlbUrl = extractField(task.getOutputPayload(), "rigged_glb_url");

        GarmentAsset asset = garmentAssetRepository.findById(task.getGarmentAsset().getId())
                .orElse(null);
        if (asset == null) {
            log.error("GarmentAsset not found for rigging task {}", task.getId());
            return;
        }

        asset.setRiggedGlbUrl(riggedGlbUrl);
        asset.setRiggingStatus("READY");
        asset.setRiggedAt(Instant.now());
        garmentAssetRepository.save(asset);

        task.setStatus(TaskStatus.MATERIALIZED);
        riggingTaskRepository.save(task);

        log.info("Rigged asset materialized for garment asset {}: {}", asset.getId(), riggedGlbUrl);
    }

    private void supersedeActiveTasks(Long garmentAssetId) {
        List<RiggingTask> tasks = riggingTaskRepository
                .findByGarmentAssetIdOrderByCreatedAtDesc(garmentAssetId);
        for (RiggingTask t : tasks) {
            if (t.getStatus() == TaskStatus.PENDING || t.getStatus() == TaskStatus.RUNNING) {
                t.setStatus(TaskStatus.FAILED);
                t.setErrorMessage("Superseded by new rigging request");
                riggingTaskRepository.save(t);
            }
        }
    }

    private void checkOwnership(Product product, String userEmail) {
        User owner = product.getDesignerProfile().getUser();
        if (!owner.getEmail().equals(userEmail)) {
            throw new AccessDeniedException("Access denied: product does not belong to current user");
        }
    }

    private GarmentSlotHint resolveSlotHint(GarmentSlotHint hint) {
        if (hint == null) {
            return GarmentSlotHint.TOP;
        }
        return switch (hint) {
            case BOTTOM -> GarmentSlotHint.BOTTOM;
            case DRESS -> GarmentSlotHint.DRESS;
            default -> GarmentSlotHint.TOP;
        };
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
