package com.iyae.config;

import com.iyae.service.AuthMailService;
import com.iyae.service.AvatarService;
import com.iyae.service.GenerationService;
import com.iyae.service.RiggingService;
import com.iyae.service.WeatherService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SchedulerConfigTest {

    @Mock GenerationService generationService;
    @Mock AvatarService avatarService;
    @Mock RiggingService riggingService;
    @Mock WeatherService weatherService;
    @Mock AuthMailService authMailService;

    @InjectMocks SchedulerConfig schedulerConfig;

    @Test
    void refreshWeatherCache_delegatesToWeatherService() {
        schedulerConfig.refreshWeatherCache();

        verify(weatherService).refresh();
    }

    @Test
    void refreshWeatherCache_swallowsExceptionsSoTheSchedulerThreadSurvives() {
        doThrow(new RuntimeException("boom")).when(weatherService).refresh();

        assertThatCode(schedulerConfig::refreshWeatherCache).doesNotThrowAnyException();
    }

    // H4: WEATHER_CACHE_TTL=0 (or negative) must not produce a non-positive fixedDelay,
    // which would make @Scheduled throw and crash context startup. The interval floors at 1s.
    @Test
    void weatherRefreshMs_floorsZeroAndNegativeToOneSecond() {
        assertThat(SchedulerConfig.weatherRefreshMs(1800)).isEqualTo(1_800_000L);
        assertThat(SchedulerConfig.weatherRefreshMs(1)).isEqualTo(1_000L);
        assertThat(SchedulerConfig.weatherRefreshMs(0)).isEqualTo(1_000L);
        assertThat(SchedulerConfig.weatherRefreshMs(-5)).isEqualTo(1_000L);
    }

    @Test
    void taskScheduler_isMultiThreadedSoSlowTasksDoNotStarveTheFastPollers() {
        ThreadPoolTaskScheduler scheduler = (ThreadPoolTaskScheduler) schedulerConfig.taskScheduler();
        scheduler.initialize();
        try {
            // A single-threaded scheduler would let a slow weather refresh delay the
            // 5s DB-polling tasks; require room for the slow task plus the fast ones.
            assertThat(scheduler.getScheduledThreadPoolExecutor().getCorePoolSize()).isGreaterThan(1);
        } finally {
            scheduler.shutdown();
        }
    }

    // ---- B-10 alerting half: the mail canary ----

    @Test
    void checkMailDeliverability_asksTheMailServiceEachTick() {
        // The point of polling: the signal has to exist without waiting for a real user's
        // registration to be the probe.
        when(authMailService.checkMailHealth())
                .thenReturn(new AuthMailService.MailHealth(true, "UP", "never", ""));

        schedulerConfig.checkMailDeliverability();

        verify(authMailService).checkMailHealth();
    }

    @Test
    void checkMailDeliverability_survivesAThrowingCheck() {
        // A scheduled method that throws kills its own future executions.
        when(authMailService.checkMailHealth()).thenThrow(new RuntimeException("boom"));

        assertThatCode(() -> schedulerConfig.checkMailDeliverability()).doesNotThrowAnyException();
    }




    @Test
    void checkMailDeliverability_startsOptimisticSoTheFirstFailureIsATransition() {
        // Transition detection is the whole reason this does not log every tick. Starting
        // pessimistic would make a healthy boot log "recovered", and starting optimistic means
        // the first unhealthy tick is the one that logs. Asserted through the state itself,
        // since log output is not the contract.
        AtomicBoolean latch = (AtomicBoolean) ReflectionTestUtils.getField(schedulerConfig, "mailHealthy");
        assertThat(latch).isNotNull();
        assertThat(latch.get()).isTrue();

        when(authMailService.checkMailHealth())
                .thenReturn(new AuthMailService.MailHealth(false, "DOWN", "never", "x"));
        schedulerConfig.checkMailDeliverability();

        assertThat(((AtomicBoolean) ReflectionTestUtils.getField(schedulerConfig, "mailHealthy")).get())
                .isFalse();

        when(authMailService.checkMailHealth())
                .thenReturn(new AuthMailService.MailHealth(true, "UP", "ok", ""));
        schedulerConfig.checkMailDeliverability();

        assertThat(((AtomicBoolean) ReflectionTestUtils.getField(schedulerConfig, "mailHealthy")).get())
                .isTrue();
    }
}
