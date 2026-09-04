package com.clossette.service;

import com.clossette.dto.GenerationStatusResponse;
import com.clossette.entity.ModelGenerationTask;
import com.clossette.entity.enums.TaskStatus;
import com.clossette.repository.ModelGenerationTaskRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ModelGenerationOrchestrationServiceTest {

    @Mock
    GenerationService generationService;

    @Mock
    ModelGenerationTaskRepository taskRepository;

    @InjectMocks
    ModelGenerationOrchestrationService orchestrationService;

    @Test
    void initiateGeneration_delegatesToGenerationService() {
        GenerationStatusResponse expected = new GenerationStatusResponse("PENDING", null, null, null, 0);
        when(generationService.regenerate(1L, "designer@test.com")).thenReturn(expected);

        GenerationStatusResponse result = orchestrationService.initiateGeneration(1L, "designer@test.com");

        assertThat(result.status()).isEqualTo("PENDING");
        verify(generationService).regenerate(1L, "designer@test.com");
    }

    @Test
    void checkStatus_delegatesToGenerationService() {
        GenerationStatusResponse expected = new GenerationStatusResponse("READY", "/assets/model.glb", null, null, 0);
        when(generationService.getStatus(1L, "designer@test.com")).thenReturn(expected);

        GenerationStatusResponse result = orchestrationService.checkStatus(1L, "designer@test.com");

        assertThat(result.status()).isEqualTo("READY");
        verify(generationService).getStatus(1L, "designer@test.com");
    }

    @Test
    void retryFailedGeneration_delegatesToGenerationService() {
        GenerationStatusResponse expected = new GenerationStatusResponse("PENDING", null, null, null, 1);
        when(generationService.retry(1L, "designer@test.com")).thenReturn(expected);

        GenerationStatusResponse result = orchestrationService.retryFailedGeneration(1L, "designer@test.com");

        assertThat(result.retryCount()).isEqualTo(1);
        verify(generationService).retry(1L, "designer@test.com");
    }

    @Test
    void checkAndMaterialize_callsProcessReadyTasks() {
        orchestrationService.checkAndMaterialize();

        verify(generationService).processReadyTasks();
    }

    @Test
    void getPendingTasks_returnsPendingTaskList() {
        ModelGenerationTask task = ModelGenerationTask.builder().id(1L).status(TaskStatus.PENDING).build();
        when(taskRepository.findByStatus(TaskStatus.PENDING)).thenReturn(List.of(task));

        List<ModelGenerationTask> result = orchestrationService.getPendingTasks();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getStatus()).isEqualTo(TaskStatus.PENDING);
    }

    @Test
    void getRunningTasks_returnsRunningTaskList() {
        ModelGenerationTask task = ModelGenerationTask.builder().id(2L).status(TaskStatus.RUNNING).build();
        when(taskRepository.findByStatus(TaskStatus.RUNNING)).thenReturn(List.of(task));

        List<ModelGenerationTask> result = orchestrationService.getRunningTasks();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getStatus()).isEqualTo(TaskStatus.RUNNING);
    }
}
