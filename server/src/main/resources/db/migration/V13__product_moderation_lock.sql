-- PR#10 M2: durable admin moderation. When an admin forces ARCHIVED, lock the product so the
-- owning designer cannot republish via the ordinary update path. Non-null default so existing rows validate.
ALTER TABLE products ADD COLUMN moderation_locked BOOLEAN NOT NULL DEFAULT FALSE;
