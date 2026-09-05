# About IYAE

> Context file for Claude Cowork — helps Claude understand the project background
> when executing tasks across any IYAE workspace.

---

## Product Vision

IYAE is an **AI-powered fashion marketplace** that helps Gen Z and young millennial shoppers (18-30) go from "I have nothing to wear" to "I feel great about this look" — with zero decision fatigue and near-zero returns.

### Problem We Solve

- **Buyers**: Decision fatigue from endless scrolling; sizing uncertainty causing returns; lack of trusted curation
- **Independent Designers**: High barrier to entry on traditional marketplaces; expensive product photography; no 3D capabilities

### Four Product Pillars

1. **AI Stylist** — Multi-turn chatbot guiding buyers through natural conversation to generate personalized outfit recommendations from the actual product catalog
2. **3D/AR Virtual Try-On** — Buyers build a body profile and visualize outfits on a customizable 3D avatar (SMPL-X based), with WebXR AR on supported devices
3. **Independent Designer Marketplace** — Small designers and fashion students publish products; AI surfaces them organically through styling recommendations
4. **Return Reduction** — Accurate virtual try-on and AI-powered fit recommendations lower the return rate, reducing fashion waste

### Target Users

| Persona | Demographics | Job to Be Done |
|---------|-------------|----------------|
| Fashion-Conscious Buyer | 18-30, digitally native | Go from uncertainty to outfit confidence with minimal friction |
| Independent Designer | Emerging designers, fashion students, small-batch creators | Publish products, get AI-powered distribution, 3D models generated automatically |

---

## Technical Architecture

### Service Topology

```
Next.js 16 (web :3000) ──REST/JSON + JWT──> Spring Boot 3.4 (server :8080) ──JDBC──> MySQL 8
                                                     |
                                             Shared MySQL task tables
                                                     |
                                             Python 3.12 (worker)
                                        3D model + avatar + rigging generation
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, React (all CSR), shadcn/ui, Three.js (3D viewer) |
| Backend API | Java 22, Spring Boot 3.4, Spring Security (JWT), Flyway migrations |
| Database | MySQL 8, Flyway-managed schema (10 migrations) |
| 3D Pipeline | Python 3.12, SMPL-X (avatar), Tripo3D/Meshy (model generation), weight transfer rigging |
| AI Providers | Claude / DeepSeek / MiniMax (pluggable via AIProvider interface) |
| Email | Resend (production), Mailpit (dev) |
| Payments | Stripe Checkout + Webhooks |
| Deployment | Docker Compose (dev), Nginx reverse proxy + Certbot SSL (production) |

### Module Breakdown

| Module | Language | Purpose | Scale |
|--------|----------|---------|-------|
| server | Java 22 | REST API, auth, AI chat, 3D orchestration, Stripe checkout | 21 controllers, 27 services, 22 entities |
| web | TypeScript | Frontend SPA, 3D/AR viewers, community feed | 37 page routes, 74 components |
| worker | Python 3.12 | 3D model + avatar + rigging generation daemon | 3 task queues, 15+ providers |
| nginx | Config | Reverse proxy, SSL termination (production only) | — |

### Key Design Decisions

- All pages are `"use client"` (no RSC) — 3D viewers and animations require client-side rendering
- MySQL task tables are the integration point between server and worker (no message broker)
- Flyway migrations only (Hibernate `ddl-auto: validate`) — explicit schema control
- Login returns 400 (not 401) — constant-time response prevents username enumeration
- Demo items use negative IDs — separates client-side demo data from real DB records

---

## Team & Roles

> **STATUS: Template — to be finalized in team meeting**

| Role | Name | Responsibilities |
|------|------|-----------------|
| Founder / Tech Lead | Jadyn Wu | Product vision, architecture, full-stack development |
| `[TBD]` | `[TBD]` | `[TBD]` |

### Collaboration Tools

| Tool | Purpose |
|------|---------|
| Huly | Project management, knowledge base (Cards), issue tracking |
| GitHub | Source code, PRs, CI/CD |
| Claude Code / CodeX | AI-assisted development |
| Claude Cowork | Browser automation, document processing |
| Figma | UI/UX design |
| Huly | Team communication (Main) |
| Instagram | Team communication (Alternative) |

---

## Business Model & Roadmap

> **STATUS: Template — to be discussed in team meeting**

### Revenue Streams (Draft)

| Stream | Description | Status |
|--------|-------------|--------|
| Marketplace transaction fees | Commission on each sale through the platform | `[To discuss: fee %]` |
| Sponsored product placement | Designers pay for AI-prioritized product surfacing | `[To discuss: pricing]` |
| Premium features | Advanced styling, unlimited saves, priority 3D generation | `[To discuss: tier structure]` |

### Current Phase

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Core Platform | In progress | Auth, catalog, AI chat, 3D viewer, cart & checkout |
| Phase 2: Community | In progress | Posts, follows, likes, designer profiles |
| Phase 3: Growth | Not started | `[To discuss: user acquisition, partnerships]` |
| Phase 4: Scale | Not started | `[To discuss: mobile app, international expansion]` |

### Key Metrics to Track (Draft)

- `[To discuss]` Monthly Active Users (MAU)
- `[To discuss]` Return rate vs industry average
- `[To discuss]` AI chat to purchase conversion rate
- `[To discuss]` Designer onboarding rate
- `[To discuss]` 3D try-on engagement rate

---

## Quick Reference

- **PRD**: `PRD.md` (canonical product spec)
- **Design Doc**: `DESIGN.md` (architecture decisions)
- **Dev Setup**: `dev.sh setup && dev.sh start`
- **Tests**: `cd server && ./gradlew test` / `cd web && npm test` / `cd worker && pytest`
- **Huly Setup Guide**: `docs/huly/huly-knowledge-base-setup.md`
