#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

require_cmd() {
  command -v "$1" &>/dev/null || { error "$1 is required but not installed."; exit 1; }
}

require_env_vars() {
  local missing=0
  for var in "$@"; do
    if [ -z "${!var:-}" ]; then
      error "Environment variable $var is not set"
      missing=1
    fi
  done
  [ "$missing" -eq 0 ] || exit 1
}

# .env holds DB_PASSWORD, JWT_SECRET, ADMIN_BOOTSTRAP_PASSWORD, INTERNAL_MAIL_SECRET, the
# third-party API keys and (once payment is enabled) STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET.
# `cp .env.example .env` creates it under the host's default umask -- 644 on a typical host -- so
# any second account on the production host (another operator, a backup or monitoring agent, a CI
# runner with persistent access) could read it with no exploit at all: JWT_SECRET forges an ADMIN
# token, DB_PASSWORD reads every customer's PII and body measurements. do_backup below already
# reasons exactly this way about the dumps it writes; it was never applied to the file it reads.
secure_env_file() {
  [ -f .env ] || return 0

  local mode=""
  if [[ "$OSTYPE" == "darwin"* ]]; then
    mode="$(stat -f '%Lp' .env 2>/dev/null || true)"
  else
    mode="$(stat -c '%a' .env 2>/dev/null || true)"
  fi
  [ "$mode" = "600" ] && return 0

  if chmod 600 .env 2>/dev/null; then
    warn ".env was mode ${mode:-non-600} -- readable beyond its owner. Tightened to 600."
    warn "Treat every secret in it as exposed and rotate them (JWT_SECRET, DB_PASSWORD, API keys)."
  else
    warn "Could not chmod 600 .env (mode ${mode:-unknown}); it may be readable by other local accounts."
  fi
}

# The server and worker images run as uid 10001 (see server/Dockerfile). Docker gives a NEW,
# EMPTY named volume the ownership of the image directory it seeds from, so on a first
# deployment assets_data is already 10001-owned and this is a no-op. A volume carried over from
# a deployment where those containers ran as root is still root-owned, and the non-root server
# could not write an upload or a placeholder GLB into it — so claim it once, here.
#
# The chown runs in a throwaway container via `compose run --user 0:0`, not in the service: that
# resolves the real volume name (<project>_assets_data) without this script having to guess the
# compose project prefix, and root exists only for the lifetime of that one command.
claim_asset_volume() {
  info "Claiming the assets volume for uid 10001..."
  if ! docker compose -f "$COMPOSE_FILE" run --rm --no-deps --user 0:0 \
      --entrypoint sh server -c 'chown -R 10001:10001 /var/iyae/assets' >/dev/null 2>&1; then
    warn "Could not chown /var/iyae/assets. If uploads or 3D placeholders fail to write,"
    warn "run: docker compose -f $COMPOSE_FILE run --rm --no-deps --user 0:0 --entrypoint sh server -c 'chown -R 10001:10001 /var/iyae/assets'"
  fi
}

ensure_env_loaded() {
  # Every subcommand that reads .env funnels through here -- up, update, backup, restore,
  # ssl-init, ssl-renew, health -- so this is also where an .env a previous deploy created loose
  # gets tightened, not just a freshly copied one.
  secure_env_file
  if [ -f .env ]; then
    set -a; source .env; set +a
  fi
  resolve_site_conf
}

BACKUP_DIR="${BACKUP_DIR:-./backups}"

# Which site config nginx actually mounts. `ssl-init` renders the TLS config to
# nginx/conf.d/tls-active.conf — gitignored — and records the choice in .env, which is also
# gitignored. Neither is therefore an uncommitted modification to a tracked file.
#
# It used to overwrite the tracked nginx/conf.d/default.conf in place, which broke TLS twice
# over: `update`'s rollback runs `git reset --hard "$previous_rev"`, which discarded the
# rendered config and silently dropped the site back to plain HTTP at exactly the moment
# something was already going wrong; and `git pull` would refuse outright the first time
# upstream touched that file. Generated deployment state must not live in git's tracked tree.
NGINX_SITE_DEFAULT="default.conf"
NGINX_SITE_TLS="tls-active.conf"
NGINX_SITE_CONF="nginx/conf.d/$NGINX_SITE_DEFAULT"

