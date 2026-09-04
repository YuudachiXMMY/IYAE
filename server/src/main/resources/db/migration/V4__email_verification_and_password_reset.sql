-- V4: Email verification fields on users + password_reset_tokens table

-- 1. Add email verification columns to users
ALTER TABLE users
    ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN verification_token VARCHAR(64) NULL,
    ADD COLUMN verification_token_expires_at DATETIME NULL;

-- 2. Mark seed users as already verified
UPDATE users
SET email_verified = TRUE
WHERE email IN (
    'luna@clossette.com',
    'marco@clossette.com',
    'aria@clossette.com',
    'emma@clossette.com',
    'james@clossette.com'
);

-- 3. Create password_reset_tokens table
CREATE TABLE password_reset_tokens (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    token_hash  VARCHAR(64)  NOT NULL,
    expires_at  DATETIME     NOT NULL,
    used_at     DATETIME     NULL,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_prt_token_hash UNIQUE (token_hash),
    CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 4. Indexes for fast lookup
CREATE INDEX idx_prt_token_hash ON password_reset_tokens (token_hash);
CREATE INDEX idx_prt_user_id    ON password_reset_tokens (user_id);
