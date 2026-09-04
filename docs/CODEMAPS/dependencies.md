<!-- Generated: 2026-05-27 | Updated: 2026-06-14 | External services: 9 | Token estimate: ~650 -->

# Dependencies & External Services

## External APIs

| Service | Used By | Config | Purpose |
|---------|---------|--------|---------|
| Claude API | server (ClaudeProvider) | `ANTHROPIC_API_KEY` | AI styling chat (claude-sonnet-4-20250514) |
| DeepSeek API | server (DeepSeekProvider) | `DEEPSEEK_API_KEY` | Cost-effective AI alternative |
| MiniMax API | server (MiniMaxProvider) | `MINIMAX_API_KEY` | China market AI provider |
| Tripo3D API | worker (TripoGenerator) | `WORKER_TRIPO_API_KEY` | Image-to-3D model generation |
| Meshy API | worker (MeshyGenerator) | `WORKER_MESHY_API_KEY` | Image-to-3D generation (GLB + USDZ) |
| Stripe API | server (CheckoutService) | `STRIPE_SECRET_KEY` | Payment processing (checkout sessions, webhooks) |
| Resend API | web (internal mail routes) | `RESEND_API_KEY` | Transactional email delivery (verification, password reset) |
| SMTP (prod) | server (AuthMailService) | `SMTP_HOST/PORT/USERNAME/PASSWORD` | Transactional email (fallback to Resend) |

## Infrastructure Services

| Service | Role | Dev | Prod |
|---------|------|-----|------|
| MySQL 8 | Primary data store | Docker :3002 | Docker (internal) |
| Mailpit | Dev SMTP capture | Docker :1025/:8025 | Not used |
| Nginx | Reverse proxy + SSL | Not used | Docker :80/:443 |
| Certbot | SSL provisioning | Not used | Docker (on-demand) |
| rigging-worker | Garment rigging pipeline | Docker (profile: rigging) | Docker (profile: rigging) |

## Server Dependencies (Spring Boot 3.4 / Java 22)

```
spring-boot-starter-web          # REST framework
spring-boot-starter-data-jpa     # Hibernate + Spring Data
spring-boot-starter-security     # Auth framework
spring-boot-starter-validation   # Jakarta Bean Validation
spring-boot-starter-mail         # JavaMailSender
mysql-connector-j                # MySQL JDBC driver
flyway-core + flyway-mysql       # Database migrations
lombok                           # Boilerplate reduction
jjwt (io.jsonwebtoken)           # JWT generation/validation
jackson-databind                 # JSON processing
stripe-java                      # Stripe API client
```

## Web Dependencies (Next.js 16)

```
Framework:  next@16, react@19, react-dom@19
UI:         tailwindcss@4, @radix-ui/* (19 pkgs), lucide-react, sonner, next-themes
3D/AR:      three@0.184, @react-three/fiber@9, @react-three/drei@10, @react-three/xr@6
Email:      resend@6 (Resend SDK for transactional emails)
Utilities:  clsx, tailwind-merge, class-variance-authority
Testing:    vitest@4, @testing-library/react@16, @playwright/test@1.60
```

## Worker Dependencies (Python 3.12)

```
# Core (requirements.txt)
mysql-connector-python>=8.0.33   # Direct SQL (no ORM)
requests>=2.31.0                 # HTTP client for APIs
pytest>=7.4.0                    # Testing
scipy>=1.11.0                    # Sparse linear algebra
pygltflib>=1.16.0                # GLB/glTF I/O

# Avatar generation (SMPL-X, optional)
torch>=2.0.0                     # PyTorch
smplx>=0.1.28                    # SMPL-X body model
trimesh>=4.0.0                   # 3D mesh processing
numpy>=1.24.0                    # Numerical computing

# Rigging worker (Dockerfile.rigging only)
libigl                           # Geometry processing
robust-laplacian                 # Laplacian solver for weight transfer
```

## Shared Volumes

| Volume | Services | Content |
|--------|----------|---------|
| mysql_data | mysql | Database files |
| assets_data | server, worker, nginx | Uploaded images + generated 3D models |
| letsencrypt | nginx, certbot | SSL certificates (prod) |

## Integration Contracts

| Contract | Type | Between | Schema |
|----------|------|---------|--------|
| model_generation_tasks | MySQL table | server ↔ worker | status enum, input/output JSON, claimed_at |
| avatar_generation_tasks | MySQL table | server ↔ worker | status enum, input/output JSON, claimed_at |
| rigging_tasks | MySQL table | server ↔ rigging-worker | status enum, input/output JSON, claimed_at |
| /api/* REST | HTTP + JWT | web → server | JSON request/response, Bearer auth |
| /api/internal/mail/* | HTTP + shared secret | server → web | Internal mail API (Resend delivery) |
| /api/webhooks/stripe | HTTP + signature | Stripe → server | Webhook events (checkout.session.completed) |
| assets volume | Filesystem | worker → nginx | GLB/USDZ files at `/assets/products/{pid}/tasks/{tid}/` |
