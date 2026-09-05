package com.iyae.service;

import com.iyae.entity.DesignerProfile;
import com.iyae.entity.Product;
import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import com.iyae.repository.GarmentAssetRepository;
import com.iyae.repository.ModelGenerationTaskRepository;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import com.iyae.entity.ModelGenerationTask;
import com.iyae.entity.enums.TaskStatus;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GenerationServiceTest {

    @Mock
    ModelGenerationTaskRepository taskRepository;

    @Mock
    GarmentAssetRepository garmentAssetRepository;

    @Mock
    ProductRepository productRepository;

    @Mock
    UserRepository userRepository;

    @Mock
    ObjectMapper objectMapper;

    @InjectMocks
    GenerationService generationService;

    private User owner;
    private User otherUser;
    private DesignerProfile ownerProfile;
    private Product product;

    @BeforeEach
    void setUp() throws Exception {
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
                .name("Test Coat")
                .price(new BigDecimal("199.99"))
                .build();

        // Inject @Value field that @InjectMocks cannot set
        var field = GenerationService.class.getDeclaredField("modelGenerationProvider");
        field.setAccessible(true);
        field.set(generationService, "mock");
    }

    @Test
    void getStatus_ownerAccess_returnsNoneWhenNoTasks() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(taskRepository.findByProductIdOrderByCreatedAtDesc(100L)).thenReturn(List.of());

        var result = generationService.getStatus(100L, "designer@example.com");

        assertThat(result.status()).isEqualTo("NONE");
    }

    @Test
    void getStatus_nonOwner_throwsAccessDeniedException() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> generationService.getStatus(100L, "other@example.com"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Access denied");
    }

    @Test
    void regenerate_nonOwner_throwsAccessDeniedException() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> generationService.regenerate(100L, "other@example.com"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Access denied");
    }

    @Test
    void retry_nonOwner_throwsAccessDeniedException() {
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> generationService.retry(100L, "other@example.com"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Access denied");
    }

    @Test
    void getStatus_productNotFound_throwsIllegalArgumentException() {
        when(productRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> generationService.getStatus(999L, "designer@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Product not found");
    }

    @Test
    void getStatus_materializedTask_returnsReadyStatus() {
        ModelGenerationTask task = ModelGenerationTask.builder()
                .id(1L)
                .product(product)
                .status(TaskStatus.MATERIALIZED)
                .outputPayload("{\"glb_url\":\"https://example.com/model.glb\",\"usdz_url\":\"https://example.com/model.usdz\"}")
                .attemptCount(1)
                .build();
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(taskRepository.findByProductIdOrderByCreatedAtDesc(100L)).thenReturn(List.of(task));

        var result = generationService.getStatus(100L, "designer@example.com");

        assertThat(result.status()).isEqualTo("READY");
    }

    @Test
    void regenerate_supersedesExistingPendingTask() throws Exception {
        product = Product.builder()
                .id(100L)
                .designerProfile(ownerProfile)
                .name("Test Coat")
                .price(new BigDecimal("199.99"))
                .media("[\"https://example.com/image.jpg\"]")
                .build();

        ModelGenerationTask pendingTask = ModelGenerationTask.builder()
                .id(1L)
                .product(product)
                .status(TaskStatus.PENDING)
                .attemptCount(0)
                .build();

        ModelGenerationTask savedPending = ModelGenerationTask.builder()
                .id(1L)
                .product(product)
                .status(TaskStatus.FAILED)
                .errorMessage("Superseded by regeneration")
                .attemptCount(0)
                .build();

        ModelGenerationTask newTask = ModelGenerationTask.builder()
                .id(2L)
                .product(product)
                .status(TaskStatus.PENDING)
                .attemptCount(0)
                .build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(taskRepository.findByProductIdOrderByCreatedAtDesc(100L)).thenReturn(List.of(pendingTask));
        when(objectMapper.readTree("[\"https://example.com/image.jpg\"]"))
                .thenReturn(new com.fasterxml.jackson.databind.ObjectMapper().readTree("[\"https://example.com/image.jpg\"]"));
        when(objectMapper.writeValueAsString(any())).thenReturn("{\"image_url\":\"https://example.com/image.jpg\"}");
        when(taskRepository.save(any(ModelGenerationTask.class))).thenAnswer(inv -> {
            ModelGenerationTask t = inv.getArgument(0);
            if (t.getStatus() == TaskStatus.PENDING && t.getId() == null) {
                return newTask;
            }
            return t;
        });

        var result = generationService.regenerate(100L, "designer@example.com");

        assertThat(result.status()).isEqualTo("PENDING");
        verify(taskRepository, org.mockito.Mockito.atLeastOnce()).save(any(ModelGenerationTask.class));
    }

    @Test
    void regenerate_noImage_throwsIllegalArgumentException() throws Exception {
        product = Product.builder()
                .id(100L)
                .designerProfile(ownerProfile)
                .name("Test Coat")
                .price(new BigDecimal("199.99"))
                .media(null)
                .build();

        when(productRepository.findById(100L)).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> generationService.regenerate(100L, "designer@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Product has no image for 3D generation");
    }
}
