package com.iyae.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

/**
 * Delivers transactional emails (verification, password reset) exclusively through the
 * Next.js internal mail route, which renders the templates and sends via Resend.
 * <p>
 * The email HTML lives in a single place — {@code web/lib/email-templates.ts} — so this
 * service only forwards the mail {@code type} plus the recipient and action URL; it does
 * not build or send any HTML itself. A non-2xx response or transport failure surfaces as
 * {@link EmailDeliveryException} (mapped to HTTP 503 by the global handler); callers that
 * must not leak delivery status (registration, forgot-password) swallow it.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthMailService {

    @Value("${app.frontend.base-url}")
    private String frontendBaseUrl;

    @Value("${app.mail.resend-endpoint:}")
    private String resendEndpoint;

    @Value("${app.mail.internal-secret:}")
    private String internalMailSecret;

    /**
     * Sends an email verification email with a tokenized link via the Resend route.
     *
     * @param toEmail  recipient email address
     * @param name     recipient display name
     * @param rawToken the unencoded token to embed in the link
     */
    public void sendVerificationEmail(String toEmail, String name, String rawToken) {
        String verifyUrl = frontendBaseUrl + "/verify-email?token=" + rawToken;
        sendViaResend("verification", toEmail, name, verifyUrl);
    }

    /**
     * Sends a password-reset email with a tokenized link via the Resend route.
     *
     * @param toEmail  recipient email address
     * @param name     recipient display name
     * @param rawToken the unencoded token to embed in the link
     */
    public void sendPasswordResetEmail(String toEmail, String name, String rawToken) {
        String resetUrl = frontendBaseUrl + "/reset-password?token=" + rawToken;
        sendViaResend("password-reset", toEmail, name, resetUrl);
    }

    /**
     * Sends an email via the Next.js internal Resend route. Throws {@link EmailDeliveryException}
     * on any failure — including an unconfigured endpoint — so delivery can never silently no-op.
     *
     * @param type      mail type ("verification" or "password-reset")
     * @param toEmail   recipient email address
     * @param name      recipient display name
     * @param actionUrl CTA button URL (verify link or reset link)
     */
    private void sendViaResend(String type, String toEmail, String name, String actionUrl) {
        try {
            String json = """
                    {"type":"%s","toEmail":"%s","name":"%s","actionUrl":"%s"}"""
                    .formatted(
                            escapeJson(type),
                            escapeJson(toEmail),
                            escapeJson(name),
                            escapeJson(actionUrl)
                    );

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(resendEndpoint))
                    .header("Content-Type", "application/json")
                    .header("x-internal-mail-secret", internalMailSecret)
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();

            HttpResponse<String> response = HttpClient.newBuilder()
                    .version(HttpClient.Version.HTTP_1_1)
                    .build()
                    .send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.error("Resend mail endpoint returned {}: {}", response.statusCode(), response.body());
                throw new EmailDeliveryException(
                        "Resend endpoint returned " + response.statusCode(), null);
            }

            log.info("{} email sent via Resend to {}", type, toEmail);
        } catch (EmailDeliveryException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to send {} email via Resend to {}: {}", type, toEmail, e.getMessage(), e);
            throw new EmailDeliveryException("Failed to deliver email via Resend to " + toEmail, e);
        }
    }

    /** Minimal JSON string escaping to prevent injection in hand-built JSON payloads. */
    private String escapeJson(String input) {
        if (input == null) return "";
        return input
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
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
