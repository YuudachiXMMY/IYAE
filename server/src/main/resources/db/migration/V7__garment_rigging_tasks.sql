CREATE TABLE rigging_tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    garment_asset_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    user_id BIGINT NULL,
    source_glb_url VARCHAR(500) NOT NULL,
    avatar_glb_url VARCHAR(500) NULL,
    slot_hint ENUM('TOP','BOTTOM','DRESS') NOT NULL,
    status ENUM('PENDING','RUNNING','READY','FAILED','MATERIALIZED') NOT NULL DEFAULT 'PENDING',
    provider VARCHAR(50),
    input_payload JSON,
    output_payload JSON,
    error_message TEXT,
    failure_code VARCHAR(100),
    attempt_count INT DEFAULT 0,
    claimed_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (garment_asset_id) REFERENCES garment_assets(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_rigging_tasks_status (status),
    INDEX idx_rigging_tasks_garment_asset (garment_asset_id),
    INDEX idx_rigging_tasks_product_user (product_id, user_id),
    INDEX idx_rigging_tasks_created_at (created_at)
);

ALTER TABLE garment_assets
    ADD COLUMN rigged_glb_url VARCHAR(500) NULL,
    ADD COLUMN rigging_status VARCHAR(50) DEFAULT 'NONE',
    ADD COLUMN rigging_error_message TEXT NULL,
    ADD COLUMN rigging_failure_code VARCHAR(100) NULL,
    ADD COLUMN rigged_at TIMESTAMP NULL;
