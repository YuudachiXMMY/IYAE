package com.iyae.config;

import com.iyae.service.AvatarService;
import com.iyae.service.GenerationService;
import com.iyae.service.ResaleService;
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
    private final ResaleService resaleService;

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
     * Returns pre-loved resale listings stuck in RESERVED (a checkout was started but never paid)
     * back to LISTED after the reservation TTL, so an abandoned buy-now can't strand a unique unit.
     * Runs every 5 minutes; first run 30s after boot.
     */
    @Scheduled(fixedDelay = 300000, initialDelay = 30000)
    public void releaseStaleResaleReservations() {
        try {
            resaleService.releaseStaleReservations();
        } catch (Exception e) {
            log.error("Error releasing stale resale reservations: {}", e.getMessage());
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
    @Scheduled(initialDelay = 5000,
               fixedDelayString = "#{T(com.iyae.config.SchedulerConfig).weatherRefreshMs(${app.weather.cache-ttl-seconds:1800})}")
    public void refreshWeatherCache() {
        try {
            weatherService.refresh();
        } catch (Exception e) {
            log.error("Error during scheduled weather cache refresh: {}", e.getMessage());
        }
    }

    /**
     * Weather refresh cadence in milliseconds. Floors at 1s so a {@code WEATHER_CACHE_TTL}
     * of 0 or a negative value cannot produce a non-positive {@code fixedDelay} (which would
     * make {@code @Scheduled} throw and crash context startup). {@code WEATHER_CACHE_TTL}
     * must be a positive integer; a non-numeric value is invalid config and fails fast.
     */
    public static long weatherRefreshMs(long ttlSeconds) {
        return Math.max(1L, ttlSeconds) * 1000L;
    }
}
