# Pre-production audit — IYAE

**Date:** 2026-10-10 · **Commit:** `78c95c6` (main, clean tree) · **Scope:** the whole repository

## Verdict

**Do not deploy.** `CHANGES_REQUESTED`.

Three independent things are wrong with the production deployment as committed, and each
one alone would be disqualifying:

1. **No payment is ever collected.** Every checkout in the shipped production stack
   silently takes a stub branch and writes the order as `PAID`.
2. **Every user's 3D body scan is a public, enumerable URL.** No authentication,
   sequential integer path.
3. **There is no TLS.** The HTTPS server block and the HTTP→HTTPS redirect are both
   commented out, so passwords and JWTs cross the internet in cleartext.

The code itself is in good shape — 1,434 tests green, zero type errors, zero lint errors,
and several security details are done carefully and deliberately (constant-time login,
enumeration-safe forgot-password, an ADMIN self-registration guard, a correctly-ordered
Spring Security matcher chain). **Almost every blocker below is in the deployment
configuration and the operational surface, not in the application logic.** That is good
news for the fix effort: the first three blockers are roughly a day of config work, not a
refactor.

---

## Provenance — what was verified, and what was not

This matters for how much weight to put on each row, so it is stated up front rather than
buried.

| Stage | Planned | Actual |
|---|---|---|
| Surface/dimension reviewers | 44 | **44 completed** |
| Raw findings → unique after dedup | — | **211 → 197** |
| CRITICAL/HIGH candidates | 66 | 66 |
| 3-lens adversarial verification | 198 verifier agents | **only 2 of 66 findings fully verified** — the account hit its monthly spend limit mid-phase and 194 agents failed |
| Completeness critics | 2 | **0 completed** (same cause) |

The audit harness fails closed, so all 64 unverified CRITICAL/HIGH findings were retained
as blocking rather than quietly demoted. **Treat an unmarked row as a strong lead, not a
proven defect.**

To compensate, I re-checked the highest-stakes findings by hand against the source. Rows
below marked ✅ **VERIFIED** were confirmed by me reading the actual files and tracing the
chain end to end; rows marked ⚠️ **UNVERIFIED** are the reviewing agent's claim only.

