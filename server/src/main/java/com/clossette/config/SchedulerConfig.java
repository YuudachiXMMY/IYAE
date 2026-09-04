package com.clossette.config;

import com.clossette.service.AvatarService;
import com.clossette.service.GenerationService;
import com.clossette.service.RiggingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

@Slf4j
@Configuration
@EnableScheduling
@RequiredArgsConstructor
public class SchedulerConfig {

    private final GenerationService generationService;
    private final AvatarService avatarService;
    private final RiggingService riggingService;

    @Scheduled(fixedDelay = 5000)
    public void processReadyGenerationTasks() {
        try {
            generationService.processReadyTasks();
        } catch (Exception e) {
            log.error("Error during scheduled generation task processing: {}", e.getMessage());
        }
    }

    @Scheduled(fixedDelay = 5000)
    public void processReadyAvatarTasks() {
        try {
            avatarService.processReadyTasks();
        } catch (Exception e) {
            log.error("Error during scheduled avatar task processing: {}", e.getMessage());
        }
    }

    @Scheduled(fixedDelay = 5000)
    public void processReadyRiggingTasks() {
        try {
            riggingService.processReadyTasks();
        } catch (Exception e) {
            log.error("Error processing ready rigging tasks: {}", e.getMessage());
        }
    }
}
