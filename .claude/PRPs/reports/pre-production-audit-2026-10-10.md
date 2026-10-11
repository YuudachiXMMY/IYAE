# Pre-production audit — IYAE

**Date:** 2026-10-10 · **Commit:** `78c95c6` (main, clean tree) · **Scope:** the whole repository

## Verdict

**Do not deploy.** `CHANGES_REQUESTED`.

Tier 0 below holds 14 findings. These three are the headline, and each one alone would be
disqualifying:

1. **Checkout silently fulfils orders for free.** Every checkout in the shipped production
   stack takes a stub branch and writes the order as `PAID` with no payment collected.
   *Launch scope decision of 2026-10-10 is that payment ships disabled — which does not
   resolve this, it reframes it: see B-1.*
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

Two caveats on that paragraph, both found by the completeness critics after it was written.
The "ADMIN self-registration guard" I praised turns out to be half of a lockout: combined
with `@Profile("!prod")` on the only code that creates an ADMIN row, it means **no
administrator can exist in production at all** (B-14). And the `authenticated()` matcher
chain, while correctly ordered, has no `authenticationEntryPoint`, so it answers 403 where
the web client only listens for 401 (B-15). Neither is a configuration fix.

---

## Provenance — what was verified, and what was not

This matters for how much weight to put on each row, so it is stated up front rather than
buried.

**The audit is now complete.** The third pass of 2026-10-11 ran every agent the harness
planned; nothing is retained fail-closed any more.

| Stage | Planned | Actual |
|---|---|---|
| Surface/dimension reviewers | 44 | **44 completed** |
| Raw findings → unique after dedup | — | **211 → 197** |
| CRITICAL/HIGH candidates | 66 | 66 |
| 3-lens adversarial verification | 198 verifier agents | **198 ran, adjudicating all 66 findings** |
| Completeness critics | 2 | **2 completed**, naming 29 coverage gaps |

Total across the three passes: 244 agents, **0 failures**, 17.6M subagent tokens.

What the adversarial pass actually changed, which is the point of running it:

- **48 findings held all three lenses** with no lens reaching the refute threshold.
- **17 were talked down** out of the blocking set into advisory (11 HIGH→MEDIUM,
  1 CRITICAL→MEDIUM, 5 HIGH→LOW).
- **1 was refuted outright, 3/3** — `web/app/orders/[id]/page.tsx` stale-state-on-id-change.
  It has been moved out of the findings entirely.
- Net: 66 candidates → **48 blocking (9 CRITICAL, 39 HIGH), 148 advisory, 1 refuted.**

The verifiers also corrected two of my own calls, which is the whole reason for running an
adversarial pass over a report its own author wrote:

- **B-13** — I had down-rated a path traversal to MEDIUM/HIGH; it held CRITICAL 3/3 and the
  verifiers found an exploitation route I had missed.
- **B-10** — I had asserted it as a HIGH "structurally certain" blocker; all three lenses
  confirmed the facts and widened them, but independently rated it MEDIUM, and in doing so
  showed my framing of it was wrong. See B-10.

