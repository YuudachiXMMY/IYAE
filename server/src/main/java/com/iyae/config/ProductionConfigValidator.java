package com.iyae.config;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
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
 *   <li>Blank {@code INTERNAL_MAIL_ENDPOINT} — mail delivery throws on every send.
 * </ul>
 *
 * <p>Refusing to boot is deliberate: these are not degraded modes, they are a deployment that
 * cannot register a user. A container that will not start is noticed; one that starts and
 * bounces every signup is not. This is distinct from payment being off, which is an intentional
 * launch decision and therefore a 503 rather than a boot failure.
 *
 * <p>This bean is NOT {@code @Profile("prod")}. It was, and that made every check above depend on
 * {@code SPRING_PROFILES_ACTIVE} being spelled exactly {@code prod}: a deploy that forgot the
 * variable, or set {@code production}, skipped the whole class in silence — the same
 * profile-name fragility this codebase already hit in {@code DataSeeder}. It now always loads and
 * decides from the active profiles: validate under {@code prod}, stay quiet under a recognised
 * {@code dev}/{@code test} profile, and log loudly when none of them is active, because an
 * unrecognised profile in a container is far more likely to be a missing variable than a
 * deliberate choice.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProductionConfigValidator {

    /** Shipped in docker-compose.yml as the dev default; must never reach production. */
    private static final String DEV_MAIL_SECRET = "dev-internal-secret";

    /** Profiles under which skipping production validation is the correct behaviour. */
    private static final List<String> NON_PROD_PROFILES = List.of("dev", "test");

    private final Environment environment;

    @Value("${app.cors.origins:}")
    private String corsOrigins;

    @Value("${app.frontend.base-url:}")
    private String frontendBaseUrl;

    @Value("${app.mail.internal-secret:}")
    private String internalMailSecret;

    @Value("${app.mail.internal-endpoint:}")
    private String internalMailEndpoint;

    @Value("${STRIPE_SECRET_KEY:}")
    private String stripeSecretKey;

    @Value("${STRIPE_WEBHOOK_SECRET:}")
    private String stripeWebhookSecret;

    @PostConstruct
    void validate() {
        List<String> active = List.of(environment.getActiveProfiles());
        if (!active.contains("prod")) {
            if (active.stream().noneMatch(NON_PROD_PROFILES::contains)) {
                log.error("No recognised Spring profile is active (active={}), so production "
                        + "configuration was NOT validated. If this is production, set "
                        + "SPRING_PROFILES_ACTIVE=prod — every check in ProductionConfigValidator "
                        + "has been skipped, including the CORS, frontend-URL, mail-secret and "
                        + "Stripe-pair checks that otherwise fail startup.", active);
            }
            return;
        }

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

        if (isBlank(internalMailEndpoint)) {
            problems.add("INTERNAL_MAIL_ENDPOINT is empty — every email send throws.");
        }

        // Both-or-neither, enforced here as well as in prod_deploy.sh, because an operator who
        // brings the stack up with plain `docker compose` never runs that script. Unlike the
        // checks above, neither-set is fine: that is launch #1's intentional payment-off mode.
        // One-set is not: CheckoutService treats it as disabled (503), so a deployment that
        // believes it has enabled payment would silently sell nothing.
        if (isBlank(stripeSecretKey) != isBlank(stripeWebhookSecret)) {
            problems.add(isBlank(stripeWebhookSecret)
                    ? "STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is not. A key without a "
                      + "webhook secret cannot fulfil what it charges, so checkout stays 503. "
                      + "Supply both to enable payment, or neither to keep it off."
                    : "STRIPE_WEBHOOK_SECRET is set but STRIPE_SECRET_KEY is not — supply both or "
                      + "neither.");
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
