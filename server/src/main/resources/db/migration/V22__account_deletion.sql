-- Account deletion.
--
-- Deletion is a tombstone, not a DELETE of the users row. `orders` carries a non-null FK to
-- users and an order is a financial record that has to survive the customer's departure, so
-- the row stays and every identifying field on it is scrubbed. Everything that is purely
-- personal content (posts, comments, chat transcripts, body measurements, avatars, wishlist,
-- resale listings) is deleted outright.
--
-- Before this there was no deletion path at all: `DELETE /api/avatar` cleared the avatar and
-- measurements and left the chat transcripts, posts, orders and analytics rows permanently.

ALTER TABLE users
  ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL
  COMMENT 'Set when the account is deleted. A tombstoned row is treated as non-existent by login, registration and every profile lookup.';

-- Lookups that must skip tombstones (login, public profile, follower lists) all filter on this.
CREATE INDEX idx_users_deleted_at ON users (deleted_at);
