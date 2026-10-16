#!/usr/bin/env bash
#
# Applies every Flyway migration to a real MySQL 8, with duplicate rows seeded before V23 so its
# de-duplication actually processes data.
#
# Why this exists
# ---------------
# The server test profile sets `spring.flyway.enabled: false` and runs Hibernate `create-drop` on
# H2, so no JUnit test executes a migration file. CI's Playwright job does bring the real schema
# up through Flyway — a migration that fails outright would fail that job — but it starts from an
# empty container, and so does any throwaway `docker run mysql`. That leaves V23's
# `DELETE ... JOIN ... GROUP_CONCAT` de-duplication in a particular position: it has run many
# times and has never once seen a duplicate row. It is also MySQL-specific, so H2 could not
# execute it even if the test profile enabled Flyway.
#
# This script closes exactly that gap, for every data-dependent migration. It stops at V22, seeds
# the duplicates V23 is supposed to collapse — including the status-precedence and oldest-first
# tie-breaks the migration comments promise — applies V23/V24 and asserts what survived; then
# seeds the NULL-provenance listings V25 is supposed to remove (two rows that are duplicates of
# each other, which uk_resale_owned_unit fails to refuse precisely because MySQL does not treat
# NULL as equal to NULL), applies V25 onwards, and asserts both the cleanup and that the
# resulting constraints refuse what they exist to refuse.
#
# Usage
# -----
#   ./scripts/verify-migrations.sh                 # starts its own throwaway MySQL via docker
#   DB_HOST=127.0.0.1 DB_PORT=3306 DB_ROOT_PASSWORD=secret ./scripts/verify-migrations.sh
#                                                  # uses an existing server (CI service container)
#
# Exits non-zero on the first failed assertion.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS="$REPO_ROOT/server/src/main/resources/db/migration"

DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-3306}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-verify-migrations}"
DB_NAME="${DB_NAME:-iyae_migration_check}"
CONTAINER="iyae-migration-check"

OWN_CONTAINER=false

