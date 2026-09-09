-- F12: optimistic-lock guard for Stripe webhook idempotency.
-- Concurrent at-least-once webhook deliveries for the same order could both cross PENDING→PAID and
-- double-fulfill (double markSold / duplicate ORDER_PAID analytics). @Version on Order maps to this
-- column so the losing concurrent writer fails to commit; Stripe's retry then sees the order PAID.
ALTER TABLE orders
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
