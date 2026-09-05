# Implementation Report: Phase 1 Deferred Centralizations

Completes the two **structural** refactors that were deferred from the Phase 1 rebrand
(`rebrand-and-foundation.plan.md`, Surfaces F & G) because no JDK was available at impl
time to compile/verify new Java structure. Both were done as literal swaps then; this
branch does the real centralization and verifies it on JDK 22.

Branch: `iyae-brandconfig-email` (off `origin/main` @ 76ef6bb, which already contains all of Phase 1).

## 1. Email consolidation — Option A (Resend-only)

The duplicate transactional-email path is gone. `AuthMailService` now delivers **only** by
POSTing `{type,toEmail,name,actionUrl}` to the Next.js internal route
`/api/internal/mail/send` (which renders `web/lib/email-templates.ts` and calls Resend).

| Change | Detail |
|---|---|
| `AuthMailService.java` | Deleted `buildEmailHtml`, `escapeHtml`, `sendHtmlEmail`, the `JavaMailSender` field, `fromAddress`, and jakarta.mail imports. Kept `sendViaResend`, `escapeJson`, `EmailDeliveryException`. Removed the resend-endpoint blank guard — a blank/failed endpoint now **throws** (no silent no-op); `AuthService` register/forgot-password still swallow it as before. |
| `AuthMailServiceTest.java` | Rewritten (8→6 tests): stands up an in-process `com.sun.net.httpserver.HttpServer` and asserts the real POST — method/path, `x-internal-mail-secret` header, JSON payload (incl. quote-escaping), and `EmailDeliveryException` on non-2xx / unreachable / blank endpoint. |
| `build.gradle.kts` | Removed `spring-boot-starter-mail`. |
| `application.yml` / `-dev` / `-prod` | Removed all `spring.mail.*` blocks and dead `app.mail.from`. |
| `docker-compose.yml` | Removed the **Mailpit** service, `SPRING_MAIL_HOST/PORT` env, and the `depends_on: mailpit`. Dev is now **4 services** (mysql, server, worker, web). `RESEND_MAIL_ENDPOINT` already wires server→web. |
| `docker-compose.prod.yml` | Removed `SMTP_*` env + the dead server `MAIL_FROM` (web sets its own sender via `RESEND_FROM_EMAIL`). |
| `.env.example` | Removed the SMTP section + dead `MAIL_FROM`; documented that email is Resend-only and a no-op in dev without `RESEND_API_KEY`. |
| web | Deleted the dead legacy route `app/api/internal/mail/password-reset/route.ts` and its test `__tests__/api/internal-mail.test.ts`. |

**DX tradeoff (documented):** dev no longer has a Mailpit inbox. To actually deliver mail in
dev, set `RESEND_API_KEY`; otherwise delivery fails and is logged (registration / forgot-password
still succeed). This is the Option-A tradeoff the plan called out.

## 2. BrandConfig centralization

| Side | Change |
|---|---|
| Server | New `config/BrandProperties.java` — `@ConfigurationProperties("app.brand")` record `{domain, serviceId, guestEmail}`, registered via `@ConfigurationPropertiesScan` on `IyaeApplication`, backed by `app.brand.*` in `application.yml`. Injected into `HealthController` + `HealthService` (`serviceId`), `GuestAvatarService` + `AvatarService` (`guestEmail` — ends the two-place duplication), and `DataSeeder` (seed-user domain). |
| Web | New `lib/brand.ts` — `BRAND {name, tagline, domain, url, mailFrom}`, now the single source for 13 UI wordmark sites (nav/footer/landing/headings/copy), the document title, email subjects (`send/route.ts`), and `lib/email-templates.ts`. |

**Scoping note:** narrative/prose copy that merely contains the word "IYAE" — the `ChatService`
system prompt and `MockAIProvider` welcome lines (both `private static final`) — was left inline.
It is prompt/marketing prose, not drift-prone configuration, and centralizing it would add
`ChatServiceTest` risk for negligible benefit. Two code comments mentioning IYAE were also left.

## Validation

| Check | Result |
|---|---|
| `cd server && ./gradlew test` | **336/336 pass**, 0 failures (was 338; AuthMailServiceTest 8→6) |
| `cd web && npx tsc --noEmit` | Clean for all source files (2 pre-existing test-file errors unrelated; stale `.next` cache regenerates on build) |
| `cd web && npx vitest run` | **209 pass** excluding the pre-existing OOM file `useOutfitRiggingStatus.test.ts` (222 total across 16 files, −5 from the deleted internal-mail test) |
| `cd web && npm run build` | Green — all routes compile; confirms the deleted route + brand wiring are sound |
| Residue scan | No `JavaMailSender` / `spring-boot-starter-mail` / `Mailpit` / `SPRING_MAIL` / `SMTP_` in code or infra |

## Not done / follow-ups
- **Docker relaunch smoke** (`./dev.sh reset && ./dev.sh start`) not run — no Docker in this
  environment. The compose edits (Mailpit removal, SMTP env removal) are reasoned-through but
  not runtime-smoke-tested.
- Prose-copy brand literals (ChatService prompt, MockAIProvider) intentionally left inline.
