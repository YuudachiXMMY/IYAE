package com.iyae.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Fails startup on a production configuration that is silently broken.
 *
 * <p>Each of these previously started cleanly and then failed at the point of use, where it was
 * invisible:
 *
 * <ul>
 *   <li>Blank {@code CORS_ORIGINS} — the browser blocks every state-changing request. The
 *       compose file passes {@code ${CORS_ORIGINS}} with no default, so forgetting it is the
 *       easy path.
 *   <li>{@code FRONTEND_BASE_URL} left at its {@code localhost:3000} default — every
 *       verification link, password-reset link and checkout redirect points at the operator's
 *       own machine. Users cannot verify their email, so they cannot use the product at all.
 *   <li>The dev fallback {@code INTERNAL_MAIL_SECRET} — the shared secret guarding the
 *       server→web mail route is published in the compose file.
 *   <li>Blank {@code RESEND_MAIL_ENDPOINT} — mail delivery throws on every send.
 * </ul>
 *
 * <p>Refusing to boot is deliberate: these are not degraded modes, they are a deployment that
 * cannot register a user. A container that will not start is noticed; one that starts and
 * bounces every signup is not. This is distinct from payment being off, which is an intentional
 * launch decision and therefore a 503 rather than a boot failure.
 */
@Slf4j
@Component
@Profile("prod")
@RequiredArgsConstructor
public class ProductionConfigValidator {

    /** Shipped in docker-compose.yml as the dev default; must never reach production. */
    private static final String DEV_MAIL_SECRET = "dev-internal-secret";

    @Value("${app.cors.origins:}")
    private String corsOrigins;

    @Value("${app.frontend.base-url:}")
    private String frontendBaseUrl;

    @Value("${app.mail.internal-secret:}")
    private String internalMailSecret;

    @Value("${app.mail.resend-endpoint:}")
    private String resendMailEndpoint;

    @PostConstruct
    void validate() {
        List<String> problems = new ArrayList<>();

        if (isBlank(corsOrigins)) {
            problems.add("CORS_ORIGINS is empty — the browser will block every state-changing "
                    + "request (login, checkout, posting). Set it to your site's origin(s).");
        } else if (corsOrigins.contains("localhost") || corsOrigins.contains("127.0.0.1")) {
            problems.add("CORS_ORIGINS contains a loopback origin (" + corsOrigins
                    + ") — real browsers will be refused.");
        }

        if (isBlank(frontendBaseUrl)) {
            problems.add("FRONTEND_BASE_URL is empty — verification and password-reset emails "
                    + "would contain unusable links.");
        } else if (frontendBaseUrl.contains("localhost") || frontendBaseUrl.contains("127.0.0.1")) {
            problems.add("FRONTEND_BASE_URL is " + frontendBaseUrl + " — every verification link, "
                    + "password-reset link and checkout redirect would point at the server host "
                    + "instead of the site. No user could verify their email.");
        }

        if (isBlank(internalMailSecret)) {
            problems.add("INTERNAL_MAIL_SECRET is empty — the server cannot authenticate to the "
                    + "mail route, so email verification and password reset fail silently.");
        } else if (DEV_MAIL_SECRET.equals(internalMailSecret)) {
            problems.add("INTERNAL_MAIL_SECRET is still the published dev default — anyone can "
                    + "drive the internal mail route. Generate a real secret.");
        }

        if (isBlank(resendMailEndpoint)) {
            problems.add("RESEND_MAIL_ENDPOINT is empty — every email send throws.");
        }

        if (!problems.isEmpty()) {
            problems.forEach(p -> log.error("Production configuration error: {}", p));
            throw new IllegalStateException("Refusing to start: " + problems.size()
                    + " production configuration error(s). See the errors logged above.");
        }
        log.info("Production configuration validated");
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
