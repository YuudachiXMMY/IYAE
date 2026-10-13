package com.iyae.service;

import com.iyae.ai.AIProviderFactory;
import com.iyae.config.BrandProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class HealthServiceTest {

    @Mock
    AIProviderFactory aiProviderFactory;

    @Mock
    BrandProperties brandProperties;

    @Mock
    DataSource dataSource;

    @InjectMocks
    HealthService healthService;

    @Test
    void getServerHealth_returnsUpStatus() {
        when(brandProperties.serviceId()).thenReturn("iyae-server");

        Map<String, String> result = healthService.getServerHealth();

        assertThat(result.get("status")).isEqualTo("UP");
        assertThat(result.get("service")).isEqualTo("iyae-server");
    }

    @Test
    void getAiHealth_returnsProviderNameAndStatus() {
        when(aiProviderFactory.getProviderName()).thenReturn("mock");
        when(aiProviderFactory.healthCheck()).thenReturn("UP");

        Map<String, String> result = healthService.getAiHealth();

        assertThat(result.get("provider")).isEqualTo("mock");
        assertThat(result.get("status")).isEqualTo("UP");
    }

    // ---- #42: readiness has to be able to say no ----

    @Test
    void isReady_whenConnectionValid_returnsTrue() throws Exception {
        Connection connection = org.mockito.Mockito.mock(Connection.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(2)).thenReturn(true);

        assertThat(healthService.isReady()).isTrue();
    }

    @Test
    void isReady_whenConnectionInvalid_returnsFalse() throws Exception {
        Connection connection = org.mockito.Mockito.mock(Connection.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(2)).thenReturn(false);

        assertThat(healthService.isReady()).isFalse();
    }

    @Test
    void isReady_whenDataSourceThrows_returnsFalseInsteadOfPropagating() throws Exception {
        // A readiness probe that 500s is still a probe that failed, but the container healthcheck
        // reads the status code, so answering false deliberately is clearer than throwing.
        when(dataSource.getConnection()).thenThrow(new SQLException("connection refused"));

        assertThat(healthService.isReady()).isFalse();
    }

    @Test
    void isReady_closesTheConnectionItTook() throws Exception {
        Connection connection = org.mockito.Mockito.mock(Connection.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(2)).thenReturn(true);

        healthService.isReady();

        // The probe runs every 15s from the container healthcheck; leaking a pooled connection
        // per call would exhaust the pool on its own.
        org.mockito.Mockito.verify(connection).close();
    }
}
