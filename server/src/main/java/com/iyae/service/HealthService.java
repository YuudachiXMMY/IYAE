package com.iyae.service;

import com.iyae.ai.AIProviderFactory;
import com.iyae.config.BrandProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class HealthService {

    private final AIProviderFactory aiProviderFactory;
    private final BrandProperties brandProperties;
    private final DataSource dataSource;

    /**
     * Liveness only: the process is answering. Cheap and always 200 by design — it is the probe
     * that must not flap while the database is briefly unreachable.
     */
    public Map<String, String> getServerHealth() {
        return Map.of(
            "status", "UP",
            "service", brandProperties.serviceId()
        );
    }

    /**
     * Readiness: can this instance actually serve a request? It touches the database, because
     * every meaningful endpoint does.
     *
     * <p>This exists because the old single hardcoded-200 endpoint was simultaneously the
     * container healthcheck and the deploy script's only success signal, so a server with no
     * database — or one whose Flyway migration had failed — reported healthy and the deploy
     * declared success. A check that cannot fail is not a check.
     */
    public boolean isReady() {
        try (Connection connection = dataSource.getConnection()) {
            // isValid() round-trips to the server; it is not just a non-null handle from the pool.
            return connection.isValid(2);
        } catch (SQLException ex) {
            log.warn("Readiness probe failed: database is not reachable", ex);
            return false;
        }
    }

    public Map<String, String> getAiHealth() {
        String providerName = aiProviderFactory.getProviderName();
        String status = aiProviderFactory.healthCheck();
        return Map.of(
            "provider", providerName,
            "status", status
        );
    }
}
