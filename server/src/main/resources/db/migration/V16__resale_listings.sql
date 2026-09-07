-- Phase 7: Resale / Circular / Trade-in (lightweight v1). Mirrors V12/V15 DDL style.
-- Buyers re-list items they already purchased as "pre-loved" listings; other shoppers buy them
-- via the existing Stripe path. A unique second-hand unit is sold exactly once (RESERVED->SOLD).
CREATE TABLE resale_listings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    seller_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    original_order_id BIGINT NULL,
    size_label VARCHAR(32) NOT NULL,
    cond VARCHAR(20) NOT NULL,               -- ResaleCondition (avoid the reserved word "condition")
    asking_price DECIMAL(10,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'CAD',
    seller_note TEXT NULL,
    media JSON NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    reserved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (original_order_id) REFERENCES orders(id) ON DELETE SET NULL
);
CREATE INDEX idx_resale_status_created ON resale_listings(status, created_at DESC);
CREATE INDEX idx_resale_seller ON resale_listings(seller_id);
CREATE INDEX idx_resale_reserved ON resale_listings(status, reserved_at);

-- Link a resale purchase order back to its listing (webhook marks the listing SOLD, provenance).
ALTER TABLE orders
    ADD COLUMN resale_listing_id BIGINT NULL,
    ADD CONSTRAINT fk_orders_resale_listing FOREIGN KEY (resale_listing_id)
        REFERENCES resale_listings(id) ON DELETE SET NULL;