cleanup() {
  if [ "$OWN_CONTAINER" = true ]; then
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

info() { printf '\033[0;34m[INFO]\033[0m %s\n' "$1"; }
ok()   { printf '\033[0;32m[OK]\033[0m   %s\n' "$1"; }
fail() { printf '\033[0;31m[FAIL]\033[0m %s\n' "$1" >&2; exit 1; }

# ── MySQL plumbing ────────────────────────────────────────────────────────────

if [ -z "$DB_HOST" ]; then
  command -v docker >/dev/null 2>&1 || fail "docker not found, and no DB_HOST given"
  info "Starting a throwaway MySQL 8 as $CONTAINER ..."
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$CONTAINER" \
    -e MYSQL_ROOT_PASSWORD="$DB_ROOT_PASSWORD" \
    -e MYSQL_DATABASE="$DB_NAME" \
    -P mysql:8 >/dev/null
  OWN_CONTAINER=true
  DB_HOST=127.0.0.1
  DB_PORT="$(docker port "$CONTAINER" 3306/tcp | head -1 | sed 's/.*://')"
fi

# `mysql` is run inside the container when we own it, so the host needs no client installed.
# MYSQL_PWD rather than -p, so the password is not echoed as a warning on every single call.
mysql_run() {
  if [ "$OWN_CONTAINER" = true ]; then
    docker exec -i -e MYSQL_PWD="$DB_ROOT_PASSWORD" "$CONTAINER" \
      mysql -u root --batch --skip-column-names "$@"
  else
    MYSQL_PWD="$DB_ROOT_PASSWORD" \
      mysql -h "$DB_HOST" -P "$DB_PORT" -u root --batch --skip-column-names "$@"
  fi
}

info "Waiting for MySQL at $DB_HOST:$DB_PORT ..."
for _ in $(seq 1 60); do
  if mysql_run -e 'SELECT 1' >/dev/null 2>&1; then break; fi
  sleep 2
done
mysql_run -e 'SELECT 1' >/dev/null 2>&1 || fail "MySQL never became reachable"
mysql_run -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`"
ok "MySQL reachable"

# Applies one migration file. `sort -V` ordering is what Flyway would use for these names.
apply() {
  local file="$1"
  if ! mysql_run "$DB_NAME" < "$file" 2>/tmp/iyae-migration-err; then
    cat /tmp/iyae-migration-err >&2
    fail "$(basename "$file") failed to apply"
  fi
}

query() { mysql_run "$DB_NAME" -e "$1"; }

# ── 1. Apply V1 .. V22 ────────────────────────────────────────────────────────

info "Applying V1 .. V22 ..."
for file in $(ls "$MIGRATIONS"/V*.sql | sort -V); do
  version="$(basename "$file" | sed 's/^V\([0-9]*\)__.*/\1/')"
  if [ "$version" -le 22 ]; then
    apply "$file"
  fi
done
ok "Schema is at V22"

# ── 2. Seed the duplicates V23 has to collapse ────────────────────────────────

info "Seeding duplicate resale listings ..."
query "
INSERT INTO users (id, email, password_hash, name, role) VALUES
  (1, 'seller@example.com', 'x', 'Seller', 'BUYER'),
  (2, 'designer@example.com', 'x', 'Designer', 'DESIGNER');
INSERT INTO designer_profiles (id, user_id, display_name) VALUES (1, 2, 'Studio');
INSERT INTO products (id, designer_profile_id, name, price) VALUES
  (10, 1, 'Linen Shirt', 120.00),
  (11, 1, 'Wool Coat', 380.00);
INSERT INTO orders (id, user_id, status, total_amount) VALUES
  (100, 1, 'PAID', 120.00),
  (101, 1, 'PAID', 380.00);

-- Unit A: a real sale alongside a stale LISTED duplicate. SOLD must survive — deleting it would
-- destroy the record of a purchase, which the migration's status precedence exists to prevent.
INSERT INTO resale_listings (id, seller_id, product_id, original_order_id, size_label, cond, asking_price, status, created_at) VALUES
  (1, 1, 10, 100, 'M', 'EXCELLENT', 60.00, 'LISTED', '2026-01-01 00:00:00'),
  (2, 1, 10, 100, 'M', 'EXCELLENT', 65.00, 'SOLD',   '2026-02-01 00:00:00'),
  (3, 1, 10, 100, 'M', 'EXCELLENT', 70.00, 'LISTED', '2026-03-01 00:00:00');

-- Unit B: three LISTED rows, no committed state. The oldest must survive.
INSERT INTO resale_listings (id, seller_id, product_id, original_order_id, size_label, cond, asking_price, status, created_at) VALUES
  (4, 1, 11, 101, 'L', 'GOOD', 200.00, 'LISTED', '2026-04-03 00:00:00'),
  (5, 1, 11, 101, 'L', 'GOOD', 210.00, 'LISTED', '2026-04-01 00:00:00'),
  (6, 1, 11, 101, 'L', 'GOOD', 220.00, 'LISTED', '2026-04-02 00:00:00');

-- Unit C: a withdrawn row beside a live one. REMOVED ranks below LISTED, so the live row wins
-- even though it is newer.
INSERT INTO resale_listings (id, seller_id, product_id, original_order_id, size_label, cond, asking_price, status, created_at) VALUES
  (7, 1, 10, 101, 'S', 'FAIR', 40.00, 'REMOVED', '2026-05-01 00:00:00'),
  (8, 1, 10, 101, 'S', 'FAIR', 45.00, 'LISTED',  '2026-05-02 00:00:00');

-- Unit D: a different size of the same product in the same order — NOT a duplicate. The unit is
-- (order, product, size), so this must be left alone.
INSERT INTO resale_listings (id, seller_id, product_id, original_order_id, size_label, cond, asking_price, status, created_at) VALUES
  (9, 1, 10, 101, 'XL', 'FAIR', 48.00, 'LISTED', '2026-05-03 00:00:00');
"
seeded="$(query 'SELECT COUNT(*) FROM resale_listings')"
[ "$seeded" = "9" ] || fail "expected 9 seeded listings, found $seeded"
ok "9 listings seeded across 4 units (3 of them duplicated)"

# ── 3. Apply V23 and V24 against that data ────────────────────────────────────

info "Applying V23 .. V24 ..."
for file in $(ls "$MIGRATIONS"/V*.sql | sort -V); do
  version="$(basename "$file" | sed 's/^V\([0-9]*\)__.*/\1/')"
  if [ "$version" -ge 23 ] && [ "$version" -le 24 ]; then
    apply "$file"
  fi
done
ok "V23 and V24 applied to a database that had duplicates in it"

# ── 4. Assert what survived ───────────────────────────────────────────────────

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    ok "$label"
  else
    fail "$label — expected '$expected', got '$actual'"
  fi
}

assert_eq "exactly one listing per owned unit remains" "4" \
  "$(query 'SELECT COUNT(*) FROM resale_listings')"

assert_eq "no unit has more than one row" "0" \
  "$(query 'SELECT COUNT(*) FROM (SELECT 1 FROM resale_listings GROUP BY original_order_id, product_id, size_label HAVING COUNT(*) > 1) d')"

assert_eq "unit A kept the SOLD row, not the oldest" "2" \
  "$(query "SELECT id FROM resale_listings WHERE original_order_id=100 AND product_id=10 AND size_label='M'")"

assert_eq "unit B kept the oldest of three LISTED rows" "5" \
  "$(query "SELECT id FROM resale_listings WHERE original_order_id=101 AND product_id=11 AND size_label='L'")"

assert_eq "unit C kept the live row over the REMOVED one" "8" \
  "$(query "SELECT id FROM resale_listings WHERE original_order_id=101 AND product_id=10 AND size_label='S'")"

assert_eq "the different-size listing was not treated as a duplicate" "9" \
  "$(query "SELECT id FROM resale_listings WHERE original_order_id=101 AND product_id=10 AND size_label='XL'")"

assert_eq "the unique index exists" "uk_resale_owned_unit" \
  "$(query "SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='resale_listings' AND INDEX_NAME='uk_resale_owned_unit'")"

# The index is the point of the migration: the application guard becomes race-proof only if the
# database refuses the second row.
if query "INSERT INTO resale_listings (seller_id, product_id, original_order_id, size_label, cond, asking_price, status) VALUES (1, 10, 100, 'M', 'GOOD', 99.00, 'LISTED')" 2>/dev/null; then
  fail "the unique index did not refuse a second listing for an already-listed unit"
fi
ok "a second listing for the same owned unit is refused by the database"

# V24's indexes are what make the webhook's session lookup not a table scan.
assert_eq "V24 added the stripe_session_id index" "1" \
  "$(query "SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='orders' AND COLUMN_NAME='stripe_session_id'")"

# V22's tombstone column, which the whole account-deletion path depends on.
assert_eq "V22 added users.deleted_at" "1" \
  "$(query "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='users' AND COLUMN_NAME='deleted_at'")"

# ── 5. Seed the NULL-provenance rows V25 has to clean up ──────────────────────
#
# Same reasoning as the V23 seeding above: on an empty database V25's DELETE touches nothing, so
# running it would prove only that it parses. These two rows are the state ON DELETE SET NULL
# would have left behind, and the fact that BOTH insert is the defect V25 closes — they are the
# same (product_id, size_label) with a NULL original_order_id, which uk_resale_owned_unit is
# supposed to forbid but does not, because MySQL does not treat NULL as equal to NULL.
info "Seeding listings with NULL provenance ..."
query "
INSERT INTO resale_listings (id, seller_id, product_id, original_order_id, size_label, cond, asking_price, status, created_at) VALUES
  (20, 1, 11, NULL, 'XS', 'GOOD', 30.00, 'LISTED', '2026-06-01 00:00:00'),
  (21, 1, 11, NULL, 'XS', 'GOOD', 35.00, 'LISTED', '2026-06-02 00:00:00');
"
assert_eq "two identical NULL-provenance listings both inserted (the defect V25 closes)" "2" \
  "$(query 'SELECT COUNT(*) FROM resale_listings WHERE original_order_id IS NULL')"

# ── 6. Apply V25 onwards against that data ────────────────────────────────────

info "Applying V25 .. latest ..."
for file in $(ls "$MIGRATIONS"/V*.sql | sort -V); do
  version="$(basename "$file" | sed 's/^V\([0-9]*\)__.*/\1/')"
  if [ "$version" -ge 25 ]; then
    apply "$file"
  fi
done
ok "V25 onwards applied to a database that had NULL-provenance listings in it"

# ── 7. Assert the provenance and index changes ────────────────────────────────

assert_eq "V25 removed the unattributable listings" "0" \
  "$(query 'SELECT COUNT(*) FROM resale_listings WHERE original_order_id IS NULL')"

assert_eq "V25 left the listings that do have provenance" "4" \
  "$(query 'SELECT COUNT(*) FROM resale_listings')"

assert_eq "V25 made original_order_id NOT NULL" "NO" \
  "$(query "SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='resale_listings' AND COLUMN_NAME='original_order_id'")"

# NO ACTION is how MySQL reports RESTRICT. The point is that it is no longer SET NULL: that
# action was the only remaining way a NULL could get back into the column.
assert_eq "V25 replaced ON DELETE SET NULL with RESTRICT" "NO ACTION" \
  "$(query "SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA='$DB_NAME' AND CONSTRAINT_NAME='fk_resale_original_order'")"

# The column constraint is the point of V25 — the unique index only constrains rows that have
# a provenance id, so the database has to be the thing that refuses a row without one.
if query "INSERT INTO resale_listings (seller_id, product_id, original_order_id, size_label, cond, asking_price, status) VALUES (1, 11, NULL, 'XS', 'GOOD', 30.00, 'LISTED')" 2>/dev/null; then
  fail "a listing with NULL provenance was still accepted after V25"
fi
ok "a listing with NULL provenance is refused by the database"

# RESTRICT has to actually bite, or provenance could still be detached from a live listing.
if query "DELETE FROM orders WHERE id = 100" 2>/dev/null; then
  fail "deleting an order referenced by a listing was still allowed after V25"
fi
ok "deleting an order a listing depends on is refused by the database"

# V26 drops exactly one index, and the two that back foreign keys must survive it. If a future
# edit widens V26 to the other two, MySQL refuses the DROP and `apply` fails above — this pins
# the end state as well.
assert_eq "V26 dropped idx_follows_follower" "0" \
  "$(query "SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='follows' AND INDEX_NAME='idx_follows_follower'")"

assert_eq "V26 kept uk_follows_pair, which now serves that foreign key" "1" \
  "$(query "SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='follows' AND INDEX_NAME='uk_follows_pair'")"

assert_eq "V26 kept the two indexes that back foreign keys" "2" \
  "$(query "SELECT COUNT(DISTINCT INDEX_NAME) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA='$DB_NAME' AND ((TABLE_NAME='model_generation_tasks' AND INDEX_NAME='idx_tasks_product') OR (TABLE_NAME='analytics_events' AND INDEX_NAME='idx_events_user'))")"

# A follow must still insert and still be deduplicated, so the dropped index is provably not
# load-bearing for the behaviour the table exists for.
query "INSERT INTO follows (follower_id, following_id) VALUES (1, 2)"
if query "INSERT INTO follows (follower_id, following_id) VALUES (1, 2)" 2>/dev/null; then
  fail "follows lost its duplicate protection after V26"
fi
ok "follows still inserts once and refuses the duplicate pair"

latest="$(ls "$MIGRATIONS"/V*.sql | sort -V | tail -1 | sed 's/.*\/V\([0-9]*\)__.*/\1/')"
printf '\n\033[0;32mAll migration checks passed — V1..V%s applied to MySQL 8, V23 de-duplicated real rows, V25 cleaned up real NULL-provenance rows.\033[0m\n' "$latest"
