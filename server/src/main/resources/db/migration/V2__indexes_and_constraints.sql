-- Clossette Performance Indexes
-- V2: Add indexes for common query patterns

-- Product queries (public catalog)
CREATE INDEX idx_products_status_category ON products(status, category);
CREATE INDEX idx_products_status_created ON products(status, created_at DESC);

-- Promotion queries (active promotions)
CREATE INDEX idx_promotions_slot_dates ON promotions(slot_type, start_at, end_at);
CREATE INDEX idx_promotions_weight ON promotions(weight DESC);

-- Task queue (worker polling)
CREATE INDEX idx_tasks_status ON model_generation_tasks(status);
CREATE INDEX idx_tasks_product ON model_generation_tasks(product_id);

-- Chat queries
CREATE INDEX idx_chat_sessions_user_status ON chat_sessions(user_id, status);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);

-- Order queries
CREATE INDEX idx_orders_user ON orders(user_id, created_at DESC);

-- Outfit recommendations
CREATE INDEX idx_outfit_recs_user ON outfit_recommendations(user_id, created_at DESC);

-- Saved looks
CREATE INDEX idx_saved_looks_user ON saved_looks(user_id, created_at DESC);
