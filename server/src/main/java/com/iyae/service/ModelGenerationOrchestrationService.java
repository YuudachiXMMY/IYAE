package com.iyae.service;

import com.iyae.dto.GenerationStatusResponse;
import com.iyae.entity.ModelGenerationTask;
import com.iyae.entity.enums.TaskStatus;
import com.iyae.repository.ModelGenerationTaskRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * High-level orchestration API for 3D model generation.
 * Coordinates task lifecycle: initiation, status polling, retry, and materialization.
 * Lower-level task processing is handled by {@link GenerationService}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ModelGenerationOrchestrationService {

    private final GenerationService generationService;
    private final ModelGenerationTaskRepository taskRepository;

    /**
     * Initiates a new generation task for the given product (owned by email).
     */
    @Transactional
    public GenerationStatusResponse initiateGeneration(Long productId, String email) {
        return generationService.regenerate(productId, email);
    }

    /**
     * Returns the current generation status for the given product.
     */
    @Transactional(readOnly = true)
    public GenerationStatusResponse checkStatus(Long productId, String email) {
        return generationService.getStatus(productId, email);
    }

    /**
     * Retries the most recent failed generation task.
     */
    @Transactional
    public GenerationStatusResponse retryFailedGeneration(Long productId, String email) {
        return generationService.retry(productId, email);
    }

    /**
     * Triggers materialization of all READY tasks into GarmentAsset rows.
     * Called by the scheduler in SchedulerConfig.
     */
    @Transactional
    public void checkAndMaterialize() {
        generationService.processReadyTasks();
    }

    /**
     * Returns all pending tasks across all products (for monitoring/admin use).
     */
    @Transactional(readOnly = true)
    public List<ModelGenerationTask> getPendingTasks() {
        return taskRepository.findByStatus(TaskStatus.PENDING);
    }

    /**
     * Returns all running tasks across all products (for monitoring/admin use).
     */
    @Transactional(readOnly = true)
    public List<ModelGenerationTask> getRunningTasks() {
        return taskRepository.findByStatus(TaskStatus.RUNNING);
    }
}
