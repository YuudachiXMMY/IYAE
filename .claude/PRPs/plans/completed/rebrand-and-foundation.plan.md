# Plan: Rebrand & Foundation (Clossette → IYAE)

## Summary
Cut the entire codebase over from the legacy "Clossette" brand to **IYAE** as a fresh, independent-company relaunch: rename the Java package `com.clossette` → `com.iyae` (220 files), atomically move the hardcoded asset path `/var/clossette` → `/var/iyae` (~40 sites), rebrand the DB/domain/SSL/CORS/sender infrastructure, fix currency so **CAD is the single source of truth** (the real bug: everything except the Stripe charge defaults to USD), centralize scattered brand literals into a `BrandConfig` (server `BrandProperties` + web `lib/brand.ts`), consolidate transactional email onto the web/Resend path (delete the duplicate Java HTML), and delete the dead `web/tailwind.config.ts`. This is a mechanical, high-blast-radius but low-logic-risk refactor guarded by the existing ~338 server + 227 web + 292 worker tests.

## User Story
As **the IYAE founder relaunching as an independent company**, I want the platform to boot as "IYAE" everywhere — package, database, domains, emails, currency, and UI wordmarks — with zero "Clossette"/"FORME" residue and correct CAD pricing, so that the new brand launches on a clean, consistent, trustworthy foundation and every later phase builds on IYAE rather than legacy naming.

## Problem → Solution
**Current state:** The codebase is entirely "Clossette" — Java package `com.clossette` (220 files / 859 refs), DB name/user `clossette`, filesystem path `/var/clossette`, domains `clossette.localhost` / `noreply@clossette.ca`, UI wordmarks "Clossette"/"CLOSSETTE", and a currency mismatch where Stripe charges CAD but the data model, seed data, and all 7 web price formatters default to USD. Brand values are copy-pasted and already drifting (`.com` vs `.ca`, `Inter` vs `Geist`, title-case vs all-caps). A dead `tailwind.config.ts` hardcodes the old brand purple, and transactional email HTML is duplicated in both Java and web.
**Desired state:** One coherent IYAE foundation — `com.iyae`, DB/user/path/domain/cert all `iyae`, CAD as the single currency source of truth, a single `BrandConfig` per side, email templates only in web/Resend, no dead config — all green against the regression suite, deployable as a fresh relaunch.

## Metadata
- **Complexity**: XL (220-file package move + ~40 asset-path sites + ~50 brand/currency edits + infra + email refactor; ~300+ touched files, but overwhelmingly mechanical)
- **Source PRD**: `.claude/PRPs/prds/iyae.prd.md`
- **PRD Phase**: Phase 1 — Rebrand & Foundation (the gate for all other phases; no dependencies)
- **Estimated Files**: ~300 (220 Java moves + ~40 asset-path + ~25 brand + ~15 CAD + ~15 infra/config + 2 new BrandConfig + deletions)
- **Delivery unit**: Recommend a **single atomic "IYAE relaunch" commit** (fresh DB, no old volume), because a running deployment mixing the old volume path with new code would 404 every 3D asset/upload.

---

## UX Design

Phase 1 is overwhelmingly internal, but three touchpoints are user-visible.

### Before
```
┌─────────────────────────────────────────────┐
│  NavBar:  "Clossette"      Landing: CLOSSETTE │
│  PDP:     "$88.00 USD"   ← labeled USD…       │
│  Checkout:"$88.00 USD"   ← …but Stripe charges│
│           Stripe session currency = CAD  ⚠   │
│  Email:   "Verify your Clossette account"     │
└─────────────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────────────┐
│  NavBar:  "IYAE"           Landing: IYAE      │
│  PDP:     "$88.00"       ← en-CA / CAD        │
│  Checkout:"$88.00"       ← matches Stripe CAD │
│           Stripe session currency = CAD  ✓   │
│  Email:   "Verify your IYAE account"          │
└─────────────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Brand wordmark (nav/footer/landing/emails) | "Clossette" / "CLOSSETTE" | "IYAE" / "IYAE" | Single source `BRAND.name`; `.toUpperCase()` only at the 2 landing sites |
| Price display (PDP, cart, checkout, orders, designer, list) | `en-US` + `USD` fallback → "US$88 / $88 USD" | `en-CA` + `CAD` fallback → "$88.00" | Removes the display-vs-charge mismatch; Stripe already charges CAD |
| Transactional email subject/body | "…your Clossette account/password" | "…your IYAE account/password" | Rendered only from `web/lib/email-templates.ts` |
| Dev domains | `clossette.localhost` | `iyae.localhost` | Only relevant with Traefik proxy running |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `.claude/PRPs/prds/iyae.prd.md` | 84–110, 174–177, 225–239 | Phase 1 scope, MoSCoW, and locked brand/data/currency decisions |
| P0 | `server/src/main/resources/application.yml` | 1–50 | Datasource `${DB_NAME:clossette}`/`${DB_USERNAME:clossette}`, CORS default, `app.mail.from` `.com` drift — the config to rebrand |
| P0 | `docker-compose.yml` | 1–154 | DB name/user, network `clossette-net`, container `clossette-mailpit`, traefik labels, `/var/clossette` mounts |
| P0 | `server/src/main/java/com/clossette/service/CheckoutService.java` | 85 | Proves CAD is intended (`.setCurrency("cad")`); anchor for the currency-source-of-truth fix |
| P0 | `server/src/main/java/com/clossette/service/ProductService.java` | 126 | The REAL currency bug: `?: "USD"` default |
| P0 | `server/src/main/java/com/clossette/service/AuthMailService.java` | all | Duplicate email HTML + Resend/SMTP fallback to consolidate |
| P1 | `web/lib/email-templates.ts` | all | The surviving canonical email templates (rebrand here) |
| P1 | `web/app/globals.css` | `@theme` block (~10–70) | Confirms `--color-brand:#9333ea` is the LIVE token source; `tailwind.config.ts` copy is dead |
| P1 | `web/postcss.config.mjs` + `web/components.json` | all | Confirms Tailwind v4 CSS-first (no `@config`); `components.json:7` is the only `tailwind.config.ts` reference |
| P1 | `docker-compose.prod.yml` | 1–120 | Prod DB/user/network/mounts/sender + nginx read-only asset mount |
| P1 | `nginx/conf.d/default.conf` | 9–127 | Active HTTP block asset aliases (36,42); commented HTTPS block (72–127) with cert paths (79,80) |
| P1 | `prod_deploy.sh` | 145–200 | `--cert-name clossette` (152) + letsencrypt health path (198) |
| P2 | `server/src/main/java/com/clossette/config/WebMvcConfig.java` | 1–40 | Static resource handler; `@Value("${worker.output-dir:/var/clossette/assets}")` default is effective (no override exists) |
| P2 | `server/src/main/java/com/clossette/config/DataSeeder.java` | 51–83, 140–672 | 5 seed emails `@clossette.com` + 36 `.currency("USD")` |
| P2 | `worker/main.py` | 23 + provider construction | `OUTPUT_BASE_DIR` env default; confirms which provider defaults leak |

