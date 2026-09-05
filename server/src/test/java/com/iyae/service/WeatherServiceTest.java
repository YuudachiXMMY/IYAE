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
    void getCurrentToronto_parsesSnapshotFromOpenMeteoBody() {
        when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(cannedBody(71));

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
    void getCurrentToronto_cachesWithinTtl_fetchesOnlyOnce() {
        when(restTemplate.getForObject(anyString(), eq(Map.class))).thenReturn(cannedBody(0));

        weatherService.getCurrentToronto();
        weatherService.getCurrentToronto();

        verify(restTemplate, times(1)).getForObject(anyString(), eq(Map.class));
    }

    @Test
    void getCurrentToronto_onFailure_returnsEmptyWithoutThrowing() {
        when(restTemplate.getForObject(anyString(), eq(Map.class)))
            .thenThrow(new RestClientException("Open-Meteo down"));

        Optional<WeatherSnapshot> result = weatherService.getCurrentToronto();

        assertThat(result).isEmpty();
    }

    @Test
    void getCurrentToronto_afterSuccess_thenFailure_returnsStaleCache() {
        when(restTemplate.getForObject(anyString(), eq(Map.class)))
            .thenReturn(cannedBody(71))
            .thenThrow(new RestClientException("Open-Meteo down"));

        Optional<WeatherSnapshot> first = weatherService.getCurrentToronto();
        // Force TTL expiry so the second call re-fetches (and fails)
        ReflectionTestUtils.setField(weatherService, "cacheTtlSeconds", 0L);
        Optional<WeatherSnapshot> second = weatherService.getCurrentToronto();

        assertThat(first).isPresent();
        assertThat(second).isPresent();
        assertThat(second.get().condition()).isEqualTo("snow");
    }

    @Test
    void getCurrentToronto_whenDisabled_returnsEmptyAndSkipsHttp() {
        ReflectionTestUtils.setField(weatherService, "enabled", false);

        Optional<WeatherSnapshot> result = weatherService.getCurrentToronto();

        assertThat(result).isEmpty();
        verify(restTemplate, never()).getForObject(anyString(), eq(Map.class));
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