resolve_site_conf() {
  NGINX_SITE_CONF="nginx/conf.d/${NGINX_SITE_CONF_FILE:-$NGINX_SITE_DEFAULT}"
}

# Persist the nginx site selection to .env so it survives a rollback, a rebuild and a reboot.
set_site_conf_file() {
  local value="$1"
  # The third path that can create .env, and the one easy to miss: `ssl-init` gates on nothing
  # that requires .env to exist, so on a host where it was never created this `touch` is the
  # creator -- and secure_env_file has already returned early from `[ -f .env ] || return 0`
  # before reaching here. Without the umask it would land at the ambient 644 and only be
  # repaired by whichever later subcommand happens to call ensure_env_loaded next.
  (umask 077 && touch .env)
  if grep -qE '^NGINX_SITE_CONF_FILE=' .env; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|^NGINX_SITE_CONF_FILE=.*|NGINX_SITE_CONF_FILE=${value}|" .env
    else
      sed -i "s|^NGINX_SITE_CONF_FILE=.*|NGINX_SITE_CONF_FILE=${value}|" .env
    fi
  else
    printf 'NGINX_SITE_CONF_FILE=%s\n' "$value" >> .env
  fi
  NGINX_SITE_CONF_FILE="$value"
  resolve_site_conf
}

# Refuses to serve the public internet over plain HTTP unless the operator says so out loud.
# The previous arrangement needed two hand edits in a comment block to enable TLS, and shipped
# with both still commented out — passwords and JWTs in cleartext, with nothing to notice it.
require_tls_or_explicit_optout() {
  if grep -qE '^\s*listen\s+443' "$NGINX_SITE_CONF"; then
    return 0
  fi
  if [ "${ALLOW_INSECURE_HTTP:-false}" = "true" ]; then
    warn "ALLOW_INSECURE_HTTP=true — serving over plain HTTP. Passwords and JWTs will cross the network in cleartext."
    return 0
  fi
  error "TLS is not configured: $NGINX_SITE_CONF has no 'listen 443'."
  error "Run './prod_deploy.sh ssl-init <your-domain>' first."
  error "To deploy without TLS anyway (local/private network only), set ALLOW_INSECURE_HTTP=true."
  exit 1
}

# Gates on the readiness probe, which touches the database, rather than on /api/health, which
# is a hardcoded 200 that cannot fail.
gate_readiness() {
  local attempts="${1:-30}" i=0
  while [ "$i" -lt "$attempts" ]; do
    if docker compose -f "$COMPOSE_FILE" exec -T server \
         curl -sf http://localhost:8080/api/health/ready &>/dev/null; then
      success "Readiness probe passed"
      return 0
    fi
    i=$((i + 1))
    sleep 2
  done
  error "Readiness probe did not pass within $((attempts * 2))s"
  return 1
}

# Backs up the only copy of the orders, the PII and the uploads. Both live on unreplicated
# Docker volumes; before this there was no backup and no documented restore at all.
do_backup() {
  local stamp target old_umask
  stamp="$(date +%Y%m%d-%H%M%S)"
  target="$BACKUP_DIR/$stamp"
  mkdir -p "$target"

  # A dump of this database is every customer's email, address, order history and body
  # measurements in cleartext, and the asset archive holds their body scans. Created with the
  # default umask these were world-readable, so any account on the host could read the lot.
  # umask must be set before the redirections below create the files — chmod afterwards would
  # leave a window in which they are readable.
  chmod 700 "$BACKUP_DIR" "$target"
  old_umask="$(umask)"
  umask 077

  info "Dumping database to $target/database.sql.gz ..."
  docker compose -f "$COMPOSE_FILE" exec -T mysql \
    mysqldump -u root -p"${MYSQL_ROOT_PASSWORD}" --single-transaction --routines --triggers iyae \
    | gzip > "$target/database.sql.gz"

  info "Archiving the assets volume to $target/assets.tar.gz ..."
  docker compose -f "$COMPOSE_FILE" exec -T server \
    tar czf - -C /var/iyae/assets . > "$target/assets.tar.gz"

  umask "$old_umask"

  # Fail loudly rather than leaving a zero-byte file that looks like a backup.
  for f in "$target/database.sql.gz" "$target/assets.tar.gz"; do
    if [ ! -s "$f" ]; then
      error "$f is empty — the backup FAILED. Do not rely on it."
      exit 1
    fi
  done

  info "Sizes: $(du -h "$target"/*.gz | awk '{printf "%s %s  ", $1, $2}')"
  success "Backup complete: $target"
  warn "This is on the same host as the data it protects. Copy it off-host — a disk failure or"
  warn "a lost VM takes the backup with it. Example: rsync -a $target <offsite>:/backups/iyae/"
  info "Schedule it: 15 3 * * *  cd $(pwd) && ./prod_deploy.sh backup >> /var/log/iyae-backup.log 2>&1"
}