---

## External Documentation

No new external libraries. Version-specific gotchas that matter:

| Topic | Source | Key Takeaway |
|---|---|---|
| Tailwind v4 CSS-first config | `web/postcss.config.mjs` (`@tailwindcss/postcss`) + `web/app/globals.css` (`@import "tailwindcss"` + `@theme`) | JS `tailwind.config.ts` is NOT loaded without an `@config` directive → safe to delete; live tokens live in `@theme` |
| Spring Boot main-class autodetection | `server/Dockerfile` (globs `*.jar`), no `springBoot{mainClass}` block | Renaming the `@SpringBootApplication` class needs no build wiring |
| BSD vs GNU sed (darwin) | Platform = darwin | Use `sed -i ''` (empty backup arg); GNU would be `sed -i` |
| MySQL first-init only | `docker-compose.yml` `MYSQL_DATABASE`/`MYSQL_USER` | DB/user created only on first volume init → fresh relaunch requires `docker compose down -v` |
| `Intl.NumberFormat` locale vs currency | web price formatters | `en-CA` + `CAD` → "$88.00"; `en-US` + `CAD` → "CA$88.00". Use `en-CA`. |

---

## Patterns to Mirror

### BRAND_CONSTANTS_MAP (single source of truth for all target values)
```
Java package     com.clossette              → com.iyae
Main class       ClossettApplication        → IyaeApplication
Gradle group     com.clossette              → com.iyae
Gradle project   clossette-server           → iyae-server
DB name / user   clossette                  → iyae
Asset path       /var/clossette/assets      → /var/iyae/assets
SMPL-X path      /var/clossette/smplx_models→ /var/iyae/smplx_models
Dev web domain   clossette.localhost        → iyae.localhost
Dev api domain   api.clossette.localhost    → api.iyae.localhost
Prod domains     (clossette.ca)             → iyae.ca / api.iyae.ca
Sender           noreply@clossette.ca/.com  → noreply@iyae.ca
SSL cert-name    clossette                  → iyae
Guest email      guest@clossette.internal   → guest@iyae.internal
Health serviceId clossette-server           → iyae-server
Docker network   clossette-net              → iyae-net
Mailpit container clossette-mailpit         → iyae-mailpit
Traefik routers  clossette-api / -web       → iyae-api / -web
Seed emails      *@clossette.com            → *@iyae.ca
Brand wordmark   Clossette / CLOSSETTE      → IYAE
Default currency USD                        → CAD
```

### PACKAGE_RENAME (git-history-preserving, anchored)
```bash
# SOURCE: java-package-rename surface. darwin/BSD sed => -i ''
cd /Users/jadyn/Development/IYAE/server
git mv src/main/java/com/clossette src/main/java/com/iyae
git mv src/test/java/com/clossette src/test/java/com/iyae
git mv src/main/java/com/iyae/ClossettApplication.java      src/main/java/com/iyae/IyaeApplication.java
git mv src/test/java/com/iyae/ClossettApplicationTests.java src/test/java/com/iyae/IyaeApplicationTests.java
# Anchored (com\. prefix) so it does NOT touch guest@clossette.internal, /var/clossette,
# luna@clossette.com, "Clossette" copy, clossette-server, clossette.localhost:
grep -rl 'com\.clossette' src build.gradle.kts | xargs sed -i '' 's/com\.clossette/com.iyae/g'
sed -i '' 's/ClossettApplication/IyaeApplication/g' \
  src/main/java/com/iyae/IyaeApplication.java src/test/java/com/iyae/IyaeApplicationTests.java
sed -i '' 's/clossette-server/iyae-server/' settings.gradle.kts
./gradlew test
```

### ASSET_PATH_REPLACE (atomic substring, whole repo)
```bash
# SOURCE: asset-paths surface. Replaces both /assets and /smplx_models in one pass;
# does NOT touch DB name/package/domain (none contain the /var/clossette/ prefix).
grep -rl '/var/clossette/' . --exclude-dir=.git --exclude-dir=.codegraph \
  --exclude-dir=node_modules --exclude-dir=build --exclude-dir=.gradle \
  | xargs sed -i '' 's#/var/clossette/#/var/iyae/#g'
```

