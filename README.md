# Clossette

AI-powered fashion marketplace combining conversational AI styling, 3D/AR virtual try-on, and an independent designer marketplace. Targets Gen Z and young millennial shoppers (18-30) to eliminate decision fatigue and reduce fashion returns.

## Overview

Clossette helps shoppers go from "I have nothing to wear" to "I feel great about this look" through:

- **AI Styling** — Conversational AI chat with outfit generation and suggestion chips
- **3D/AR Try-On** — SMPL-X avatar generation, garment rigging, and pose animation
- **Designer Marketplace** — Independent designer storefronts with product CRUD, promotions, and Stripe checkout
- **Community** — Posts, follows, likes, comments, and public profiles

## Architecture

Five-service architecture orchestrated via Docker Compose:

```
Next.js 16 (web :3000)  ──REST/JSON + JWT──▶  Spring Boot 3.4 (server :8080)  ──JDBC──▶  MySQL 8 (:3306)
                                                        │
                                                Shared MySQL tables
                                            (model_generation_tasks,
                                             avatar_generation_tasks,
                                             rigging_tasks)
                                                        │
                                                Python 3.12 (worker)
                                          3D model + avatar + rigging generation

Mailpit (dev SMTP :1025, WebUI :8025)  ◀── server (transactional emails)
```

| Module | Language | Purpose |
|--------|----------|---------|
| [server](./server/) | Java 22 / Spring Boot 3.4 | REST API, auth, AI chat, 3D orchestration, Stripe checkout |
| [web](./web/) | TypeScript / Next.js 16 | Frontend SPA, 3D/AR viewers, community feed |
| [worker](./worker/) | Python 3.12 | 3D model + avatar generation, garment rigging |
| nginx | Config | Reverse proxy (production), SSL termination |

## Quick Start

### Prerequisites

- Docker + Docker Compose
- Java 22 (server local dev)
- Node.js (web local dev)
- Python 3.12 (worker local dev)

### Docker (Recommended)

```bash
./dev.sh setup    # First-time: check prereqs, generate .env, create JWT_SECRET
./dev.sh start    # Start all services (MySQL + Server + Mailpit + Worker + Web)
./dev.sh status   # Show container states and health checks
```

### Local Development

```bash
# Server (requires MySQL on :3306)
cd server && ./gradlew bootRun

# Web (proxies /api/* to localhost:3001)
cd web && npm install && npm run dev

# Worker (requires MySQL on :3306)
cd worker && pip install -r requirements.txt && python main.py
```

### Dev Port Mappings

| Service | Host Port | Container Port |
|---------|-----------|----------------|
| Web | `${WEB_PORT:-3000}` | 3000 |
| Server (API) | `${API_PORT:-3001}` | 8080 |
| MySQL | `${DB_PORT:-3002}` | 3306 |
| Mailpit SMTP | 1025 | 1025 |
| Mailpit WebUI | 8025 | 8025 |

## Dev Commands

| Command | Description |
|---------|-------------|
| `./dev.sh setup` | Check prerequisites, generate `.env`, auto-create JWT_SECRET |
| `./dev.sh start` | Start all services + wait for healthy |
| `./dev.sh stop` | Stop all services |
| `./dev.sh status` | Show container status, curl health endpoints |
| `./dev.sh logs [service]` | Tail logs (all or specific service) |
| `./dev.sh build [service]` | Rebuild containers |
| `./dev.sh restart [service]` | Rebuild and restart |
| `./dev.sh reset` | Stop and wipe all data volumes |
| `./dev.sh db backup` | Dump database to timestamped SQL file |
| `./dev.sh db restore <file>` | Restore database from SQL file |
| `./dev.sh web` | Run frontend on host with hot reload |

## Testing

```bash
cd server && ./gradlew test    # Server: JUnit 5 (48 files, 338 tests)
cd web && npm run test          # Web: Vitest (17 files, 227 tests)
cd web && npm run test:e2e      # Web: Playwright E2E (8 specs, 60 tests)
cd worker && pytest             # Worker: pytest (15 files, 292 tests)
```

## Production

```bash
./prod_deploy.sh setup              # Generate .env, validate required vars
./prod_deploy.sh up                 # Build and start all production services
./prod_deploy.sh health             # Container status, HTTP checks, SSL expiry
./prod_deploy.sh ssl-init <domain>  # Obtain SSL via Let's Encrypt
```

Production uses `docker-compose.prod.yml` with Nginx reverse proxy (ports 80/443).

## Key Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `MYSQL_ROOT_PASSWORD` | Yes | MySQL root password |
| `DB_PASSWORD` | Yes | App database user password |
| `JWT_SECRET` | Yes | >=32 chars for HS256 signing |
| `AI_PROVIDER` | No | `mock` / `claude` / `deepseek` / `minimax` |
| `MODEL_GENERATION_PROVIDER` | No | `mock` / `tripo3d` / `meshy` |
| `AVATAR_GENERATION_PROVIDER` | No | `mock` / `smplx` |
| `RIGGING_PROVIDER` | No | `mock` / `python` / `blender` |

See `.env.example` for the full list.

## Documentation

- [PRD.md](./PRD.md) — Canonical product specification
- [CLAUDE.md](./CLAUDE.md) — AI context and coding conventions
- [server/CLAUDE.md](./server/CLAUDE.md) — Server module details
- [web/CLAUDE.md](./web/CLAUDE.md) — Web module details
- [worker/CLAUDE.md](./worker/CLAUDE.md) — Worker module details
- [DESIGN.md](./DESIGN.md) — Architecture and design decisions