do_restore() {
  local src="$1"
  [ -d "$src" ] || { error "No such backup directory: $src"; exit 1; }
  [ -s "$src/database.sql.gz" ] || { error "$src/database.sql.gz missing or empty"; exit 1; }

  warn "This OVERWRITES the live database and assets volume with $src."
  printf "Type 'restore' to continue: "
  read -r confirm
  [ "$confirm" = "restore" ] || { info "Aborted."; exit 1; }

  # Quiesce the writers first. The dump contains DROP TABLE / CREATE TABLE, so with `server` and
  # `worker` still live their in-flight writes commit against tables that are being replaced
  # underneath them: those rows vanish silently the moment the table is recreated, and a
  # transaction holding a metadata lock can stall the import half-done. nginx stays up on purpose
  # so callers get an immediate 502 rather than a hang.
  info "Stopping server and worker so no live writes race the import..."
  docker compose -f "$COMPOSE_FILE" stop server worker

  info "Restoring database..."
  if ! gunzip -c "$src/database.sql.gz" \
    | docker compose -f "$COMPOSE_FILE" exec -T mysql \
        mysql -u root -p"${MYSQL_ROOT_PASSWORD}" iyae; then
    error "Database import failed. server and worker are still stopped — the database is in a"
    error "partial state. Fix the dump or restore another backup before starting them:"
    error "  docker compose -f $COMPOSE_FILE up -d server worker"
    exit 1
  fi

  if [ -s "$src/assets.tar.gz" ]; then
    info "Restoring assets..."
    # `run --rm` rather than `exec`, because the service it mounts the volume from is stopped.
    docker compose -f "$COMPOSE_FILE" run --rm --no-deps -T \
      --entrypoint tar server xzf - -C /var/iyae/assets < "$src/assets.tar.gz"
  fi

  info "Starting server and worker on the restored state..."
  docker compose -f "$COMPOSE_FILE" up -d server worker
  success "Restore complete from $src"
}

# Both-or-neither validation. Used for the Stripe pair: STRIPE_SECRET_KEY alone makes
# handleWebhook throw "Webhook secret not configured", so a half-configured payment setup
# breaks fulfilment rather than enabling payment. Neither set = payment stays off (503).
require_paired_env_vars() {
  local a="$1" b="$2"
  local a_set=0 b_set=0
  [ -n "${!a:-}" ] && a_set=1
  [ -n "${!b:-}" ] && b_set=1
  if [ "$a_set" -ne "$b_set" ]; then
    if [ "$a_set" -eq 1 ]; then
      error "$a is set but $b is not — supply both or neither. A key without a webhook secret breaks order fulfilment."
    else
      error "$b is set but $a is not — supply both or neither."
    fi
    exit 1
  fi
  if [ "$a_set" -eq 0 ]; then
    warn "$a / $b are unset — payment collection is DISABLED; POST /api/checkout will answer 503."
  fi
}

