CREATE TABLE avatar_generation_tasks (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    status ENUM('PENDING','RUNNING','READY','FAILED','MATERIALIZED') NOT NULL DEFAULT 'PENDING',
    provider VARCHAR(50),
    input_payload JSON,
    output_payload JSON,
    error_message TEXT,
    attempt_count INT DEFAULT 0,
    claimed_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_avatar_tasks_status (status),
    INDEX idx_avatar_tasks_user (user_id)
);

ALTER TABLE users ADD COLUMN avatar_glb_url VARCHAR(500) NULL;
