package com.iyae.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Rate-limiting configuration, bound from {@code app.rate-limit.*} and auto-discovered
 * via {@code @ConfigurationPropertiesScan} on {@code IyaeApplication}.
 *
 * @param trustedProxies IPs and/or CIDR ranges (e.g. {@code 172.16.0.0/12}) whose
 *                       X-Forwarded-For header is trusted for client-IP resolution.
 *                       Empty ⇒ always use {@code request.getRemoteAddr()}.
 * @param enabled        master switch; when false the filter passes all requests through.
 */
@ConfigurationProperties("app.rate-limit")
public record RateLimitProperties(
        List<String> trustedProxies,
        boolean enabled
) {
    public RateLimitProperties {
        trustedProxies = trustedProxies == null ? List.of() : trustedProxies;
    }
}
