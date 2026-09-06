package com.iyae.config;

import com.iyae.service.AvatarService;
import com.iyae.service.GenerationService;
import com.iyae.service.RiggingService;
import com.iyae.service.WeatherService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Slf4j
@Configuration
@EnableScheduling
@RequiredArgsConstructor
public class SchedulerConfig {

    private final GenerationService generationService;
    private final AvatarService avatarService;
    private final RiggingService riggingService;
    private final WeatherService weatherService;

    /**
     * Multi-threaded scheduler so a slow task — notably {@link #refreshWeatherCache()},
     * which makes a bounded but possibly multi-second outbound HTTP call — can never
     * delay the fast DB-polling tasks below. {@code @EnableScheduling} picks up this
     * bean automatically; without it, every {@code @Scheduled} method shares a single thread.
     */
    @Bean
    public TaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(3);
        scheduler.setThreadNamePrefix("iyae-sched-");
        scheduler.setWaitForTasksToCompleteOnShutdown(true);
        scheduler.setAwaitTerminationSeconds(20);
        return scheduler;
    }

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

    /**
     * Pre-warms the Toronto weather cache OFF the chat hot path. Running this on a
     * schedule (starting shortly after boot) keeps {@link WeatherService#getCurrentToronto()}
     * a non-blocking in-memory read, so a slow or unreachable Open-Meteo can never add
     * latency to a user's stylist turn (addresses PR #9 review finding M1). The cadence is
     * driven by {@code app.weather.cache-ttl-seconds} (converted to milliseconds) so the
     * cache is re-warmed exactly as often as it is allowed to go stale.
     */
    @Scheduled(initialDelay = 5000, fixedDelayString = "${app.weather.cache-ttl-seconds:1800}000")
    public void refreshWeatherCache() {
        try {
            weatherService.refresh();
        } catch (Exception e) {
            log.error("Error during scheduled weather cache refresh: {}", e.getMessage());
        }
    }
}
