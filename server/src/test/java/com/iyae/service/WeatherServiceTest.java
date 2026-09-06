package com.iyae.service;

import com.iyae.service.WeatherService.WeatherSnapshot;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WeatherServiceTest {

    @Mock RestTemplate restTemplate;

    @InjectMocks WeatherService weatherService;

    @BeforeEach
    void setUp() {
        // @Value fields are not populated outside Spring — set them explicitly
        ReflectionTestUtils.setField(weatherService, "enabled", true);
        ReflectionTestUtils.setField(weatherService, "apiUrl", "https://api.open-meteo.com/v1/forecast");
        ReflectionTestUtils.setField(weatherService, "latitude", 43.6532);
        ReflectionTestUtils.setField(weatherService, "longitude", -79.3832);
        ReflectionTestUtils.setField(weatherService, "timezone", "America/Toronto");
        ReflectionTestUtils.setField(weatherService, "cacheTtlSeconds", 1800L);
    }

    private Map<String, Object> cannedBody(int weatherCode) {
        return Map.of("current", Map.of(
            "temperature_2m", 4.1,
            "apparent_temperature", -1.2,
            "weather_code", weatherCode,
            "wind_speed_10m", 15.0
        ));
    }

    @Test
    void getCurrentToronto_beforeRefresh_returnsEmptyWithoutHittingNetwork() {
        // The hot-path read must never trigger a blocking HTTP fetch (PR #9 review, M1).
        Optional<WeatherSnapshot> result = weatherService.getCurrentToronto();

        assertThat(result).isEmpty();
        verifyNoInteractions(restTemplate);
    }

    @Test
    void refresh_thenGetCurrentToronto_returnsSnapshotParsedFromOpenMeteoBody() {
        when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(cannedBody(71));

        weatherService.refresh();
        Optional<WeatherSnapshot> result = weatherService.getCurrentToronto();

        assertThat(result).isPresent();
        WeatherSnapshot snap = result.get();
        assertThat(snap.temperatureC()).isEqualTo(4.1);
        assertThat(snap.feelsLikeC()).isEqualTo(-1.2);
        assertThat(snap.condition()).isEqualTo("snow");
    }

    @Test
    void mapWeatherCode_mapsWmoCodesToLabels() {
        assertThat(weatherService.mapWeatherCode(0)).isEqualTo("clear");
        assertThat(weatherService.mapWeatherCode(2)).isEqualTo("partly cloudy");
        assertThat(weatherService.mapWeatherCode(48)).isEqualTo("fog");
        assertThat(weatherService.mapWeatherCode(55)).isEqualTo("drizzle");
        assertThat(weatherService.mapWeatherCode(65)).isEqualTo("rain");
        assertThat(weatherService.mapWeatherCode(71)).isEqualTo("snow");
        assertThat(weatherService.mapWeatherCode(82)).isEqualTo("rain showers");
        assertThat(weatherService.mapWeatherCode(86)).isEqualTo("snow showers");
        assertThat(weatherService.mapWeatherCode(95)).isEqualTo("thunderstorm");
        assertThat(weatherService.mapWeatherCode(1234)).isEqualTo("mixed conditions");
    }

    @Test
    void refresh_withinTtl_fetchesOnlyOnce() {
        when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(cannedBody(0));

        weatherService.refresh();
        weatherService.refresh();

        verify(restTemplate, times(1)).getForObject(anyString(), eq(Map.class));
    }

    @Test
    void refresh_onFailure_doesNotThrow_andLeavesCacheEmpty() {
        when(restTemplate.getForObject(anyString(), eq(Map.class)))
            .thenThrow(new RestClientException("Open-Meteo down"));

        weatherService.refresh();

        assertThat(weatherService.getCurrentToronto()).isEmpty();
    }

    @Test
    void refresh_afterSuccessThenFailure_keepsStaleSnapshot() {
        when(restTemplate.getForObject(anyString(), eq(Map.class)))
            .thenReturn(cannedBody(71))
            .thenThrow(new RestClientException("Open-Meteo down"));

        weatherService.refresh();
        // Force TTL expiry so the second refresh re-fetches (and fails)
        ReflectionTestUtils.setField(weatherService, "cacheTtlSeconds", 0L);
        weatherService.refresh();

        Optional<WeatherSnapshot> result = weatherService.getCurrentToronto();
        assertThat(result).isPresent();
        assertThat(result.get().condition()).isEqualTo("snow");
    }

    @Test
    void refresh_whenDisabled_skipsHttp() {
        ReflectionTestUtils.setField(weatherService, "enabled", false);

        weatherService.refresh();

        verify(restTemplate, never()).getForObject(anyString(), eq(Map.class));
        assertThat(weatherService.getCurrentToronto()).isEmpty();
    }

    @Test
    void getCurrentToronto_whenDisabled_returnsEmpty() {
        ReflectionTestUtils.setField(weatherService, "enabled", false);

        assertThat(weatherService.getCurrentToronto()).isEmpty();
    }

    @Test
    void toPromptContext_formatsHumanReadableLine() {
        WeatherSnapshot snap = new WeatherSnapshot(4.0, -1.0, "light snow", java.time.Instant.now());

        String context = weatherService.toPromptContext(snap);

        assertThat(context).contains("Current Toronto weather");
        assertThat(context).contains("light snow");
        assertThat(context).contains("4°C");
    }
}
