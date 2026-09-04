package com.clossette.repository;

import com.clossette.entity.AvatarGenerationTask;
import com.clossette.entity.enums.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AvatarGenerationTaskRepository extends JpaRepository<AvatarGenerationTask, Long> {

    List<AvatarGenerationTask> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<AvatarGenerationTask> findByStatus(TaskStatus status);

    Optional<AvatarGenerationTask> findFirstByUserIdAndStatusOrderByCreatedAtDesc(Long userId, TaskStatus status);
}