### CURRENCY_DEFAULT — server (SOURCE: server/.../service/ProductService.java:126)
```java
// current → change "USD" to "CAD"
.currency(request.currency() != null ? request.currency() : "USD")
```

### CURRENCY_DISPLAY — web (SOURCE: web/components/ProductListItem.tsx:29-31, repeated in 6 more files)
```ts
  return new Intl.NumberFormat("en-US", {   // → "en-CA"
    style: "currency",
    currency: currency || "USD",            // → currency || "CAD"
```

### CONFIG_PROPERTIES — existing pattern the whole server uses is `@Value` (SOURCE: CheckoutService.java:47-54)
```java
@Value("${STRIPE_SECRET_KEY:}")
private String stripeSecretKey;
@Value("${app.frontend.base-url:http://localhost:3000}")
private String frontendBaseUrl;
```
> The server has **no existing `@ConfigurationProperties`** — everything is `@Value`. For `BrandConfig`, prefer whichever matches house style: a small `@Component` with `@Value` fields (mirrors existing code exactly) OR a `@ConfigurationProperties(prefix="app.brand")` record (cleaner, but a new pattern). This plan uses the record form; downgrade to `@Value` if consistency is preferred.

### EMAIL_RESEND_PATH — the surviving delivery seam (SOURCE: AuthMailService.sendViaResend, ~111-147)
```java
// KEEP: POSTs {type,toEmail,name,actionUrl} to app.mail.resend-endpoint
//       with header x-internal-mail-secret; escapeJson() guards the body.
// DELETE around it: buildEmailHtml(), escapeHtml(), sendHtmlEmail(), JavaMailSender field.
```

### TEST_STRUCTURE — server (SOURCE: server/CLAUDE.md test inventory)
```
JUnit5 + Mockito (@ExtendWith(MockitoExtension)) for services;
@WebMvcTest for controllers; H2 + Flyway-off via application-test.yml.
Brand/currency literals are asserted in: ProductServiceTest, TestProducts,
AuthMailServiceTest, HealthControllerTest/HealthServiceTest,
web internal-mail*.test.ts, and e2e register/auth specs — all must move in lockstep.
```

---

## Files to Change

> Full per-site detail (exact current→target) lives in each surface's mapping; the master list below groups by surface. **Ordering rule:** do all literal-keyed content edits FIRST (they don't depend on the directory name), then run PACKAGE_RENAME LAST as the structural move — the anchored `com.clossette` sed will also fix the `package` decl of any new file (e.g. `BrandProperties.java`).

### Surface A — Java Package Rename (`com.clossette` → `com.iyae`)
| File | Action | Justification |
|---|---|---|
| `server/src/main/java/com/clossette/` (168 files) | MOVE → `com/iyae/` | `git mv` preserves history |
| `server/src/test/java/com/clossette/` (52 files) | MOVE → `com/iyae/` | test tree move |
| `ClossettApplication.java` / `ClossettApplicationTests.java` | RENAME → `Iyae…` | class + file rename (`s/ClossettApplication/IyaeApplication/g`) |
| 220 `package` decls + 637 `import` lines + FQNs (`ChatService.java:148`, `IyaeApplicationTests.java:101`) | EDIT | anchored `s/com\.clossette/com.iyae/g` |
| `server/build.gradle.kts:7` (`group`) | EDIT | caught by anchored sed |
| `server/settings.gradle.kts:5` (`rootProject.name`) | EDIT | separate `s/clossette-server/iyae-server/` |
| `application-dev.yml:14`, `application-prod.yml:23` (`com.clossette:` log key) | EDIT | caught by anchored sed (under `src`) |
| `server/Dockerfile` | VERIFY (no change) | globs `*.jar`, no main-class pin |

### Surface B — Asset Path (`/var/clossette` → `/var/iyae`)
| File | Action | Justification |
|---|---|---|
| `docker-compose.yml` (45,83,85,87,88,104,106,108,109) | EDIT | dev volume/env mounts (server+worker+rigging-worker) |
| `docker-compose.prod.yml` (46,74,76,78,79,115) | EDIT | prod mounts incl. nginx `:ro` |
| `server/.../config/WebMvcConfig.java:11`, `GlbAssetInitializer.java:30` | EDIT | `@Value` defaults are **effective** (no override) |
| `server/.../service/FileStorageService.java:19` | EDIT | hardcoded `UPLOAD_DIR`; **recommended fix**: read `@Value("${worker.output-dir:/var/iyae/assets}") + "/uploads/products"` |
| `nginx/conf.d/default.conf` (36,42 active; 100,106 commented) | EDIT | filesystem `alias` (NOT the `/assets/` URL prefix) |
| `worker/main.py:23` | EDIT | `OUTPUT_BASE_DIR` env default |
| `worker/providers/*.py` (stub_generator:36, tripo:15, meshy:17, smplx_stub:217, smplx:111 **+112 model_path**, stub_rigging:160, python_rigging:25, blender:42) | EDIT | provider defaults; **smplx:112 `model_path` LEAKS** (never overridden) |
| `worker/tests/test_meshy_generator.py:60`, `test_blender_rigging_provider.py` (63,84,88,359,368,372) | EDIT | 7 tests assert the exact string |
| `.env.example:72`, `CLAUDE.md:180`, `worker/CLAUDE.md:300,364`, `PRD.md:404`, `DESIGN.md:30` | EDIT | docs/comments |

