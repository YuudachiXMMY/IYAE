-- Phase 5: Marketplace + Local Designers + ADMIN
-- (A) ADMIN role — extend the users.role enum. MODIFY ... NOT NULL preserves existing rows.
ALTER TABLE users MODIFY COLUMN role ENUM('BUYER','DESIGNER','ADMIN') NOT NULL;

-- (B) Designer locality — free-text city + boolean is_local (non-null default so existing rows validate).
ALTER TABLE designer_profiles ADD COLUMN city VARCHAR(120) NULL;
ALTER TABLE designer_profiles ADD COLUMN is_local BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX idx_designer_profiles_is_local ON designer_profiles (is_local);

-- (C) Per-size garment measurements (cm) — normalized child table keyed by (product, size_label).
CREATE TABLE product_size_measurements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    size_label VARCHAR(32) NOT NULL,
    chest_cm DOUBLE NULL,
    waist_cm DOUBLE NULL,
    hips_cm DOUBLE NULL,
    length_cm DOUBLE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_product_size (product_id, size_label),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
