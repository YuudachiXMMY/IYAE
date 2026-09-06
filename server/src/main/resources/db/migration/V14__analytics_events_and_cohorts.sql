-- Phase 9: A/B-cohort KPI instrumentation.
-- Deterministic cohort assignment per user + a first-party event log so conversion,
-- return, retention and size-bracket KPIs are queryable `GROUP BY cohort`.

CREATE TABLE cohort_assignments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    cohort VARCHAR(64) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_cohort_user UNIQUE (user_id),
    CONSTRAINT fk_cohort_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_cohort_cohort ON cohort_assignments (cohort);

CREATE TABLE analytics_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NULL,
    cohort VARCHAR(64) NULL,
    event_type VARCHAR(32) NOT NULL,
    product_id BIGINT NULL,
    order_id BIGINT NULL,
    size_bracket VARCHAR(16) NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_event_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_events_cohort_type ON analytics_events (cohort, event_type);
CREATE INDEX idx_events_created ON analytics_events (created_at);
CREATE INDEX idx_events_user ON analytics_events (user_id);
