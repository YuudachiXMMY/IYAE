package com.iyae.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verifies the Resend-only delivery path (Option A): {@link AuthMailService} POSTs to the
 * Next.js internal mail route and never sends HTML itself. Spins up an in-process
 * {@link HttpServer} that stands in for the Next.js route so the real HTTP call is exercised.
 */
class AuthMailServiceTest {

    private AuthMailService authMailService;
    private HttpServer server;
    private final AtomicInteger healthRequestCount = new AtomicInteger();
    private final AtomicReference<String> capturedHealthSecret = new AtomicReference<>();
    private final AtomicReference<String> healthBody = new AtomicReference<>(
            "{\"status\":\"UP\",\"transport\":\"UP\",\"lastSend\":{\"state\":\"never\"}}");
    private volatile int healthStatus = 200;

    private volatile int responseStatus = 200;
    private final AtomicInteger requestCount = new AtomicInteger();
    private final AtomicReference<String> capturedMethod = new AtomicReference<>();
    private final AtomicReference<String> capturedPath = new AtomicReference<>();
    private final AtomicReference<String> capturedSecret = new AtomicReference<>();
    private final AtomicReference<String> capturedBody = new AtomicReference<>();

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/api/internal/mail/send", exchange -> {
            requestCount.incrementAndGet();
            capturedMethod.set(exchange.getRequestMethod());
            capturedPath.set(exchange.getRequestURI().getPath());
            capturedSecret.set(exchange.getRequestHeaders().getFirst("x-internal-mail-secret"));
            capturedBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(responseStatus, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        // Sibling of /send on the same server, so checkMailHealth's URL derivation is exercised
        // by whether the request actually lands here — not by asserting on a string.
        server.createContext("/api/internal/mail/health", exchange -> {
            healthRequestCount.incrementAndGet();
            capturedHealthSecret.set(exchange.getRequestHeaders().getFirst("x-internal-mail-secret"));
            byte[] body = healthBody.get().getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(healthStatus, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();
        String endpointUrl = "http://localhost:" + server.getAddress().getPort() + "/api/internal/mail/send";

        authMailService = new AuthMailService(new ObjectMapper());
        ReflectionTestUtils.setField(authMailService, "frontendBaseUrl", "http://localhost:3000");
        ReflectionTestUtils.setField(authMailService, "internalMailEndpoint", endpointUrl);
        ReflectionTestUtils.setField(authMailService, "internalMailSecret", "test-secret");
    }

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void sendVerificationEmail_postsVerificationPayloadToResendEndpoint() {
        authMailService.sendVerificationEmail("user@example.com", "Test User", "rawtoken123");

        assertThat(requestCount.get()).isEqualTo(1);
        assertThat(capturedMethod.get()).isEqualTo("POST");
        assertThat(capturedPath.get()).isEqualTo("/api/internal/mail/send");
        assertThat(capturedSecret.get()).isEqualTo("test-secret");
        assertThat(capturedBody.get())
                .contains("\"type\":\"verification\"")
                .contains("\"toEmail\":\"user@example.com\"")
                .contains("\"name\":\"Test User\"")
                .contains("/verify-email?token=rawtoken123");
    }

    @Test
    void sendPasswordResetEmail_postsPasswordResetPayloadToResendEndpoint() {
        authMailService.sendPasswordResetEmail("user@example.com", "Test User", "resettoken456");

        assertThat(requestCount.get()).isEqualTo(1);
        assertThat(capturedMethod.get()).isEqualTo("POST");
        assertThat(capturedBody.get())
                .contains("\"type\":\"password-reset\"")
                .contains("\"toEmail\":\"user@example.com\"")
                .contains("/reset-password?token=resettoken456");
    }

    @Test
    void sendViaMailRoute_escapesQuotesInName() {
        authMailService.sendVerificationEmail("user@example.com", "Ann \"Q\" Lee", "tok");

        // Embedded quotes must be JSON-escaped so the serialized payload stays valid.
        assertThat(capturedBody.get()).contains("\"name\":\"Ann \\\"Q\\\" Lee\"");
    }

    @Test
    void sendVerificationEmail_non2xxResponse_throwsEmailDeliveryException() {
        responseStatus = 500;

        assertThatThrownBy(() ->
                authMailService.sendVerificationEmail("user@example.com", "Test User", "tok"))
                .isInstanceOf(AuthMailService.EmailDeliveryException.class);
    }

    @Test
    void sendVerificationEmail_endpointUnreachable_throwsEmailDeliveryException() {
        // Point at a closed port so the HTTP client cannot connect.
        ReflectionTestUtils.setField(authMailService, "internalMailEndpoint",
                "http://localhost:1/api/internal/mail/send");

        assertThatThrownBy(() ->
                authMailService.sendVerificationEmail("user@example.com", "Test User", "tok"))
                .isInstanceOf(AuthMailService.EmailDeliveryException.class);
    }

    @Test
    void sendVerificationEmail_blankEndpoint_throwsEmailDeliveryException() {
        // Option A removes the SMTP fallback: an unconfigured endpoint must fail loudly,
        // never silently no-op.
        ReflectionTestUtils.setField(authMailService, "internalMailEndpoint", "");

        assertThatThrownBy(() ->
                authMailService.sendVerificationEmail("user@example.com", "Test User", "tok"))
                .isInstanceOf(AuthMailService.EmailDeliveryException.class);
    }

    @Test
    void sendVerificationEmail_slowEndpoint_timesOut_throwsEmailDeliveryException() {
        // A hung route must fail via the request timeout, never block the caller indefinitely.
        server.removeContext("/api/internal/mail/send");
        server.createContext("/api/internal/mail/send", exchange -> {
            try {
                Thread.sleep(2000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            exchange.close();
        });
        ReflectionTestUtils.setField(authMailService, "requestTimeout", Duration.ofMillis(200));

        assertThatThrownBy(() ->
                authMailService.sendVerificationEmail("user@example.com", "Test User", "tok"))
                .isInstanceOf(AuthMailService.EmailDeliveryException.class);
    }

    // ---- B-10 alerting half: checkMailHealth ----

    @Test
    void checkMailHealth_reachesTheHealthSiblingOfTheSendEndpoint() {
        // The health URL is derived from the configured send URL rather than being a second
        // environment variable, because two values that must agree is the drift this codebase
        // keeps paying for. This passes only if the derived path actually resolves.
        AuthMailService.MailHealth health = authMailService.checkMailHealth();

        assertThat(healthRequestCount.get()).isEqualTo(1);
        assertThat(health.healthy()).isTrue();
        assertThat(health.transport()).isEqualTo("UP");
        assertThat(health.lastSend()).isEqualTo("never");
    }

    @Test
    void checkMailHealth_sendsTheSharedSecret() {
        authMailService.checkMailHealth();
        assertThat(capturedHealthSecret.get()).isEqualTo("test-secret");
    }

    @Test
    void checkMailHealth_derivesTheUrlWhenTheEndpointHasNoSendSuffix() {
        // Tolerates a configured base URL as well as the conventional /send one.
        ReflectionTestUtils.setField(authMailService, "internalMailEndpoint",
                "http://localhost:" + server.getAddress().getPort() + "/api/internal/mail");

        AuthMailService.MailHealth health = authMailService.checkMailHealth();

        assertThat(healthRequestCount.get()).isEqualTo(1);
        assertThat(health.healthy()).isTrue();
    }

    @Test
    void checkMailHealth_reportsUnhealthyWhenTheRouteSaysDown() {
        healthBody.set("{\"status\":\"DOWN\",\"transport\":\"DOWN\","
                + "\"transportReason\":\"ECONNREFUSED\",\"lastSend\":{\"state\":\"never\"}}");

        AuthMailService.MailHealth health = authMailService.checkMailHealth();

        assertThat(health.healthy()).isFalse();
        assertThat(health.transport()).isEqualTo("DOWN");
        assertThat(health.detail()).contains("ECONNREFUSED");
    }

    @Test
    void checkMailHealth_reportsUnhealthyWhenTheTransportIsUpButTheLastSendFailed() {
        // The case a connect-and-authenticate probe cannot see on its own: the transport is
        // fine and the mail server refuses to relay for the sending domain.
        healthBody.set("{\"status\":\"DOWN\",\"transport\":\"UP\",\"lastSend\":"
                + "{\"state\":\"failed\",\"at\":\"2026-10-15T00:00:00Z\","
                + "\"reason\":\"550 relay not permitted\"}}");

        AuthMailService.MailHealth health = authMailService.checkMailHealth();

        assertThat(health.healthy()).isFalse();
        assertThat(health.transport()).isEqualTo("UP");
        assertThat(health.lastSend()).isEqualTo("failed");
    }

    @Test
    void checkMailHealth_treatsANon2xxAsUnhealthyRatherThanThrowing() {
        // The caller is a health endpoint and a scheduled canary. Both want a verdict; an
        // exception here would turn a monitoring signal into a 500.
        healthStatus = 503;

        AuthMailService.MailHealth health = authMailService.checkMailHealth();

        assertThat(health.healthy()).isFalse();
        assertThat(health.detail()).contains("503");
    }

    @Test
    void checkMailHealth_treatsAnUnreachableRouteAsUnhealthy() {
        ReflectionTestUtils.setField(authMailService, "internalMailEndpoint",
                "http://localhost:1/api/internal/mail/send");

        AuthMailService.MailHealth health = authMailService.checkMailHealth();

        assertThat(health.healthy()).isFalse();
        assertThat(health.transport()).isEqualTo("UNKNOWN");
    }

    @Test
    void checkMailHealth_treatsAnUnconfiguredEndpointAsUnhealthy() {
        // Not "no news is good news": an unconfigured mail path is precisely the B-10 state.
        ReflectionTestUtils.setField(authMailService, "internalMailEndpoint", "");

        AuthMailService.MailHealth health = authMailService.checkMailHealth();

        assertThat(health.healthy()).isFalse();
        assertThat(health.detail()).contains("INTERNAL_MAIL_ENDPOINT");
        assertThat(healthRequestCount.get()).isZero();
    }

    @Test
    void checkMailHealth_toleratesAMalformedBody() {
        healthBody.set("not json at all");

        AuthMailService.MailHealth health = authMailService.checkMailHealth();

        assertThat(health.healthy()).isFalse();
    }
}
