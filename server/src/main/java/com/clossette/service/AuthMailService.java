package com.clossette.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthMailService {

    private final JavaMailSender mailSender;

    @Value("${app.frontend.base-url}")
    private String frontendBaseUrl;

    @Value("${app.mail.from}")
    private String fromAddress;

    @Value("${app.mail.resend-endpoint:}")
    private String resendEndpoint;

    @Value("${app.mail.internal-secret:}")
    private String internalMailSecret;

    /**
     * Sends an email verification email with a tokenized link.
     * <p>
     * When {@code app.mail.resend-endpoint} is configured, attempts delivery via the
     * Next.js internal mail route (Resend API). Falls back to JavaMailSender if the
     * endpoint is not set or if the Resend call fails.
     *
     * @param toEmail  recipient email address
     * @param name     recipient display name
     * @param rawToken the unencoded token to embed in the link
     */
    public void sendVerificationEmail(String toEmail, String name, String rawToken) {
        String verifyUrl = frontendBaseUrl + "/verify-email?token=" + rawToken;
        if (resendEndpoint != null && !resendEndpoint.isBlank()) {
            try {
                sendViaResend("verification", toEmail, name, verifyUrl);
                return;
            } catch (EmailDeliveryException e) {
                log.error("Resend delivery failed for verification (endpoint={}), falling back to SMTP: {}",
                        resendEndpoint, e.getMessage());
            }
        }
        String html = buildEmailHtml(
                "Verify your Clossette account",
                "Hi " + escapeHtml(name) + ",",
                "Thanks for joining Clossette! Please verify your email address to complete your registration.",
                verifyUrl,
                "Verify Email Address",
                null
        );
        sendHtmlEmail(toEmail, "Verify your Clossette account", html);
    }

    /**
     * Sends a password-reset email with a tokenized link.
     * <p>
     * When {@code app.mail.resend-endpoint} is configured, attempts delivery via the
     * Next.js internal mail route (Resend API). Falls back to JavaMailSender if the
     * endpoint is not set or if the Resend call fails.
     *
     * @param toEmail  recipient email address
     * @param name     recipient display name
     * @param rawToken the unencoded token to embed in the link
     */
    public void sendPasswordResetEmail(String toEmail, String name, String rawToken) {
        String resetUrl = frontendBaseUrl + "/reset-password?token=" + rawToken;
        if (resendEndpoint != null && !resendEndpoint.isBlank()) {
            try {
                sendViaResend("password-reset", toEmail, name, resetUrl);
                return;
            } catch (EmailDeliveryException e) {
                log.error("Resend delivery failed for password-reset (endpoint={}), falling back to SMTP: {}",
                        resendEndpoint, e.getMessage());
            }
        }
        String html = buildEmailHtml(
                "Reset your Clossette password",
                "Hi " + escapeHtml(name) + ",",
                "We received a request to reset your password. Click the button below to choose a new one.",
                resetUrl,
                "Reset Password",
                "This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email."
        );
        sendHtmlEmail(toEmail, "Reset your Clossette password", html);
    }

    /**
     * Sends an email via the Next.js internal Resend route.
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

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    private void sendHtmlEmail(String toEmail, String subject, String html) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromAddress);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(html, true);
            mailSender.send(message);
        } catch (MailException | MessagingException e) {
            log.error("Failed to send email to {}: {}", toEmail, e.getMessage(), e);
            throw new EmailDeliveryException("Failed to deliver email to " + toEmail, e);
        }
    }

    /**
     * Builds a branded HTML email template using Clossette purple (#9333ea) accent.
     *
     * @param title      browser/preview title
     * @param greeting   first-line greeting text (already safe to embed)
     * @param bodyText   main paragraph text
     * @param actionUrl  CTA button href
     * @param actionText CTA button label
     * @param footnote   optional footnote below the button (null to omit)
     */
    private String buildEmailHtml(
            String title,
            String greeting,
            String bodyText,
            String actionUrl,
            String actionText,
            String footnote
    ) {
        String footnoteBlock = footnote != null
                ? "<p style=\"margin:24px 0 0;font-size:13px;color:#78716c;\">" + escapeHtml(footnote) + "</p>"
                : "";

        return """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8"/>
                  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                  <title>%s</title>
                </head>
                <body style="margin:0;padding:0;background-color:#fdf8f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding:40px 16px;">
                        <table role="presentation" width="560" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
                          <!-- Header -->
                          <tr>
                            <td style="background:#9333ea;padding:32px 40px;text-align:center;">
                              <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Clossette</span>
                            </td>
                          </tr>
                          <!-- Body -->
                          <tr>
                            <td style="padding:40px 40px 32px;">
                              <p style="margin:0 0 16px;font-size:16px;color:#292524;font-weight:600;">%s</p>
                              <p style="margin:0 0 32px;font-size:15px;line-height:1.6;color:#57534e;">%s</p>
                              <!-- CTA Button -->
                              <table role="presentation" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td style="border-radius:10px;background:#9333ea;">
                                    <a href="%s"
                                       style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                                      %s
                                    </a>
                                  </td>
                                </tr>
                              </table>
                              %s
                            </td>
                          </tr>
                          <!-- Footer -->
                          <tr>
                            <td style="background:#fdf8f6;padding:20px 40px;text-align:center;">
                              <p style="margin:0;font-size:12px;color:#a8a29e;">
                                &copy; 2026 Clossette. All rights reserved.
                              </p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(
                escapeHtml(title),
                greeting,
                escapeHtml(bodyText),
                actionUrl,
                escapeHtml(actionText),
                footnoteBlock
        );
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

    /** Minimal HTML escaping to prevent injection in user-supplied strings. */
    private String escapeHtml(String input) {
        if (input == null) return "";
        return input
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#x27;");
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
