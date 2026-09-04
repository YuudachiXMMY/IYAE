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

ensure_env_loaded() {
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
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" .env
  else
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${jwt_secret}|" .env
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
        cp .env.example .env
        info "Created .env from .env.example"
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

    success "Setup complete. Run './deploy.sh up' to start services."
    ;;

  up)
    info "Starting production services..."
    docker compose -f "$COMPOSE_FILE" up -d --build
    wait_for_healthy mysql
    info "All services starting..."
    sleep 5
    "$0" health
    ;;

  update)
    info "Pulling latest code..."
    git pull
    info "Rebuilding services..."
    docker compose -f "$COMPOSE_FILE" build
    info "Restarting services..."
    docker compose -f "$COMPOSE_FILE" up -d
    wait_for_healthy mysql
    sleep 5
    "$0" health
    success "Update complete"
    ;;

  ssl-init)
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
      certbot certonly --standalone \
      --cert-name clossette \
      -d "$domain" \
      --agree-tos --no-eff-email \
      $email_flag

    docker compose -f "$COMPOSE_FILE" up -d nginx
    success "SSL certificate obtained for $domain"
    info "Enable HTTPS block in nginx/conf.d/default.conf and restart nginx"
    ;;

  ssl-renew)
    info "Renewing SSL certificates..."
    docker compose -f "$COMPOSE_FILE" --profile tools run --rm \
      certbot renew --webroot -w /var/certbot/www
    docker compose -f "$COMPOSE_FILE" exec nginx nginx -s reload
    success "SSL certificates renewed"
    ;;

  health)
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
    if curl -sf http://localhost/api/health &>/dev/null; then
      success "API endpoint: reachable via nginx"
    else
      warn "API endpoint: not reachable"
    fi
    if curl -sf http://localhost &>/dev/null; then
      success "Web frontend: reachable via nginx"
    else
      warn "Web frontend: not reachable"
    fi

    expiry=$(docker compose -f "$COMPOSE_FILE" exec -T nginx \
      sh -c "cat /etc/letsencrypt/live/clossette/fullchain.pem 2>/dev/null" 2>/dev/null | \
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
    echo "  ssl-init <domain>  Obtain SSL certificate via Let's Encrypt"
    echo "  ssl-renew          Renew SSL certificates"
    echo "  health             Show service status and diagnostics"
    echo "  logs [service]     Tail production logs"
    ;;
esac
