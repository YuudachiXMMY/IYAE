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
 * @param drapeDeployCutoff ISO-8601 instant of the Phase 1-3 drape deploy, used as the default
 *                          split point for the Phase 4 pre/post drape-decision endpoint. Blank
 *                          means the endpoint requires an explicit {@code ?cutoff=} query param.
 */
@ConfigurationProperties("app.analytics")
public record AnalyticsProperties(
        boolean enabled,
        List<String> cohorts,
        String drapeDeployCutoff
) {
    public AnalyticsProperties {
        cohorts = (cohorts == null || cohorts.isEmpty()) ? List.of("control", "variant") : cohorts;
    }
}