I also **rejected** several agent claims after checking them — see
[Rejected claims](#rejected-claims-checked-and-found-not-to-hold). Do not skip that
section; it is as load-bearing as the findings.

---

## Ground truth — build and test status

All measured on this commit, not taken from docs.

| Suite | Result |
|---|---|
| `server` — Gradle 8.10 + JUnit | **BUILD SUCCESSFUL**, 565 tests, 0 failures, 0 errors |
| `web` — `tsc --noEmit` | **0 errors** |
| `web` — `eslint` | **0 errors** |
| `web` — vitest | **495/495 pass** (44 files) |
| `worker` — pytest | **374 pass, 10 skipped** |
| `web` — `npm audit --omit=dev` | **1 critical, 4 high, 3 moderate** (production dependencies) |

The test suites are genuinely green. What they do not cover is the subject of B-10 and
B-11 below.

---

## Tier 0 — release blockers, verified by hand

### B-1 ✅ VERIFIED · CRITICAL · Production never collects payment; every order is written `PAID`

`server/src/main/java/com/iyae/service/CheckoutService.java:77`

```java
if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
    return stubCheckout(user, fulfillment);
}
```

`stripeSecretKey` is bound as `@Value("${STRIPE_SECRET_KEY:}")` — empty default. The chain:

- `docker-compose.prod.yml` declares the server's environment as an **explicit 17-entry
  map** (lines 23–42). `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` **are not in it**.
- **Neither compose file has an `env_file:` directive** (grepped: zero hits). Compose's
  `.env` is interpolation-only, so an operator *cannot* supply the key by exporting it or
  putting it in `.env` — the compose file would have to be edited. The blank key is
  structurally guaranteed, not an operator oversight.
- `.env.example` contains **no Stripe entry at all**, so the documented setup never
  mentions the variable.
- `prod_deploy.sh:107` validates only `DB_PASSWORD MYSQL_ROOT_PASSWORD JWT_SECRET`.
- No Stripe property exists in `application.yml` / `-prod.yml` / `-dev.yml`, and
  `server/Dockerfile` declares no `ENV`/`ARG`.

So `./prod_deploy.sh setup && ./prod_deploy.sh up` always starts the server with
`stripeSecretKey = ""`. Every `POST /api/checkout` then runs `stubCheckout` (lines
335–366), which persists an `Order` with `status=PAID`, `paymentStatus="STUB"`, a
fabricated `cs_test_<uuid>` session id, and fires an `ORDER_PAID` analytics event. The
buyer is redirected to `/checkout/success` and charged nothing. The only trace is one
`log.info`.

Two aggravating details the original finding missed:

- `stubCheckout` **never clears the cart**, so the same cart can be re-"purchased"
  indefinitely, each time producing another free `PAID` order.
- `stubResaleCheckout` is the same bypass on the resale path and additionally calls
  `resaleService.markSold(...)`, irreversibly consuming a unique pre-loved unit for free.
- Partial configuration does not help: `handleWebhook` throws
  `IllegalArgumentException("Webhook secret not configured")` on a blank
  `STRIPE_WEBHOOK_SECRET`, so wiring only the secret key breaks fulfillment instead of
  fixing the bypass. **Both variables must land together.**

**Fix.** Add both variables to `server.environment` in `docker-compose.prod.yml`, document
them as required in `.env.example`, add them to `prod_deploy.sh`'s `require_env_vars`, and
make `CheckoutService` **refuse** (fail startup, or 503 on checkout) rather than
stub-fulfill when `SPRING_PROFILES_ACTIVE=prod` and the key is blank. The stub path is a
legitimate dev convenience; it must be impossible to reach under the prod profile.

*This is the one finding that did receive all three adversarial lenses: 3 run, 0 refutes,
confidence 0.95.*

---

### B-2 ✅ VERIFIED · CRITICAL · Every user's 3D body scan is publicly downloadable at a guessable URL

`server/src/main/java/com/iyae/config/SecurityConfig.java:46` ·
`worker/providers/smplx_provider.py:313,362` · `nginx/conf.d/default.conf:41`

The worker writes each avatar to a path keyed only on the database primary key:

```python
output_dir = os.path.join(self.output_base_dir, f"avatars/{user_id}")
...
"glb_url": f"/assets/avatars/{user_id}/avatar.glb"
```

Identical in `smplx_stub_provider.py:234,256`, so both the real and the stub provider do
it. `SecurityConfig:46` then declares:

```java
.requestMatchers("/assets/**", "/uploads/**").permitAll()
```

and `WebMvcConfig` maps `/assets/**` onto the shared `assets_data` volume. nginx proxies
`/assets/` through with `Cache-Control: public, immutable`.

`user_id` is a sequential `AUTO_INCREMENT`. So **anyone, unauthenticated, can walk
`/assets/avatars/1/avatar.glb`, `/2/avatar.glb`, … and download every user's body mesh** —
a model derived from the height, weight, chest, waist, hips, shoulder-width and inseam
they entered. For a consumer app targeting 18–30-year-olds, this is among the most
sensitive data categories the product touches.

This is not an oversight — the comment at `AvatarService.java:46` states the design
plainly: *"({assetRoot}/avatars/{userId}/avatar.glb), served publicly at /assets/\*\*"*.
It needs to be redesigned, not patched.

Compounding: `Cache-Control: public, immutable` means any intermediary cache retains the
mesh, so `AvatarService.deleteAvatarData` deleting the directory does not recall copies.

**Fix.** Serve avatar GLBs through an authenticated, ownership-checked endpoint (or
unguessable opaque tokens plus `Cache-Control: private`). Narrow the `permitAll` matcher to
the genuinely public asset prefixes and stop serving `avatars/` from the public root.

---

### B-3 ✅ VERIFIED · CRITICAL · Production has no TLS at all

`nginx/conf.d/default.conf:10,23-25,72-127`

The only live `server` block is `listen 80;`. The `location / { return 301 https://… }`
redirect (lines 23–25) and **the entire `server { listen 443 ssl; … }` block including the
HSTS header** (lines 72–127) are commented out. `prod_deploy.sh ssl-init` runs certbot and
restarts nginx but **does not edit the config** — it only prints an instruction to enable
HTTPS manually.

So on the documented deploy path, the site serves plaintext HTTP on port 80. Every login
password, every JWT (24-hour expiry, stored in `localStorage`), every body measurement and
every checkout interaction is sniffable and modifiable in transit. The CSP that
`middleware.ts` carefully sets is also trivially strippable by an on-path attacker.

**Fix.** Make the HTTPS block and the redirect the committed default, have `ssl-init`
activate them, and add HSTS. Certificate renewal also needs to be automatic (see B-12).

---

### B-4 ✅ VERIFIED · CRITICAL · Self-service DESIGNER → malicious upload → `next@16.2.6` image-optimizer RCE

`web/package.json:35` · `server/src/main/java/com/iyae/service/FileStorageService.java:33`
· `server/src/main/java/com/iyae/dto/RegisterRequest.java` · `web/Dockerfile:14`

`npm audit --omit=dev` reports **1 critical + 4 high** production advisories. `next@16.2.6`
is in the vulnerable range for 17 of them. The reachable chain, each link checked:

1. **Anyone can become a DESIGNER.** `RegisterRequest` has `@NotNull Role role` — the role
   is caller-supplied. `AuthService:87` blocks only `ADMIN`; `AuthService:143` auto-creates
   a `DesignerProfile` for `DESIGNER`. One public `POST /api/auth/register` plus any real
   inbox (email verification *is* enforced, at `JwtAuthenticationFilter:58` and
   `AuthService:174` — correctly) is the entire precondition.
2. **Upload validation trusts the client's MIME header and never looks at the bytes.**
   `FileStorageService:33-37` reads `file.getContentType()` and maps it to an extension.
   There is no magic-byte check. Send `Content-Type: image/png` with AVIF, HEIF, SVG or
   crafted TIFF bytes and it is stored as `<uuid>.png`.
3. **Those uploads are rendered through `next/image`.** 13 files pass server-supplied URLs
   (`product.media[...]`, `item.imageUrl`, `primaryImage`) into `<Image>`; `/uploads/*` is
   same-origin via the `next.config.ts` rewrite, so the Image Optimization API accepts them.
4. **sharp sniffs content, not the extension**, so the `.png` name does not protect it. The
   relevant advisories: GHSA-2xp9-vwfh-vxw4 (*unauthenticated RCE in Image Optimization
   when AVIF files are used*, critical), GHSA-vcvr-r3jv-pc5j (`next/og` RCE),
   GHSA-rgj7-g3m4-5g8c (libheif), GHSA-wq5f-xc86-pv6w (librsvg),
   GHSA-f88m-g3jw-g9cj (libvips CVEs), GHSA-cjq9-62q9-8jv4 (SSRF in Image Optimization),
   GHSA-q8wf-6r8g-63ch (SVG DoS).
5. **`/_next/image` is internet-reachable.** nginx's location list is
   `/.well-known/…`, `/api/`, `/uploads/`, `/assets/`, `/_next/static`, `/` — so
   `/_next/image` falls through to `location /` → the web container.
6. **`web/Dockerfile` declares no `USER`**, so the Next.js process runs as **root**,
   maximising the blast radius of step 4.

Separately confirmed from the installed docs
(`next/dist/docs/01-app/01-getting-started/01-installation.md:156`): *"Turbopack is now the
default bundler."* The build script is a plain `next build`, so
GHSA-6gpp-xcg3-4w24 — *middleware/proxy bypass in App Router applications using Turbopack
and a single locale* — applies directly, and `middleware.ts` is this app's **only** CSP
delivery mechanism.

**Fix, in order.** (a) Bump `next` 16.2.6 → **16.4.0** — npm reports this as
**non-semver-major**, and it pulls the patched `sharp` and `postcss` with it. (b) Add
magic-byte validation to `FileStorageService` (defence in depth — the content-type check is
not a validation). (c) Add a non-root `USER` to `web/Dockerfile`. (d) Decide whether
self-service DESIGNER signup is actually intended; if it is, it needs upload quotas and
review.

Also outstanding from the same audit: `nanoid` and `source-map-js` (both high, both
`fixAvailable: true`). CI has **no dependency audit at all**, so none of this was going to
be caught — see B-11.

---

### B-5 ✅ VERIFIED · CRITICAL · Email address is published as the public display name

`server/src/main/java/com/iyae/dto/PostResponse.java:44` ·
`CommentResponse.java:19` · `PostReportResponse.java:21`

```java
String username = post.getUser().getUsername() != null
    ? post.getUser().getUsername()
    : post.getUser().getEmail();
```

`username` is genuinely optional: `RegisterRequest.username` carries only `@Size` and
`@Pattern`, both of which Bean Validation treats as satisfied by `null`, and
`AuthService:107` assigns it only `if (request.username() != null)`. Skipping it is the
*documented* path — the registration wizard has a "Complete Later" step.

So any user who registers without a username has **their email address rendered as their
display name on every post and comment they make**, visible to unauthenticated visitors
(community feeds and `/api/auth/users/profile/**` are both `permitAll`). That is a PII
leak, an account-enumeration oracle, and a spam-harvesting surface in one.

The reviewing agent found this in `PostResponse` only; I found the same fallback in three
response DTOs.

**Fix.** Never fall back to email. Either make `username` required at registration or
derive a non-identifying handle (and backfill existing rows).

---

### B-6 ✅ VERIFIED · HIGH · New users land on a dead dashboard with no instruction to verify

`web/lib/auth-config.ts:14` · `web/Dockerfile:11` · `prod_deploy.sh:107` · `.env.example:133`

Two independent halves of the onboarding flow are broken, and they compound.

**Half one — the client flag can never be true.** `requireEmailVerification()` reads
`process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION`, which Next.js inlines at **build**
time. `web/Dockerfile` declares only `ARG API_PROXY_TARGET`; `docker-compose.prod.yml`'s
`web.build.args` passes only `API_PROXY_TARGET`. The variable is therefore unset during
`npm run build` and baked to `false` permanently — setting it in `.env` does nothing.
Consequence: `resolvePostRegisterRedirect` always returns `/dashboard`, so a new user is
"logged in" and sent to a dashboard whose every API call 401s (the server, correctly,
rejects an unverified account's JWT), with no "check your email" page and no explanation.

**Half two — no verification email is sent in the first place.** `.env.example:133` ships
`INTERNAL_MAIL_SECRET=` (empty) and leaves `RESEND_API_KEY` commented out.
`prod_deploy.sh` does not validate either. The route
(`web/app/api/internal/mail/send/route.ts:20-23`) correctly **fails closed** on an empty
secret → 403 → `AuthMailService` throws `EmailDeliveryException` → and
`AuthService:151-155` **catches it and lets registration succeed anyway** with a
`log.warn`. The account exists, `emailVerified=false`, and no email was ever sent.

Net: on the documented production deploy, **no new user can ever sign in**, and they are
given no way to find out why.

**Fix.** Plumb `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` as a Docker build arg; add
`INTERNAL_MAIL_SECRET` and `RESEND_API_KEY` to `prod_deploy.sh`'s `require_env_vars`; and
surface mail-delivery failure to the user at registration instead of only logging it.

---

### B-7 ✅ VERIFIED · HIGH · Every unexpected exception vanishes with zero server-side trace

`server/src/main/java/com/iyae/config/GlobalExceptionHandler.java:86`

```java
@ExceptionHandler(RuntimeException.class)
public ResponseEntity<ErrorResponse> handleRuntime(RuntimeException ex) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(new ErrorResponse("Internal server error", …));
}
```

The catch-all swallows `ex` entirely — **no `log.error`, no stack trace, nothing**. There
is no error-tracking integration anywhere in the repo either. An operator investigating a
failed checkout has literally no signal beyond the client's 500.

This is the single worst operability defect in the codebase, and it makes every other
production problem harder to diagnose. Fix it first, before chasing anything subtle.

**Fix.** `log.error("Unhandled exception on {} {}", method, path, ex)` with a correlation
id echoed to the client. Keep the response body generic.

---

### B-8 ✅ VERIFIED · HIGH · The health check cannot fail, and the deploy script trusts it

`server/src/main/java/com/iyae/controller/HealthController.java:22`

`health()` returns a hardcoded `{"status":"UP"}`. It never touches the database, Flyway, or
anything else. It is simultaneously:

- the container healthcheck in `docker-compose.prod.yml`
  (`curl -sf http://localhost:8080/api/health`), and
- the only success signal for `prod_deploy.sh health` and `prod_deploy.sh update`.

A server with a dead database, an un-migrated schema, or an exhausted connection pool
reports healthy, and `update` will happily cut production traffic over to it. Relatedly,
`/api/health/ai` calls the configured LLM provider on **every** probe — cost per probe, and
a third-party outage failing your own health endpoint.

**Fix.** Make `/api/health` a real readiness probe (`SELECT 1`, Flyway state) and separate
liveness from readiness. Keep the AI probe off the healthcheck path.

---

### B-9 ✅ VERIFIED · HIGH · Community comments and follows are never sent to the server

`web/components/PostDetailDialog.tsx:230` · `web/lib/hooks/useCommunityState.ts:116`

`handleAddComment` calls the pure localStorage helper `addComment(...)` and then
`onUpdate(...)`. It never calls `postsApi.comment(...)` — even though that client exists
(`web/lib/api.ts:623`) and **the same file uses the server for reports**
(`await postsApi.report(...)` at line 219). Same for `handleAddReply` and for
`handleToggleFollow`, which calls a pure state helper with no API call at all.

So a user writes a comment, sees it appear, and it exists only in that browser's
localStorage. Follows likewise.

This is **known, documented, unfinished work**, not a regression — `CLAUDE.md`'s own
changelog says: *"**Remaining** (not yet built): PR-B F2–F4 (community-feed server adapter,
delete the 3 fabrication sites, useCommunityState write-through)"*. The Phase 6 server API
landed; the client was never wired to it. Related rows in the appendix (public profile grid
sourced from the viewer's own local cache, Discover opening on fabricated demo posts) are
the same root cause.

**Fix.** Finish F2–F4, or gate the community feature behind a flag and ship without it.
Shipping a social feature whose writes are discarded is worse than not shipping it.

---

### B-10 ⚠️ UNVERIFIED but structurally certain · HIGH · Nothing tests the schema the production server validates against

`.github/workflows/e2e.yml:65-98` · `server/src/test/resources/application-test.yml` ·
`server/src/test/java/com/iyae/IyaeApplicationTests.java`

Production runs MySQL 8 + Flyway + `ddl-auto: validate`. The test environment runs
H2 with `flyway.enabled: false` and `ddl-auto: create-drop` — Hibernate *generates* the
schema from the entities instead of validating against the Flyway-produced one. And the one
`@SpringBootTest` that would boot the real stack explicitly excludes
`DataSourceAutoConfiguration`, `HibernateJpaAutoConfiguration` and
`FlywayAutoConfiguration`, with all 30 repositories `@MockBean`'d.

So **no unit or integration test ever runs the 21 migrations or checks an entity against
them.** Any drift — a renamed column, a too-short `VARCHAR` for an enum name, a `@Version`
field with no matching column — is a hard startup failure that CI cannot see.

Partial mitigation, which is why this is HIGH and not CRITICAL: the Playwright job does
bring the real stack up via `docker compose` and waits for `DataSeeder`, so a boot failure
would surface there — indirectly, expensively, and only in that one job.

**Fix.** Add a `@DataJpaTest`/`@SpringBootTest` against Testcontainers MySQL with Flyway on
and `ddl-auto=validate`. It is one test and it closes the largest structural gap in the
suite.

---

### B-11 ✅ VERIFIED · HIGH · CI has no security scanning, and no least-privilege token

`.github/workflows/e2e.yml`

Triggers are safe (`pull_request`, `push: main`, `workflow_dispatch` — no
`pull_request_target`). But there is **no `permissions:` block**, so `GITHUB_TOKEN` gets
the repository default rather than `contents: read`; actions are pinned to mutable major
tags (`@v4`, `@v5`) rather than commit SHAs; and there is **no dependency audit, no SAST,
no secret scanning, and no container scan**. The four production advisories in B-4 were
never going to be caught.

Also missing for a release: nothing builds the production images, and nothing exercises
`docker-compose.prod.yml`.

**Fix.** Add `permissions: contents: read`, an `npm audit --omit=dev --audit-level=high`
gate, and a secret scan. Pin third-party actions by SHA.

### B-12 ✅ VERIFIED · HIGH · Operational gaps that turn any single failure into an outage

Grouped because they share one fix session and all were confirmed by reading
`docker-compose.prod.yml` and `prod_deploy.sh`:

- **No `restart:` policy on any production service.** One OOM or host reboot is a
  permanent outage with no auto-recovery. The worker additionally has no healthcheck.
- **No automated backup of the MySQL volume or the `assets_data` volume, and no restore
  procedure.** Orders, PII and every upload live on one unreplicated Docker volume.
  `dev.sh db backup` is a manual dev command. For a store taking orders this is on its own
  a release blocker.
- **No automated certificate renewal** — `ssl-renew` is a manual command.
- **`prod_deploy.sh update` cuts traffic over with no real health gate** (see B-8) **and no
  rollback path.**
- **No graceful shutdown**: `server.shutdown: graceful` is not set, so in-flight checkout
  requests are killed on container stop.
- **Unpinned dependencies on the money path.** `server/build.gradle.kts` uses
  `com.stripe:stripe-java:26.+` — a dynamic version range on the payment SDK — with no
  Gradle dependency locking configured. Two builds of the same commit can embed different
  Stripe SDKs. `worker/requirements.txt` is entirely `>=` lower bounds with no lock file.
  (`web/package-lock.json` is committed and correct.)

---

## Tier 1 — remaining CRITICAL/HIGH leads, not independently verified

These are the reviewing agents' claims. Each carries `evidence`, a `proof` scenario and a
suggested `fix` in `pre-production-audit-2026-10-10-findings.json`. Ranked by my read of
consequence. **Confirm before acting.**

**Money and data integrity**

- `ResaleService.java:55` — the stale-reservation sweep can release a listing while an
  earlier buyer's Stripe payment is still settling → double-sale with a silent
  double-charge. Stripe sessions outlive the 30-minute sweep window and `setExpiresAt` is
  never called.
- `CheckoutService.java:232` — the resale webhook never persists the `PAID` order status:
  `markSold`'s `clearAutomatically = true` discards the unflushed `Order` change.
- `ResaleService.java:242` — a `markSold` matching zero rows is logged at INFO and the
  buyer is still charged.
- `ResaleService.java:121,124` — a seller can create unlimited active listings for one
  owned unit; the duplicate guard exists only in the read path.
- `worker/task_queue.py:80` — `fail_task()` has no `RUNNING` guard, so it can flip an
  already-`READY` task back to `FAILED`.
- `worker/main.py:138` — the `rigging-worker` container also polls the model and avatar
  queues unconditionally, so it becomes a second claimant and can complete real tasks with
  stub output.
- `V16__resale_listings.sql:20` — FKs with no `ON DELETE` action mean product deletion
  permanently fails once an item has ever been resold.

Resale is the least-reviewed money-adjacent surface in the repo: it appears nowhere in
`CLAUDE.md`'s module docs or test inventory, and six of the leads above are in it. It
deserves its own focused pass.

**Security and privacy**

- `GuestAvatarService.java:65` — the guest-avatar status endpoint is an unauthenticated
  IDOR: the ownership check compares against the single shared `guest@iyae.internal` user
  row, so it is a no-op across all guests. Paired with
  `smplx_provider.py:313`, every guest avatar also overwrites one shared on-disk path, so a
  visitor can be served another visitor's body mesh. (I confirmed the shared-identity
  mechanism while reading `getOrCreateGuestUser`; I did not trace the full exploit.)
- `GlbAssetInitializer.java:61` — path traversal via the designer-settable, unvalidated
  `glbUrl`. I checked the premises: `glbUrl` has no validation annotation and
  `ProductService:190` writes it straight through, and `Path.of(assetsOutputDir, relative)`
  does escape on `models/../../..`. **But** the write is guarded by `if (!Files.exists(…))`
  and the content is a fixed placeholder GLB — so this is arbitrary-path file *creation*,
  not overwrite and not RCE. **I would re-rate it MEDIUM/HIGH, not CRITICAL.** The more
  interesting consequence of the same unvalidated field: a designer can point a product's
  3D model at any external URL that every PDP visitor then fetches.
- `AvatarService.java:133` — no account- or data-deletion path exists. Only the
  avatar/measurements can be deleted; chat transcripts, posts, orders and analytics rows
  persist. For a product collecting body scans from EU/Canadian consumers this needs a
  decision before launch, not after.
- `DataSeeder.java:22` — the profile guard is a deny-list (`!prod`), so any deployment not
  setting `SPRING_PROFILES_ACTIVE` to exactly `prod` seeds a known-password ADMIN account.
  **Mitigated in the committed topology** — `docker-compose.prod.yml:36` does set
  `SPRING_PROFILES_ACTIVE: prod` — so I would re-rate this MEDIUM. It is still a
  fail-open guard that should be an allow-list.
- `AnalyticsController.java:34` — any authenticated BUYER can `POST /api/events` with
  `ORDER_PAID` / `ORDER_RETURNED`, polluting the KPI and cohort data the PRD says drives
  INVEST/STOP decisions. The agent filed this CRITICAL; **I would re-rate it HIGH** —
  `userId` is taken from the authenticated principal, so there is no cross-user forgery,
  only self-attributed noise.
- `docker-compose.yml:123` — hardcoded `dev-internal-secret` fallback. Dev-file only; the
  route itself fails closed (see B-6). Low real risk, but the comparison in
  `route.ts:21` is a non-constant-time `!==` on a shared secret.

**Availability and cost**

- No rate limit on `POST /api/designer/products/upload/image` (shared-volume disk-fill), on
  job-creation endpoints that trigger **paid** 3D generation, or on guest avatar creation —
  which is unauthenticated and uncapped. With a paid provider configured, that is a direct
  cost-runaway path.
- `PostService.java:82` — unbounded `size` query parameter on feed/follow/comment
  pagination lets one request bypass pagination entirely.
- N+1 queries on every hot path: product catalog (`ProductService.java:346`), community
  feed (`PostService.java:101,233` — three extra queries per post), cart
  (`CartService.java:136`), plus `OutfitService.java:130` loading the entire products table
  into memory on every chat turn.
- `OrderRepository.java:15` — the Stripe webhook's order lookup has no index on
  `orders.stripe_session_id`.
- `AvatarViewer.tsx:106` — drei's `useGLTF` cache is never cleared, so GPU/JS-heap grows
  without bound across navigations; no error boundary around the canvas on the public
  `/ar-visualization` page.
- `web/app/products/page.tsx:100` — the primary catalog renders a failed fetch identically
  to a genuine zero-result search; `web/app/error.tsx:16` offers no escape route.
- `worker/providers/tripo_generator.py:86` — reads `glb_resp.content` after the stream is
  consumed, which would crash every real Tripo3D generation. (Same class as the Meshy bug
  already fixed in the 2026-09-06 pass — worth grepping for a third instance.)

**Accessibility** — `LocalImagePicker.tsx:104`: keyboard-only users cannot create a
community post at all; the mandatory image picker has no focusable control.

Full list with evidence: [appendix](./pre-production-audit-2026-10-10-appendix.md) ·
[JSON](./pre-production-audit-2026-10-10-findings.json).

---

## Rejected claims (checked and found not to hold)

Recorded so nobody spends time on them.

| Claim | Why it does not hold |
|---|---|
| `PasswordResetTokenRepository.consumeToken` assigns `CURRENT_TIMESTAMP` to an `Instant`, breaking JPA bootstrap (carried in `CLAUDE.md` as a known latent bug) | **Already fixed.** The query now takes `@Param("now") Instant now` and `AuthService:306` passes `Instant.now()`. The `CLAUDE.md` note is stale and should be removed. |
| Per-IP rate limiting is broken behind nginx because `trusted-proxies` is unset | **Configured.** `docker-compose.prod.yml:42` sets `RATE_LIMIT_TRUSTED_PROXIES: ${RATE_LIMIT_TRUSTED_PROXIES:-172.16.0.0/12}`. |
| `RESEND_FROM_EMAIL` is documented but the route reads `MAIL_FROM` — a config mismatch | **Wired correctly.** `docker-compose.prod.yml:93` maps `MAIL_FROM: ${RESEND_FROM_EMAIL:-onboarding@resend.dev}`. |
| The internal mail route ships with a `dev-internal-secret` default, so anyone can send mail from the verified domain | **Fails closed.** `route.ts:21` compares against `process.env.INTERNAL_MAIL_SECRET` with no fallback; unset ⇒ every request 403s. The default lives only in `docker-compose.yml` (dev). Externally it is also unreachable: nginx routes `/api/` to the Spring server, which has no such route. |
| MySQL or the API is exposed directly in production | **Not exposed.** Only nginx publishes ports (80/443) in `docker-compose.prod.yml`. |
| Stripe line items let the client influence price | **Server-side.** Amounts are computed from `item.getProduct().getPrice()`; currency is hardcoded `cad`. |
| A committed `.env`, DB dump, or key file | **None.** `git ls-files` is clean; `.gitignore` covers `.env`, `.env.*`, `backup_*.sql` and the SMPL-X weights. |

Credit where due, since a review that only lists faults is misleading: the Spring Security
matcher chain is correctly ordered (the authenticated `/recommended-size` rule precedes the
broad `GET /api/products/**` permitAll), login is constant-time with the unverified-account
check deliberately placed *after* the credential check to preserve the enumeration defence,
`ADMIN` self-registration is explicitly blocked, `tokenVersion` revocation is enforced in
the JWT filter, and the `RegisterRequest` DTO is thoroughly annotated with bounds. The
application layer is the strongest part of this codebase.

---

## Recommended order of work

1. **Config blockers** (~1 day, no refactor): B-1 Stripe env + hard prod guard · B-3 enable
   TLS/HSTS · B-4a bump `next` to 16.4.0 · B-4c non-root `USER` · B-6 build arg + required
   vars · B-12 restart policies, backups, cert renewal.
2. **Observability before anything subtle** (~half a day): B-7 log the catch-all · B-8 real
   readiness probe. Without these you cannot confirm any later fix in production.
3. **Privacy redesign** (needs a decision, not just a patch): B-2 authenticated avatar
   delivery · B-5 kill the email fallback · Tier-1 data deletion path.
4. **Confirm and fix the resale cluster** — seven leads, zero test coverage, money-adjacent.
5. **Close the structural test gap**: B-10 Testcontainers schema test · B-11 CI audit gate.
6. **Then** the N+1 and front-end-race tier, and decide whether the community feature ships
   at all (B-9).

## Re-run the verification pass

The adversarial stage is the part of this audit that did not happen. When the spend limit
resets, it replays from cache for free except for the agents that failed:

```
Workflow({
  scriptPath: '/Users/jadyn/.claude/projects/-Users-jadyn-Development-IYAE/8a85d4d4-ed6f-40b0-a205-b707ba54fc62/workflows/scripts/iyae-production-readiness-audit-wf_6214f9db-3a3.js',
  resumeFromRunId: 'wf_6214f9db-3a3'
})
```

All 44 audit agents are cached, so this re-runs only the ~194 failed verifiers and the two
completeness critics — which also means the "what did this audit miss?" question is still
open.

---

*Audit: 44 parallel reviewers over server/web/worker/infra, 211 raw → 197 unique findings,
7.4M subagent tokens, 1,823 tool calls, 56 min wall clock. 12 findings re-verified by hand;
7 agent claims rejected.*
