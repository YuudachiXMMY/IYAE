package com.iyae.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Central, environment-overridable source for the server's brand-derived values, so the
 * same literal is never duplicated across services. Previously the health service id and
 * the guest sentinel email were each hardcoded in two places (drift risk); they now bind
 * from {@code app.brand.*} in {@code application.yml}.
 * <p>
 * User-visible brand copy (wordmarks, email subjects/templates) lives in
 * {@code web/lib/brand.ts}; server-side narrative copy (AI prompts, welcome lines) is left
 * inline since it is prose, not configuration.
 *
 * @param domain      registrable brand domain, e.g. {@code iyae.ca} — backs seed-user emails
 * @param serviceId   service identifier reported by {@code /api/health}, e.g. {@code iyae-server}
 * @param guestEmail  internal sentinel address for anonymous avatar generation
 */
@ConfigurationProperties("app.brand")
public record BrandProperties(
        String domain,
        String serviceId,
        String guestEmail
) {
}
