package com.iyae.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * A/B-cohort analytics configuration, bound from {@code app.analytics.*} and auto-discovered
 * via {@code @ConfigurationPropertiesScan} on {@code IyaeApplication}.
 *
 * @param enabled when false, event recording is a no-op.
 * @param cohorts the experiment cohort names users are deterministically bucketed into
 *                (defaults to {@code [control, variant]} when unset/empty).
 */
@ConfigurationProperties("app.analytics")
public record AnalyticsProperties(
        boolean enabled,
        List<String> cohorts
) {
    public AnalyticsProperties {
        cohorts = (cohorts == null || cohorts.isEmpty()) ? List.of("control", "variant") : cohorts;
    }
}
