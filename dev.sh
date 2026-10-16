#!/usr/bin/env bash
#
# IYAE Development Helper
#
# Usage: ./dev.sh <command>
#
# Commands:
#   setup              Check prerequisites and initialize .env
#   start [--no-cache]  Start all services via Docker Compose
#   stop               Stop all services
#   status             Show service status and health checks
#   logs [service]     Tail service logs (all or: server, web, worker, mysql)
#   build [service]    Rebuild containers (all or specific service)
#   reset              Stop services and wipe all data volumes
#   restart [service] [--no-cache]  Rebuild and restart services with changes
#   db backup          Dump database to timestamped SQL file
#   db restore <file>  Restore database from SQL file
#   web                Run frontend dev server on host (hot reload)
#
# Examples:
#   ./dev.sh setup && ./dev.sh start   # First-time setup + launch
#   ./dev.sh build server && ./dev.sh start  # Rebuild after backend changes
#   ./dev.sh web                       # Frontend hot reload (separate terminal)
#   ./dev.sh logs server               # Debug backend issues
#
# Ports (defaults, override via .env):
#   Web Frontend: http://localhost:${WEB_PORT:-3000}  (container :3000)
#   API Server:   http://localhost:${API_PORT:-3001}  (container :8080)
#   MySQL:        localhost:${DB_PORT:-3002}           (container :3306)
#

set -euo pipefail

COMPOSE_FILE="docker-compose.yml"

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

wait_for_mysql() {
  info "Waiting for MySQL to be healthy..."
  local retries=30
  while [ $retries -gt 0 ]; do
    if docker compose -f "$COMPOSE_FILE" exec -T mysql mysqladmin ping -h localhost --silent &>/dev/null; then
      success "MySQL is ready"
      return 0
    fi
    retries=$((retries - 1))
    sleep 2
  done
  error "MySQL failed to become healthy"
  return 1
}

wait_for_http() {
  local url="$1" label="${2:-service}"
  info "Waiting for $label at $url..."
  local retries=30
  while [ $retries -gt 0 ]; do
    if curl -sf "$url" &>/dev/null; then
      success "$label is ready"
      return 0
    fi
    retries=$((retries - 1))
    sleep 2
  done
  error "$label failed to respond at $url"
  return 1
}

# .env holds DB_PASSWORD, JWT_SECRET, ADMIN_BOOTSTRAP_PASSWORD, INTERNAL_MAIL_SECRET and every
# third-party API key. `cp .env.example .env` creates it under the host's default umask -- 644 on
# a typical host -- so every local account could read it, and JWT_SECRET alone is enough to forge
# a valid HS256 token for any user id including an ADMIN. do_backup in prod_deploy.sh already
# reasons this way about the dumps it writes; it was never applied to the file it reads.
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
    warn "If this host is shared or production, treat the secrets in it as exposed and rotate them."
  else
    warn "Could not chmod 600 .env (mode ${mode:-unknown}); it may be readable by other local accounts."
  fi
}

# The server and worker images run as uid 10001 (see server/Dockerfile). Docker gives a NEW,
# EMPTY named volume the ownership of the image directory it seeds from, so a first-time
# assets_data is already 10001-owned and this is a no-op. A volume left over from when those
# containers ran as root is still root-owned, and the non-root server could not write an upload
# or a placeholder GLB into it — so claim it once, here.
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
  # Every command that reads .env funnels through here, so this is also where an .env that was
  # created loose by an older checkout gets tightened -- not just a freshly copied one.
  secure_env_file
  if [ -f .env ]; then
    set -a; source .env; set +a
  fi
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

cmd_setup() {
  info "Checking prerequisites..."
  require_cmd docker
  require_cmd curl
  success "Prerequisites OK"

  if [ ! -f .env ]; then
    if [ -f .env.example ]; then
      # umask in a subshell rather than a chmod afterwards: a chmod leaves a window in which the
      # file -- about to be filled with a generated JWT_SECRET -- is world-readable. Same
      # reasoning as do_backup's `umask 077` in prod_deploy.sh.
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

  require_env_vars DB_PASSWORD MYSQL_ROOT_PASSWORD JWT_SECRET

  # SMPL-X models are not in git (license forbids redistribution). Only needed
  # when AVATAR_GENERATION_PROVIDER=smplx; verify they are present on disk.
  if [ "${AVATAR_GENERATION_PROVIDER:-mock}" = "smplx" ]; then
    if ! ./scripts/fetch-smplx-models.sh --check >/dev/null 2>&1; then
      warn "AVATAR_GENERATION_PROVIDER=smplx but SMPL-X models are missing."
      warn "Fetch them once: ./scripts/fetch-smplx-models.sh <models_smplx_v1_1.zip>"
      warn "See smplx_models/README.md (requires accepting the SMPL-X license)."
    else
      success "SMPL-X models present"
    fi
  fi

  success "Setup complete"
}