### Surface C — DB Relaunch + Infra Config
| File | Action | Justification |
|---|---|---|
| `docker-compose.yml` (6,7 MYSQL_DATABASE/USER; 28,29,75,76,100,101 DB_NAME/USERNAME; 56,141,146 `clossette-net`; 62 `clossette-mailpit`; 53,54,138,139 traefik) | EDIT | DB name/user + network/container/router names → `iyae` |
| `docker-compose.prod.yml` (6,7,26,27,66,67 DB; 17,57 network) | EDIT | prod DB/network |
| `server/src/main/resources/application.yml` (3 `${DB_NAME:clossette}`, 4 `${DB_USERNAME:clossette}`) | EDIT | datasource defaults → `iyae` |
| `dev.sh` (3 header comment; 195 `mysqldump -u clossette … clossette`; 212 `mysql -u clossette … clossette`) | EDIT | DB backup/restore user+name |
| Flyway `V1–V10` bodies | VERIFY (leave) | no DB-name strings; V4 seed-email `UPDATE` is a no-op on fresh DB |

### Surface D — Domain / SSL / nginx / CORS / Sender
| File | Action | Justification |
|---|---|---|
| `.env.example` (53 CORS, 93 WEB_DOMAIN, 94 API_DOMAIN, 108 MAIL_FROM) | EDIT | domain + sender defaults |
| `docker-compose.yml` (37 CORS default) | EDIT | dev CORS fallback |
| `docker-compose.prod.yml:42` (MAIL_FROM default `.ca`) | EDIT | → `noreply@iyae.ca` |
| `server/src/main/resources/application.yml` (39 CORS default, 43 `app.mail.from` **`.com` drift**) | EDIT | unify to `iyae.localhost` + `noreply@iyae.ca` |
| `prod_deploy.sh` (152 `--cert-name`, 198 letsencrypt path) | EDIT | cert-name → `iyae` (must match nginx 79/80) |
| `nginx/conf.d/default.conf` (79,80 commented cert paths; 67 doc-comment `deploy.sh`→`prod_deploy.sh`) | EDIT | keep in sync for post-ssl-init uncomment |
| Test sender pins: `AuthMailServiceTest.java:35`, `web/__tests__/api/internal-mail-send.test.ts:31,140`, `internal-mail.test.ts:31` | EDIT | lockstep with sender rebrand |

### Surface E — CAD Single Source of Truth
| File | Action | Justification |
|---|---|---|
| `server/.../service/CheckoutService.java:85` | VERIFY (already `"cad"`) | anchor proving intent |
| `server/.../service/ProductService.java:126` | EDIT | `"USD"` → `"CAD"` (primary default fix) |
| `server/.../config/DataSeeder.java` (36× `.currency("USD")`) | EDIT (replace_all) | seed products → CAD |
| `server/.../entity/Product.java:38-39` | VERIFY (no default) | effective default lives in ProductService |
| `ProductServiceTest.java` (379 method name, 395 mock, 408 assert, 116/133/340/355 fixtures) | EDIT | flip USD→CAD assertions/fixtures |
| `testsupport/TestProducts.java` (31,57) | EDIT | shared fixtures → CAD |
| Web formatters: `components/ProductListItem.tsx` (29-31), `app/products/[id]/page.tsx` (74,76), `app/cart/page.tsx` (14-16), `app/checkout/page.tsx` (24,25), `app/designer/products/page.tsx` (41,43), `app/orders/page.tsx` (57,59), `app/orders/[id]/page.tsx` (245-262) | EDIT | `en-US`→`en-CA`, `USD`→`CAD` (currency blocks only, NOT date formatters) |
| `app/outfits/page.tsx` (66,141), `app/outfits/[id]/view/page.tsx` (323) | EDIT (optional) | raw `$` literals → CAD formatter for consistency |

### Surface F — BrandConfig + Brand Strings + Dead Config
| File | Action | Justification |
|---|---|---|
| `web/lib/brand.ts` | CREATE | web single source: `{name:"IYAE", tagline, domain:"iyae.ca", url, mailFrom, social}` |
| `server/.../config/BrandProperties.java` | CREATE | `@ConfigurationProperties("app.brand")` record `{name,domain,url,mailFrom,guestEmail,supportEmail}` (or `@Value` component) |
| `server/src/main/resources/application.yml` (add `app.brand.*`; fix `app.mail.from` `.com`→`.ca`) | EDIT | backs BrandProperties |
| Web rendered literals → `{BRAND.name}`: `layout.tsx:19`, `NavBar.tsx:128`, `Footer.tsx:8,21`, `home/LandingNav.tsx:153`, `home/LandingFooter.tsx:12,38`, `home/AIStylistSection.tsx:405`, `register/page.tsx:99`, `status/page.tsx:123`, `register/StepAvatar.tsx:26`, `home/SocialProofSection.tsx:64`, `profile/[username]/page.tsx:108` | EDIT | `.toUpperCase()` at the 2 landing sites |
| Server literals → `brand.name()`/`brand.guestEmail()`: `AuthMailService.java` (subjects/copy/HTML wordmarks), `GuestAvatarService.java:29`, `AvatarService.java:152`, `HealthController.java:23`+`HealthService.java:20` (`clossette-server`), `MockAIProvider.java:16`, `ChatService.java:38`, `GlbPlaceholderGenerator.java:49` | EDIT | dedupe guest email; rebrand copy |
| `web/tailwind.config.ts` | DELETE | dead under v4 (`#9333ea` lives in `globals.css @theme`) |
| `web/components.json:7` (`"config": "tailwind.config.ts"`) | EDIT → `""` | only reference; prevents `shadcn add` error |
| `HealthControllerTest.java:37`, `HealthServiceTest.java:29` | EDIT | assert `iyae-server` |
| E2E: `register-wizard.spec.ts:27,107`, `auth.spec.ts:26` (`Join Clossette`) | EDIT | lockstep with `register/page.tsx:99` |
| `DataSeeder.java` seed emails (51,59,67,75,83 `@clossette.com`) | EDIT → `@iyae.ca` | governs fresh-relaunch seed |

