<!-- Generated: 2026-05-27 | Updated: 2026-06-14 | Services: 6 (dev) / 7 (prod) | Token estimate: ~750 -->

# Architecture

## System Topology

```
                        [Browser]
                           |
               +-----------+-----------+
               |                       |
          (dev: direct)         (prod: Nginx :80/443)
               |                       |
     +---------+---------+    +--------+--------+
     |                   |    |        |        |
  Web :3000         API :3001 |   Web :3000  API :8080
  (Next.js 16)    (Spring Boot)|  (upstream)  (upstream)
                         |    |
                    MySQL :3306
                    ┌────┴────┐
                    │         │
               Worker      Rigging Worker
               (Python)    (Python, profile: rigging)
               polls:      polls:
               - model_generation_tasks
               - avatar_generation_tasks
                           - rigging_tasks
```

## Service Boundaries

| Service | Role | Port (dev) | Port (prod) |
|---------|------|------------|-------------|
| web | Next.js 16 SPA (all CSR), 37 page routes + 2 API routes | 3000 | via Nginx |
| server | Spring Boot 3.4 REST API, auth, AI chat, 3D/rigging orchestration, community, Stripe checkout, guest avatar | 3001→8080 | via Nginx |
| mysql | MySQL 8 data store | 3002→3306 | internal only |
| worker | Python 3.12 3D model + avatar generation daemon | none | none |
| rigging-worker | Python 3.12 garment rigging (weight transfer) daemon | none | none |
| mailpit | Dev SMTP + WebUI | 1025/8025 | replaced by real SMTP |
| nginx | Reverse proxy, SSL, static assets (prod only) | -- | 80/443 |

## Data Flow

```
Auth:     Browser → POST /api/auth/login → AuthService → UserRepo → JWT returned
Chat:     Browser → POST /api/chat/sessions/{id}/messages → ChatService → AIProvider → DB
                    ↳ if [GENERATE_OUTFIT] detected → OutfitService → product matching → response
                    ↳ if [SUGGESTIONS] detected → extracted as suggestion chips → ChatMessageResponse.suggestions
3D Gen:   Designer uploads product → server creates task (PENDING)
          Worker polls → claims (RUNNING) → provider generates → validates → completes (READY)
          Server scheduler materializes READY → GarmentAsset (MATERIALIZED)
Avatar:   User requests avatar → server creates avatar_generation_task (PENDING)
          Worker polls → claims → SMPL-X generates → validates → completes (READY)
Guest:    Anonymous user → POST /api/public/avatar/generate → GuestAvatarService → task (PENDING)
          Worker polls → claims → generates → completes (READY)
Rigging:  Server creates rigging_task for garment asset (PENDING)
          Rigging worker polls → claims → weight transfer → skinned GLB → completes (READY)
Checkout: Browser → POST /api/checkout → CheckoutService → Stripe → Order created
          Stripe → POST /api/webhooks/stripe → StripeWebhookController → order fulfillment
Email:    Server → AuthMailService → JavaMailSender → Mailpit (dev) / SMTP (prod)
          Server → internal API → Web (Resend SDK) → Resend API (prod)
Community:Browser → POST /api/posts → PostService → PostRepo → DB
          Browser → POST /api/follows/{userId} → FollowService → FollowRepo → DB
```

## Integration Points

- **Server ↔ Worker**: `model_generation_tasks` + `avatar_generation_tasks` MySQL tables
- **Server ↔ Rigging Worker**: `rigging_tasks` MySQL table
- **Server ↔ AI**: AIProvider interface (mock/claude/deepseek/minimax)
- **Server ↔ Stripe**: CheckoutService → StripeCheckoutGateway, StripeWebhookController
- **Server → Web (internal mail)**: Internal API with shared secret for Resend email delivery
- **Web → Server**: REST/JSON + JWT Bearer token via `/api/*` proxy
- **Server → Email**: JavaMailSender (Mailpit dev, authenticated SMTP prod, Resend fallback via web)
- **Nginx → All**: Reverse proxy with security headers (prod)
