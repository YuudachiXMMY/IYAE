package com.clossette.repository;

import com.clossette.entity.RiggingTask;
import com.clossette.entity.enums.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RiggingTaskRepository extends JpaRepository<RiggingTask, Long> {

    List<RiggingTask> findByStatus(TaskStatus status);

    List<RiggingTask> findByGarmentAssetIdOrderByCreatedAtDesc(Long garmentAssetId);

    Optional<RiggingTask> findFirstByGarmentAssetIdAndStatusOrderByCreatedAtDesc(Long garmentAssetId, TaskStatus status);

    List<RiggingTask> findByProductIdOrderByCreatedAtDesc(Long productId);
}