### Surface G — Email Consolidation (recommend Option A: Resend-only)
| File | Action | Justification |
|---|---|---|
| `AuthMailService.java` `buildEmailHtml` (178-250), `escapeHtml` (263-272), `sendHtmlEmail` (153-166), `JavaMailSender` field (23), `fromAddress` (28-29), jakarta.mail imports | DELETE | remove duplicate HTML + SMTP coupling; **KEEP** `sendViaResend`, `escapeJson`, `EmailDeliveryException`, `resendEndpoint`, `internalMailSecret` |
| `AuthMailService.java` `sendVerificationEmail`/`sendPasswordResetEmail` (59-67, 92-100) | EDIT | call `sendViaResend` only; drop the resend-endpoint blank guard so email can't silently no-op |
| `web/app/api/internal/mail/send/route.ts` (6-9 subjects, 52 from) | EDIT | keep as sole endpoint; subjects → IYAE; from `BRAND.mailFrom` |
| `web/lib/email-templates.ts` (40,66,82,85,91,93,95) | EDIT | Clossette→IYAE (canonical templates) |
| `web/app/api/internal/mail/password-reset/route.ts` | DELETE | dead legacy route (never called) |
| `web/__tests__/api/internal-mail.test.ts` | DELETE | tests the deleted legacy route |
| `web/__tests__/api/internal-mail-send.test.ts` (138,140,155) | EDIT | rebrand asserted strings |
| `AuthMailServiceTest.java` (8 tests) | EDIT/REWRITE | SMTP-based; rewrite to assert the Resend POST (or Option B keep + rebrand strings) |
| `build.gradle.kts:32` (`spring-boot-starter-mail`), `application*.yml` `spring.mail` blocks, compose SMTP/Mailpit env, `.env.example` SMTP section | EDIT (Option A) | remove SMTP wiring; **Option B keeps them** |
| `docs/CODEMAPS/dependencies.md`, `frontend.md` | EDIT | doc sync |

## NOT Building
- **Design-system color/typography reskin** — the `@theme` token rewrite (White/Burgundy/Ink, serif+sans), shadcn regen, and `home/` rebuild are **Phase 2**. Phase 1 only *deletes* the dead `tailwind.config.ts`; it does NOT change `--color-brand:#9333ea` in `globals.css` or the email `#9333ea` accents.
- **Email verification ON in prod** and **rate-limit `trusted-proxies`** — these are **Phase 9** (Hardening). Leave `require-email-verification: false` and the in-memory rate limiter as-is.
- **AI voice / prompts, try-on hardening, marketplace/ADMIN, community, resale, shipping** — Phases 3–8.
- **Renaming `clossette_*` localStorage/session keys** (`clossette_token`, `clossette_demo_cart_items`, `clossette_demo_looks`, `clossette_profile_surface`, `clossette-community-state-*`, `clossette_guest_glb`) — NOT user-facing; renaming logs out users / drops demo state. Defer to a separate keyed-migration surface if ever wanted.
- **Editing applied Flyway migration bodies** (V1–V10) — V4's seed-email `UPDATE` is a no-op on fresh DB; DataSeeder.java governs the relaunch seed.
- **Font drift resolution** (docs say Inter, code uses Geist) — a doc/name reconciliation, not a Phase-1 rename blocker (note in Risks).
- **Data migration** — fresh relaunch discards old users/orders/assets (PRD decision).
- **New OG/favicon/manifest brand assets** — manual asset work outside string mapping.

---

## Step-by-Step Tasks

> Execute in a worktree; land as one atomic relaunch commit. Tasks 1–7 are content edits on the still-`com/clossette/` tree; **Task 8 (package move) runs LAST**. Guard continuously with `./gradlew test`, `npm run test`, `pytest`.

### Task 1: CAD single source of truth
- **ACTION**: Make CAD the default across data model, seed data, and web display.
- **IMPLEMENT**: `ProductService.java:126` `"USD"`→`"CAD"`; `DataSeeder.java` replace_all `.currency("USD")`→`.currency("CAD")` (36×); flip `ProductServiceTest.java` (379 name, 395 mock, 408 assert, 116/133/340/355 fixtures) and `TestProducts.java` (31,57); in the 7 web formatters change `"en-US"`→`"en-CA"` and `"USD"`→`"CAD"` **only inside `NumberFormat` currency blocks**.
- **MIRROR**: CURRENCY_DEFAULT, CURRENCY_DISPLAY.
- **IMPORTS**: none new.
- **GOTCHA**: Do NOT blanket-`sed` `en-US`→`en-CA` — it would rewrite `toLocaleDateString('en-US')` date formatters (status/looks/orders/[id]/PromotionList). Edit currency blocks only. Exact literal `"USD"` won't collide with `usdz`/`usd` substrings.
- **VALIDATE**: `grep -rn '"USD"' server/src/main` → 0; `cd server && ./gradlew test`; `cd web && npm run test`.

