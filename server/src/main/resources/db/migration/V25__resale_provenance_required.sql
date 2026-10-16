-- Make resale provenance mandatory, so uk_resale_owned_unit actually constrains.
--
-- Why
-- ---
-- V23 added `CREATE UNIQUE INDEX uk_resale_owned_unit (original_order_id, product_id, size_label)`
-- to enforce "one listing per physical unit". V16 left `original_order_id BIGINT NULL` with
-- `ON DELETE SET NULL`, and in MySQL a unique index does not deduplicate NULLs — NULL is not
-- equal to anything, including another NULL. Measured on MySQL 8.0.46: two INSERTs with
-- original_order_id = NULL and the same (product_id, size_label) both succeeded and
-- SELECT COUNT(*) returned 2. The index V23 added to stop duplicate listings does not see them.
--
-- The hole is currently unreachable, not live: ResaleService.createListing resolves the owning
-- order with findOwningOrderId(...).orElseThrow(...), so every listing the application creates
-- has provenance, and nothing in the tree hard-deletes an order, so ON DELETE SET NULL never
-- fires. This migration removes the latent path instead of depending on both of those staying
-- true — the next code change that deletes an order, or that adds a listing path without an
-- order, silently re-opens the duplicate-listing hole V23 exists to close.
--
-- A listing whose provenance is gone cannot be validated as "this seller owns this unit", which
-- is the premise of the entire resale flow, so such rows are deleted rather than backfilled —
-- there is nothing to backfill them from. On a fresh install there are none.
DELETE FROM resale_listings WHERE original_order_id IS NULL;

-- The FK is dropped before the column is tightened: an `ON DELETE SET NULL` action on a column
-- that cannot be NULL is contradictory, and MySQL rejects declaring one.
--
-- V16 declared this FK inline and unnamed, so its name is the server-generated
-- `resale_listings_ibfk_3` — a name that depends on the declaration order of the three FKs in
-- that CREATE TABLE. It is looked up rather than hardcoded so this migration does not break if
-- that ordering is ever different from what it is today.
SET @fk_name := (
    SELECT constraint_name
    FROM information_schema.key_column_usage
    WHERE table_schema = DATABASE()
      AND table_name = 'resale_listings'
      AND column_name = 'original_order_id'
      AND referenced_table_name = 'orders'
    LIMIT 1
);
SET @drop_fk := CONCAT('ALTER TABLE resale_listings DROP FOREIGN KEY ', @fk_name);
PREPARE stmt FROM @drop_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE resale_listings
    MODIFY COLUMN original_order_id BIGINT NOT NULL;

-- Re-added with the default RESTRICT rather than SET NULL. RESTRICT also matches the design
-- intent already recorded elsewhere: an order is a financial record, and V22's account tombstone
-- exists precisely so that deleting a user never physically deletes their orders.
ALTER TABLE resale_listings
    ADD CONSTRAINT fk_resale_original_order
        FOREIGN KEY (original_order_id) REFERENCES orders (id);
