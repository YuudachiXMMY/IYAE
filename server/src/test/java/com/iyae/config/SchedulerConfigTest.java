package com.iyae.config;

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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class SchedulerConfigTest {

    @Mock GenerationService generationService;
    @Mock AvatarService avatarService;
    @Mock RiggingService riggingService;
    @Mock WeatherService weatherService;

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
}
