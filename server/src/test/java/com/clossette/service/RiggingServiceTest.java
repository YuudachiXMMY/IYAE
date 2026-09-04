package com.clossette.service;

import com.clossette.dto.RiggingStatusResponse;
import com.clossette.entity.DesignerProfile;
import com.clossette.entity.GarmentAsset;
import com.clossette.entity.Product;
import com.clossette.entity.RiggingTask;
import com.clossette.entity.User;
import com.clossette.entity.enums.GarmentSlotHint;
import com.clossette.entity.enums.Role;
import com.clossette.entity.enums.TaskStatus;
import com.clossette.repository.GarmentAssetRepository;
import com.clossette.repository.ProductRepository;
import com.clossette.repository.RiggingTaskRepository;
import com.clossette.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RiggingServiceTest {

    @Mock
    RiggingTaskRepository riggingTaskRepository;

    @Mock
    GarmentAssetRepository garmentAssetRepository;

    @Mock
    ProductRepository productRepository;

    @Mock
    UserRepository userRepository;

    @Mock
    ObjectMapper objectMapper;

    @InjectMocks
    RiggingService riggingService;

    private User owner;
    private User otherUser;
    private DesignerProfile ownerProfile;
    private Product product;
    private GarmentAsset asset;

    @BeforeEach
    void setUp() {
        owner = User.builder()
                .id(1L)
                .email("designer@example.com")
                .passwordHash("$2a$10$hash")
                .name("Designer")
                .role(Role.DESIGNER)
                .build();

        otherUser = User.builder()
                .id(2L)
                .email("other@example.com")
                .passwordHash("$2a$10$hash")
                .name("Other")
                .role(Role.DESIGNER)
                .build();

        ownerProfile = DesignerProfile.builder()
                .id(10L)
                .user(owner)
                .shopName("Luna Studio")
                .build();

        product = Product.builder()
                .id(100L)
                .designerProfile(ownerProfile)
                .name("Test Jacket")
                .price(new BigDecimal("149.99"))
                .build();

        asset = GarmentAsset.builder()
                .id(50L)
                .product(product)
                .glbUrl("https://example.com/jacket.glb")
                .slotHint(GarmentSlotHint.TOP)
                .status("READY")
                .build();
    }

    // --- requestRigging ---

    @Test
    void requestRigging_success_returnsPendingStatus() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Optional.of(asset));
        when(riggingTaskRepository.findByGarmentAssetIdOrderByCreatedAtDesc(50L))
                .thenReturn(List.of());
        when(riggingTaskRepository.save(any(RiggingTask.class))).thenAnswer(inv -> inv.getArgument(0));
        when(garmentAssetRepository.save(any(GarmentAsset.class))).thenReturn(asset);

        RiggingStatusResponse result = riggingService.requestRigging(100L, "designer@example.com");

        assertThat(result.status()).isEqualTo("PENDING");
        assertThat(result.riggedGlbUrl()).isNull();
        verify(riggingTaskRepository).save(any(RiggingTask.class));
        verify(garmentAssetRepository).save(asset);
    }

    @Test
    void requestRigging_productNotFound_throwsIllegalArgumentException() {
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> riggingService.requestRigging(999L, "designer@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Product not found");
    }

    @Test
    void requestRigging_notOwner_throwsAccessDeniedException() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> riggingService.requestRigging(100L, "other@example.com"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Access denied");
    }

    @Test
    void requestRigging_noGarmentAsset_throwsIllegalArgumentException() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> riggingService.requestRigging(100L, "designer@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("No garment asset found");
    }

    @Test
    void requestRigging_assetHasNoGlbUrl_throwsIllegalArgumentException() {
        GarmentAsset assetNoGlb = GarmentAsset.builder()
                .id(51L)
                .product(product)
                .glbUrl(null)
                .status("PENDING")
                .build();
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Optional.of(assetNoGlb));

        assertThatThrownBy(() -> riggingService.requestRigging(100L, "designer@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no GLB URL");
    }

    @Test
    void requestRigging_supersedesActiveTasks() throws Exception {
        // Two existing active tasks (one PENDING, one RUNNING) for the same asset
        RiggingTask pendingTask = RiggingTask.builder()
                .id(1L)
                .garmentAsset(asset)
                .product(product)
                .status(TaskStatus.PENDING)
                .attemptCount(0)
                .build();
        RiggingTask runningTask = RiggingTask.builder()
                .id(2L)
                .garmentAsset(asset)
                .product(product)
                .status(TaskStatus.RUNNING)
                .attemptCount(1)
                .build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Optional.of(asset));
        when(riggingTaskRepository.findByGarmentAssetIdOrderByCreatedAtDesc(50L))
                .thenReturn(List.of(pendingTask, runningTask));
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"source_glb_url\":\"https://example.com/jacket.glb\",\"slot_hint\":\"TOP\"}");
        when(riggingTaskRepository.save(any(RiggingTask.class))).thenAnswer(inv -> inv.getArgument(0));
        when(garmentAssetRepository.save(any(GarmentAsset.class))).thenReturn(asset);

        riggingService.requestRigging(100L, "designer@example.com");

        // Both active tasks must have been superseded to FAILED
        ArgumentCaptor<RiggingTask> captor = ArgumentCaptor.forClass(RiggingTask.class);
        verify(riggingTaskRepository, atLeast(2)).save(captor.capture());
        List<RiggingTask> saved = captor.getAllValues();
        long failedCount = saved.stream()
                .filter(t -> t.getStatus() == TaskStatus.FAILED && t.getId() != null)
                .count();
        assertThat(failedCount).isGreaterThanOrEqualTo(2);
    }

    // --- getStatus ---

    @Test
    void getStatus_returnsReadyWhenTaskIsReady() throws Exception {
        RiggingTask task = RiggingTask.builder()
                .id(1L)
                .garmentAsset(asset)
                .product(product)
                .status(TaskStatus.READY)
                .outputPayload("{\"rigged_glb_url\":\"https://example.com/rigged.glb\"}")
                .attemptCount(1)
                .build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Optional.of(asset));
        when(riggingTaskRepository.findByGarmentAssetIdOrderByCreatedAtDesc(50L))
                .thenReturn(List.of(task));
        when(objectMapper.readTree("{\"rigged_glb_url\":\"https://example.com/rigged.glb\"}"))
                .thenReturn(new ObjectMapper().readTree("{\"rigged_glb_url\":\"https://example.com/rigged.glb\"}"));

        RiggingStatusResponse result = riggingService.getStatus(100L, "designer@example.com");

        assertThat(result.status()).isEqualTo("READY");
        assertThat(result.riggedGlbUrl()).isEqualTo("https://example.com/rigged.glb");
    }

    @Test
    void getStatus_mapsMaterializedToReady() {
        RiggingTask task = RiggingTask.builder()
                .id(1L)
                .garmentAsset(asset)
                .product(product)
                .status(TaskStatus.MATERIALIZED)
                .outputPayload(null)
                .attemptCount(1)
                .build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Optional.of(asset));
        when(riggingTaskRepository.findByGarmentAssetIdOrderByCreatedAtDesc(50L))
                .thenReturn(List.of(task));

        RiggingStatusResponse result = riggingService.getStatus(100L, "designer@example.com");

        assertThat(result.status()).isEqualTo("READY");
    }

    @Test
    void getStatus_returnsNoneWhenNoTaskExists() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Optional.of(asset));
        when(riggingTaskRepository.findByGarmentAssetIdOrderByCreatedAtDesc(50L))
                .thenReturn(List.of());

        RiggingStatusResponse result = riggingService.getStatus(100L, "designer@example.com");

        assertThat(result.status()).isEqualTo("NONE");
        assertThat(result.riggedGlbUrl()).isNull();
    }

    @Test
    void getStatus_returnsNoneWhenNoAsset() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Optional.empty());

        RiggingStatusResponse result = riggingService.getStatus(100L, "designer@example.com");

        assertThat(result.status()).isEqualTo("NONE");
    }

    // --- retry ---

    @Test
    void retry_success_resetsToPending() {
        RiggingTask failedTask = RiggingTask.builder()
                .id(1L)
                .garmentAsset(asset)
                .product(product)
                .status(TaskStatus.FAILED)
                .errorMessage("Worker error")
                .failureCode("RIGGING_FAILED")
                .attemptCount(1)
                .build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Optional.of(asset));
        when(riggingTaskRepository.findFirstByGarmentAssetIdAndStatusOrderByCreatedAtDesc(50L, TaskStatus.FAILED))
                .thenReturn(Optional.of(failedTask));
        when(riggingTaskRepository.save(any(RiggingTask.class))).thenAnswer(inv -> inv.getArgument(0));
        when(garmentAssetRepository.save(any(GarmentAsset.class))).thenReturn(asset);

        RiggingStatusResponse result = riggingService.retry(100L, "designer@example.com");

        assertThat(result.status()).isEqualTo("PENDING");
        assertThat(result.attemptCount()).isEqualTo(2);
        assertThat(failedTask.getStatus()).isEqualTo(TaskStatus.PENDING);
        assertThat(failedTask.getErrorMessage()).isNull();
        assertThat(failedTask.getFailureCode()).isNull();
    }

    @Test
    void retry_noFailedTask_throwsIllegalArgumentException() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Optional.of(asset));
        when(riggingTaskRepository.findFirstByGarmentAssetIdAndStatusOrderByCreatedAtDesc(50L, TaskStatus.FAILED))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> riggingService.retry(100L, "designer@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("No failed rigging task found");
    }

    @Test
    void retry_backfillsInputPayload_whenMissingOnLegacyTask() throws Exception {
        // A legacy FAILED task with no inputPayload should get it populated from the asset
        RiggingTask legacyFailed = RiggingTask.builder()
                .id(3L)
                .garmentAsset(asset)
                .product(product)
                .status(TaskStatus.FAILED)
                .errorMessage("Legacy error")
                .inputPayload(null)
                .attemptCount(1)
                .build();

        String expectedPayload = "{\"source_glb_url\":\"https://example.com/jacket.glb\",\"slot_hint\":\"TOP\"}";
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(garmentAssetRepository.findTopByProductIdOrderByCreatedAtDesc(100L))
                .thenReturn(Optional.of(asset));
        when(riggingTaskRepository.findFirstByGarmentAssetIdAndStatusOrderByCreatedAtDesc(50L, TaskStatus.FAILED))
                .thenReturn(Optional.of(legacyFailed));
        when(objectMapper.writeValueAsString(any())).thenReturn(expectedPayload);
        when(riggingTaskRepository.save(any(RiggingTask.class))).thenAnswer(inv -> inv.getArgument(0));
        when(garmentAssetRepository.save(any(GarmentAsset.class))).thenReturn(asset);

        riggingService.retry(100L, "designer@example.com");

        // Verify inputPayload was backfilled
        assertThat(legacyFailed.getInputPayload()).isEqualTo(expectedPayload);
        assertThat(legacyFailed.getStatus()).isEqualTo(TaskStatus.PENDING);
    }

    // --- processReadyTasks ---

    @Test
    void processReadyTasks_materializesReadyAsset() throws Exception {
        String payload = "{\"rigged_glb_url\":\"https://example.com/rigged.glb\"}";
        RiggingTask task = RiggingTask.builder()
                .id(1L)
                .garmentAsset(asset)
                .product(product)
                .status(TaskStatus.READY)
                .outputPayload(payload)
                .attemptCount(1)
                .build();

        when(riggingTaskRepository.findByStatus(TaskStatus.READY)).thenReturn(List.of(task));
        when(riggingTaskRepository.findByGarmentAssetIdOrderByCreatedAtDesc(50L))
                .thenReturn(List.of(task));
        when(garmentAssetRepository.findById(50L)).thenReturn(Optional.of(asset));
        when(objectMapper.readTree(payload))
                .thenReturn(new ObjectMapper().readTree(payload));
        when(garmentAssetRepository.save(any(GarmentAsset.class))).thenReturn(asset);
        when(riggingTaskRepository.save(any(RiggingTask.class))).thenAnswer(inv -> inv.getArgument(0));

        riggingService.processReadyTasks();

        assertThat(asset.getRiggedGlbUrl()).isEqualTo("https://example.com/rigged.glb");
        assertThat(asset.getRiggingStatus()).isEqualTo("READY");
        assertThat(task.getStatus()).isEqualTo(TaskStatus.MATERIALIZED);
        verify(garmentAssetRepository).save(asset);
        verify(riggingTaskRepository).save(task);
    }

    @Test
    void processReadyTasks_skipsNonLatestReadyTask() {
        String payload = "{\"rigged_glb_url\":\"https://example.com/rigged-v2.glb\"}";
        // olderTask is READY but not the latest — it should NOT be materialized
        RiggingTask olderTask = RiggingTask.builder()
                .id(1L)
                .garmentAsset(asset)
                .product(product)
                .status(TaskStatus.READY)
                .outputPayload("{\"rigged_glb_url\":\"https://example.com/rigged-v1.glb\"}")
                .attemptCount(1)
                .build();
        // newerTask is also READY and is the latest for the asset
        RiggingTask newerTask = RiggingTask.builder()
                .id(2L)
                .garmentAsset(asset)
                .product(product)
                .status(TaskStatus.READY)
                .outputPayload(payload)
                .attemptCount(1)
                .build();

        // processReadyTasks fetches all READY tasks — here only olderTask is returned
        when(riggingTaskRepository.findByStatus(TaskStatus.READY)).thenReturn(List.of(olderTask));
        // The idempotency check finds newerTask (id=2) as the latest READY for the asset,
        // so olderTask (id=1) is NOT the latest and must be skipped
        when(riggingTaskRepository.findByGarmentAssetIdOrderByCreatedAtDesc(50L))
                .thenReturn(List.of(newerTask, olderTask));

        riggingService.processReadyTasks();

        // Neither the asset nor the older task should have been saved
        verify(garmentAssetRepository, never()).save(any());
        verify(riggingTaskRepository, never()).save(any());
        // olderTask status unchanged
        assertThat(olderTask.getStatus()).isEqualTo(TaskStatus.READY);
    }
}