Read the blocking count with one correction applied, which the critics raised and I
verified by counting the rows myself: **roughly 13 of the 48 blocking findings restate 6
underlying defects** (the missing `restart:` policy is filed four times, the `/assets`
avatar exposure three times, nginx TLS twice, and so on). The honest distinct-defect count
is about **42**, not 48. The duplicates are kept rather than merged because each was filed
against a different file and fixing one does not fix the others — but they should not be
read as independent evidence of breadth. See [What the audit missed](#what-the-audit-missed--29-coverage-gaps), gap G-14.

Rows marked ✅ **VERIFIED** below were confirmed by me reading the actual files and tracing
the chain end to end, independently of the agents. Where my read and the verifiers' differ,
the report says so.

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

Fourteen blockers, B-1 to B-15 — **with one exception: B-10 is no longer a blocker.** It is
kept in place, relabelled, with the verifiers' reasoning and my corrected framing, rather
than quietly deleted. Everything else in this section holds.

### B-1 ✅ VERIFIED · CRITICAL · Checkout silently fulfils orders for free; every order is written `PAID`

`server/src/main/java/com/iyae/service/CheckoutService.java:77`

> **Launch scope, decided 2026-10-10:** the first production launch ships with
> checkout/payment **disabled**; Stripe integration is deferred to a later release.
> This does **not** clear the blocker — it changes what "fixed" means. Leaving
> `STRIPE_SECRET_KEY` blank is *not* disabling checkout: it is exactly the state described
> below, in which the endpoint still answers and still persists `PAID` orders. Jump to
> [the revised fix](#b-1-revised-fix-under-the-launch-decision).

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

#### B-1 revised fix under the launch decision

Because launch #1 deliberately ships without payment, the fix is **not** to wire Stripe —
it is to make "no payment" an explicit, visible refusal instead of a silent free
fulfilment. All four parts are needed:

1. **Make the stub branch unreachable under the prod profile.** `CheckoutService` should
   refuse (503, or fail fast at startup) when `SPRING_PROFILES_ACTIVE=prod` and the key is
   blank, rather than falling through to `stubCheckout`. The stub is a legitimate dev
   convenience; it must be impossible to reach in production. Re-enabling payment later
   then has to be a deliberate act.
2. **Disable the resale buy path too.** `stubResaleCheckout` is the same bypass and
   additionally calls `resaleService.markSold(...)`, irreversibly consuming a unique
   pre-loved unit for free. Disabling only `/api/checkout` leaves this one open.
3. **Hide the entry points in the web UI** — the checkout button and resale buy-now — so
   nobody reaches a dead endpoint. A 503 behind a live-looking button is a support ticket,
   not a disabled feature.
4. **When Stripe is wired later, land both variables together.** `handleWebhook` throws
   `IllegalArgumentException("Webhook secret not configured")` on a blank
   `STRIPE_WEBHOOK_SECRET`, so configuring only `STRIPE_SECRET_KEY` breaks fulfilment
   instead of fixing the bypass. Both need adding to `server.environment` in
   `docker-compose.prod.yml`, to `.env.example`, and to `prod_deploy.sh`'s
   `require_env_vars` — remember that no compose file uses `env_file:`, so they cannot be
   supplied via `.env` alone.

Also worth deciding alongside this: with payment off, `OrderStatus.PAID` should not be
reachable at all, and the `ORDER_PAID` / `CHECKOUT_INITIATED` analytics events that
`stubCheckout` fires would otherwise seed the KPI tables with fabricated revenue before any
real revenue exists.

*This is the one finding that received all three adversarial lenses in the first run: 3
run, 0 refutes, confidence 0.95.*

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

> **Scope correction — `/assets/` is served by four code paths, not two.** A completeness
> critic caught that this finding (and the two nginx framings of it) name only nginx and
> `SecurityConfig`. I verified the other two: `WebMvcConfig.java:21-22` registers
> `/assets/**` as a Spring resource handler onto `file:${worker.output-dir}`, making the
> application itself a static file server for the avatar meshes independently of nginx; and
> `web/next.config.ts:22-23` rewrites `/assets/:path*` to the API target, so the Next.js
> container proxies the same bytes. **Take the inventory before scoping the fix** — closing
> the `permitAll` matcher alone leaves the nginx `location` open, and closing nginx alone
> leaves the Spring handler reachable wherever the API is.

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

### B-10 ↓ DOWNGRADED to MEDIUM by the verifiers · my framing was wrong · The worker's hand-written SQL is tested against no real schema

`.github/workflows/e2e.yml:186-187` · `server/src/test/resources/application-test.yml` ·
`worker/task_queue.py:23` · `worker/avatar_task_queue.py:24` · `worker/rigging_task_queue.py:26`

**I filed this as a HIGH release blocker titled "Nothing tests the schema the production
server validates against." That title is false, and all three lenses showed me why** — while
simultaneously confirming every individual fact I cited and widening the gap. They ran
3/3 with no refutation and each independently rated it MEDIUM. The severity came down, but
for a better reason than "less bad": I had the boundary of the gap in the wrong place.

What I got right, and what the verifiers added to it. The JUnit environment is H2 with
`flyway.enabled: false` and `ddl-auto: create-drop`, so Hibernate *generates* the schema
from the entities rather than validating against the Flyway output; `IyaeApplicationTests`
excludes `DataSourceAutoConfiguration` and `FlywayAutoConfiguration`; and all four
`@DataJpaTest` slices use that same Flyway-off H2. The worker's three queue modules patch
`mysql.connector.connect` with a `MagicMock` in *every* test — the strongest schema
assertion in the whole Python suite is `assert "rigging_tasks" in sql`, a substring check
on SQL text. There are no Testcontainers anywhere in the repo.

What I got wrong. I wrote that a boot failure would surface in the Playwright job only
"indirectly, expensively, and only in that one job." It is in fact a real gate that runs on
every PR: `application.yml:9,12-13` set `ddl-auto: validate` and `flyway.enabled: true`
with no dev or prod override, and `.github/workflows/e2e.yml:187` boots `mysql server web`
against real MySQL and then blocks on `/api/health` plus actual seeded rows. **So
entity↔migration drift on the Java side is already a hard build failure.** I verified this
myself after the verifiers raised it. The migrations are also not currently adrift —
`V1__baseline_schema.sql:75-89`, V6 and V7 supply every column the worker names, and the
status ENUMs cover `PENDING/RUNNING/READY/FAILED/MATERIALIZED`.

What actually remains, which is the correctly-scoped finding: **the Python worker's
raw-SQL reader is the uncovered half.** CI never starts it — `e2e.yml:186` carries an
explicit comment that the workers are excluded because they add build time "and nothing the
E2E tests assert on." So the Java-writer/Python-reader contract (hand-written SQL plus the
`output_payload` key names that `materializeGarmentAsset` reads back) is exercised against
one real schema by no job at all. That is preventive coverage for a future regression, not
a live defect — hence MEDIUM, and hence **no longer a Tier 0 blocker.**

**Fix.** Unchanged, and still cheap: one Testcontainers-MySQL test with Flyway on, asserting
the worker's actual queue SQL round-trips. Scope it at the worker, not the server.

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

### B-13 ✅ 3/3 · CRITICAL · Designer-settable `glbUrl` is a path traversal into the nginx-served volume

`server/src/main/java/com/iyae/config/GlbAssetInitializer.java:61` ·
`server/src/main/java/com/iyae/dto/CreateProductRequest.java:33` ·
`UpdateProductRequest.java:30` · `ProductService.java:149,190`

```java
String relative = url.substring("/assets/".length());
Path glbPath = Path.of(assetsOutputDir, relative);
```

The only guard is `url.startsWith("/assets/models/")` — a prefix test that
`/assets/models/../../../x` passes. `Path.of` does not normalize, there is no
`normalize()` anywhere in `server/src/main/java`, and the OS resolves `..` at open time.
The source is unvalidated: both request DTOs declare `glbUrl` as a bare `String` with no
annotation (while carrying `@NotBlank`/`@DecimalMin` on neighbouring fields, so validation
is plainly active and this field was simply left open), and `ProductService` persists it
verbatim. `GlbAssetInitializer` is an unconditional `CommandLineRunner` with no `@Profile`
guard, so it fires on every production start, as root (`server/Dockerfile` declares no
`USER`), into the `assets_data` volume shared with the worker and nginx. A `DRAFT` product
suffices — `findAll()` has no status filter.

**I initially down-rated this to MEDIUM/HIGH** on the grounds that line 62's
`if (!Files.exists(glbPath))` makes the primitive create-only and the content a fixed
placeholder GLB. The verification pass held it at CRITICAL on all three lenses, and it was
right — for a reason I had missed:

> `glbUrl = "/assets/models/../x.html"` lands **inside** the nginx-served volume, where
> nginx assigns `text/html` by extension and the Next.js `middleware.ts` CSP never applies.
> That is a **same-origin stored-XSS primitive that needs no escape from the volume at
> all** — and the JWT lives in `localStorage`. The ~100 attacker-controlled bytes from
> `category` (double-quotes stripped) are more than enough for an `onerror` payload.

One verifier also reproduced the traversal empirically in a scratch program: `Files.exists`
returned false (so the guard does not block it), `createDirectories` succeeded, and the
write landed outside the base directory. The create-only constraint and the restart trigger
are mitigants, not unreachability.

**Fix.** Normalize and containment-check the resolved path
(`p.normalize().startsWith(base.normalize())`), and add a server-side pattern to both DTOs
(`^/assets/models/[A-Za-z0-9_-]+\.glb$`). Separately, the same unvalidated field lets a
designer point a product's 3D model at an arbitrary external URL that every PDP visitor
then fetches.

---

### B-14 ✅ VERIFIED BY HAND · HIGH · No administrator can exist in production, so the whole moderation surface is unreachable

`server/src/main/java/com/iyae/config/DataSeeder.java:22,98` ·
`server/src/main/java/com/iyae/service/AuthService.java:87` · `docker-compose.prod.yml:36`

Raised by a completeness critic, not by the 44 surface reviewers — then confirmed by me
against the tree. Three facts compose into a lockout:

1. `DataSeeder` is annotated `@Profile("!prod")` (line 22) and line 98 is **the only
   `.role(Role.ADMIN)` assignment in the entire non-test source tree** (`grep -rn
   "Role.ADMIN" server/src/main/java/` returns exactly two hits: this one and the guard
   below).
2. `AuthService.register` hard-rejects the role: `if (request.role() == Role.ADMIN) throw
   new IllegalArgumentException("Cannot register with ADMIN role")` (line 87-88).
3. `docker-compose.prod.yml:36` sets `SPRING_PROFILES_ACTIVE: prod`, which switches the
   seeder off.

No migration creates one either — V12 only widens the enum
(`ALTER TABLE users MODIFY COLUMN role ENUM('BUYER','DESIGNER','ADMIN')`); it inserts no
row. There is no provisioning endpoint, no CLI, and no instruction in `prod_deploy.sh` or
`.env.example`.

So on a correctly-configured production deploy, `/api/admin/**` and the `/admin` console
are live but **permanently unreachable**: the catalogue moderation, the post/comment
removal, the `post_reports` queue built in Phase 6, and the `moderation_locked` lock of
PR#10 all have no one who can invoke them. This is the inverse of a privilege-escalation
bug and it is why the ADMIN self-registration guard I praised in the verdict is only half a
design.

It compounds with two other gaps the critics named: there is **no account suspension or ban
flag** on `User` at all and no server-side session revocation, and **no rate limit on any
UGC write** (`RateLimitFilter`'s 10-rule allowlist covers neither `POST /api/posts` nor
`POST /api/posts/{id}/report`). The product therefore ships user-generated content plus a
report-intake queue with no throttle on either and nobody able to action them.

**Fix.** Pick one and document it: a one-off Flyway migration inserting an ADMIN row with a
deploy-time-supplied bcrypt hash, or a guarded bootstrap that promotes a single
`ADMIN_BOOTSTRAP_EMAIL` on first start and then no-ops. Add it to `prod_deploy.sh`'s
required-vars check so the deploy cannot silently produce an unadministrable instance.

---

### B-15 ✅ VERIFIED BY HAND · HIGH · Sessions answer 403, the client only handles 401 — every user wedges at token expiry

`server/src/main/java/com/iyae/config/SecurityConfig.java:52` ·
`server/src/main/java/com/iyae/security/JwtAuthenticationFilter.java:45-60` ·
`web/lib/api.ts:53-61`

Also a critic find, also confirmed by hand. `SecurityConfig` registers
`.anyRequest().authenticated()` and **no `exceptionHandling`/`authenticationEntryPoint`**,
no `formLogin`, no `httpBasic` — I grepped for all four. Spring Security therefore falls
back to `Http403ForbiddenEntryPoint`, so an unauthenticated request gets **403, not 401**.
The server's own tests encode this expectation (`SavedProductControllerTest` asserts 403
for each unauthenticated call), so it is settled behaviour, not a guess.

