-- Wishlist: a shopper's saved catalogue items. Mirrors V16/V17 DDL style.
--
-- saved_looks cannot carry these: its recommendation_id is NOT NULL and points at
-- outfit_recommendations, so it stores generated outfits, not products. Without
-- this table web/lib/saved-products.ts had nowhere to persist and kept the set in
-- localStorage, which does not survive a change of device.
--
-- Set membership, not an event log: one row per (user, product), no quantity and
-- nothing to update, so there is no updated_at. The unique key makes a repeated
-- save idempotent at the database level rather than only in the service.
CREATE TABLE saved_products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_saved_products_user_product (user_id, product_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- The only read path is "this user's saves, newest first". The unique key above
-- already covers (user_id, product_id) lookups, so this adds the sort order.
CREATE INDEX idx_saved_products_user_created ON saved_products(user_id, created_at DESC);