### Task 2: Asset path atomic move (`/var/clossette` → `/var/iyae`)
- **ACTION**: One repo-wide substring replace + the FileStorageService source-of-truth fix.
- **IMPLEMENT**: Run ASSET_PATH_REPLACE. Then refactor `FileStorageService.java:19` to read `@Value("${worker.output-dir:/var/iyae/assets}")` + `"/uploads/products"` instead of the hardcoded constant. Verify `smplx_provider.py:112 model_path` changed (it leaks).
- **MIRROR**: ASSET_PATH_REPLACE.
- **IMPORTS**: `org.springframework.beans.factory.annotation.Value` in FileStorageService (if adding `@Value`).
- **GOTCHA**: Do NOT touch `/assets/` or `/uploads/` **URL** prefixes (nginx `location`, `addResourceHandler`, payload URLs). The named volume `assets_data` stays; only mount targets change. 7 worker tests assert the string — they're covered by the same sed.
- **VALIDATE**: `grep -rn '/var/clossette' . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.codegraph` → nothing; `cd worker && pytest`; `cd server && ./gradlew test`.

### Task 3: DB relaunch + infra names (`clossette` → `iyae`)
- **ACTION**: Rename DB name/user, docker network/container/router names, datasource defaults, and dev.sh DB commands.
- **IMPLEMENT**: Edit compose (dev+prod) `MYSQL_DATABASE`/`MYSQL_USER`/`DB_NAME`/`DB_USERNAME`→`iyae`, `clossette-net`→`iyae-net` (declaration + both `networks:` refs), `clossette-mailpit`→`iyae-mailpit`, traefik `clossette-api/-web`→`iyae-api/-web` (router+service in lockstep); `application.yml:3,4` `${DB_NAME:iyae}`/`${DB_USERNAME:iyae}`; `dev.sh:195,212` `-u iyae … iyae`, and header comment.
- **MIRROR**: BRAND_CONSTANTS_MAP.
- **GOTCHA**: MySQL creates DB/user only on first volume init → the relaunch needs `docker compose down -v` (drops `mysql_data`). Flyway replays V1–V10 clean on the empty DB; V4's seed-email UPDATE is a no-op.
- **VALIDATE**: `grep -rniE 'clossette' docker-compose.yml docker-compose.prod.yml dev.sh` → 0; `./dev.sh reset && ./dev.sh start` boots healthy; `/api/health` 200.

### Task 4: Domain / SSL / nginx / CORS / sender
- **ACTION**: Rebrand all domain/cert/CORS/sender tokens; unify sender to `noreply@iyae.ca`.
- **IMPLEMENT**: `.env.example` (53,93,94,108), compose dev CORS (37), compose prod MAIL_FROM (42), `application.yml` (39 CORS, 43 `.com`→`iyae.ca`), `prod_deploy.sh` (152 `--cert-name iyae`, 198 path), `nginx/conf.d/default.conf` (79,80 cert paths; 67 doc-comment), and the 4 test sender pins. Do api-domain sed before web-domain (broader pattern) — see mechanics.
- **MIRROR**: BRAND_CONSTANTS_MAP; domain-ssl-nginx mechanics.
- **GOTCHA**: `--cert-name` (prod_deploy 152), health path (198), and nginx cert paths (79,80) must ALL read `iyae`. nginx HTTPS block is commented — edits are inert until uncommented post-`ssl-init`. `ssl-init` passes one `-d`; add a 2nd `-d api.iyae.ca` (prod_deploy 153) for a SAN cert if needed. `internal-mail-send.test.ts:31↔140` must change together.
- **VALIDATE**: `grep -rniE 'clossette\.(localhost|ca|com)|cert-name clossette|live/clossette' .env.example docker-compose*.yml prod_deploy.sh nginx server/src/main/resources web/__tests__` → 0; `cd server && ./gradlew test`; `cd web && npm run test`.

### Task 5: BrandConfig + brand strings + delete dead config
- **ACTION**: Create both BrandConfigs, replace rendered literals, delete `tailwind.config.ts`.
- **IMPLEMENT**: Create `web/lib/brand.ts` and `server/.../config/BrandProperties.java` (register via `@EnableConfigurationProperties` or a `@Component`+`@Value`); add `app.brand.*` to `application.yml`. Replace all web rendered literals with `{BRAND.name}` (`.toUpperCase()` at LandingNav:153/LandingFooter:12); inject `BrandProperties` into `AuthMailService`/`GuestAvatarService`/`AvatarService`/`HealthController`/`HealthService` and replace literals. Dedupe guest email via `brand.guestEmail()`. Delete `web/tailwind.config.ts`; set `components.json:7` → `""`. Update `HealthControllerTest`/`HealthServiceTest`, e2e register/auth specs, and `DataSeeder.java` seed emails → `@iyae.ca`.
- **MIRROR**: CONFIG_PROPERTIES; brandconfig-strings surface.
- **IMPORTS**: web `import { BRAND } from '@/lib/brand'`; server `@RequiredArgsConstructor` constructor injection.
- **GOTCHA**: AuthMailService email HTML wordmarks (206,232) are Java text blocks with `.formatted(...)` — adding `{BRAND.name}` means adding `%s` placeholders + matching args (mind existing `%%` at 199). Do NOT rename `clossette_*` storage keys. `web/package.json:2` is already generic (`"web"`) — no change needed.
- **VALIDATE**: `cd web && npm run build` (proves tailwind delete safe) && `npm run test`; `cd server && ./gradlew test`; `grep -rniIE 'Clossette' server/src/main/java | grep -viE 'com\.clossette|package com'` → 0.