`JwtAuthenticationFilter.authenticate` compounds it by declining *silently* — a bare
`return;` with no response written — when the token is expired, the user row is gone,
`ver < tokenVersion`, or the email is unverified. The request simply proceeds as anonymous
and lands on the 403 entry point.

Meanwhile `web/lib/api.ts:53` is:

```ts
if (res.status === 401) {
  // Token expired or invalid - clear and redirect
  ...localStorage.removeItem(AUTH_TOKEN_KEY); window.location.href = "/login";
}
```

**401 is the only status that triggers it, and the server never sends 401.** So at the 24h
token expiry every signed-in user starts getting `ApiError(403)` from every call, with the
dead token still in `localStorage` and no redirect to `/login`. The UI shows whatever each
surface shows on a failed fetch — and per the advisory rows, several of those render an
error as "no results". The user is stuck until they manually clear site data. The same path
fires after a password reset bumps `token_version`, which is the one revocation mechanism
the product has.

**Fix.** Either add an `authenticationEntryPoint` that returns 401 for API routes (correct,
and it makes the server honest), or make the client treat 403-with-a-token as a session
failure. Prefer the former; do both and pin it with a test, since the existing server tests
currently assert the 403.

---

## Tier 1 — remaining CRITICAL/HIGH leads

These are the reviewing agents' claims. Each carries `evidence`, a `proof` scenario and a
suggested `fix` in `pre-production-audit-2026-10-10-findings.json`. Ranked by my read of
consequence.

