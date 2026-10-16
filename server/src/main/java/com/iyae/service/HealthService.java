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
    private final AuthMailService authMailService;

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

    /**
     * Whether transactional email can actually be delivered. B-10's alerting half.
     *
     * <p>Shaped like {@link #isReady()} and deliberately not like {@link #getAiHealth()}: the
     * caller maps this to a 503, because an endpoint that always answers 200 with the verdict in
     * the body cannot be alarmed on by an HTTP uptime monitor without keyword matching. The
     * comment on this class already states the principle - a check that cannot fail is not a
     * check.
     *
     * <p>The payload is coarse on purpose. {@code /api/health/**} is {@code permitAll}, so this
     * is readable by anyone; it reports whether delivery works and nothing about the host,
     * credentials or sending domain. The detail stays in the logs and in the internal route.
     */
    public MailHealthView getMailHealth() {
        AuthMailService.MailHealth health = authMailService.checkMailHealth();
        return new MailHealthView(
                health.healthy(),
                Map.of(
                        "status", health.healthy() ? "UP" : "DOWN",
                        "transport", health.transport(),
                        "lastSend", health.lastSend()));
    }

    /** Verdict plus the body to render, so the controller does not re-derive the status code. */
    public record MailHealthView(boolean healthy, Map<String, String> body) {}

    public Map<String, String> getAiHealth() {
        String providerName = aiProviderFactory.getProviderName();
        String status = aiProviderFactory.healthCheck();
        return Map.of(
            "provider", providerName,
            "status", status
        );
    }
}