# Every check that must hold before production services are (re)started.
#
# These used to run only in `setup`. An operator who had already run `setup` once — before
# ADMIN_BOOTSTRAP_* / CORS_ORIGINS / FRONTEND_BASE_URL became mandatory — could then `up` or
# `update` forever without ever being told the deployment was misconfigured, which is the
# normal upgrade path and so the one that mattered most.
require_production_config() {
  # ADMIN_BOOTSTRAP_* is required, not optional: no other code path can create an
  # administrator in production, so omitting it yields an unmoderatable instance.
  # CORS_ORIGINS and FRONTEND_BASE_URL were never validated. Their effective production
  # values (empty, and http://localhost:3000) silently break every state-changing browser
  # request and every verification / password-reset / checkout link in an email.
  require_env_vars DB_PASSWORD MYSQL_ROOT_PASSWORD JWT_SECRET \
    INTERNAL_MAIL_SECRET ADMIN_BOOTSTRAP_EMAIL ADMIN_BOOTSTRAP_PASSWORD \
    CORS_ORIGINS FRONTEND_BASE_URL
  require_paired_env_vars STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET

  if is_placeholder_jwt "${JWT_SECRET:-}"; then
    error "JWT_SECRET is unset, a known placeholder, or shorter than 32 characters."
    error "Run './prod_deploy.sh setup' to generate one."
    exit 1
  fi

  case "${FRONTEND_BASE_URL:-}" in
    *localhost*|*127.0.0.1*)
      error "FRONTEND_BASE_URL is $FRONTEND_BASE_URL — email links and checkout redirects would point at the operator's own machine."
      exit 1
      ;;
  esac
}

