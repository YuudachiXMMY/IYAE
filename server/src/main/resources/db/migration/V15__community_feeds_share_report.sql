-- V15: Community feeds (city/topic dimensions) + Share-a-Look linkage + user reports + comment moderation
-- Phase 6. Mirrors the DDL style of V8__community_tables.sql (CREATE TABLE + FK + UNIQUE + INDEX).
-- NOTE: the test suite runs H2 with Flyway disabled (schema from Hibernate); this file is only
-- exercised against real MySQL via ./dev.sh, so entity/column parity is validated at boot.

-- Feed dimensions + Share-a-Look linkage on posts
ALTER TABLE posts
    ADD COLUMN city VARCHAR(120) NULL,
    ADD COLUMN topic VARCHAR(60) NULL,
    ADD COLUMN saved_look_id BIGINT NULL,
    ADD COLUMN product_ids JSON NULL,
    ADD CONSTRAINT fk_posts_saved_look FOREIGN KEY (saved_look_id) REFERENCES saved_looks(id);

-- Feed queries always constrain status; index the (status, city) and (status, topic) pairs
CREATE INDEX idx_posts_status_city ON posts(status, city);
CREATE INDEX idx_posts_status_topic ON posts(status, topic);

-- Author city backs the Toronto feed
ALTER TABLE users
    ADD COLUMN city VARCHAR(120) NULL;

-- Comment moderation (hide/remove) without hard delete
ALTER TABLE post_comments
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN deleted_at TIMESTAMP NULL;

-- User report intake feeding the admin moderation queue
CREATE TABLE post_reports (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    reporter_id BIGINT NOT NULL,
    reason VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_id) REFERENCES users(id),
    UNIQUE KEY uk_post_reports_post_reporter (post_id, reporter_id)
);

CREATE INDEX idx_post_reports_status ON post_reports(status, created_at DESC);