### Task 6: Email consolidation (Option A — Resend-only)
- **ACTION**: Delete duplicate Java HTML; make web/Resend the sole path; delete dead legacy route.
- **IMPLEMENT**: In `AuthMailService.java` delete `buildEmailHtml`, `escapeHtml`, `sendHtmlEmail`, `JavaMailSender` field, `fromAddress`, jakarta.mail imports; simplify the two send methods to call `sendViaResend` and rethrow `EmailDeliveryException`. Rebrand `web/lib/email-templates.ts` + `send/route.ts` subjects. Delete `password-reset/route.ts` + `internal-mail.test.ts`. Rewrite `AuthMailServiceTest` to assert the Resend POST (mock endpoint; `EmailDeliveryException` on non-2xx). Remove `spring-boot-starter-mail`, `spring.mail` blocks, SMTP/Mailpit env; fix MAIL_FROM defaults. Doc-sync CODEMAPS.
- **MIRROR**: EMAIL_RESEND_PATH; email-consolidation surface.
- **GOTCHA**: KEEP `escapeJson` (guards the JSON body) — only `escapeHtml` is dead. Preserve `EmailDeliveryException` (GlobalExceptionHandler → 503; AuthService swallows it on register/forgot-password). Drop the resend-endpoint blank guard so mail can't silently no-op. Option A removes Mailpit dev DX (emails go to Resend sandbox) — if that's unacceptable, use **Option B** (keep SMTP as a plain-text-only fallback: convert `sendHtmlEmail`→`setText(body,false)`, keep tests with brand-string edits only).
- **VALIDATE**: `grep -rn 'buildEmailHtml\|sendHtmlEmail\|escapeHtml\|JavaMailSender' server/src/main/java/.../AuthMailService.java` → 0; `test ! -e web/app/api/internal/mail/password-reset/route.ts`; `cd server && ./gradlew test`; `cd web && npm run test`.

### Task 7: DataSeeder + fresh-relaunch verification of seeds
- **ACTION**: Ensure fresh seed data is IYAE-branded and CAD.
- **IMPLEMENT**: Confirm DataSeeder emails (Task 5) + currency (Task 1) are done; leave V1–V10 bodies untouched.
- **GOTCHA**: DataSeeder only runs when the DB is empty — fresh relaunch (`down -v`) triggers it.
- **VALIDATE**: after `./dev.sh reset && ./dev.sh start`, seed users are `*@iyae.ca` and products are CAD.

### Task 8: Java package rename (LAST — structural move)
- **ACTION**: Move `com.clossette`→`com.iyae` and rename the app class.
- **IMPLEMENT**: Run PACKAGE_RENAME exactly. This also fixes the `package` decl of any file created in Task 5 (e.g. `BrandProperties.java`).
- **MIRROR**: PACKAGE_RENAME.
- **GOTCHA**: BSD `sed -i ''`. Anchor to `com\.clossette` — a naive `s/clossette/iyae/g` clobbers ~20 branding literals. Class is `ClossettApplication` (no trailing `e`). Dir move before file rename before sed.
- **VALIDATE**: `! grep -rn 'com\.clossette' server/src build.gradle.kts`; `! grep -rn 'ClossettApplication' server/src`; `test -f .../com/iyae/IyaeApplication.java`; `git status --porcelain | grep -c '^R'` ≈ 220; `cd server && ./gradlew test`.

### Task 9: Full-stack relaunch smoke + docs sync
- **ACTION**: Prove the relaunch end-to-end and sync docs.
- **IMPLEMENT**: `./dev.sh reset && ./dev.sh start`; run all three suites; upload a designer image (lands under `/var/iyae/assets/uploads/products/`, served 200); stub-checkout shows CAD; update root/server/worker `CLAUDE.md` + `docs/CODEMAPS/*` + PRD Phase-1 status.
- **VALIDATE**: see Validation Commands.

---

## Testing Strategy

### Unit / Integration Tests (edit in lockstep; no new suites required)
| Test | Input | Expected | Edge Case? |
|---|---|---|---|
| `ProductServiceTest.createProduct_defaultsCurrency…` | create product, currency null | `"CAD"` | default path |
| `CheckoutServiceTest` | checkout | Stripe currency `cad` (unchanged) | already green |
| `AuthMailServiceTest` | send verification/reset | Resend POST to endpoint; subject "…IYAE…"; `EmailDeliveryException` on non-2xx | Option A rewrite |
| `HealthControllerTest`/`HealthServiceTest` | GET /api/health | `service: iyae-server` | brand id |
| `internal-mail-send.test.ts` | POST /api/internal/mail/send | subject "…IYAE…", from `noreply@iyae.ca` | web route |
| worker `test_meshy_generator`, `test_blender_rigging_provider` | provider defaults | `/var/iyae/assets…` | path asserts |
| e2e `register-wizard`, `auth` | register page | heading "Join IYAE" | UI copy |
| `IyaeApplicationTests` | context load | boots as `com.iyae` | package move |

### Edge Cases Checklist
- [ ] Fresh DB (`down -v`) → Flyway V1–V10 replay clean; DataSeeder seeds `*@iyae.ca` + CAD
- [ ] Existing dev volume reused → assets re-mount at `/var/iyae/assets` (volume name unchanged) — no data loss, but the relaunch intends a wipe
- [ ] SMPL-X avatar path (`model_path` leak) resolves under `/var/iyae/smplx_models`
- [ ] Email with `RESEND_MAIL_ENDPOINT` unset → must NOT silently no-op (Option A removes the guard)
- [ ] `npm run build` succeeds after `tailwind.config.ts` deletion (`bg-brand` still resolves via `@theme`)
- [ ] No `com.clossette` / `/var/clossette` / rendered "Clossette" / `"USD"` residue

---

## Validation Commands

### Static Analysis
```bash
cd server && ./gradlew compileJava compileTestJava
cd web && npm run lint && npx tsc --noEmit
```
EXPECT: Zero errors.

### Unit Tests
```bash
cd server && ./gradlew test            # ~338 methods
cd web && npm run test                 # ~227 cases
cd worker && pytest                     # ~292 tests
```
EXPECT: All pass.

