package com.iyae.repository;

import com.iyae.entity.ModelGenerationTask;
import com.iyae.entity.enums.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ModelGenerationTaskRepository extends JpaRepository<ModelGenerationTask, Long> {

    List<ModelGenerationTask> findByProductIdOrderByCreatedAtDesc(Long productId);

    Optional<ModelGenerationTask> findFirstByProductIdAndStatus(Long productId, TaskStatus status);

    Optional<ModelGenerationTask> findFirstByProductIdAndStatusOrderByCreatedAtDesc(Long productId, TaskStatus status);

    List<ModelGenerationTask> findByStatus(TaskStatus status);
}