**Every row in this section has now cleared the full 3-lens adversarial pass**, so the
earlier "not independently verified — confirm before acting" caveat no longer applies to
the section as a whole. Rows still marked ✅ **hand-verified** are ones I additionally
traced myself. The rows that did *not* survive are no longer here: six of them were talked
down into advisory on the final pass and are listed under
[Fully adjudicated](#fully-adjudicated--how-the-last-16-leads-resolved).

**Money and data integrity**

> **Descoping note.** The 2026-10-10 decision to launch with payment disabled takes the
> resale *buy* path out of scope for launch #1 — nothing reaches a Stripe session or a
> webhook. The three rows marked **[latent]** below are therefore not launch blockers, but
> they must be cleared *before* Stripe is wired, because they are exactly the bugs that only
> appear once money flows. The listing-lifecycle rows are **not** descoped: listings can
> still be created.

- `ResaleService.java:55` ✅ **3/3 held** · *[latent]* — the stale-reservation sweep can
  release a listing while an earlier buyer's Stripe payment is still settling → double-sale
  with a silent double-charge. Stripe sessions outlive the 30-minute sweep window and
  `setExpiresAt` is never called.
- `CheckoutService.java:232` ✅ **hand-verified** · *[latent]* — the resale webhook never
  persists the `PAID` order status. I traced the whole chain: `markSold` is
  `@Modifying(clearAutomatically = true)` with **no `flushAutomatically`**
  (`ResaleListingRepository.java:35`); `handleWebhook` is `@Transactional:167` and
  `ResaleService.markSold:238` joins it under default `REQUIRED` propagation, so they share
  one persistence context; `orderRepository.save(order)` on a managed entity is a no-op
  merge that does not flush; and Hibernate's pre-query auto-flush does not fire because the
  bulk update's query space (`resale_listings`) does not intersect the dirty entity's table
  (`orders`). The clear then detaches the dirty `Order` and the `PAID` transition is lost —
  the order stays `PENDING` while the listing is `SOLD` and the buyer has been charged.
  **Scope confirmed as resale-only:** `clearAutomatically` appears in exactly three places,
  all in `ResaleListingRepository`, and the normal cart branch uses a derived
  `deleteByCartId` with no such annotation. (Residual assumption: I reasoned about
  Hibernate's auto-flush query-space rule from the code rather than executing it.)
- `ResaleService.java:242` ✅ **3/3 held** (1 refute vote, below threshold) · *[latent]* — a
  `markSold` matching zero rows is logged at INFO and the buyer is still charged.
- `ResaleService.java:121,124` ✅ **hand-verified** — a seller can create unlimited active
  listings for one owned unit. `createListing:121` checks only
  `findOwningOrderId(user, productId, size)` — "did you ever buy this" — and never looks for
  an existing active `ResaleListing` on the same seller+product+size. The `activeKeys`
  exclusion lives only in `listEligibleItems`, the read-path picker hint. **Not descoped:**
  this fills the marketplace with phantom inventory from day one even with payment off.
- `worker/task_queue.py:80` ✅ **3/3 held** — `fail_task()` has no `RUNNING` guard, so it can
  flip an already-`READY` task back to `FAILED`.
- `worker/main.py:138` ✅ **3/3 held** — the `rigging-worker` container also polls the model
  and avatar queues unconditionally, so it becomes a second claimant and can complete real
  tasks with stub output.
- `V16__resale_listings.sql:20` — **verifiers downgraded HIGH → MEDIUM.** FKs with no
  `ON DELETE` action mean product deletion fails once an item has ever been resold. Now
  advisory.

Resale is the least-reviewed money-adjacent surface in the repo: it appears nowhere in
`CLAUDE.md`'s module docs or test inventory, and six of the leads above are in it. Even with
the buy path descoped it deserves its own focused pass before Stripe lands.

**Security and privacy**

- `smplx_provider.py:313` ✅ **3/3 held** · HIGH — every guest avatar writes to one shared
  on-disk path (`avatars/{guest user id}/avatar.glb`), so a visitor can be served another
  visitor's body mesh. This is the framing that survived, and it stays blocking.
- `GuestAvatarService.java:65` — **verifiers downgraded HIGH → LOW.** The IDOR framing of
  the same defect (the ownership check compares against the single shared
  `guest@iyae.internal` row, so it is a no-op across all guests) has now been adjudicated,
  and both framings came down: the CRITICAL "shares one global user identity" duplicate to
  MEDIUM on the earlier pass, this one to LOW. I had written "treat MEDIUM as the floor, not
  the ceiling" while it was unadjudicated; the full pass did not agree, and the row is now
  advisory. **The underlying exposure is not dismissed** — it survives as the HIGH above,
  where it belongs, since the harm is the shared *output path*, not the status endpoint.
- `GuestAvatarService.java:40` ✅ **3/3 held** · HIGH — guest avatar task creation never
  supersedes or caps prior tasks for that shared anonymous account.
- `GlbAssetInitializer.java:61` — path traversal via the designer-settable `glbUrl`.
  **Promoted to Tier 0 — see B-13 at the end of that section.** I had initially down-rated
  this; the verification pass showed I was wrong.
- `AvatarService.java:133` ✅ **hand-verified** — there is no account- or data-deletion path.
  `deleteAvatarData` is scoped exactly as its own javadoc says (avatar URL, body profile,
  avatar task rows; the `User` is explicitly *not* deleted), and a sweep of every
  `@DeleteMapping` in all 27 controllers turns up **no** account/user deletion endpoint. So
  chat transcripts, posts, comments, orders, analytics events, saved looks, follows and
  uploads persist with no way to remove them. For a product collecting body scans from
  EU/Canadian consumers this needs a decision before launch, not after. (The deletion method
  itself is thoughtfully written — its in-flight-task reasoning is sound. The gap is scope,
  not quality.)
- `DataSeeder.java:22` ✅ **3/3 held at HIGH** — the profile guard is a deny-list (`!prod`),
  so any deployment not setting `SPRING_PROFILES_ACTIVE` to exactly `prod` seeds a
  known-password ADMIN account. I noted that `docker-compose.prod.yml:36` *does* set it and
  expected a downgrade; the verifiers held HIGH anyway, on the grounds that a fail-open
  guard whose only protection is one correctly-typed env var is still a blocker. I agree
  with them over my earlier read: make it an allow-list (`@Profile({"dev","test"})`).
- `AnalyticsController.java:34` — **verifiers downgraded CRITICAL → MEDIUM**, which goes
  further than my own re-rate to HIGH. Any authenticated BUYER can `POST /api/events` with
  `ORDER_PAID` / `ORDER_RETURNED`, polluting the KPI and cohort data the PRD says drives
  INVEST/STOP decisions — but `userId` comes from the authenticated principal, so there is
  no cross-user forgery, only self-attributed noise. Now in the advisory list.
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
  feed (`PostService.java:233` — three extra queries per post), plus `OutfitService.java:130`
  loading the entire products table into memory on every chat turn. The final pass moved
  three of these out of blocking: `PostService.java:101` and `ProductService.java:346` to
  MEDIUM and `CartService.java:136` to LOW (a cart holds a handful of line items, so the
  N+1 there is bounded by design). `PostService.java:233` stays HIGH because the feed is
  unbounded.
- `JwtAuthenticationFilter.java:47` — raised by a critic, not by a surface reviewer, and
  unverified: the auth filter does a `findByEmail` **on every authenticated request**, purely
  to read three values that could ride in the JWT claims. It is the hottest path in the app
  and it compounds with every N+1 above plus the 3-second status polls. Worth a look during
  the same pass.
- `OrderRepository.java:15` — the Stripe webhook's order lookup has no index on
  `orders.stripe_session_id`.
- `AvatarViewer.tsx:106` — drei's `useGLTF` cache is never cleared, so GPU/JS-heap grows
  without bound across navigations; no error boundary around the canvas on the public
  `/ar-visualization` page.
- `web/app/products/page.tsx:100` — the primary catalog renders a failed fetch identically
  to a genuine zero-result search (**downgraded HIGH → MEDIUM**); `web/app/error.tsx:16`
  offers no escape route (**downgraded HIGH → LOW**). Both are now advisory. Note that the
  first one is what makes **B-15** worse than it looks: a 403 at token expiry reaches this
  page and is rendered as "nothing matched your search."
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
| `web/app/orders/[id]/page.tsx:123` — the order detail page does not reset `order`/`error`/`loading` when navigating between two order ids, so stale or wrong-order data renders | **Refuted 3/3 by the adversarial pass** — the only finding killed outright by verification. Removed from the findings entirely. |
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

1. **Hard-disable checkout** (the launch decision, and the only item here that is real code
   rather than config): B-1 parts 1–3 — refuse under the prod profile, close the resale buy
   path, hide both entry points.
2. **Make the instance administrable and the session recoverable** — B-14 ADMIN bootstrap ·
   B-15 the 401 entry point. These moved to the front after the completeness critics ran:
   both are small, both are real code, and until B-14 lands nobody can moderate the UGC the
   launch ships with, while until B-15 lands every user is one token expiry from a dead app.
3. **Config blockers** (~1 day, no refactor): B-3 enable TLS/HSTS · B-4a bump `next` to
   16.4.0 · B-4c non-root `USER` · B-6 build arg + required vars · B-12 restart policies,
   backups, cert renewal. Add log rotation here — no service in the prod stack sets a
   `logging:` limit, on the same disk that holds the only copy of the database (gap G-25).
4. **Observability before anything subtle** (~half a day): B-7 log the catch-all · B-8 real
   readiness probe. Without these you cannot confirm any later fix in production. The
   critics' wider point stands: the stack has no metrics, no error aggregation and no
   alerting of any kind, so nothing can tell you production broke (gap G-3).
5. **Privacy redesign** (needs a decision, not just a patch): B-2 authenticated avatar
   delivery — **across all four serving paths**, see the scope correction under B-2 · B-5
   kill the email fallback · Tier-1 data deletion path. Publish the legal pages in the same
   pass: there is no `/privacy` or `/terms` route, the footer links to `href="#"`, and
   registration gates on consent to documents that do not exist (gap G-24) — on a product
   whose core data is body measurements and 3D body meshes.
6. **Fix the resale cluster** — zero test coverage, money-adjacent, and partly descoped by
   step 1 (the buy path goes away, the listing lifecycle does not). All of its rows now
   carry 3/3.
7. **Close the structural test gap**: B-10 Testcontainers schema test, scoped at the
   *worker* · B-11 CI audit gate.
8. **Then** the N+1 and front-end-race tier, and decide whether the community feature ships
   at all (B-9). Rate-limit the UGC writes in the same pass (gap G-22) — `POST /api/posts`,
   its comments, the report intake and `POST /api/events` are all unthrottled.

## Fully adjudicated — how the last 16 leads resolved

These were the rows whose three verifiers had never run, retained as blocking fail-closed.
All 16 are now adjudicated: **10 held 3/3 and 6 were talked down into advisory.** The table
keeps my earlier hand-verification column next to the verifiers' independent verdict, so the
two can be compared.

| Finding | My hand-check | Verifiers' verdict |
|---|---|---|
| `SecurityConfig.java:46` — body scans public at a guessable path | ✅ **B-2** | **held CRITICAL 3/3** |
| `nginx/conf.d/default.conf:21` — HTTP-only | ✅ **B-3** | **held HIGH 3/3** |
| `HealthController.java:22` — health check cannot fail | ✅ **B-8** | **held HIGH 3/3** |
| `web/Dockerfile:11` — `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` never plumbed | ✅ **B-6** | **held HIGH 3/3** |
| `docker-compose.prod.yml:105` — no restart policy, worker has no healthcheck | ✅ **B-12** | **held HIGH 3/3** |
| `AvatarService.java:133` — no account/data deletion path | ✅ Tier 1 | **held HIGH 3/3** |
| `CheckoutService.java:232` — resale webhook loses the `PAID` transition | ✅ Tier 1 *[latent]* | **held HIGH 3/3** (1 refute vote) |
| `ResaleService.java:124` — unlimited active listings per owned unit | ✅ Tier 1 | **held HIGH 3/3** |
| `smplx_provider.py:313` — all guests share one avatar output path | ◐ mechanism only | **held HIGH 3/3** |
| `ResaleService.java:242` — lost reservation, buyer still charged | ⚠️ not checked *[latent]* | **held HIGH 3/3** (1 refute vote) |
| `.github/workflows/e2e.yml:185` — no real queue contract test | ✅ **B-10**, framing wrong | ↓ **HIGH → MEDIUM** |
| `GuestAvatarService.java:65` — unauthenticated guest IDOR | ◐ mechanism only | ↓ **HIGH → LOW** |
| `PostService.java:101` — community feed N+1 | ⚠️ not checked (low stakes) | ↓ **HIGH → MEDIUM** |
| `web/app/products/page.tsx:100` — failed fetch renders as zero results | ⚠️ not checked (low stakes) | ↓ **HIGH → MEDIUM** |
| `CartService.java:136` — cart N+1 per line item | ⚠️ not checked (low stakes) | ↓ **HIGH → LOW** |
| `web/app/error.tsx:16` — root error boundary has no escape route | ⚠️ not checked (low stakes) | ↓ **HIGH → LOW** |

Two things are worth reading off this table rather than just the counts.

**My triage was right about which rows mattered.** Every one of the nine I hand-verified as
consequential held 3/3. Every one of the four I set aside as "low stakes" was downgraded.
The two I had marked "mechanism confirmed, exploit not traced" split — the shared avatar
output path held HIGH, the IDOR framing of it went to LOW — which is the correct split,
because the harm was always the shared path.

**My one wrong call was a framing error, not a triage error.** B-10 was the single row I
had asserted as a blocker on structural reasoning instead of a traced chain, and it is the
single row whose severity the verifiers moved against me. That is a useful lesson about
exactly which claims in a report like this deserve the least trust: the ones argued from
"this must be true" rather than "I followed this path."

Plus the two latent resale rows I had never checked at all (`ResaleService.java:242`) or
checked only partially — both held HIGH. Descoping them behind the disabled payment path
remains correct for launch #1, but they are real and they must be cleared before Stripe
lands.

## What the audit missed — 29 coverage gaps

The two completeness critics ran for the first time on the final pass. Their only job was to
find what the 44 reviewers did not look at. **Read these as leads, not findings: the critics
are the terminal stage of the pipeline, so unlike everything above, their output never went
through the 3-lens adversarial pass.** Full text with each critic's own evidence is in the
[appendix](./pre-production-audit-2026-10-10-appendix.md#coverage-gaps-named-by-the-two-completeness-critics-29).

Four were serious enough that I verified them myself before letting them stand. Two became
blockers:

- **G-17 → now B-14.** No ADMIN can exist in production. Confirmed.
- **G-16 → now B-15.** The server answers 403, the client only handles 401. Confirmed.
- **G-9 → scope correction on B-2.** `/assets/` is served by four code paths, not the two
  the findings name. Confirmed: `WebMvcConfig.java:21` and `web/next.config.ts:22` are the
  two nobody had looked at.
- **G-24.** No `/privacy`, `/terms`, `/legal` or `/cookies` route exists; `LandingFooter`
  links all of them to `href="#"`; `StepBasics.tsx:128` makes the user tick a box agreeing
  to documents that are not even links. Confirmed by listing `web/app` (44 routes, none of
  them legal).

And one is a criticism of this report itself, which I verified by counting the rows:

- **G-14.** Roughly 13 of the 48 blocking findings restate 6 underlying defects. Recorded in
  [Provenance](#provenance--what-was-verified-and-what-was-not); the honest distinct-defect
  count is ~42.

The remaining 24 gaps are unverified. These are the classes the critics say had **no audit
surface pointed at them at all**, which is the part worth acting on — a finding you did not
file is invisible, but a class you never looked at is knowable:

| Gap | Class with no surface |
|---|---|
| G-1 | **Trust & safety** — no suspend/ban flag on `User`, no server-side session revocation, no admin user management, no upload moderation |
| G-3 | **Observability** — zero metrics/APM/error-aggregation/tracing dependencies anywhere, no alerting, no log rotation |
| G-5 | **Outfit generation** — the product's headline feature and the only write path reachable from LLM output; 14 files, not one finding |
| G-11 | **Cost controls** — no quota, budget ceiling, concurrency cap or kill switch on the paid AI/3D providers |
| G-12 | **Mobile/responsive and i18n/currency** — no viewport coverage on a mobile-first product; `lang="en"` hardcoded, currency is free-text |
| G-13, G-23 | **SEO and link previews** — no robots/sitemap/manifest/OG tags, and because every route is `"use client"` no route *can* export metadata, so the sharing growth loop produces blank cards |
| G-8 | **Supply-chain integrity** — `gradle-wrapper.jar` untracked (swallowed by `.gitignore:24`), no dependency locking in 2 of 3 ecosystems |
| G-7, G-27 | **Dependency CVEs** — only the npm ecosystem was swept; no Gradle or pip pass, and the `next@16.2.6` CRITICAL names no CVE and never establishes that the vulnerable path is reachable in this config |
| G-4, G-20 | **Email deliverability** — `MAIL_FROM` defaults to Resend's sandbox address, which can only deliver to the account owner; no SPF/DKIM/DMARC review |
| G-19 | **UGC payload size** — post images are unbounded base64 data URIs persisted straight into MySQL, no `@Size`, no rate limit |
| G-22 | **UGC throttling** — `RateLimitFilter`'s allowlist covers none of the post/comment/report/follow/analytics writes |
| G-25 | **Container hardening** — no `cap_drop`, `no-new-privileges`, `read_only` or `user` on any production service |
| G-28 | **Auth hot-path cost** — a DB round trip per authenticated request, with no pool sizing configured |
| G-15, G-29 | **Inventory drift** — three tracked junk artifacts at the repo root (incl. `review_results.json`, stale pre-rebrand guidance a future agent may act on), an unreferenced second landing page at `/design`, and an undocumented `web/components/design-system/` holding the globally-mounted `SiteHeader` |
| G-26, G-10 | **The suspicious silence on auth** — both critics independently flagged that zero CRITICALs on the auth path is itself a signal, and each supplied a concrete re-test list |

Both critics landed independently on the same three things — trust & safety, observability,
and the auth path — which is the strongest signal in the list.

## Reproducing or extending this audit

**Nothing is left to re-run.** The third pass of 2026-10-11 completed every planned agent:
198 of 198 verifiers and 2 of 2 completeness critics, 0 failures. Across the three passes
the harness ran 244 agents in total. It took three attempts because the first two were cut
short by a monthly spend limit, not by anything in the script.

To reproduce or extend the audit, the script is still on disk and fully cached — an
unchanged resume returns every result instantly and costs nothing:

```
Workflow({
  scriptPath: '/Users/jadyn/.claude/projects/-Users-jadyn-Development-IYAE--claude-worktrees-preprod-audit-report/8a85d4d4-ed6f-40b0-a205-b707ba54fc62/workflows/scripts/iyae-production-readiness-audit-wf_6214f9db-3a3.js',
  resumeFromRunId: 'wf_6214f9db-3a3'
})
```

Editing a surface's prompt re-runs that surface and everything downstream of it, which is
the cheap way to act on the coverage gaps above: the obvious next pass adds surfaces for
trust & safety, observability, outfit generation, and cost controls — the four classes both
critics agreed had nothing pointed at them.

What remains genuinely open about this report's coverage is now bounded and named: the 24
unverified coverage gaps. Everything that was ever filed as a finding has been adjudicated.

---

*Audit: 44 parallel reviewers over server/web/worker/infra, 211 raw → 197 unique findings.
Adversarial verification: **all 198 lens-agents ran**, adjudicating all 66 blocking
candidates — 48 held 3/3, 17 downgraded, 1 refuted. Both completeness critics ran, naming 29
coverage gaps. 244 agents, 0 failures, 17.6M subagent tokens, 3,267 tool calls, 58 + 58 + 27
min wall clock across three passes. 25 findings re-verified by hand; 7 agent claims
rejected; 4 critic gaps hand-verified, 2 of which became blockers (B-14, B-15); 2 of my own
calls corrected by the verifiers — B-13's severity and B-10's framing.*