### Residue Scan (the acceptance gate)
```bash
cd /Users/jadyn/Development/IYAE
! grep -rn 'com\.clossette' server/src server/build.gradle.kts
! grep -rn '/var/clossette' . --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=.codegraph --exclude-dir=build
! grep -rniE 'clossette' docker-compose.yml docker-compose.prod.yml dev.sh prod_deploy.sh .env.example nginx
! grep -rniIE 'Clossette' server/src/main/java web/app web/components web/lib | grep -viE 'clossette_[a-z]|clossette:profile|clossette-community|picsum'
! grep -rn '"USD"' server/src/main
```
EXPECT: All commands succeed (no matches).

### Database / Migration
```bash
./dev.sh reset && ./dev.sh start
docker compose exec mysql sh -c 'mysql -u iyae -p"$DB_PASSWORD" iyae -e "SHOW TABLES;"'
```
EXPECT: DB `iyae` exists with 21 Flyway tables; app boots (`GET /api/health` → 200, `service: iyae-server`).

### Browser / Runtime Smoke
```bash
./dev.sh start   # then, in the app:
```
- [ ] Nav/footer/landing render "IYAE"; PDP/cart/checkout show "$XX.XX" (en-CA)
- [ ] Designer image upload lands at `/var/iyae/assets/uploads/products/` and serves 200
- [ ] Stub checkout order total is CAD; a real Stripe session (if keyed) is `cad`
- [ ] Register/verify email arrives from `noreply@iyae.ca` with "IYAE" copy

### Manual Validation
- [ ] `git status --porcelain | grep -c '^R'` ≈ 220 (package renames recorded, history preserved)
- [ ] `web/tailwind.config.ts` deleted; `web/components.json` `config: ""`; `npm run build` green

---

## Acceptance Criteria
- [ ] All tasks completed; single atomic relaunch commit
- [ ] Residue scan passes (no `com.clossette`, `/var/clossette`, rendered "Clossette", `"USD"`)
- [ ] All three test suites green; `npm run build` green
- [ ] App boots as "IYAE" on DB `iyae`; `/api/health` reports `iyae-server`
- [ ] A test checkout charges/displays CAD consistently
- [ ] 3D assets/uploads serve correctly under `/var/iyae/assets`
- [ ] Email sends via Resend as `noreply@iyae.ca` with IYAE copy

## Completion Checklist
- [ ] Code follows discovered patterns (`@Value`/`@ConfigurationProperties`, `Intl.NumberFormat`, git-mv+anchored-sed)
- [ ] Error handling unchanged (`EmailDeliveryException`→503 preserved; AuthService swallow preserved)
- [ ] No hardcoded brand values remain outside `BrandConfig`/`brand.ts`
- [ ] Tests moved in lockstep; no orphaned assertions
- [ ] `.com`/`.ca`, casing, and guest-email duplication drifts resolved
- [ ] Docs synced (root/server/worker CLAUDE.md, CODEMAPS, PRD phase status)
- [ ] No Phase-2+ scope crept in (no color/token rewrite, no email-verification-on, no rate-limit change)

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Non-atomic asset-path change → 404 on all 3D assets/uploads | M | H | Single coordinated commit; `smplx:112 model_path` fixed in lockstep; fresh relaunch (`down -v`) |
| Naive `s/clossette/iyae/g` clobbers branding/storage-key literals | M | H | Anchor package sed to `com\.clossette`; asset sed to `/var/clossette/`; leave `clossette_*` keys |
| Email consolidation (Option A) drops Mailpit dev DX + needs AuthMailServiceTest rewrite | M | M | Documented Option B (plain-text SMTP fallback) if DX/scope matters; remove resend guard so mail can't no-op |
| Editing applied Flyway migrations breaks `flyway validate` | L | M | Leave V1–V10 bodies; DataSeeder.java governs fresh seed; V4 UPDATE is a no-op |
| CAD `en-US`→`en-CA` sed also rewrites date formatters | M | L | Edit currency `NumberFormat` blocks only, never blanket sed |
| `rootProject.name` change alters jar filename | L | L | Dockerfile globs `*.jar`; verified no repo file pins the name |
| Font drift (docs Inter vs code Geist) surfaces confusion | L | L | Note-only; reconcile in Phase 2 design system |
| Existing seed users had `@clossette.com` in a migrated DB | L | L | Fresh relaunch discards old data; optional additive V11 if a stale DB must be renamed |

## Notes
- **`FORME` has zero code occurrences** — it was a working name only; the sole rename battlefield is `Clossette`/`clossette`.
- **The PRD's "CAD bug at `CheckoutService.java:85`" is already fixed** (`.setCurrency("cad")`). The real defect is USD everywhere else (ProductService default + 36 seeds + 7 web formatters) contradicting the CAD charge — Surface E fixes that.
- **`FileStorageService.java:19` hardcodes the path** instead of reading `worker.output-dir`; the recommended fix centralizes it via `@Value` so the server has one asset-path source.
- **Two real bugs surfaced as dedupe wins**: guest email `guest@clossette.internal` is duplicated in `GuestAvatarService:29` + `AvatarService:152` (drift risk); `MAIL_FROM` defaults to `.com` in `application.yml` but `.ca` everywhere else. `BrandConfig` removes both.
- **Decision to confirm at implement time**: Email Option A (Resend-only, recommended — matches PRD "consolidate onto web/Resend, remove duplicate Java HTML") vs Option B (keep plain-text SMTP fallback + Mailpit DX). Default: **A**.
- **Source intelligence**: full per-site mappings were produced by a 7-way exploration workflow; this plan inlines every change site so no further codebase search is needed during implementation.
