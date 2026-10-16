package com.iyae.config;

import com.iyae.service.AuthMailService;
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

import java.util.concurrent.atomic.AtomicBoolean;

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
    private final AuthMailService authMailService;

    /**
     * Multi-threaded scheduler so a slow task — notably {@link #refreshWeatherCache()},
     * which makes a bounded but possibly multi-second outbound HTTP call — can never
     * delay the fast DB-polling tasks below. {@code @EnableScheduling} picks up this
     * bean automatically; without it, every {@code @Scheduled} method shares a single thread.
     */
    /**
     * Last known mail verdict, for transition detection. Starts optimistic so the first
     * unhealthy tick logs — a pessimistic start would log "recovered" on a healthy boot.
     */
    private final AtomicBoolean mailHealthy = new AtomicBoolean(true);

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
     * Mail-delivery canary. B-10's alerting half.
     *
     * <p>Exists because "nothing has failed" and "delivery works" were indistinguishable. A
     * misconfigured mail path produced no signal at all: registration still answered 201, the
     * user never got a link, login stayed gated on verification, and the only trace was a
     * {@code log.warn} in container stdout. Polling on a schedule means the signal exists
     * without waiting for a real user to be the probe.
     *
     * <p>Logs only on a <em>transition</em>, not on every tick. A line every two minutes while
     * mail is down is noise an operator learns to scroll past; one ERROR when it breaks and one
     * INFO when it recovers is readable. The marker {@code [mail-canary]} is deliberately
     * greppable, since log-grepping is the only tool this deployment has until a monitor is
     * pointed at {@code /api/health/mail}.
     *
     * <p>There is deliberately no outbound notification. The signal is the log line plus
     * {@code GET /api/health/mail}, which answers 503 when delivery is broken and is therefore
     * directly alarmable — but nothing is wired to watch it yet, so until a monitor is pointed
     * at that endpoint, discovering an outage means grepping for the marker above. That is a
     * known, accepted gap rather than an oversight.
     */
    @Scheduled(fixedDelay = 120000, initialDelay = 45000)
    public void checkMailDeliverability() {
        try {
            AuthMailService.MailHealth health = authMailService.checkMailHealth();
            boolean wasHealthy = mailHealthy.getAndSet(health.healthy());

            if (!health.healthy() && wasHealthy) {
                log.error("[mail-canary] transactional email is NOT deliverable "
                        + "(transport={}, lastSend={}, detail={}). Verification and "
                        + "password-reset mail is failing; registration still returns 201 and "
                        + "users are left unable to sign in.",
                        health.transport(), health.lastSend(), health.detail());
            } else if (health.healthy() && !wasHealthy) {
                log.info("[mail-canary] transactional email is deliverable again "
                        + "(transport={}, lastSend={})", health.transport(), health.lastSend());
            }
        } catch (Exception e) {
            log.error("[mail-canary] the deliverability check itself failed: {}", e.getMessage());
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
