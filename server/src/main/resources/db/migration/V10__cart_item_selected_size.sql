ALTER TABLE cart_items ADD COLUMN selected_size VARCHAR(32) NOT NULL DEFAULT 'ONE_SIZE';
ALTER TABLE cart_items ADD UNIQUE KEY uk_cart_product_size (cart_id, product_id, selected_size);
ALTER TABLE cart_items DROP INDEX uk_cart_product;
