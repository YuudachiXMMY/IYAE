package com.iyae.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Delivers transactional emails (verification, password reset) exclusively through the
 * Next.js internal mail route, which renders the templates and hands the message to SMTP.
 * <p>
 * The email HTML lives in a single place — {@code web/lib/email-templates.ts} — so this
 * service only forwards the mail {@code type} plus the recipient and action URL; it does
 * not build or send any HTML itself. A non-2xx response or transport failure surfaces as
 * {@link EmailDeliveryException} (mapped to HTTP 503 by the global handler); callers that
 * must not leak delivery status (registration, forgot-password) swallow it.
 * <p>
 * Both the connect and per-request timeouts are bounded so a slow or hung mail route can
 * never block the calling request thread indefinitely — the removed SMTP path carried an
 * explicit 5s timeout, and this is now the sole delivery path.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthMailService {

    /** Shared, immutable client — reused across sends; bounds connection setup time. */
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private final ObjectMapper objectMapper;

    @Value("${app.frontend.base-url}")
    private String frontendBaseUrl;

    @Value("${app.mail.internal-endpoint:}")
    private String internalMailEndpoint;

    @Value("${app.mail.internal-secret:}")
    private String internalMailSecret;

    /** Per-request read timeout; a hung route fails with {@link EmailDeliveryException} rather than blocking. */
    private Duration requestTimeout = Duration.ofSeconds(10);

    /** What {@link #checkMailHealth()} found, as the mail route reported it. */
    public record MailHealth(boolean healthy, String transport, String lastSend, String detail) {
        static MailHealth unreachable(String detail) {
            return new MailHealth(false, "UNKNOWN", "UNKNOWN", detail);
        }
    }

    /**
     * Asks the mail route whether delivery actually works. B-10's alerting half.
     *
     * <p>Reaches the route's health sibling, which reports two things the server cannot see for
     * itself: whether the SMTP transport connects and authenticates, and how the last real
     * delivery went. Neither alone is enough — a transport that authenticates is still refused
     * when the sending domain is not registered on the mail server, and an instance that has
     * never sent anything has no delivery history to judge.
     *
     * <p>Never throws. An unreachable route is itself an unhealthy answer, not an error to
     * propagate: the caller is a health endpoint and a scheduled canary, and both want a verdict.
     */
    public MailHealth checkMailHealth() {
        if (internalMailEndpoint == null || internalMailEndpoint.isBlank()) {
            return MailHealth.unreachable("INTERNAL_MAIL_ENDPOINT is not configured");
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(healthEndpoint()))
                    .timeout(requestTimeout)
                    .header("x-internal-mail-secret", internalMailSecret == null ? "" : internalMailSecret)
                    .GET()
                    .build();
            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return MailHealth.unreachable("mail route returned " + response.statusCode());
            }
            Map<String, Object> body = objectMapper.readValue(
                    response.body(), new TypeReference<Map<String, Object>>() {});
            String transport = String.valueOf(body.getOrDefault("transport", "UNKNOWN"));
            Object lastSendNode = body.get("lastSend");
            // `getOrDefault` on a wildcard Map will not take a String default, so read then
            // fall back rather than fighting the capture type.
            String lastSend = lastSendNode instanceof Map<?, ?> m && m.get("state") != null
                    ? String.valueOf(m.get("state"))
                    : "UNKNOWN";
            boolean healthy = "UP".equals(String.valueOf(body.getOrDefault("status", "DOWN")));
            String detail = String.valueOf(body.getOrDefault("transportReason", ""));
            return new MailHealth(healthy, transport, lastSend, detail);
        } catch (IOException | InterruptedException | RuntimeException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return MailHealth.unreachable(e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
        }
    }

    /**
     * The health sibling of the send endpoint, derived rather than configured.
     *
     * <p>A second environment variable holding the same base URL is two values that must agree,
     * which is the drift this codebase keeps paying for. One variable, one derivation.
     */
    private String healthEndpoint() {
        String endpoint = internalMailEndpoint;
        return endpoint.endsWith("/send")
                ? endpoint.substring(0, endpoint.length() - "/send".length()) + "/health"
                : endpoint + "/health";
    }

    /**
     * Sends an email verification email with a tokenized link via the internal mail route.
     *
     * @param toEmail  recipient email address
     * @param name     recipient display name
     * @param rawToken the unencoded token to embed in the link
     */
    public void sendVerificationEmail(String toEmail, String name, String rawToken) {
        String verifyUrl = frontendBaseUrl + "/verify-email?token=" + rawToken;
        sendViaMailRoute("verification", toEmail, name, verifyUrl);
    }

    /**
     * Sends a password-reset email with a tokenized link via the internal mail route.
     *
     * @param toEmail  recipient email address
     * @param name     recipient display name
     * @param rawToken the unencoded token to embed in the link
     */
    public void sendPasswordResetEmail(String toEmail, String name, String rawToken) {
        String resetUrl = frontendBaseUrl + "/reset-password?token=" + rawToken;
        sendViaMailRoute("password-reset", toEmail, name, resetUrl);
    }

    /**
     * Sends an email via the Next.js internal mail route. Throws {@link EmailDeliveryException}
     * on any failure — including an unconfigured endpoint or a timeout — so delivery can never
     * silently no-op or hang the caller.
     *
     * @param type      mail type ("verification" or "password-reset")
     * @param toEmail   recipient email address
     * @param name      recipient display name
     * @param actionUrl CTA button URL (verify link or reset link)
     */
    private void sendViaMailRoute(String type, String toEmail, String name, String actionUrl) {
        try {
            // Build the payload with a real serializer so all JSON metacharacters and control
            // characters are escaped correctly (no hand-rolled escaping).
            Map<String, String> payload = new LinkedHashMap<>();
            payload.put("type", type);
            payload.put("toEmail", toEmail == null ? "" : toEmail);
            payload.put("name", name == null ? "" : name);
            payload.put("actionUrl", actionUrl == null ? "" : actionUrl);
            String json = objectMapper.writeValueAsString(payload);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(internalMailEndpoint))
                    .timeout(requestTimeout)
                    .header("Content-Type", "application/json")
                    .header("x-internal-mail-secret", internalMailSecret)
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.error("Internal mail route returned {}: {}", response.statusCode(), response.body());
                throw new EmailDeliveryException(
                        "Internal mail route returned " + response.statusCode(), null);
            }

            log.info("{} email accepted by the mail route for {}", type, toEmail);
        } catch (EmailDeliveryException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to send {} email to {}: {}", type, toEmail, e.getMessage(), e);
            throw new EmailDeliveryException("Failed to deliver email to " + toEmail, e);
        }
    }

    // -------------------------------------------------------------------------
    // Inner exception type
    // -------------------------------------------------------------------------

    public static class EmailDeliveryException extends RuntimeException {
        public EmailDeliveryException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