is_placeholder_jwt() {
  local val="$1"
  [[ -z "$val" ]] && return 0
  [[ "$val" == "changeme" ]] && return 0
  [[ "$val" == "your-secret-key-at-least-32-characters-long" ]] && return 0
  [[ ${#val} -lt 32 ]] && return 0
  return 1
}

generate_jwt_secret() {
  local jwt_secret
  jwt_secret=$(openssl rand -base64 32)
  # The grep guard + append fallback is what dev.sh has always done here, and this copy had
  # drifted without it: an unconditional sed is a silent no-op on an .env with no JWT_SECRET=
  # line, so it reported "Generated JWT_SECRET" having written nothing, and the operator then
  # got "Environment variable JWT_SECRET is not set" two lines later. Reachable because
  # set_site_conf_file's `touch` can leave behind an empty .env that `setup` then declines to
  # overwrite (its guard is `[ ! -f .env ]`).
  if grep -q "^JWT_SECRET=" .env; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" .env
    else
      sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" .env
    fi
  else
    echo "JWT_SECRET=${jwt_secret}" >> .env
  fi
  success "Generated JWT_SECRET"
}

wait_for_healthy() {
  local service="$1" retries=30
  info "Waiting for $service to be healthy..."
  while [ $retries -gt 0 ]; do
    local status
    status=$(docker compose -f "$COMPOSE_FILE" ps "$service" --format '{{.Health}}' 2>/dev/null || echo "unknown")
    if [ "$status" = "healthy" ]; then
      success "$service is healthy"
      return 0
    fi
    retries=$((retries - 1))
    sleep 2
  done
  error "$service failed to become healthy"
  return 1
}

case "${1:-help}" in
  setup)
    info "Checking prerequisites..."
    require_cmd docker
    require_cmd curl
    require_cmd openssl

    if docker compose version &>/dev/null; then
      success "Docker Compose available"
    else
      error "Docker Compose is required (docker compose plugin)"
      exit 1
    fi

    if [ ! -f .env ]; then
      if [ -f .env.example ]; then
        # umask in a subshell rather than a chmod afterwards: a chmod leaves a window in which
        # the file -- about to be filled with a generated JWT_SECRET and then the production
        # secrets -- is world-readable. Same reasoning as do_backup's `umask 077`.
        (umask 077 && cp .env.example .env)
        info "Created .env from .env.example (mode 600)"
      else
        error ".env.example not found"
        exit 1
      fi
    else
      info ".env already exists, skipping"
    fi

    ensure_env_loaded
    if is_placeholder_jwt "${JWT_SECRET:-}"; then
      generate_jwt_secret
      ensure_env_loaded
    fi

    require_production_config

    success "Setup complete. Run './deploy.sh up' to start services."
    ;;

  up)
    ensure_env_loaded
    require_production_config
    require_tls_or_explicit_optout
    info "Starting production services..."
    docker compose -f "$COMPOSE_FILE" build
    claim_asset_volume
    docker compose -f "$COMPOSE_FILE" up -d
    wait_for_healthy mysql
    wait_for_healthy server
    info "All services starting..."
    "$0" health
    ;;

  update)
    ensure_env_loaded
    require_production_config
    require_tls_or_explicit_optout
    previous_rev="$(git rev-parse HEAD)"
    info "Current revision: $previous_rev"

    info "Pulling latest code..."
    git pull
    info "Rebuilding services..."
    docker compose -f "$COMPOSE_FILE" build
    # Also here, not only in `up`: upgrading an instance that was deployed before the containers
    # went non-root arrives through this path, and that instance's assets_data is root-owned.
    claim_asset_volume
    info "Restarting services..."
    docker compose -f "$COMPOSE_FILE" up -d
    wait_for_healthy mysql

    # Real gate, not `sleep 5`. The old `update` cut traffic over and then merely *printed*
    # diagnostics, so a release that could not serve a single request was reported as complete
    # and left running. Nothing rolled back.
    if wait_for_healthy server && gate_readiness; then
      "$0" health
      success "Update complete"
    else
      error "New revision failed its readiness gate — rolling back to $previous_rev"
      git reset --hard "$previous_rev"
      docker compose -f "$COMPOSE_FILE" build
      docker compose -f "$COMPOSE_FILE" up -d
      if wait_for_healthy server && gate_readiness; then
        warn "Rolled back to $previous_rev, which is serving again."
      else
        error "Rollback to $previous_rev is ALSO unhealthy. Manual intervention required."
      fi
      exit 1
    fi
    ;;

  backup)
    ensure_env_loaded
    do_backup
    ;;

  restore)
    ensure_env_loaded
    archive="${2:-}"
    if [ -z "$archive" ]; then
      error "Usage: ./prod_deploy.sh restore <backup-directory>"
      info "Available backups:"
      ls -1 "$BACKUP_DIR" 2>/dev/null || info "  (none in $BACKUP_DIR)"
      exit 1
    fi
    do_restore "$archive"
    ;;

  ssl-init)
    ensure_env_loaded
    domain="${2:-}"
    email="${3:-}"
    if [ -z "$domain" ]; then
      error "Usage: ./deploy.sh ssl-init <domain> [email]"
      exit 1
    fi
    info "Obtaining SSL certificate for $domain..."

    docker compose -f "$COMPOSE_FILE" stop nginx 2>/dev/null || true

    email_flag="--register-unsafely-without-email"
    if [ -n "$email" ]; then
      email_flag="--email $email"
    fi

    docker compose -f "$COMPOSE_FILE" --profile tools run --rm -p 80:80 \
      certbot-cli certonly --standalone \
      --cert-name iyae \
      -d "$domain" \
      --agree-tos --no-eff-email \
      $email_flag

    # Install the TLS site config instead of telling the operator to uncomment two blocks by
    # hand. That instruction is why production ran without TLS: it was never carried out, and
    # nothing failed to indicate it.
    if [ ! -f nginx/templates/tls.conf ]; then
      error "nginx/templates/tls.conf is missing — cannot enable TLS."
      exit 1
    fi
    previous_site_file="${NGINX_SITE_CONF_FILE:-$NGINX_SITE_DEFAULT}"
    sed -e "s|__SERVER_NAME__|$domain|g" -e "s|__CERT_NAME__|iyae|g" \
      nginx/templates/tls.conf > "nginx/conf.d/$NGINX_SITE_TLS"
    set_site_conf_file "$NGINX_SITE_TLS"
    info "Rendered TLS config to nginx/conf.d/$NGINX_SITE_TLS and recorded NGINX_SITE_CONF_FILE in .env"

    # --force-recreate: the mount source changed, so an existing container would keep serving
    # the old site config.
    docker compose -f "$COMPOSE_FILE" up -d --force-recreate nginx
    sleep 3
    if docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -t &>/dev/null; then
      success "SSL certificate obtained and HTTPS enabled for $domain"
      info "Renewal is automatic: the certbot service renews every 12h and nginx reloads every 6h."
    else
      error "nginx rejected the TLS config. Reverting to $previous_site_file."
      set_site_conf_file "$previous_site_file"
      docker compose -f "$COMPOSE_FILE" up -d --force-recreate nginx
      exit 1
    fi
    ;;

  ssl-renew)
    ensure_env_loaded
    info "Renewing SSL certificates..."
    # certbot-cli, NOT certbot. The `certbot` service is the always-on renewal loop and
    # overrides `entrypoint: /bin/sh`, so `run certbot renew ...` ran `/bin/sh renew ...` —
    # sh looking for a script named "renew" — and this command could never have renewed
    # anything. certbot-cli is the same image with the image's own entrypoint intact.
    docker compose -f "$COMPOSE_FILE" --profile tools run --rm \
      certbot-cli renew --webroot -w /var/certbot/www
    docker compose -f "$COMPOSE_FILE" exec nginx nginx -s reload
    success "SSL certificates renewed"
    ;;

  health)
    # Needed for NGINX_SITE_CONF_FILE: the TLS-expiry section below inspects whichever site
    # config is actually mounted, which .env records.
    ensure_env_loaded
    info "Service status:"
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    info "Health checks:"

    for svc in mysql server worker web nginx; do
      local_status=$(docker compose -f "$COMPOSE_FILE" ps "$svc" --format '{{.Status}}' 2>/dev/null || echo "not running")
      if echo "$local_status" | grep -q "Up"; then
        success "$svc: $local_status"
      else
        error "$svc: $local_status"
      fi
    done

    echo ""
    # /ready, not /health: /health is a hardcoded 200 and reports fine with no database.
    if curl -sf http://localhost/api/health/ready &>/dev/null; then
      success "API readiness: database reachable, serving"
    elif curl -sf http://localhost/api/health &>/dev/null; then
      error "API is up but NOT READY — the database is unreachable. It is serving errors."
    else
      warn "API endpoint: not reachable"
    fi

    if grep -qE '^\s*listen\s+443' "$NGINX_SITE_CONF"; then
      success "TLS: configured"
    else
      error "TLS: NOT configured — traffic is plaintext HTTP"
    fi

    if [ -d "$BACKUP_DIR" ] && [ -n "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
      info "Most recent backup: $(ls -1t "$BACKUP_DIR" | head -1)"
    else
      error "No backups found in $BACKUP_DIR — the database has no recoverable copy."
    fi
    if curl -sf http://localhost &>/dev/null; then
      success "Web frontend: reachable via nginx"
    else
      warn "Web frontend: not reachable"
    fi

    expiry=$(docker compose -f "$COMPOSE_FILE" exec -T nginx \
      sh -c "cat /etc/letsencrypt/live/iyae/fullchain.pem 2>/dev/null" 2>/dev/null | \
      openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || true)
    if [ -n "$expiry" ]; then
      info "SSL certificate expires: $expiry"
    fi
    ;;

  logs)
    docker compose -f "$COMPOSE_FILE" logs -f "${2:-}"
    ;;

  stop)
    docker compose -f "$COMPOSE_FILE" down
    success "Production services stopped"
    ;;

  *)
    echo "Usage: ./deploy.sh <command>"
    echo ""
    echo "Commands:"
    echo "  setup              Check prerequisites and initialize .env"
    echo "  up                 Build and start all production services"
    echo "  stop               Stop all production services"
    echo "  update             Pull latest code, rebuild, and restart"
    echo "  ssl-init <domain>  Obtain SSL certificate and switch nginx to HTTPS"
    echo "  ssl-renew          Renew SSL certificates now (renewal is otherwise automatic)"
    echo "  backup             Dump the database and assets volume to ./backups/<timestamp>"
    echo "  restore <dir>      Restore database and assets from a backup directory"
    echo "  health             Show service status and diagnostics"
    echo "  logs [service]     Tail production logs"
    ;;
esac
