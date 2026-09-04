<!-- Generated: 2026-05-27 | Updated: 2026-06-14 | Tables: 21 | Migrations: 10 | Token estimate: ~900 -->

# Data Layer (MySQL 8 + Flyway)

Hibernate `ddl-auto: validate` — all schema changes via Flyway only.

## Entity-Relationship Diagram

```
users (1)─────(1) designer_profiles (1)───(N) products (1)───(N) garment_assets
  │                                            │                     │
  │(1:1)                                       │(1:N)           model_generation_tasks
  ├── body_profiles                            │                rigging_tasks
  ├── carts (1)───(N) cart_items ───(N:1) products
  │                    (unique: cart_id+product_id+selected_size)
  ├── orders (stripe_session_id, payment_status)
  ├── reviews ─────────────────────(N:1) products
  ├── chat_sessions (1)───(N) chat_messages
  │        └── outfit_recommendations
  ├── saved_looks ──(N:1) outfit_recommendations
  ├── password_reset_tokens
  ├── promotions ──────────────────(N:1) products
  ├── avatar_generation_tasks
  ├── posts (1)───(N) post_comments
  │     └──(N) post_likes
  └── follows (user_id → followed_user_id)
```

## Tables (21)

| Table | Key Columns | Notes |
|-------|-------------|-------|
| users | id, email*, username*, password_hash, role, emailVerified, verificationToken | V5 added profile/preference fields (JSON columns) |
| designer_profiles | id, user_id*, display_name, shop_name | 1:1 with users |
| body_profiles | id, user_id*, height/weight/chest/waist/hips_cm | V5 added shoulder/inseam/shoe/top/bottom/dress/jacket sizes |
| products | id, designer_profile_id, name*, price*, category, style_tags(J), color_tags(J), status | Statuses: DRAFT/PUBLISHED/ARCHIVED |
| garment_assets | id, product_id, glb_url, usdz_url, slot_hint | Slots: TOP/BOTTOM/SHOES/ACCESSORY/DRESS |
| model_generation_tasks | id, product_id, status*, provider, input/output(J), attempt_count | Worker integration; PENDING→RUNNING→READY/FAILED→MATERIALIZED |
| rigging_tasks | id, garment_asset_id, status*, provider, input/output(J), attempt_count | V7; rigging worker integration; same lifecycle as model tasks |
| avatar_generation_tasks | id, user_id, status*, provider, input/output(J), attempt_count | V6; avatar generation worker integration |
| carts | id, user_id* | 1:1 per user, get-or-create pattern |
| cart_items | id, cart_id, product_id, quantity, selected_size | V10: unique (cart_id, product_id, selected_size) replaces (cart_id, product_id) |
| orders | id, user_id, status, total_amount, items_snapshot(J), stripe_session_id, stripe_payment_intent, payment_status | V9 added Stripe fields; Statuses: PENDING/PAID/PROCESSING/SHIPPED/DELIVERED |
| chat_sessions | id, user_id, status | ACTIVE/COMPLETED |
| chat_messages | id, session_id, role, content, outfit_recommendation_id | USER/ASSISTANT |
| outfit_recommendations | id, user_id, session_id, top/bottom/shoes/accessory_product_id | Slot-based matching |
| saved_looks | id, user_id, outfit_id, note | Bookmarked outfits |
| reviews | id, user_id, product_id, rating, comment | Unique (user_id, product_id) |
| promotions | id, designer_profile_id, product_id, slot_type, weight | FEATURED/SPONSORED |
| password_reset_tokens | id, user_id, token_hash*, expires_at, consumed_at | SHA-256 hashed; 1h TTL |
| posts | id, user_id, content, image_url, status | V8; community posts; Statuses: ACTIVE/ARCHIVED/DELETED |
| post_comments | id, post_id, user_id, content, parent_id | V8; threaded comments |
| post_likes | id, post_id, user_id | V8; unique (post_id, user_id) |
| follows | id, user_id, followed_user_id | V8; unique (user_id, followed_user_id) |

(J) = JSON column, * = indexed/unique

## Migration History

| Migration | Description |
|-----------|-------------|
| V1__baseline_schema.sql | 15 tables with FKs, enums, timestamps |
| V2__indexes_and_constraints.sql | 14 performance indexes (status, category, FKs, sort columns) |
| V3__add_materialized_status.sql | MATERIALIZED enum value for task lifecycle |
| V4__email_verification_and_password_reset.sql | Verification fields on users + password_reset_tokens table |
| V5__profile_social_fields.sql | Username, preferences (JSON), avatar, extended measurements |
| V6__avatar_generation_tasks.sql | avatar_generation_tasks table + users.avatar_glb_url column |
| V7__garment_rigging_tasks.sql | rigging_tasks table for garment rigging pipeline |
| V8__community_tables.sql | posts, post_comments, post_likes, follows tables |
| V9__checkout_orders.sql | Stripe fields on orders (stripe_session_id, stripe_payment_intent, payment_status) |
| V10__cart_item_selected_size.sql | cart_items.selected_size column + new unique key (cart_id, product_id, selected_size) |

## Key Indexes

```
products(status, category), products(status, created_at DESC)
promotions(slot_type, start_at, end_at), promotions(weight DESC)
model_generation_tasks(status), model_generation_tasks(product_id)
rigging_tasks(status), rigging_tasks(garment_asset_id)
avatar_generation_tasks(status), avatar_generation_tasks(user_id)
chat_sessions(user_id, status), chat_messages(session_id, created_at)
orders(user_id, created_at DESC)
outfit_recommendations(user_id, created_at DESC)
saved_looks(user_id, created_at DESC)
password_reset_tokens(token_hash), password_reset_tokens(user_id)
posts(user_id, status), post_likes(post_id, user_id)
follows(user_id, followed_user_id)
cart_items(cart_id, product_id, selected_size) UNIQUE
```

## Task Status Lifecycle

```
Server creates → PENDING → Worker claims → RUNNING → Provider generates → READY or FAILED
                                                        ↓
                                              Server scheduler → MATERIALIZED (→ GarmentAsset)
                                              API maps MATERIALIZED → READY for clients
```

Applies to: model_generation_tasks, avatar_generation_tasks, rigging_tasks.
Retry: max 3 attempts. Stale reclaim: RUNNING > 15min → PENDING.
