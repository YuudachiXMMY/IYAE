package com.iyae.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

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