cmd_status() {
  ensure_env_loaded
  local api_port="${API_PORT:-3001}"
  local web_port="${WEB_PORT:-3000}"
  info "Container status:"
  docker compose -f "$COMPOSE_FILE" ps
  echo ""
  info "Health checks:"
  if curl -sf "http://localhost:${api_port}/api/health" &>/dev/null; then
    success "API Server: healthy (http://localhost:${api_port})"
  else
    warn "API Server: not responding"
  fi
  if curl -sf "http://localhost:${web_port}" &>/dev/null; then
    success "Web Frontend: healthy (http://localhost:${web_port})"
  else
    warn "Web Frontend: not responding"
  fi
}

cmd_db() {
  ensure_env_loaded
  require_env_vars DB_PASSWORD

  case "${1:-}" in
    backup)
      local timestamp
      timestamp=$(date +%Y%m%d_%H%M%S)
      local backup_file="backup_${timestamp}.sql"
      info "Backing up database to $backup_file..."
      docker compose -f "$COMPOSE_FILE" exec -T mysql \
        mysqldump -u iyae -p"${DB_PASSWORD}" iyae > "$backup_file"
      success "Database backed up to $backup_file"
      ;;
    restore)
      local restore_file="${2:-}"
      if [ -z "$restore_file" ]; then
        error "Usage: ./dev.sh db restore <file.sql>"
        exit 1
      fi
      if [ ! -f "$restore_file" ]; then
        error "File not found: $restore_file"
        exit 1
      fi
      warn "This will overwrite the current database. Press Enter to continue or Ctrl+C to cancel."
      read -r
      info "Restoring database from $restore_file..."
      docker compose -f "$COMPOSE_FILE" exec -T mysql \
        mysql -u iyae -p"${DB_PASSWORD}" iyae < "$restore_file"
      success "Database restored from $restore_file"
      ;;
    *)
      echo "Usage: ./dev.sh db {backup|restore <file>}"
      ;;
  esac
}

cmd_web() {
  ensure_env_loaded
  local web_port="${WEB_PORT:-3000}"
  local api_port="${API_PORT:-3001}"
  if lsof -i ":${web_port}" &>/dev/null; then
    warn "Port ${web_port} is in use. If the Docker web container is running, stop it first: ./dev.sh stop"
  fi
  info "Starting web dev server (host mode) on port ${web_port}..."
  info "API proxy target: http://localhost:${api_port}"
  cd web && PORT="${web_port}" API_PROXY_TARGET="http://localhost:${api_port}" npm run dev
}

case "${1:-help}" in
  start)
    ensure_env_loaded
    api_port="${API_PORT:-3001}"
    web_port="${WEB_PORT:-3000}"
    if [[ "${2:-}" == "--no-cache" ]]; then
      info "Building with --no-cache..."
      docker compose -f "$COMPOSE_FILE" --profile rigging build --no-cache
    fi
    docker compose -f "$COMPOSE_FILE" --profile rigging build
    claim_asset_volume
    docker compose -f "$COMPOSE_FILE" --profile rigging up -d
    wait_for_mysql
    wait_for_http "http://localhost:${api_port}/api/health" "API Server"
    success "Services started. API: http://localhost:${api_port}, Frontend: http://localhost:${web_port}"
    ;;
  stop)
    docker compose -f "$COMPOSE_FILE" down
    ;;
  logs)
    docker compose -f "$COMPOSE_FILE" logs -f "${2:-}"
    ;;
  reset)
    docker compose -f "$COMPOSE_FILE" down -v
    echo "All data wiped."
    ;;
  build)
    docker compose -f "$COMPOSE_FILE" build "${2:-}"
    ;;
  restart)
    ensure_env_loaded
    api_port="${API_PORT:-3001}"
    web_port="${WEB_PORT:-3000}"
    # Parse args: [service] [--no-cache]
    service=""
    no_cache=""
    for arg in "${@:2}"; do
      if [[ "$arg" == "--no-cache" ]]; then
        no_cache="--no-cache"
      else
        service="$arg"
      fi
    done
    info "Rebuilding and restarting${service:+ $service}...${no_cache:+ (no cache)}"
    if [[ -n "$no_cache" ]]; then
      docker compose -f "$COMPOSE_FILE" --profile rigging build --no-cache $service
    fi
    docker compose -f "$COMPOSE_FILE" --profile rigging up -d --build $service
    wait_for_mysql
    wait_for_http "http://localhost:${api_port}/api/health" "API Server"
    success "Services restarted. API: http://localhost:${api_port}, Frontend: http://localhost:${web_port}"
    ;;
  setup)
    cmd_setup
    ;;
  status)
    cmd_status
    ;;
  db)
    shift
    cmd_db "$@"
    ;;
  web)
    cmd_web
    ;;
  *)
    echo "Usage: ./dev.sh <command>"
    echo ""
    echo "Commands:"
    echo "  setup    Check prerequisites and initialize .env"
    echo "  start    Start all services via Docker Compose"
    echo "  stop     Stop all services"
    echo "  status   Show service status and health checks"
    echo "  logs     Tail service logs (optionally specify service)"
    echo "  build    Rebuild containers (optionally specify service)"
    echo "  restart  Rebuild and restart services with changes (optionally specify service)"
    echo "  reset    Stop services and wipe all data volumes"
    echo "  db       Database operations (backup/restore)"
    echo "  web      Run frontend dev server on host (hot reload)"
    ;;
esac
