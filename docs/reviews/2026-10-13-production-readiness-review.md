# Production-readiness review — IYAE

**Date:** 2026-10-13  
**Target:** the production surface at `main` = `1dbf4d9` (merge of PR #47), clean working tree  
**Verdict:** `CHANGES_REQUESTED` — 31 blocking, 42 advisory

## How this was produced

A gated multi-agent review run in two passes (250 agents, ~4000 tool calls, ~24M subagent tokens):

**Pass 1 — the blocking tier.**

1. **Review** — 16 area reviewers in parallel, each reading the real source at HEAD rather than a diff, so every hunk was judged with the code around it in view. Each CRITICAL/HIGH had to carry quoted `file:line` evidence plus a traced failure path; anything without one was to be demoted or dropped.
2. **Verify** — every CRITICAL/HIGH adjudicated by three agents with *different* lenses: execution-trace, adversarial refutation, and existing-mitigation. Fail-closed: a finding is dismissed only when a verifier can affirmatively prove it false from code at confidence >= 0.8. Uncertainty keeps it blocking.
3. **Gaps** — three completeness critics (architecture coverage / first-launch reality / adversarial) named what the 16 areas never opened; each gap got its own reviewer and the same three-lens verification.

**Pass 2 — the advisory tier.** The first pass verified only CRITICAL/HIGH, so its 42 MEDIUM/LOW rows shipped explicitly labelled as unverified leads. All 42 have since been through the same treatment, with two changes: a third lens ranks impact against a shared rubric (so the 42 rankings are comparable rather than each judged on its own scale), and any proposed escalation to HIGH/CRITICAL had to survive three further agents attacking its reachability, its real consequence, and whether the severe impact was already counted by an existing blocking finding. Crying HIGH on ten MEDIUMs costs the team as much as missing one real HIGH, so the gate is majority-rule in both directions. A final agent then did the cross-finding work no per-finding verifier could: naming duplicate clusters, ordering the fixes, and spotting systemic causes.

Deliberate product decisions were declared non-defects up front (payment off for Launch 1, engineering-authored legal pages, demo negative ids, `MATERIALIZED`->`READY`, login 400-on-bad-credentials), and the project `CLAUDE.md` narrative was declared non-evidence — so every claim had to be re-established against code.

### Results

| | Blocking tier | Advisory tier |
|---|---|---|
| Verified | 31 | 42 |
| Confirmed | 27 by three lenses, 2 carried from the first run, 2 by hand | 42 |
| Refuted | 0 | 0 |
| Severity changed | 1 downgraded (HIGH -> LOW) | 6 downgraded (MEDIUM -> LOW), 0 escalated |

Pass 1: 16/16 areas completed; 50 raw -> 45 unique findings; 11 gaps named, 11 reviewed, 33 raw -> 28 new unique. Four blocking findings were left unadjudicated when the account hit its monthly spend limit — two carry a confirmed verdict from the first run and two were verified by hand, and all four are marked individually below.

> **Nothing was refuted, in either tier — 0 of 73.** That is unusual enough to state plainly rather than bury. It does not mean the refutation lens rubber-stamped: it produced substantive pushback on 20+ findings without killing any of them, and that pushback is recorded inline as **Verifier caveats**. Two findings had their traced consequence shown to be wrong (A-19, A-30), one carries a **suggested fix that would cause an outage** (A-42), one is self-refuted by its own evidence (A-28), and six collapse into three defects. Five of the highest-impact blocking claims were additionally spot-checked by hand — `/api/outfits` absent from `RateLimitFilter.RULES`; `.env` is `-rw-r--r--` on disk; `stripe-java:26.+` with no `gradle.lockfile`; `setSlotHint` present only in the `@Profile({"dev","test"})` seeder; `ReviewService` has no `orderRepository` — and all five held.

### Known limits of this review

- It is static: nothing was executed, deployed, load-tested or run against a real MySQL. Findings about runtime behaviour are reasoned from code, not observed.
- Severity is judged for a *first* production launch of a consumer app holding photos and body measurements. A finding's rank would move under different launch assumptions.
- Both tiers are now adversarially verified, but verification is still three agents reading code — it establishes that a claim holds against the source, not that the failure has been observed in a running system.
- Read the **Verifier caveats** on a finding before acting on its suggested fix. A-42's primary suggested fix is actively harmful; A-35 and B-5 are the same defect with *conflicting* fixes.

---

# Blocking (31)

## B-1 · `CRITICAL` — update() auto-applies forward-only Flyway migrations to the live DB with no pre-pull backup, so a failed readiness gate rolls back code only — leaving old code to boot against a newer schema it was never validated against

**Location:** `prod_deploy.sh:330`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** gap:prod_deploy.sh update's rollback reverts code but not the database; Flyway migrations are forward-only and auto-apply on boot

**Evidence**

> prod_deploy.sh:334-355 — `previous_rev="$(git rev-parse HEAD)"` ... `git pull` ... `docker compose -f "$COMPOSE_FILE" up -d` ... `if wait_for_healthy server && gate_readiness; then ... else error "New revision failed its readiness gate — rolling back to $previous_rev"; git reset --hard "$previous_rev"; docker compose -f "$COMPOSE_FILE" build; docker compose -f "$COMPOSE_FILE" up -d ...`. No `do_backup` call appears anywhere in this function (confirmed via `grep -n do_backup prod_deploy.sh`, which only matches the standalone `backup` subcommand and the read-only check inside `health`). `application.yml:12-14`: `flyway: enabled: true, locations: classpath:db/migration` with no `baseline-version`/target pinning, so Spring Boot's Flyway autoconfiguration runs `migrate()` unconditionally on every `server` boot, before `gate_readiness` is even invoked. `server/src/main/resources/db/migration/` contains only V1–V24, additively named, no undo/down files. `V18__resale_currency_varchar.sql`'s own comment documents that a prior schema/entity mismatch under `hibernate.ddl-auto: validate` (set at `application.yml:9`) already "failed to boot" the server once in this project's history, and `V23__resale_one_listing_per_unit.sql` performs an irreversible `DELETE` as part of its migration.

**Failure path**

> Operator runs `./prod_deploy.sh update` against a production DB holding real orders/body-profiles/posts. `up -d` restarts `server`, and Flyway migrates the schema forward synchronously during Spring context startup — this happens unconditionally, before the script's readiness gate runs, and there is no down-migration to undo it. Suppose the migration itself applies cleanly but the new application image then fails `gate_readiness` for an unrelated reason (a bad image, an unrelated regression, a misconfigured env var). The script's only recovery is `git reset --hard "$previous_rev"` followed by rebuilding and restarting — this boots the PREVIOUS code revision against the ALREADY-MIGRATED schema it was never built or tested against. Because `ddl-auto: validate` strictly checks every JPA-mapped column/table/type (as V18's own history proves it does, having crashed the server once already for exactly this class of mismatch), a migration that is anything other than purely column-additive can make the old code fail the same Hibernate validation on startup — landing on the script's own line-359 branch: 'Rollback to $previous_rev is ALSO unhealthy. Manual intervention required.' At that point there is no database snapshot to restore from (do_backup was never called by update, and health's own backup check at lines 481-485 would report 'No backups found' at exactly the moment it matters) — so the production instance is down for all users, on a DB containing live customer orders and body-profile data, with no automated or even documented path back beyond ad-hoc manual reconciliation.

**Suggested fix**

> Make `update` call `do_backup` (or at minimum capture the Flyway `schema_version`/`flyway_schema_history` max `installed_rank` and a `mysqldump` snapshot) immediately after capturing `previous_rev` and before `git pull`/rebuild, so a failed gate has a known-good restore point. On the rollback failure branch (the `error "Rollback to $previous_rev is ALSO unhealthy..."` message), print the backup path taken at the start of this `update` run and explicit next-step guidance to run `./prod_deploy.sh restore <that backup>` if the rolled-back code's failure is schema-related — don't leave 'manual intervention' as the entire plan once real user data exists.

## B-2 · `CRITICAL` — POST /api/outfits/generate calls the paid LLM provider on every request with zero rate limiting and zero input validation

**Location:** `server/src/main/java/com/iyae/config/RateLimitFilter.java:26`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** rate-limit-abuse

**Evidence**

> RateLimitFilter.RULES (lines 26-76) enumerates every throttled path — /api/auth/*, /api/chat/ (POST), /api/checkout, /api/public/avatar/generate, /api/avatar (DELETE/generate), /api/products/*/recommended-size, /api/posts/*, /api/follows/, /api/designer/products/* — but contains no entry whose pathPrefix is "/api/outfits". OutfitController.java:22 `@PostMapping("/generate") public ResponseEntity<OutfitResponse> generate(@RequestBody GenerateOutfitRequest request, Authentication authentication)` takes no `@Valid` and the request record itself (dto/GenerateOutfitRequest.java) has zero validation annotations on any field. OutfitService.java:60-66 `generateOutfit()` → `buildOutfitResponse()` → `generateExplanation()` (OutfitService.java ~300-317): `AIProvider provider = aiProviderFactory.getProvider(); ... provider.sendMessage(AI_SYSTEM_PROMPT, messages);` unconditionally calls the configured paid provider (Claude/DeepSeek/MiniMax in prod) whenever at least one catalog slot matched (true for the seeded 36-product catalog).

**Failure path**

> Any account that completes one (per-IP-throttled but ultimately free) email verification can hold a 24h JWT and call POST /api/outfits/generate in a tight loop — the filter's `for (RateRule rule : RULES)` loop never matches this path, so no 429 is ever returned and the request always reaches OutfitService. Each call triggers one billed LLM completion with a user-controlled, unbounded prompt (event/style/mood/weather are raw unvalidated strings concatenated into the AI user message in buildAiUserMessage). A simple scripted loop (tens to hundreds of req/s, well within what a single Spring instance can accept) turns into the same multiple of billed Anthropic/DeepSeek/MiniMax API calls per second, indefinitely, from one cheap account — direct, uncapped financial loss, in contrast to the equivalent AI-calling chat endpoint which the same filter caps at 10 req/60s.

**Suggested fix**

> Add a RateLimitFilter rule for POST /api/outfits/generate (and /manual) matching the chat bucket's severity (e.g. 10/60s), add @Valid to OutfitController.generate with @Size caps on GenerateOutfitRequest's string/list fields (event, style, mood, weather, colorPalette, seedProductIds), and consider making the AI-authored explanation optional/cacheable per product-slot-combination rather than a fresh LLM call on every request.

## B-3 · `CRITICAL` — Guest avatar body-scan GLBs are enumerable and downloadable by any unauthenticated caller via sequential taskId

**Location:** `server/src/main/java/com/iyae/service/GuestAvatarService.java:62`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** authz-ownership, privacy-assets (reported independently 2x)

**Precondition — read before ranking this:** the *missing-authorization* half holds unconditionally. The *body-scan disclosure* half requires `AVATAR_GENERATION_PROVIDER=smplx`, which is not the default anywhere in the tree (`docker-compose.prod.yml:52,99`, `docker-compose.yml:42,71`, `.env.example:79`, `dev.sh:151` all resolve to `mock`, and the licensed SMPL-X weights are not in the repository — `.gitignore:68`). Under the shipped `mock` default, `worker/main.py:151-157` routes to `SmplxStubProvider`, whose own docstring says the payload is "ignored by stub" (`worker/providers/smplx_stub_provider.py:226`) and which writes a fixed 8-vertex/12-triangle box via the zero-argument `create_avatar_glb()` — byte-identical for every visitor. So **as the repository ships today the exposure is enumeration of task existence, not body-scan disclosure**; it becomes the latter the moment SMPL-X is switched on. Fix this before enabling `smplx`, not after. (Note the same fact is already load-bearing elsewhere in this review: A-34's caveat states "the stub mesh is not derived from the submitted measurements at all (`input_payload` is ignored)" and uses it to justify a MEDIUM.)

**Evidence**

> server/src/main/java/com/iyae/service/GuestAvatarService.java:62-70 and :99-107: `AvatarGenerationTask task = avatarTaskRepository.findById(taskId).orElseThrow(...); User guest = getOrCreateGuestUser(); if (!task.getUser().getId().equals(guest.getId())) { throw new IllegalArgumentException("Task not found"); }` — the exact same check guards both `getTaskStatus(Long taskId)` and `openTaskModel(Long taskId)`. `getOrCreateGuestUser()` resolves ONE fixed internal account (`userRepository.findByEmail(brandProperties.guestEmail())`, default `guest@iyae.internal`) that every anonymous visitor's generated avatar task is attached to. `avatar_generation_tasks.id` is `BIGINT AUTO_INCREMENT PRIMARY KEY` (V6 migration), shared across both the authenticated and guest flows. Both `GET /api/public/avatar/status/{taskId}` (GuestAvatarController.java:28-31) and `GET /api/public/avatar/model/{taskId}` (GuestAvatarController.java:38-46) are reachable with zero authentication (`SecurityConfig`: `.requestMatchers("/api/public/**").permitAll()`), and neither path is covered by any `RateLimitFilter` rule (only `POST /api/public/avatar/generate` is rate-limited, 3/60s; the GET routes have no rule at all).

**Failure path**

> Any unauthenticated actor can script `GET /api/public/avatar/status/1`, `/2`, `/3`, ... incrementing taskId with no rate limit. For every id that belongs to a guest-flow task (every anonymous try-on user shares the single `guest@iyae.internal` account, so the ownership check `task.getUser().getId().equals(guest.getId())` is true for ALL of them — it provides zero isolation between different anonymous visitors), the status endpoint returns `glbUrl: /api/public/avatar/model/{taskId}` once READY, and the model endpoint streams that visitor's generated 3D body-scan GLB — a mesh whose shape directly encodes the real height/weight/waist/chest/hips/shoulder-width/inseam measurements that visitor typed into the anonymous try-on form (GuestAvatarRequest/GuestAvatarService.buildInputPayload). This is exactly the scenario the product's own code comments acknowledge and wave off rather than fix: `openTaskModel`'s Javadoc states "The task id is therefore exactly as guessable as it is for GET /api/public/avatar/status/{taskId}, which has always been keyed this way — this route does not widen that surface," i.e. the team knew the id is guessable and treated it as pre-existing rather than remediating it. The current regression test (`GuestAvatarServiceTest.openTaskModelRefusesAnotherAccountsTask`) only proves a *registered user's* task (different `user_id`) is refused; there is no test for guest-vs-guest isolation because no such isolation exists — every guest avatar ever generated, for as long as the task rows persist (no retention/expiry job found), is downloadable by anyone who can count. Registered users' own avatars are NOT exposed through this path (their `user_id` differs from the guest account's, so the check correctly rejects them) — the exposure is scoped to every anonymous visitor who has used the try-on flow.

**Suggested fix**

> Stop keying the guest routes on the shared DB primary key. Issue a per-request unguessable secret (e.g. a 128+-bit random token) at `generateForGuest()` time, store its hash alongside the task row (mirroring the existing `SecureTokenService` pattern already used for email verification / password reset), return the raw token to the caller instead of the raw taskId, and require it on both `GET /api/public/avatar/status/{token}` and `GET /api/public/avatar/model/{token}`. Alternatively, scope guest avatars to a short-lived per-browser session (e.g. a signed cookie checked against the task) rather than one shared account for every anonymous visitor on the internet. Also add the two GET routes to `RateLimitFilter` regardless of the fix, since even a token-based scheme benefits from throttling repeated guesses.

## B-4 · `CRITICAL` — Account deletion cascades through post_comments.parent_comment_id and silently deletes OTHER users' replies

**Location:** `server/src/main/resources/db/migration/V8__community_tables.sql:37`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** db-migrations

**Evidence**

> V8__community_tables.sql:37 `FOREIGN KEY (parent_comment_id) REFERENCES post_comments(id) ON DELETE CASCADE`; AccountDeletionService.java:110 `postCommentRepository.deleteByUser(user);`; PostCommentRepository.java:27 `void deleteByUser(User user);` (plain derived delete, no re-parenting of children).

**Failure path**

> User A leaves a top-level comment on any post. User B (an unrelated, still-active account) replies to it, which sets `post_comments.parent_comment_id = A's comment id` (PostService.addComment, request.parentCommentId()). User A later calls `DELETE /api/auth/me`. `AccountDeletionService.deleteAccount` runs `postCommentRepository.deleteByUser(user)` (line 110), issuing a real SQL DELETE against A's `post_comments` rows — there is no step anywhere in the method that re-parents or detaches children first. MySQL/InnoDB enforces `ON DELETE CASCADE` on `parent_comment_id` regardless of how Hibernate issued the delete, so B's reply row is cascade-deleted along with it: a comment B never asked to remove, on a post that still exists, vanishes with no notification and no way to recover it. This is exercised only against real MySQL — the test suite runs on H2 with a Hibernate-generated schema (no `@OnDelete` annotation on `PostComment.parentComment`), so no JUnit test ever sees the real FK cascade, which is why it was not caught by the two prior review passes.

**Suggested fix**

> Before deleting the user's own comments in AccountDeletionService, re-parent or detach any other user's replies that point at them (e.g. bulk-update `parent_comment_id = NULL` — and flag the orphaned reply as a top-level comment with a 'reply to a deleted comment' placeholder — for rows whose parent belongs to the deleting user but whose own author does not), or change the FK to `ON DELETE SET NULL` and have PostService render a tombstone placeholder for a comment with no author. Add a test seeded against a real/representative FK (or an `@OnDelete`-annotated H2 schema) asserting a third party's reply survives the parent author's account deletion.

## B-5 · `CRITICAL` — Rigging GLB write is non-atomic and in-place at a deterministic, live-served path — a failed retry/regeneration permanently destroys an already-working try-on asset

**Location:** `worker/providers/skinned_glb_writer.py:339`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** worker-python

**Evidence**

> worker/providers/skinned_glb_writer.py:339-340: `gltf.set_binary_blob(binary_blob); gltf.save(str(output_path))` — called directly against the live serving path with no temp file or rename. pygltflib's `GLTF2.save_binary` (.venv/lib/python3.12/site-packages/pygltflib/__init__.py:1098) does `with open(fname, 'wb') as f:` — this truncates the destination the instant it is opened, before the new GLB bytes are built/written.

**Failure path**

> worker/providers/python_rigging_provider.py:160-163 computes `out_rel = f"rigged/{garment_asset_id}/garment-rigged.glb"` — deterministic per garment, NOT per task_id (unlike the model path `products/{product_id}/tasks/{task_id}/preview.glb` or the avatar path `avatars/{user_id}/{task_id}/avatar.glb`, both confirmed task-scoped and therefore immune to this). `worker/providers/stub_rigging_provider.py:197-201` writes the same deterministic path the same way (`open(output_path, 'wb')`, no temp+rename either). Server-side, `RiggingService.requestRigging()` (server/src/main/java/com/iyae/service/RiggingService.java:36-82) and `RiggingService.retry()` (:122-167) both create a new task against the SAME `garmentAsset.getId()` — a routine designer action (re-trigger rigging after editing the garment image, or click 'Retry' after any unrelated failure) reuses the exact live path. nginx serves this path directly with no API gate: `nginx/conf.d/default.conf:91-92` `location /assets/rigged/ { alias /var/iyae/assets/rigged/; }`, and `OutfitService.java:220-228` returns `asset.getRiggedGlbUrl()` to every shopper's outfit/try-on view unconditionally — that DB field is only ever updated on a successful materialize (`RiggingService.materializeRiggedAsset`, :182-218) and is never cleared or rolled back when a later attempt fails. Sequence: (1) garment 42 has a good, live rigged GLB being shown to shoppers; (2) a new rigging task for asset 42 is claimed and `write_skinned_glb` is called against the same `out_abs`, which truncates the existing good file at the moment it opens the handle; (3) if anything from that point on fails — a crash/OOM/disk-full during `gltf.save()` (`main.py` explicitly anticipates `MemoryError` for this exact task at worker/main.py:389-395, confirming the failure mode is expected), or a post-write rejection from `validate_rigged_glb`/`validate_glb_geometry` in `main.py` (worker/main.py:333-356, which calls `rigging_queue.fail_task(...)` but never deletes or restores the file at `absolute_path`) — the task is correctly marked FAILED in `rigging_tasks`, but the file on disk is now empty/truncated/invalid and `asset.riggedGlbUrl` in the DB still points at it, unchanged. Every subsequent shopper who views that garment's try-on/outfit now receives a broken GLB where a working one existed moments before, with no operator-visible signal beyond an internal FAILED task row the designer may not even check. This is live, customer-facing data loss triggered by an ordinary, expected operation (regenerate/retry), not an exotic edge case.

**Suggested fix**

> Write to a temp file in the same directory (e.g. via `tempfile.mkstemp(dir=os.path.dirname(out_abs), suffix='.glb')` or `out_abs + f'.tmp-{task_id}'`), have `write_skinned_glb` target that temp path, and only `os.replace(tmp_path, out_abs)` (atomic on the same filesystem) after `main.py`'s validation of the temp file succeeds; on any exception or validation failure, unlink the temp file and leave the previously-published GLB untouched. Apply the same pattern to `stub_rigging_provider.py` and `blender_rigging_provider.py` for consistency.

## B-6 · `HIGH` — .env (all production secrets) is created world-readable and never locked down

**Location:** `.env`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** infra-deploy

**Evidence**

> `ls -la .env` on this exact checkout: `-rw-r--r-- .env` (mode 644). `dev.sh:131` and `prod_deploy.sh:297` both do `cp .env.example .env` with no `chmod` afterward. Contrast with `prod_deploy.sh:111-124` (`do_backup`), which explicitly `chmod 700`s the backup dir and sets `umask 077` before writing backup files "because... any account on the host could read the lot" — the exact same reasoning never got applied to `.env` itself.

**Failure path**

> `.env` holds `DB_PASSWORD`, `JWT_SECRET`, `ADMIN_BOOTSTRAP_PASSWORD`, `INTERNAL_MAIL_SECRET`, `RESEND_API_KEY`, `WORKER_TRIPO_API_KEY`/`WORKER_MESHY_API_KEY`, and (once payment is enabled) `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`. Neither `dev.sh setup` nor `prod_deploy.sh setup`/`up` restricts its mode after creating it, and the default umask on a typical host (022) leaves it readable by every local account — confirmed empirically on this very checkout. Any second local/service account on the production host (a second operator, a backup/monitoring agent, a CI runner with persistent access, or any unrelated low-privileged process) can `cat .env` with no further exploit and obtain: JWT_SECRET (forge a valid HS256 token for any user id, including an ADMIN, bypassing all auth), DB_PASSWORD (read/modify every customer's PII, body measurements and order history directly), and every third-party API key. This is the same class of defect the backup-file-mode fix (2026-10-11 changelog) was written to close, left unclosed for the one file that matters most.

**Suggested fix**

> After `cp .env.example .env` in both scripts, `chmod 600 .env` (and `umask 077` before the copy, mirroring `do_backup`). Consider also warning in `require_production_config`/`gate_readiness` if `.env` is group/world-readable.

## B-7 · `HIGH` — No automated test (unit, integration, or E2E) exercises upload -> 3D generation trigger -> status polling -> materialization, and the CI E2E job structurally cannot run one

**Location:** `.github/workflows/e2e.yml:236`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** test-integrity

**Evidence**

> `.github/workflows/e2e.yml:233-236`: "# Only the three services the suite needs. The 3D/rigging workers add several minutes of build time and nothing the E2E tests assert on." followed by `docker compose up -d --build mysql server web`. `web/e2e/designer-crud.spec.ts` (the file the project's own CLAUDE.md credits with covering "image upload, 3D generation") creates a product with no image file and contains no reference to upload/generation/regenerate/glb anywhere in the file; a repo-wide grep for those terms across `web/e2e/*.spec.ts` turns up nothing related to the designer flow.

**Failure path**

> The worker container is never started in the Playwright CI job, so even if an E2E test attempted to poll a generation task to READY, it would time out forever (the task would sit PENDING with no worker to claim it). A regression anywhere in the designer upload path, the `regenerate`/`generation-status` endpoints, or the worker's materialization into `GarmentAsset` can ship with every CI job green, for one of the flows the review brief itself names as unrecoverable if broken.

**Suggested fix**

> Add a worker service (using the default `mock`/`StubGenerator` provider, which requires no GPU/API key and completes near-instantly) to the Playwright CI compose invocation, and add an E2E spec that uploads an image, triggers generation, polls `generation-status` to READY, and asserts the resulting GLB URL renders in the viewer.

## B-8 · `HIGH` — do_backup never rotates: the daily cron it documents grows without bound on the filesystem that holds MySQL's data directory, and nothing checks disk

**Location:** `prod_deploy.sh:131`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** gap:Generated-asset storage has no retention, no quota and no monitoring, on the same filesystem as the database, gap:Generated 3D assets accumulate on the shared volume forever; no retention, cleanup, or disk-usage alerting exists (reported independently 2x)

**Evidence**

> prod_deploy.sh:131-133 archives the WHOLE asset tree on every run, into a fresh timestamped directory (line 114 `target="$BACKUP_DIR/$stamp"`), with no pruning of prior runs anywhere in the file: ``` info "Archiving the assets volume to $target/assets.tar.gz ..." docker compose -f "$COMPOSE_FILE" exec -T server \ tar czf - -C /var/iyae/assets . > "$target/assets.tar.gz" ``` and prod_deploy.sh:149 tells the operator to run exactly that, daily, forever: ``` info "Schedule it: 15 3 * * * cd $(pwd) && ./prod_deploy.sh backup >> /var/log/iyae-backup.log 2>&1" ``` Target defaults into the deploy checkout — prod_deploy.sh:39 `BACKUP_DIR="${BACKUP_DIR:-./backups}"`. `grep -i 'rotat|prune|retention'` over every .sh returns nothing.

**Failure path**

> Operator follows the script's own instruction at line 149 and crons `backup` nightly. Each run writes a full mysqldump plus a full tar of `/var/iyae/assets`; neither the script nor any other component ever removes an older run. Growth is therefore N_days x (DB + entire asset tree), and GLB/JPEG/USDZ payloads are already-compressed so gzip reclaims little. `mysql_data` and `assets_data` are bare named volumes under /var/lib/docker (docker-compose.prod.yml:207-211) with no quota, and on a single-volume host that is the same filesystem as `./backups`. When it fills, InnoDB write failures begin: POST /api/checkout, cart writes, post creation and every task-row INSERT fail, i.e. total outage. Nothing warns beforehand — `prod_deploy.sh health` (lines 447-498) checks container status, readiness, TLS, backup *presence* and cert expiry but never free space, and the readiness probe it gates on is `connection.isValid(2)` (HealthService.java:43-51), a read-only round trip that stays green while writes fail. Worse, a backup aborted mid-dump by ENOSPC leaves a partial `$target` directory behind, and `health` (prod_deploy.sh:481-485) then reports it as `Most recent backup: <stamp>` from a bare `ls -1t` with no validation — so the operator is told they have a current backup at the exact moment they do not.

**Suggested fix**

> Add retention to `do_backup`: after the integrity check, prune to a configurable `BACKUP_KEEP` (e.g. `ls -1t "$BACKUP_DIR" | tail -n +$((BACKUP_KEEP+1)) | xargs -r -I{} rm -rf "$BACKUP_DIR/{}"`), default 7. Refuse to start a backup when free space on `$BACKUP_DIR`'s filesystem is below (last asset archive size x 2) — fail loudly rather than filling the disk the database lives on. Add a disk-headroom check to the `health` branch (`df -P` on the Docker root and on `$BACKUP_DIR`, error below 15% free) and validate the newest backup directory contains both non-empty members before reporting it as the most recent. Consider `BACKUP_DIR` defaulting to a path the operator must set explicitly off the data volume.

## B-9 · `HIGH` — Stripe SDK pinned to unbounded dynamic version `26.+` with no dependency locking or CI drift detection

**Location:** `server/build.gradle.kts:46`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** gap:Payment SDK pinned to an unbounded dynamic version (`26.+`) with no Gradle dependency locking

**Evidence**

> server/build.gradle.kts:46: `implementation("com.stripe:stripe-java:26.+")` — every other dependency in the same block is exact: `io.jsonwebtoken:jjwt-api:0.12.6` (line 41), `org.springframework.boot` plugin version `3.4.1` (line 3), `io.spring.dependency-management` version `1.1.7` (line 4). `com.mysql:mysql-connector-j` and the Flyway/Spring Boot starters omit a version only because `io.spring.dependency-management` pins them centrally via the Spring BOM — stripe-java is not covered by that BOM and has no pin of its own.

**Failure path**

> stripe-java is the one library in the server that verifies inbound webhook signatures (`CheckoutService.java:234`, `stripeGateway.constructEvent(payload, signature, stripeWebhookSecret)`, backed by `com.stripe.exception.SignatureVerificationException`/`com.stripe.model.Event`) and that calls Stripe's live Checkout API to create paid sessions (`com.stripe.param.checkout.SessionCreateParams`, `com.stripe.model.checkout.Session`). Because the version is a Gradle dynamic range (`26.+`) and there is no `gradle.lockfile` anywhere in the repo (confirmed absent at repo root and in `server/`) and no `dependencyLocking { lockAllConfigurations() }` block in `server/build.gradle.kts` (confirmed absent), every `gradle build`/`gradle test`/`gradle bootJar` re-resolves to whatever the newest `26.x.y` on Maven Central is at that moment — with zero diff and zero review. The CI server job (`.github/workflows/e2e.yml`, `server-tests`) runs plain `gradle test --no-daemon` with no lockfile verification or dependency-resolution-drift step, and the production image build (`server/Dockerfile`: `FROM gradle:8.10-jdk22 AS build` ... `RUN gradle bootJar --no-daemon`) resolves fresh again at image-build time, independent of whatever CI resolved. A new `26.x.y` release that changes webhook-signature verification behavior, alters a request/response field Jackson deserializes, or is itself compromised on Maven Central would silently become the version shipped to production on the next build/deploy, directly affecting the one code path that moves real money (checkout session creation + webhook-driven order fulfillment in `CheckoutService`) with no corresponding commit or review to catch it. By contrast, `web/package-lock.json` is committed and pins every npm dependency exactly, so this is an inconsistency specific to the server's one payment-critical dependency.

**Suggested fix**

> Either (a) pin to an exact version, e.g. `implementation("com.stripe:stripe-java:26.14.0")` (use whatever the currently-resolved exact version is) and bump it via a reviewed PR, or (b) enable Gradle dependency locking for the server module (`dependencyLocking { lockAllConfigurations() }` in `build.gradle.kts`, run `gradle dependencies --write-locks`, commit the resulting `gradle.lockfile`) and add a CI step (`gradle dependencies --write-locks --dry-run` equivalent, or simply failing the build if `git diff --exit-code gradle.lockfile` is non-empty after a normal resolve) so a version drift shows up as a reviewable diff rather than a silent re-resolve. Either approach should also cover the Dockerfile build stage, since it resolves independently of CI.

## B-10 · `HIGH` — Prod preflight never checks RESEND_API_KEY / RESEND_FROM_EMAIL — sandbox default silently kills every real user's verification/reset email, with no alerting

**Location:** `server/src/main/java/com/iyae/config/ProductionConfigValidator.java:56`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** gap:Email deliverability to real users is unvalidated at prod boot and failures are deliberately silent

**Evidence**

> ProductionConfigValidator's @Value fields (lines 58-74) are corsOrigins, frontendBaseUrl, internalMailSecret, resendMailEndpoint, stripeSecretKey, stripeWebhookSecret — there is no RESEND_API_KEY or RESEND_FROM_EMAIL field, and validate() (lines 90-139) never references them. prod_deploy.sh's require_production_config() (lines 219-242) likewise calls `require_env_vars DB_PASSWORD MYSQL_ROOT_PASSWORD JWT_SECRET INTERNAL_MAIL_SECRET ADMIN_BOOTSTRAP_EMAIL ADMIN_BOOTSTRAP_PASSWORD CORS_ORIGINS FRONTEND_BASE_URL` plus the Stripe pair — RESEND_API_KEY/RESEND_FROM_EMAIL are absent there too. docker-compose.prod.yml:134-135 wires `RESEND_API_KEY: ${RESEND_API_KEY}` (empty if unset, nothing catches that) and `MAIL_FROM: ${RESEND_FROM_EMAIL:-onboarding@resend.dev}`. .env.example:142-143 ships that exact default with its own comment: '# Default onboarding@resend.dev is a sandbox — can only deliver to your Resend account email'. web/app/api/internal/mail/send/route.ts has no startup-time check (Next.js has no @PostConstruct-equivalent): it constructs `new Resend(process.env.RESEND_API_KEY)` per-request (line 51) and only reacts after the fact — `if (error) { ...; return Response.json(..., {status: 502}); }` (lines 59-61).

**Failure path**

> Operator follows .env.example's own shipped values into docker-compose.prod.yml and either leaves RESEND_API_KEY unset or leaves RESEND_FROM_EMAIL at its sandbox default while setting only the key. Both `./prod_deploy.sh up` (require_production_config) and the server's own @PostConstruct ProductionConfigValidator pass cleanly — neither variable is in either check. Every `POST /api/auth/register` still returns 201 with a usable JWT (AuthService.register, lines 151-156, wraps the send in try/catch and only `log.warn`s on AuthMailService.EmailDeliveryException), because Resend rejects sandbox-sender mail to any recipient other than the account owner (502 from the internal route) or the client 401s with no key at all — either way AuthMailService.sendViaResend throws EmailDeliveryException on the non-2xx response. The same swallow happens in forgotPassword (log.error, line 288) and resendVerification (log.warn, line 257), so a user who notices they never got the link and asks for a new one hits the identical silently-broken path. Login is gated by `requireEmailVerification` in prod, so the account is now permanently stuck unverified with zero in-app error at any step — not a 503, not a toast, nothing. The only trace is a log line in container stdout; grep of the whole repo (build.gradle.kts, every application*.yml) turns up no micrometer/actuator/prometheus/sentry dependency at all, so there is no metric or alert that would tell an operator this is happening to 100% of real signups on launch day except reading logs nobody is paged to watch.

**Suggested fix**

> (1) Yes — ProductionConfigValidator should fail prod boot (or at minimum log.error loudly) when RESEND_API_KEY is blank under the prod profile, and should fail/warn when RESEND_FROM_EMAIL (or MAIL_FROM as read by the web container) is blank or still equals the literal sandbox default `onboarding@resend.dev`, mirroring the existing INTERNAL_MAIL_SECRET-dev-default check pattern already in this file. Since RESEND_API_KEY/RESEND_FROM_EMAIL live on the web container, not the server's Spring Environment, this check more naturally belongs in prod_deploy.sh's require_production_config() (add both to the require_env_vars list and add a sandbox-default string match next to the existing FRONTEND_BASE_URL localhost check) so it's enforced on every `up`/`update`, not just an operator who remembers to also configure the server-side JVM. (2) No — there is currently no metric or alert of any kind; add a minimal synthetic check (e.g. a scheduled server-side canary that calls the mail route and emits a counter/log line distinguishable from the per-request warn, or at minimum document in the runbook that the first few hours' server logs must be grepped for 'Failed to send verification email' before declaring launch healthy).

## B-11 · `HIGH` — No production content or designer-onboarding path exists: the ADMIN role cannot create products or promotions, roles are immutable after registration, and no seed/cutover script exists

**Location:** `server/src/main/java/com/iyae/config/SecurityConfig.java:66`  
**Verification:** CONFIRMED (2/3 lenses)  
**Found by:** gap:Production database seeds to an empty marketplace; no production content/designer-onboarding path exists

**Evidence**

> The catalogue write surface is reserved to DESIGNER and the admin surface has no create endpoints. server/src/main/java/com/iyae/config/SecurityConfig.java:66-68: ```java .requestMatchers("/api/designer/**").hasRole("DESIGNER") .requestMatchers("/api/promotions/**").hasRole("DESIGNER") .requestMatchers("/api/admin/**").hasRole("ADMIN") ``` `AdminController` exposes only `GET /products`, `PUT /products/{id}/status`, posts/reports/comments moderation, `GET /promotions` and `PUT /promotions/{id}/slot` — no product create, no promotion create, no designer listing or approval (AdminController.java:34-98; AdminModerationService.java has no designer-facing method at all). `PromotionService.createPromotion` requires an owned product (`resolveOwnedProduct(request.productId(), user.getId())`, PromotionService.java:46-48), so only a DESIGNER can fill the FEATURED/SPONSORED slots. Role is write-once: a repo-wide grep for `setRole|.role(` in `server/src/main/java` finds assignments only in `AuthService.java:102` (at registration) and `AdminBootstrap.java:91,108`. There is no role-change endpoint. `DataSeeder` is `@Profile({"dev", "test"})` (DataSeeder.java:26) with the comment "Unlabelled now means 'seed nothing'". `scripts/` contains only `fetch-smplx-models.sh` and `verify-migrations.sh`; `prod_deploy.sh` has no seed/content step (grep for seed/catalog/product/designer matches only `require_production_config` text); there is no runbook file anywhere in the tree.

**Failure path**

> Cutover sequence on a fresh production database: Flyway runs V1-V24 (V17 inserts two pickup locations; nothing inserts a product, designer profile or promotion), `DataSeeder.run` is never registered because the active profile is `prod`, and `AdminBootstrap` creates exactly one `Role.ADMIN` account from `ADMIN_BOOTSTRAP_EMAIL` (which `prod_deploy.sh:226` makes mandatory). The instance now has 0 products, 0 designer profiles, 0 promotions. The operator signs in to `/admin`: `GET /api/admin/products` returns `[]`, and there is no create affordance — `POST /api/designer/products` answers 403 for them because their single role is ADMIN, not DESIGNER, and `ProductService.createProduct` additionally requires a `DesignerProfile` that no ADMIN account has. `GET /api/promotions/featured` returns empty, so the FEATURED carousel has nothing. `GET /api/products` returns an empty page, so `/products` renders "No pieces found" for every visitor. `OutfitService.buildOutfitResponse` filters `findAll()` to PUBLISHED (OutfitService.java:130-133) and skips every slot with no candidates (lines 155-160), so the AI stylist completes a chat turn and persists an outfit with zero slots — the user is handed an empty recommendation rather than an error. The only way out is to self-register a second account with `role=DESIGNER` under a different email and hand-enter listings through `/designer/products/new`, which is also the only onboarding path available to any real designer. Nothing in the repository automates or documents this, so launch hour one is a dead storefront for every visitor and stakeholder demo.

**Suggested fix**

> Add a production-safe content bootstrap distinct from DataSeeder — either a Flyway migration seeding a vetted starter catalogue, or an idempotent `prod_deploy.sh seed-catalog` step reading a checked-in JSON/CSV manifest — and gate `prod_deploy.sh up`/`health` on a non-empty PUBLISHED catalogue so an empty storefront fails loudly instead of silently. Independently, give ADMIN the ability to administer content: either permit ADMIN on `/api/designer/**` and `/api/promotions/**` (creating an operator-owned DesignerProfile on bootstrap) or add explicit `POST /api/admin/products` and `POST /api/admin/promotions`. Write the cutover runbook (seed, verify catalogue non-empty, verify a FEATURED promotion resolves, verify one end-to-end try-on) as a checked-in document.

## B-12 · `HIGH` — POST /api/events accepts any EventType from an authenticated client — the INVEST/STOP drape-decision gate is 100% client-forgeable

**Location:** `server/src/main/java/com/iyae/controller/AnalyticsController.java:32`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** gap:Analytics/KPI subsystem: client-trusted, unthrottled, silently lossy — and the INVEST/STOP decision gate reads it, gap:Client-emitted analytics events are trusted at face value — any buyer can forge ORDER_PAID/CHECKOUT_INITIATED rows that feed the admin KPI and deploy-decision dashboards (reported independently 2x)

**Evidence**

> AnalyticsController.java:32-37: `type = EventType.valueOf(request.type().trim().toUpperCase());` — any name in the EventType enum (VIEW, TRYON_STARTED, ADD_TO_CART, CHECKOUT_INITIATED, ORDER_PAID, ORDER_RETURNED) is accepted from the client with no allow-list restricting it to advisory types, and AnalyticsEvent (entity) has no source/provenance column distinguishing a client-submitted row from one CheckoutService emitted. useTrackEvent.ts's own comment says 'server-side emission remains authoritative for the conversion funnel; client events are advisory' but the server never enforces that distinction.

**Failure path**

> AnalyticsService.drapeDecision (lines 142-171) computes tryBefore/cartBefore/tryAfter/cartAfter purely from COUNT(*) over TRYON_STARTED and ADD_TO_CART rows in analytics_events, and that pair of event types has no server-side emitter anywhere in the codebase — confirmed by grep: CheckoutService only emits CHECKOUT_INITIATED/ORDER_PAID/ORDER_RETURNED; TRYON_STARTED is emitted solely by AvatarViewer.tsx:276-280 and ADD_TO_CART solely by products/[id]/page.tsx:226, both via POST /api/events. Any one authenticated account (open registration, no admin approval) can loop POST /api/events {type:'ADD_TO_CART', productId:N} (or withhold it) after ANALYTICS_DRAPE_DEPLOY_CUTOFF; at 60 req/60s (RateLimitFilter.java:60) that is up to 86,400 events/day from a single IP/account, dwarfing real Phase-0 traffic and trivially pushing relLift past the +10% threshold (or driving it negative) and the two-proportion z-test past p<0.05 in either direction — flipping the recommendation returned by GET /api/admin/kpis/drape-decision between INVEST and STOP with no code path able to tell a genuine try-on/add-to-cart from a forged one. The same lack of a type allow-list also lets any account inject fabricated CHECKOUT_INITIATED/ORDER_PAID rows into kpisByCohort's conversion-rate aggregate (paid/initiated) alongside CheckoutService's real rows, corrupting the admin KPI view with no way to separate genuine from forged counts.

**Suggested fix**

> Split /api/events into a strictly client-advisory allow-list (VIEW, TRYON_STARTED, ADD_TO_CART) and reject CHECKOUT_INITIATED/ORDER_PAID/ORDER_RETURNED from this endpoint (400) since those must only ever be written by CheckoutService; add a per-user (not just per-IP) event-count cap or an idempotency/dedupe key tied to the triggering action (e.g. one TRYON_STARTED per product per session, enforced server-side) so the drape-decision funnel cannot be trivially inflated by a single account.

## B-13 · `HIGH` — Chat messages have no length cap and the entire session history is resent to the paid AI provider on every turn

**Location:** `server/src/main/java/com/iyae/dto/ChatMessageRequest.java:6`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** rate-limit-abuse

**Evidence**

> dto/ChatMessageRequest.java: `public record ChatMessageRequest(@NotBlank(message = "Message content must not be blank") String content) {}` — no `@Size` or max-length constraint anywhere, and no `web/components` chat input applies a client-side maxLength either (grep found none). ChatService.java:143-148 persists `content` verbatim, then line 151: `List<ChatMessage> history = chatMessageRepository.findBySessionOrderByCreatedAtAsc(session);` loads EVERY message ever sent in the session, and `buildAiMessages()` (ChatService.java:238-245) maps the full `history` list — with no windowing/truncation — into the payload passed to `aiProvider.sendMessage(effectivePrompt, aiMessages)` (line 162). There is also no global JSON body-size limit configured anywhere in application.yml; `spring.servlet.multipart.max-request-size: 10MB` only bounds multipart/file-upload requests, not @RequestBody JSON reads.

**Failure path**

> POST /api/chat/sessions/{id}/messages is capped at 10 requests/60s per IP, but nothing caps the size of `content` in each request or the number of prior turns resent. A user can (a) send a single multi-megabyte `content` string as one of their 10 allowed requests per minute, which is forwarded wholesale into a billed LLM prompt, and (b) keep one ACTIVE session alive indefinitely (sessions aren't message-count-limited and only flip to COMPLETED when an outfit is produced), so by turn N the server resends N prior messages' full content to the AI provider on every single subsequent call — token cost grows at least linearly per turn and the accumulated transcript size is unbounded. Ten large-content requests per minute sustained over hours is a direct, uncapped multiplier on the AI provider bill that the existing per-minute request-count limit does nothing to restrain.

**Suggested fix**

> Add `@Size(max = N)` (e.g. 2000-4000 chars) to ChatMessageRequest.content, enforce a per-session message/turn cap (or sliding-window truncation of `history` before it is sent to the provider, e.g. last K turns), and add a general `server.tomcat.max-swallow-size`/application-level body-size guard for non-multipart JSON endpoints.

## B-14 · `HIGH` — Outbound mail HTTP call runs inside the JPA transaction for register/forgot-password/resend-verification, risking DB-pool exhaustion under mail-route latency

**Location:** `server/src/main/java/com/iyae/service/AuthService.java:151`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** auth-identity, server-java (reported independently 2x)

**Evidence**

> AuthService.java:75 `@Transactional public AuthResponse register(...)` ... line 151-156: `try { authMailService.sendVerificationEmail(user.getEmail(), user.getName(), rawToken); } catch (AuthMailService.EmailDeliveryException e) { log.warn(...); }` — same pattern at `resendVerification` (line 241 `@Transactional`, call at 253-258) and `forgotPassword` (line 264 `@Transactional`, call at 284-289). `AuthMailService.java` line 37-40 builds a shared `HttpClient` with `connectTimeout(5s)`, and line 54 sets a 10s `requestTimeout`; the blocking `HTTP_CLIENT.send(...)` at line 109 executes synchronously inside the caller's method body.

**Failure path**

> register()/forgotPassword()/resendVerification() are `@Transactional`, so Spring/Hibernate acquire a pooled DB connection on the first JPA write (e.g. `userRepository.save(user)` in register, `passwordResetTokenRepository.save(resetToken)` in forgotPassword) and hold that physical connection for the life of the method — including the subsequent synchronous `AuthMailService` HTTP call to the Next.js mail route, which can block for up to 5s connect + 10s read (~15s) per request. No Hikari pool size is configured anywhere in `application*.yml` or compose files, so it defaults to HikariCP's 10. If the mail route (`RESEND_MAIL_ENDPOINT`, i.e. the `web` container's `/api/internal/mail/send`, itself dependent on the Resend API) merely becomes slow rather than refusing connections outright — plausible under Resend API latency, web-container load, or a network blip, and exactly the kind of launch-day condition a sign-up surge produces — then any 11th concurrent call to register/forgot-password/resend-verification blocks waiting for a free connection. Once concurrency exceeds the pool size for the duration of the mail timeout, every other DB-backed endpoint in the app (login, product browsing, cart, chat) queues behind the same exhausted Hikari pool and starts timing out, i.e. an app-wide outage triggered purely by a degraded third-party mail dependency, not an outright mail outage. Per-IP rate limiting (3/60s on these routes) does not prevent this because the trigger is aggregate concurrency across many distinct users/IPs signing up at once, which rate limiting by IP cannot bound.

**Suggested fix**

> Send the verification/reset email after the transaction commits rather than inside it — via `TransactionSynchronizationManager.registerSynchronization` or `@TransactionalEventListener(phase = AFTER_COMMIT)` — so the request thread and its DB connection are released before the outbound call starts. Independently, add a short circuit-breaker/bulkhead (e.g. Resilience4j) around `AuthMailService` so a degraded mail route fails fast instead of holding resources for the full connect+read timeout.
>
> **Do not reach for `@Async` as a shortcut here.** This tree has no `@EnableAsync` anywhere (`grep -rn '@EnableAsync' server/src/main/java/` → no hits) and no `AsyncConfigurer`, so annotating `AuthMailService.send*` changes nothing: the call stays synchronous on the request thread, inside the transaction, and the defect survives a change that looks like a fix. If you do want the executor route, it costs an `@EnableAsync` + a bounded `ThreadPoolTaskExecutor` bean first — and note that `@Async` alone still does not fix the ordering problem, because the mail would then fire before the transaction commits.

## B-15 · `HIGH` — The "Local Designers" shop filter can never match a product in production — designer_profiles.is_local has no production write path

**Location:** `server/src/main/java/com/iyae/service/AuthService.java:143`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** gap:Production database seeds to an empty marketplace; no production content/designer-onboarding path exists

**Evidence**

> Designer registration never sets `city` or `isLocal` (server/src/main/java/com/iyae/service/AuthService.java:143-149): ```java if (request.role() == Role.DESIGNER) { DesignerProfile designerProfile = DesignerProfile.builder() .user(user) .displayName(displayName) .build(); designerProfileRepository.save(designerProfile); } ``` `DesignerProfile.isLocal` is a primitive `boolean` (entity/DesignerProfile.java:40) so it defaults to `false`. A repo-wide grep for `setIsLocal|isLocal(|setCity` finds writers only in `config/DataSeeder.java:113,129` (`@Profile({"dev","test"})`) and `service/AccountDeletionService.java:206` (`profile.setCity(null)`). `DesignerProfileService.updateProfile(email, displayName, shopName, bio)` does not accept city/isLocal at all. The consumer is live and user-reachable: `web/components/SearchFilterBar.tsx:23` `{ key: "local", label: "Local Designers" }`, rendered at `web/app/products/page.tsx:242-244`, mapping to `localOnly=true` (products/page.tsx:174) -> `ProductController.java:26` -> `repository/ProductSpecifications.java:37-39`: ```java if (localOnly) { Join<Object, Object> designer = root.join("designerProfile"); predicates.add(cb.isTrue(designer.get("isLocal"))); } ```

**Failure path**

> In production, every `designer_profiles` row is created by `AuthService.register` with `is_local = 0` and `city = NULL`, and no endpoint exists that can change either value (`DesignerProfileService` is the only class with setters for profile fields and it has zero injection sites — see the dead-service finding). A shopper on `/products` taps the "Local Designers" pill; the request becomes `GET /api/products?localOnly=true`; the specification adds `AND designer_profiles.is_local = TRUE`, which matches zero rows by construction. The page renders the empty state at `web/app/products/page.tsx:262-266` ("No pieces found"). This is permanent, not a cold-start artifact: no amount of designer onboarding can ever make the filter return a result. It works in dev only because `DataSeeder` hardcodes `.isLocal(true)` on two profiles, which is exactly why the end-to-end tests (`ProductSpecificationsDataJpaTest` builds profiles with an explicit `isLocal(local)` argument) pass while production is broken. The `· Local` badge at `web/app/admin/page.tsx:214` and `web/components/ProductListItem.tsx:98` is likewise dead.

**Suggested fix**

> Add `city` (and a derived or operator-set `isLocal`) to a designer-profile write path: either collect city during DESIGNER registration and set `isLocal` from a configured local-city list, or add an admin endpoint that flags a designer as local (which is the honest model, since "local" is a curation claim that should not be self-asserted). Until one exists, hide the "Local Designers" pill behind a check that at least one local designer exists, rather than shipping a filter that always returns nothing.

## B-16 · `HIGH` — In-flight avatar generation writes the body-scan GLB to disk after a privacy delete's file sweep already ran, permanently orphaning it with no cleanup path

**Location:** `server/src/main/java/com/iyae/service/AvatarService.java:211`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** gap:Body-scan GLB survives a privacy delete when a worker job is in flight

**Evidence**

> AvatarService.java:211-242 `deleteAvatarData` deletes the PENDING/RUNNING AvatarGenerationTask row(s) (`avatarTaskRepository.deleteAll(tasks)`, line 233) then calls `deleteAvatarFiles(user.getId())` (line 239), a one-shot `Files.walk` over `{assetRoot}/avatars/{userId}` (lines 250-268) that only deletes what already exists on disk at call time. The worker (`worker/main.py:279-300`) runs `avatar_provider.generate(...)` to completion — which, in both `providers/smplx_stub_provider.py:239-245` and the production `providers/smplx_provider.py:319-320`, does `os.makedirs(output_dir, exist_ok=True)` then writes `avatar.glb` to `{assetRoot}/avatars/{user_id}/{task_id}/` — *before* `main.py` calls `avatar_queue.complete_task(task_id, output)`. `AvatarTaskQueue.complete_task` (`worker/avatar_task_queue.py:57-76`) only logs `cursor.rowcount == 0` as a WARNING ('Avatar task {id} was not in RUNNING state — skipping completion') and returns — no exception, no retry, no cleanup trigger.

**Failure path**

> User (or guest) starts avatar generation (real `AVATAR_GENERATION_PROVIDER=smplx`, the slowest job in the system per the module docs). Worker claims the task (RUNNING) and begins `SmplxProvider.generate()`. While SMPL-X model inference is still running — minutes, not milliseconds — the user calls `DELETE /api/avatar` (or `DELETE /api/auth/me`, which routes through the identical `AvatarService.deleteAvatarData` call at `AccountDeletionService.java:105`). `deleteAvatarData` deletes the task row and walks `avatars/{userId}` on disk; at that instant the worker has not yet reached its `os.makedirs`/`open(...).write(...)` call, so there is nothing there to delete and the sweep returns immediately (idempotent no-op). Moments later the worker finishes, writes `avatar.glb` under `avatars/{userId}/{taskId}/`, and calls `complete_task` — which silently no-ops because the task row no longer exists. Net result: `user.avatarGlbUrl` is correctly null and the BodyProfile is correctly gone from the database, but a full 3D reconstruction of the user's body, generated from the very measurements they asked to have deleted, now sits permanently on disk in a directory named after their user id. No code anywhere (`processReadyTasks`, any scheduled task in `SchedulerConfig`, any worker job, any script in the repo) ever enumerates or revisits an orphaned `avatars/{userId}/{taskId}/` directory — a future regeneration creates a brand-new task id and a brand-new directory, never touching the old one. This directly contradicts `web/app/privacy/page.tsx` lines 138-141 ('Your profile settings offer a one-tap delete of your measurements and your 3D body model, including the generated file on disk') and line 152 ('Deletion is immediate and cannot be undone'): for this timing window, the file on disk is never deleted and the promise is false. Exposure is narrower than retention, though: the orphaned file is not currently reachable through any shipped route — `WebMvcConfig.PUBLIC_ASSET_SUBTREES` (server/src/main/java/com/iyae/config/WebMvcConfig.java:48) and the nginx `/assets/` allow-lists (nginx/conf.d/default.conf and the prod equivalent) both deliberately omit `avatars`, and the only authenticated route, `GET /api/avatar/model` -> `AvatarService.openOwnAvatarModel`, resolves strictly from `user.getAvatarGlbUrl()`, which stays null. So this is confirmed unauthorized *retention* of erased personal data, not an active *leak* of it.

**Suggested fix**

> Give the worker a pre-write ownership check: before `os.makedirs`/writing the GLB, have `AvatarTaskQueue.claim_task` (or the provider's `generate()` entry) re-verify the task row still exists and is still RUNNING (e.g. a cheap `SELECT 1 FROM avatar_generation_tasks WHERE id=%s AND status='RUNNING'` right before the write), and abort the write if not — mirroring the `status='RUNNING'` guard `complete_task`/`fail_task` already apply to the UPDATE. Alternatively, keep a lightweight tombstone (e.g. a `deleted_user_ids` marker table, or don't hard-delete the task row in `deleteAvatarData` — instead mark it CANCELLED and let the worker's `complete_task`/`fail_task` guard already in place be the single source of truth) so a write that lands after deletion can be identified and swept. Either way, add a periodic orphan sweep (a scheduled job or a one-off migration script) that deletes any `avatars/{userId}/{taskId}/` directory whose `taskId` no longer has a corresponding row in `avatar_generation_tasks` and whose `userId`'s current avatar task (if any) points elsewhere — closing both the race window and any directories already orphaned by it in production.

## B-17 · `HIGH` — garment_assets.slot_hint is never populated outside the dev-only seeder, so every production garment is scaled and rigged as a TOP

**Location:** `server/src/main/java/com/iyae/service/GenerationService.java:175`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** gap:Production database seeds to an empty marketplace; no production content/designer-onboarding path exists

**Evidence**

> server/src/main/java/com/iyae/service/GenerationService.java:175-180 — the only production code that creates a GarmentAsset omits the slot hint: ```java GarmentAsset asset = GarmentAsset.builder() .product(task.getProduct()) .glbUrl(glbUrl) .usdzUrl(usdzUrl) .status("READY") .build(); ``` The only `.slotHint(...)` call site in the whole main tree is `server/src/main/java/com/iyae/config/DataSeeder.java:807` (`.slotHint(slotHintFromCategory(product.getCategory()))`), inside a class annotated `@Profile({"dev", "test"})` (DataSeeder.java:26). `grep setSlotHint server/src/main/java` returns no matches. The column is nullable: `V1__baseline_schema.sql:67` `slot_hint ENUM('TOP', 'BOTTOM', 'SHOES', 'ACCESSORY'),`. RiggingService.java:239-248 then silently substitutes TOP: ```java private GarmentSlotHint resolveSlotHint(GarmentSlotHint hint) { if (hint == null) { return GarmentSlotHint.TOP; } ```

**Failure path**

> Fresh production instance. A designer uploads trousers, the 3D pipeline produces a GLB, the worker marks the ModelGenerationTask READY, and `SchedulerConfig` calls `GenerationService.processReadyTasks()` -> `materializeGarmentAsset` (GenerationService.java:155) writes a `garment_assets` row with `slot_hint = NULL`, because nothing in the production code path ever sets it. The designer then hits `POST /api/designer/products/{id}/rigging`; `RiggingService.requestRigging` (line 54) calls `resolveSlotHint(asset.getSlotHint())`, gets `TOP` for the NULL, and writes that into `rigging_tasks.slot_hint` and into `input_payload.slot_hint` (lines 58-71). The worker consumes it in `worker/providers/scale_normalizer.py:68,90`: `slot_ratio = SLOT_HEIGHT_RATIOS.get(slot_hint, ...)` with `SLOT_HEIGHT_RATIOS = {"TOP": 0.45, "BOTTOM": 0.55, "DRESS": 0.85, "SHOES": 0.08}` and `y_offset_ratio = SLOT_Y_CENTER_OFFSETS.get(slot_hint, 0.0)` with `{"TOP": 0.15, "BOTTOM": -0.15, ...}`. So the trousers are scaled to 0.45 of avatar height instead of 0.55 and translated to +0.15*height instead of -0.15*height — a 0.30*height vertical error, ~51cm on a 1.7m avatar, i.e. trousers rendered across the chest. Weight transfer then masks to the TOP bone subset (14 bones pelvis->wrists per worker/providers/canonical_skeleton.py), binding leg geometry to torso and arm bones. `validate_rigged_glb(file, slot_hint)` passes because the writer wrote the TOP bone set it was asked for, so nothing detects it. This is invisible in dev and in the Playwright suite because DataSeeder is the only thing that populates slot_hint, so only production is affected — and it breaks the 3D try-on that is the product's headline differentiator for every bottom, dress and shoe listing.

**Suggested fix**

> Set the slot hint in `materializeGarmentAsset`, deriving it from `product.getCategory()`. **Do not lift `DataSeeder.slotHintFromCategory` to do it** — that mapping is wrong for this purpose in two ways and would cement the defect this finding reports:
>
> - `DataSeeder.java:841` is `case "Tops", "Outerwear", "Dresses" -> GarmentSlotHint.TOP`. A dress routed to TOP is scaled to 0.45 of avatar height at `+0.15*height` instead of `0.85` at `0.0` (`worker/providers/scale_normalizer.py:10-23`) — i.e. **exactly the mis-scaling this finding is about, left unfixed**, while the failure path above names "every bottom, dress and shoe listing".
> - `DataSeeder.java:844` is `default -> GarmentSlotHint.ACCESSORY`. `ACTIVEWEAR` has no case (`web/components/ProductForm.tsx:19-28`), so every activewear listing would be filed ACCESSORY and become unriggable — a *new* breakage introduced by the fix.
> - The seeder switches on Title-Case literals (`"Tops"`, `"Dresses"`) while the designer-facing vocabulary is uppercase (`"TOPS"`, `"DRESSES"`, same file). Lifted case-sensitively, **no** designer-created product matches any case and all of them fall to `ACCESSORY`. Case-insensitivity is necessary but nowhere near sufficient — see A-27 on the three disagreeing category vocabularies.
>
> Write a fresh mapping instead: `TOPS`/`OUTERWEAR` -> `TOP`, `BOTTOMS` -> `BOTTOM`, `DRESSES` -> `DRESS`, `SHOES` -> `SHOES`, `ACCESSORIES`/`BAGS` -> `ACCESSORY`, normalised case-insensitively, with `ACTIVEWEAR` an explicit decision rather than a `default` (it spans both halves of the body; either map it to `TOP` deliberately or have the designer pick the slot at upload). Make the `default` branch log and leave the column NULL rather than guess, so a new category shows up as a gap rather than as a silently mis-rigged garment.
>
> **`DRESS` cannot be stored today** — `V1__baseline_schema.sql:67` declares `slot_hint ENUM('TOP', 'BOTTOM', 'SHOES', 'ACCESSORY')`, with no `DRESS` member, so this fix needs a new migration widening that ENUM before the mapping can emit it. Everything downstream already supports it: the Java enum has `DRESS` (`entity/enums/GarmentSlotHint.java`), `rigging_tasks.slot_hint` has it (`V7__garment_rigging_tasks.sql:8`), `RiggingService.resolveSlotHint` passes it through (`:245`, `case DRESS -> GarmentSlotHint.DRESS`), and the worker has ratios for it. The `garment_assets` column is the only thing missing — which is also why this defect was invisible: the one slot value dresses need was never storable.
>
> Sequence it as: (1) migration widening the ENUM with `DRESS`; (2) the new mapping wired into `materializeGarmentAsset`; (3) a backfill of existing NULL rows; and only then (4) `NOT NULL`, since making the column non-null ahead of (1)-(3) would lock in `TOP` for every dress. Separately, `RiggingService.resolveSlotHint`'s `default -> TOP` branch swallows SHOES and ACCESSORY: either widen the rigging path's handling or reject rigging for those slots explicitly rather than mis-rigging them as tops.

## B-18 · `HIGH` — OutfitService.generateOutfit holds a DB transaction/connection across a blocking AI-provider HTTP call

**Location:** `server/src/main/java/com/iyae/service/OutfitService.java:60`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** server-java

**Evidence**

> OutfitService.java:60-66 `@Transactional\n public OutfitResponse generateOutfit(GenerateOutfitRequest request, String userEmail) {\n User user = findUserByEmail(userEmail);\n OutfitResponse response = buildOutfitResponse(request);` — buildOutfitResponse (line 129) calls `generateExplanation(request, enrichedSlots)` (line 192) which (line 361-366) does `AIProvider provider = aiProviderFactory.getProvider(); ... String explanation = provider.sendMessage(AI_SYSTEM_PROMPT, messages);` — a synchronous RestTemplate call (AIConfig.java: 10s connect + 10s read timeout, i.e. up to ~20s) made while the `@Transactional` method above is still open.

**Failure path**

> POST /api/outfits/generate is reachable by any authenticated user with no rate limit (RateLimitFilter has no rule for /api/outfits/**). Each call opens a DB transaction in generateOutfit(), then blocks for up to ~20s inside that transaction waiting on the configured AI provider (Claude/DeepSeek/MiniMax in production) before the method returns and the connection is released. HikariCP's pool defaults to 10 connections (no override in application.yml). A burst of ~10 concurrent outfit-generation requests — or one slow/degraded AI provider — pins the entire connection pool for the duration of each call, so every other endpoint needing a DB connection (login, cart, checkout, product browsing) starts queuing and timing out app-wide until a connection frees up. This exact bug class was already identified and fixed once in this codebase for ChatService.sendMessage (commit 4a243d7, 'F15: ChatService.sendMessage no longer @Transactional, so the blocking AI HTTP call doesn't pin a DB connection/lock across its duration' — see the explicit comment left in ChatService.java:117-122), but the same pattern was not corrected here.

**Suggested fix**

> Remove @Transactional from generateOutfit (or split it the way ChatService does): persist nothing during the AI call, call the AI provider outside any open transaction, then persist the OutfitRecommendation in its own short transaction (e.g. via TransactionTemplate, mirroring CheckoutService's txTemplate.executeWithoutResult pattern).

## B-19 · `HIGH` — N+1 query in the public product catalog and designer product list via buildTaskStatusFallbackMap

**Location:** `server/src/main/java/com/iyae/service/ProductService.java:341`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** server-java, perf-scale (reported independently 2x)

**Evidence**

> ProductService.java:341-357 `private Map<Long, String> buildTaskStatusFallbackMap(List<Product> products) {\n ...\n for (Product product : products) {\n List<ModelGenerationTask> tasks =\n modelGenerationTaskRepository.findByProductIdOrderByCreatedAtDesc(product.getId());\n ... } }` — called unconditionally for every product on the page from getPublicCatalog (line 68: `Map<Long, String> taskStatusMap = buildTaskStatusFallbackMap(products);`) and from getDesignerProducts (line 117), unlike the sibling helpers buildAssetMap (line 285-298) and buildMeasurementMap (line 305-315) in the same file, which both batch via a single `findByProductIdIn(ids)`/`findByProductIdInOrderByCreatedAtDesc(ids)` query. ModelGenerationTaskRepository (repository/ModelGenerationTaskRepository.java) has no `findByProductIdIn` method at all.

**Failure path**

> GET /api/products (public, unauthenticated, the main storefront browse endpoint) calls getPublicCatalog, which loads a page of up to MAX_PAGE_SIZE=100 products and then calls buildTaskStatusFallbackMap on the whole page before it is known which products even lack a GarmentAsset. That issues one `SELECT ... FROM model_generation_tasks WHERE product_id = ?` per product in the page — up to 100 extra round trips to MySQL for a single catalog page load, on the highest-traffic, unauthenticated endpoint in the application. The same pattern recurs for every designer's product list (getDesignerProducts). At realistic catalog sizes beyond the 36-row seed dataset this materially increases p99 latency and DB load per page view and scales linearly with page size, not with any 'needs it' subset.

**Suggested fix**

> Batch-load with a single `modelGenerationTaskRepository.findByProductIdIn(ids)` (or a query grouped/ordered by product+createdAt) the same way buildAssetMap and buildMeasurementMap already do, and pick the latest PENDING/RUNNING task per product id in memory instead of issuing one query per product.

## B-20 · `HIGH` — Deleting or archiving a product removes neither its uploaded images nor its generated 3D previews from the public filesystem, and destroys the only record of where they are

**Location:** `server/src/main/java/com/iyae/service/ProductService.java:209`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** gap:Generated-asset storage has no retention, no quota and no monitoring, on the same filesystem as the database, gap:Generated 3D assets accumulate on the shared volume forever; no retention, cleanup, or disk-usage alerting exists (reported independently 2x)

**Evidence**

> server/src/main/java/com/iyae/service/ProductService.java:209-214 — the only product delete path, DB-only: ```java @Transactional public void deleteProduct(String email, Long id) { DesignerProfile profile = resolveDesignerProfile(email); Product product = requireOwnedProduct(id, profile); productRepository.delete(product); } ``` The files stay publicly served, unauthenticated and cacheable — nginx/conf.d/default.conf:40-44 and :81-85: ``` location /uploads/ { alias /var/iyae/assets/uploads/; expires 7d; add_header Cache-Control "public, immutable"; } ... location /assets/products/ { alias /var/iyae/assets/products/; ``` Admin moderation removes nothing either — AdminModerationService only flips status (`setProductStatus` line 72 `product.setStatus(status);`); there is no media handling in that class at all.

**Failure path**

> A designer uploads a product photo that must later come down (no model release, third-party lookbook image, or a personal photo attached by mistake). FileStorageService.java:19-20 wrote it to `/var/iyae/assets/uploads/products/{uuid}.jpg` and returned `/uploads/products/{uuid}.jpg`. The designer deletes the listing, or an admin ARCHIVEs it after a report. The listing leaves the catalogue; the image still answers 200 at that URL, with `Cache-Control: public, immutable` and a 7-day expiry carrying it into every intermediary. Same for the generated preview at `/assets/products/{productId}/tasks/{taskId}/preview.glb`. No API route, admin action, script or scheduled task removes either — the only on-disk deletes in the production tree are AvatarService.java:258 and meshy_generator.py:79. The state is then unrecoverable: `productRepository.delete` destroys `products.media`, the sole record of the uuid filenames, and V1__baseline_schema.sql:71/:88 declare `garment_assets` and `model_generation_tasks` `ON DELETE CASCADE`, so the glb paths go with it. After a hard delete, nobody — including someone with a shell on the host — can determine which uuid-named files belonged to that listing. A takedown request cannot be honoured.

**Suggested fix**

> Make deletion and moderation take the media down. (1) In `deleteProduct`, before `productRepository.delete`, collect the product's `media` entries plus the `glb_url`/`usdz_url` of its garment assets and generation tasks, and delete the containment-checked files under `assetRoot` — reuse the containment pattern from `AvatarService.openAvatarModelAt` and the best-effort recursive delete from `AvatarService.deleteAvatarFiles`, rather than writing a third copy. (2) Better still for moderation: have `AdminModerationService.setProductStatus(ARCHIVED)` stop serving the media, which argues for routing product media through an authenticated/status-checked API route instead of a blanket nginx alias, so a status flip is sufficient and no filesystem mutation is needed. (3) At minimum, soft-delete products (reuse the `moderation_locked` precedent) so the media manifest survives and a later reaper can find the files.

## B-21 · `HIGH` — removeListing lets a seller erase a RESERVED or SOLD resale listing mid-sale, with no fulfilment-side guard

**Location:** `server/src/main/java/com/iyae/service/ResaleService.java:237`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** money-orders

**Evidence**

> server/src/main/java/com/iyae/service/ResaleService.java:237-243: @Transactional public void removeListing(String email, Long id) { User user = requireUser(email); ResaleListing listing = requireOwnedListing(id, user); listing.setStatus(ResaleStatus.REMOVED); // soft-remove: keep row for provenance + order FK resaleRepo.save(listing); } compare the sibling guard the team DID add three methods above, ResaleService.java:213-214: if (listing.getStatus() == ResaleStatus.SOLD || listing.getStatus() == ResaleStatus.RESERVED) { throw new IllegalArgumentException("This listing can no longer be edited"); }

**Failure path**

> Buyer B calls POST /api/resale/listings/{id}/checkout. ResaleService.reserve() atomically flips the listing LISTED->RESERVED (ResaleService.java:271) and CheckoutService.initiateResaleCheckout then creates a PENDING Order plus a live Stripe Checkout session valid for up to CHECKOUT_SESSION_TTL=30 minutes (CheckoutService.java:359). While that session is still payable, the seller (the listing's own owner, who legitimately passes requireOwnedListing) calls DELETE /api/resale/listings/{id} -> ResaleController.remove -> ResaleService.removeListing, which applies no status check at all and unconditionally overwrites status to REMOVED. Buyer B then completes payment on the still-valid Stripe session; the checkout.session.completed webhook fires, CheckoutService.fulfillPaidSession marks the Order PAID and calls resaleService.markSold(listingId) (CheckoutService.java:296), whose conditional UPDATE ... WHERE id=:id AND status=RESERVED (ResaleListingRepository.java:66-69) matches 0 rows because status is now REMOVED. markSold returns false, so the order is set to PAID_UNFULFILLABLE and only a server log records 'REFUND REQUIRED' (CheckoutService.java:301-307) -- Buyer B has been charged by Stripe for an item that will never ship, and nothing automatically refunds them. The exact same unguarded call also lets a seller flip an already-SOLD listing straight to REMOVED, with no reason given for why that path differs from updateListing's explicit SOLD/RESERVED rejection.

**Suggested fix**

> Add the same guard updateListing already has to removeListing: reject (400) when listing.getStatus() == ResaleStatus.SOLD || listing.getStatus() == ResaleStatus.RESERVED, or route the removal through a conditional @Modifying UPDATE (mirroring reserve/markSold/release) so a RESERVED or SOLD unit cannot be removed out from under a live or completed sale.

## B-22 · `HIGH` — POST /api/products/{id}/reviews has no verified-purchase gate — any registered buyer can 1-star-bomb a rival designer's product

**Location:** `server/src/main/java/com/iyae/service/ReviewService.java:36`  
**Verification:** CONFIRMED (verified by hand — see note)  
**Found by:** gap:No verified-purchase gate or rate limit on product reviews — zero-cost review-bombing of a competitor designer

> **Note on verification:** The three adjudication agents for this finding hit the account's monthly spend limit. Verified by hand instead: `ReviewService` injects only `reviewRepository`/`userRepository`/`productRepository` (no `orderRepository`), and `createReview` does `requireUser` + `requireProduct` then `save` with no purchase lookup anywhere; `RateLimitFilter`'s only `/api/products/` rule is the `GET .../recommended-size` suffix rule, so the POST is unthrottled.

**Evidence**

> server/src/main/java/com/iyae/service/ReviewService.java:36-53: `createReview(String email, Long productId, ReviewRequest request)` calls `requireUser(email)` and `requireProduct(productId)` (a bare `productRepository.findById`) and then directly builds and saves a `Review` — there is no `OrderRepository` lookup, no check that the caller ever purchased `productId`, and no reference to `Order`/`OrderStatus` anywhere in the file (`grep -n Order server/src/main/java/com/iyae/service/ReviewService.java` returns nothing). The only constraint preventing abuse is the DB `UNIQUE KEY uk_user_product_review (user_id, product_id)` in `V1__baseline_schema.sql:167`, which stops one account reviewing the same product twice but does nothing to stop many accounts each reviewing it once.

**Failure path**

> Registration only requires a verified email (`AuthService.register` + email verification token; no purchase, no admin approval, no cost) and `POST /api/auth/register` is throttled at only 3/60s per IP (`RateLimitFilter.RULES` line 28) — slow but not a meaningful blocker for a patient scripted attacker, and trivially parallelized across source IPs/residential proxies. A competing designer (or anyone hired by one) scripts: register N disposable accounts -> verify each via the (also attacker-controlled) mailbox -> `POST /api/products/{rivalProductId}/reviews` with `{rating:1, comment:<2000 chars of libel>}` from each account. `ReviewService.createReview` never checks whether the caller bought the product, so every request succeeds and is persisted. `GET /api/products/{id}/reviews/summary` (ReviewService.getReviewSummary, public, no auth) immediately reflects the deflated average storefront-wide (`reviewRepository.findAverageRatingByProductId`), directly damaging a named designer's sales on a marketplace where designers compete for the same buyers — this is a 'destroy a tenant's business' lever with no purchase cost and no rate limit on the endpoint itself (see next finding).

**Suggested fix**

> Require proof of purchase before accepting a review: in `ReviewService.createReview`, look up the caller's orders for `productId` with a fulfilled status (mirror `ResaleService.findOwningOrderId`'s pattern of scanning `orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId())`, skipping `OrderStatus.PENDING`, and matching the product id in `items_snapshot`) and throw an `IllegalArgumentException`/403 if no qualifying order exists.
>
> The DRAFT/unpublished hole is real and worth closing too, but **do not close it by adding a status filter inside `requireProduct`**: that helper is shared by all four entry points — `createReview` (`ReviewService.java:39`), `getReviews` (`:61`), `getReviewSummary` (`:75`) and `deleteReview` (`:91`). A PUBLISHED-only check there would also make existing reviews unreadable and, worse, stop a buyer deleting *their own* review the moment the designer or an admin archives the listing — turning a write guard into a data-access regression on three paths that have nothing to do with the defect. Add the status check in `createReview` only (after `requireProduct` returns), leaving the read and self-delete paths on the unfiltered lookup.

## B-23 · `HIGH` — Chat session switch race: stale message-load response from a previous session overwrites the currently viewed session

**Location:** `web/app/chat/page.tsx:211`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** web-react

**Evidence**

> app/chat/page.tsx:211-238 — `useEffect(() => { if (!activeSessionId) return; ... setMessages([]); ... chat.getMessages(activeSessionId).then((msgs) => { setMessages(msgs); ... }).catch(...).finally(() => setIsLoadingMessages(false)); }, [activeSessionId]);` — no `AbortController`/`signal` is created or passed, and the `.then` callback commits unconditionally even though `chat.getMessages` (lib/api.ts:727) accepts an optional `signal` for exactly this purpose.

**Failure path**

> User has 2+ chat sessions (normal usage — ChatSidebar lets you click any session at any time, with no disabling of the sidebar while a load is in flight: components/ChatSidebar.tsx passes no loading-derived `disabled` to its session buttons, and `handleSelectSession` in app/chat/page.tsx:260 just calls `setActiveSessionId(id)`). User opens session A (effect fires, fetch A starts, slow — large history or server load). Before it resolves, user clicks session B in the sidebar (same mounted ChatPage, App Router does not remount; effect re-runs for B, resets `messages`/`currentSuggestions`, fetch B starts). Fetch B resolves quickly and renders B's messages correctly. Then the earlier, slower fetch A finally resolves and its `.then` unconditionally calls `setMessages(msgsForA)` and conditionally `setCurrentSuggestions(...)`, overwriting the correctly-displayed session B conversation with session A's messages while the UI still shows session B as active/selected in the sidebar. The user now reads the wrong conversation's content under the wrong session, with no further effect run to self-correct until they switch sessions again.

**Suggested fix**

> Create an AbortController per effect run (keyed on activeSessionId), pass its signal to `chat.getMessages`, and gate every state commit (`setMessages`, `setCurrentSuggestions`, the `finally`'s `setIsLoadingMessages(false)`) on `!controller.signal.aborted`; return `() => controller.abort()` from the effect. Alternatively, tag the stored result with the session id it was fetched for (the pattern already used elsewhere in this codebase, e.g. `app/products/[id]/page.tsx`'s `key={id}` remount or `app/outfits/[id]/view/page.tsx`'s tagged `loaded` state) and only render/commit when it matches the current `activeSessionId`.

## B-24 · `HIGH` — The "Clothing" shop filter pill matches no category value that exists anywhere in the system, so it always returns zero results

**Location:** `web/app/products/page.tsx:180`  
**Verification:** CONFIRMED (verified by hand — see note)  
**Found by:** gap:Production database seeds to an empty marketplace; no production content/designer-onboarding path exists

> **Note on verification:** The three adjudication agents for this finding hit the account's monthly spend limit. Verified by hand instead: `web/app/products/page.tsx:180` emits `category: "Clothing"`, and the only category values written anywhere in the tree are Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories/Bags/Jewelry — none contains the substring `clothing`, so `LOWER(category) LIKE '%clothing%'` matches zero rows by construction.

**Evidence**

> web/components/SearchFilterBar.tsx:20-26 renders the pill: ```ts const FILTER_PILLS: { key: ShopFilter; label: string }[] = [ { key: "forYou", label: "For You" }, { key: "newIn", label: "New In" }, { key: "local", label: "Local Designers" }, { key: "clothing", label: "Clothing" }, { key: "accessories", label: "Accessories" }, ]; ``` web/app/products/page.tsx:179-181 maps it to a literal category: ```ts case "clothing": updateParams({ category: "Clothing", localOnly: "", view: "" }); ``` server/src/main/java/com/iyae/repository/ProductSpecifications.java:26-29 resolves it as a substring match on the stored category: ```java if (category != null && !category.isBlank()) { predicates.add(cb.like(cb.lower(root.get("category")), "%" + category.toLowerCase() + "%")); } ``` No category value containing "clothing" exists. The designer form offers `TOPS, BOTTOMS, DRESSES, OUTERWEAR, SHOES, ACCESSORIES, BAGS, ACTIVEWEAR` (web/components/ProductForm.tsx:19-28) or the distinct stored values from `GET /api/products/categories`; `DataSeeder` stores `Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories, Bags, Jewelry`.

**Failure path**

> Any visitor on `/products` — dev, staging or production, empty catalogue or full — clicks the "Clothing" pill. The URL becomes `?category=Clothing`, the client issues `GET /api/products?category=Clothing`, and the server builds `WHERE status='PUBLISHED' AND LOWER(category) LIKE '%clothing%'`. Because `category` is a free-text column populated only from the eight values above, none of which contains the substring "clothing", the query returns zero rows on every call. The page renders "No pieces found" (products/page.tsx:262-266) with the pill highlighted as the active filter (`activeFilter` resolves to "clothing" at products/page.tsx:148-156), so the user sees a selected category with an empty catalogue and no explanation. One of the five primary browse affordances on the storefront is permanently dead. The sibling "Accessories" pill works, which is what makes this easy to miss on a quick pass.

**Suggested fix**

> Either make "Clothing" an OR over the garment categories (Tops/Bottoms/Dresses/Outerwear) rather than a single `category` string — e.g. accept a repeated `category` param or a named group in `ProductSpecifications` — or drop the pill. More durably, replace the free-text `products.category` with the enum the three disagreeing hardcoded lists are trying to approximate (see the category-vocabulary finding) so a filter key that cannot match becomes a compile error.

## B-25 · `HIGH` — Desktop try-on Suspense boundary blocks already-loaded avatar/garment models behind a third-party HDR CDN fetch with no timeout

**Location:** `web/components/AvatarViewer.tsx:334`  
**Verification:** CONFIRMED (3/3 lenses in the first run; re-verification hit the spend limit)  
**Found by:** gap:3D/AR viewer render path and its unpinned third-party CDN dependencies

**Evidence**

> web/components/AvatarViewer.tsx:49: `useEnvironment.preload({ preset: ENVIRONMENT_PRESET });` (module scope) resolves to `https://raw.githack.com/pmndrs/drei-assets/.../hdri/studio_small_03_1k.hdr` (confirmed in `node_modules/@react-three/drei/core/useEnvironment.js`, `CUBEMAP_ROOT`). Lines 334-354: `<Suspense fallback={<PreviewFallback previewImageUrl={previewImageUrl} />}> <Bounds fit clip observe margin={1.2}>{...AvatarModel/GarmentModel via useGLTF...}</Bounds> <ContactShadows .../> <Environment preset={ENVIRONMENT_PRESET} environmentIntensity={0.6} /> </Suspense>` — the HDR-fetching `<Environment>` and the user's own GLB models share one Suspense boundary.

**Failure path**

> React Suspense only reveals a boundary's children once every suspended promise registered under it has settled — resolved or rejected. `useLoader`'s underlying fetch for the HDR has no fetch-level timeout; a silently dropped/stalled TCP connection (content filters, captive portals, flaky mobile networks — the exact failure mode the task calls out) leaves that promise neither resolved nor rejected for as long as the OS-level socket timeout takes (commonly 60s+), during which the fallback (`PreviewFallback`/`Loader`, lines 65-98) stays on screen even though the avatar and garment GLBs the user is actually trying to see have already finished loading. `ViewerErrorBoundary` (components/ViewerErrorBoundary.tsx:21-27) only implements `getDerivedStateFromError`/`componentDidCatch`, which fire on a *thrown* error — a rejected suspended promise is re-thrown by React and is caught, but a promise that never settles throws nothing, so the boundary cannot intervene. Per `SmartARViewer`'s own routing comment, the desktop branch (AvatarViewer) is the viewer for every non-mobile, non-WebXR visitor — the primary try-on surface, not an edge case.

**Suggested fix**

> Give the environment/background load its own narrower Suspense boundary (or render `<Environment>` outside the Suspense that gates the garment/avatar models) so a slow/blocked HDR fetch cannot hide content that has already arrived. Wrap the `useLoader`-backed fetches with an application-level timeout (`AbortController` + `Promise.race`) that converts a hang into an explicit rejection so `ViewerErrorBoundary` can show a real fallback instead of an indefinite spinner. Longer term, self-host the HDR file under `/public` (as already done for `public/models/` and `public/textures/fabric/`) to remove the runtime third-party dependency from the core try-on path entirely.

## B-26 · `HIGH` — AR entry point loads @google/model-viewer from an unpinned CDN with no error handling, no vendoring, and no fallback UI

**Location:** `web/components/ModelViewer.tsx:22`  
**Verification:** CONFIRMED (3/3 lenses in the first run; re-verification hit the spend limit)  
**Found by:** gap:3D/AR viewer render path and its unpinned third-party CDN dependencies

**Evidence**

> web/components/ModelViewer.tsx:22-30: `useEffect(() => { if (!customElements.get("model-viewer")) { const script = document.createElement("script"); script.type = "module"; script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"; document.head.appendChild(script); } }, []);` — no `script.onerror`, no `integrity`, no `crossorigin`, no retry/fallback state. `web/package.json` dependencies list (lines 15-33) has no `@google/model-viewer` entry despite the version/URL being hand-written in this file and in `middleware.ts`'s comment.

**Failure path**

> SmartARViewer.tsx routes every iOS Safari visitor (`arQuickLook`) and every non-WebXR Android visitor (`sceneViewer`) into this exact component (SmartARViewer.tsx:66-85) — i.e. the majority of real-world mobile AR traffic, per the file's own routing table. If `ajax.googleapis.com` is unreachable (corporate/ISP content filter, outage, offline device, or a future CSP tightening that drops the allowance), `customElements.get("model-viewer")` never resolves and the JSX's unconditionally-rendered `<model-viewer>` tag stays an undefined custom element. Browsers give undefined custom elements no default box model (`display: inline`, no content), so the component paints nothing — no spinner, no error text, no retry affordance — inside the wrapping div. Because nothing throws, `ViewerErrorBoundary` wrapping the call sites in `app/products/[id]/page.tsx:407` and `app/outfits/[id]/ar/page.tsx:163` never engages; the user is left looking at a blank area with zero indication that AR failed to load. There is also no test coverage anywhere in the suite for this component or this failure mode.

**Suggested fix**

> Add `@google/model-viewer` as a real npm dependency and import it statically (or via a guarded dynamic `import("@google/model-viewer")`) inside this already-client-only, already-ssr:false component instead of hand-rolling a `<script>` tag — this removes the CDN round-trip, the CSP `script-src` allowance for `ajax.googleapis.com`, and the version-drift risk. If CDN delivery must be kept, at minimum add `integrity`/`crossorigin` attributes, a `script.onerror` handler that flips a `loadFailed` state, and render a visible fallback (e.g. a static product image + "AR preview unavailable" message with retry) when the custom element never upgrades within a timeout.

## B-27 · `HIGH` — The production checkout-disabled configuration that Launch 1 actually ships with has zero E2E coverage

**Location:** `web/e2e/checkout-flow.spec.ts:109`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** test-integrity

**Evidence**

> `server/src/main/resources/application.yml:70` and `application-prod.yml:13` both set `stub-checkout-enabled: false` (the real default); only `application-dev.yml:10` flips it to `true`. The Playwright CI job brings up the stack via plain `docker compose` (dev profile), so `checkout-flow.spec.ts:109` ("place order redirects to success or Stripe URL") only ever exercises the checkout-ENABLED stub path. A repo-wide grep for `503`/`PaymentsDisabled`/"not accepting payments" across `web/e2e/*.spec.ts` returns nothing; the only coverage of that state is in web unit tests (`usePublicConfig.test.ts`, `useRiggingStatus.test.ts`) that mock the fetch response.

**Failure path**

> Launch 1's single most deliberately-enforced business rule -- checkout is off, and a half-configured Stripe key must 503 rather than silently charge -- is never driven end-to-end against the real checkout page. A regression in the web client's handling of that 503 (e.g. an unhandled promise rejection crashing the checkout page instead of showing the intended "this store is not accepting payments yet" message) would ship with every CI job green, directly undermining the one thing this launch was explicitly built to guarantee.

**Suggested fix**

> Add an E2E project/config variant that runs the stack with `app.payments.stub-checkout-enabled=false` and no Stripe keys, and assert the checkout page renders the disabled-state message rather than erroring.

## B-28 · `HIGH` — Unguarded localStorage writes crash the app (or silently break features) for any browser that blocks storage writes — read paths in the same files are carefully try/catched, write paths are not

**Location:** `web/lib/demo-cart.ts:41`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** web-ts

**Evidence**

> web/lib/demo-cart.ts:41-44 `export function saveDemoCartItems(items) { if (typeof window === "undefined") return; localStorage.setItem(DEMO_CART_STORAGE_KEY, JSON.stringify(items)); }` — no try/catch, while the sibling `loadDemoCartItems` (lines 27-39) wraps the identical `localStorage` access in try/catch. Called unguarded from web/lib/cart-context.tsx:149-153: `useEffect(() => { if (persistedDemoItems.current === demoItems) return; persistedDemoItems.current = demoItems; saveDemoCartItems(demoItems); }, [demoItems]);`. The same asymmetric pattern (read guarded, write unguarded) repeats in web/lib/community-feed.ts:554 and :558-563 (`saveCommunityState`, called unguarded from the fallback branch of `loadCommunityState` and again from the persistence effect in web/lib/hooks/useCommunityState.ts:58-59), in web/lib/saved-products.ts:192-196 (`write()`, called from the undocumented-reject-breaking path in `toggleSavedProduct` at line 48, itself fired-and-forgotten with `void toggleSavedProduct(product.id)` in app/products/page.tsx:285), and in web/lib/demo-looks.ts:32-35 (`saveDemoLooksToStorage`).

**Failure path**

> `localStorage.setItem`/`removeItem` throw synchronously in real, non-exotic browser configurations: Safari's "Block All Cookies" privacy setting (a standard user-facing toggle, not a dev tool) disables the Storage API entirely and makes every `setItem` call throw a `SecurityError`/`QuotaExceededError`; several privacy extensions and managed-browser policies do the same. `CartProvider` is mounted directly in `app/layout.tsx` (`<AuthProvider><CartProvider>{children}</CartProvider></AuthProvider>`), i.e. inside the ROOT layout, above and outside the per-route error boundary Next.js inserts around `{children}`. Next.js's own docs state `error.tsx` does NOT catch errors thrown by the root `layout.tsx` or its own component tree — only `app/global-error.tsx` can, and this repo has no `app/global-error.tsx` (confirmed: only `app/error.tsx` exists). So: a user on Safari with "Block All Cookies" (or an equivalent storage-blocking browser/extension) adds any single item to their cart — the single most common e-commerce action in the app, reachable by signed-out guests from the very first page view — `addDemoItem` commits new state, the persist effect fires, `saveDemoCartItems` throws inside a `useEffect`, and because this effect's owning component (`CartProvider`) sits above every error boundary in the tree, React has no boundary to hand the error to and unmounts the entire root: a blank white page with no "Try Again" button, no error.tsx recovery UI, and nothing to click — the whole app becomes unusable for that user on that browser, not just the cart. Reloading the page re-hydrates the same demo cart from storage (the add already succeeded in state before the throw) and the exact same effect fires again, reproducing the crash every time. The community-feed instance is slightly less severe (it lives on a route segment below `app/error.tsx`, so it shows the recoverable "Something went wrong" screen instead of a blank one) but crash-loops identically on "Try Again" since the unguarded write re-fires on every mount of any community-state page for the same user. The saved-products instance breaks a different, explicitly documented contract: `toggleSavedProduct`'s own doc comment says "It never rejects, so an ignored return value cannot produce an unhandled rejection" — but `write()` runs before the function's try/catch even starts, so a storage-write failure converts the async function's synchronous throw into a rejected promise, and the one real call site (`void toggleSavedProduct(product.id)`) has no `.catch()`, producing exactly the unhandled rejection the comment claims cannot happen, while the wishlist heart silently does nothing.

**Suggested fix**

> Wrap every localStorage write/remove call in these four files (and anywhere else following the same pattern) in try/catch mirroring the existing read-side guards, swallowing (and optionally logging) a write failure rather than letting it propagate — the UI should degrade to "this preference didn't save" rather than crash. For `CartProvider` specifically, also consider adding a root-level `app/global-error.tsx` as defense-in-depth, since any future unguarded throw inside a root-layout provider has the same unrecoverable blast radius.

## B-29 · `HIGH` — Status-polling hooks collapse ANY fetch failure into the same 'nothing requested yet' empty state, which exposes an enabled action that supersedes (destroys) the real in-progress task

**Location:** `web/lib/hooks/useRiggingStatus.ts:33`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** silent-failures

**Evidence**

> web/lib/hooks/useRiggingStatus.ts:30-34: `.catch((err) => { if (signal.aborted) return; if (err instanceof Error && err.name === "AbortError") return; setStatus(null); })`. The polling effect at lines 77-99 is gated on `status?.status === "PENDING" || "RUNNING"` and is the ONLY thing that re-arms polling; the mount effect (lines 69-75) depends only on `[loadStatus]` and fires once. web/components/RiggingStatusCard.tsx:125-138 renders `(status === "NONE" || status === null) && !isLoading` as 'No rigging task found... Start Rigging' with an enabled button (`disabled={isActionLoading}` only). Same shape in web/lib/hooks/useGenerationStatus.ts:29 (`.catch(() => setStatus(null))`, polling gated at line 41) feeding web/components/GenerationStatusCard.tsx:102-112 ('Regenerate 3D Model', no disabled condition at all) and in web/lib/hooks/useAvatarStatus.ts:31 feeding web/app/profile/avatar/page.tsx:273 (`const currentStatus = avatarStatus?.status ?? "NONE"`) and the 'Generate Avatar' button at lines 438-445 (`disabled={!hasProfile || statusLoading}` — statusLoading is false once the mount fetch settles, polling is silent and doesn't touch it).

**Failure path**

> A designer triggers garment rigging (or 3D generation, or avatar generation) and the task is PENDING/RUNNING on the backend — these can legitimately run for many minutes (Meshy/Tripo3D poll up to 10 min; PythonRiggingProvider has no timeout and does SMPL-X loading + biharmonic inpainting). While the frontend hook polls every 3-5s, ANY single non-2xx response or network blip (a rolling deploy, a transient 5xx from nginx, a dropped connection) causes the generic `.catch` to replace the whole status object with `null`. That `null` is rendered identically to 'no task has ever been requested' (RiggingStatusBadge/GenerationStatusBadge/`currentStatus ?? "NONE"` all collapse to the same 'NONE' visual), with no error, timestamp, or retry affordance distinguishing 'can't tell right now' from 'genuinely empty'. Because the only polling loop is gated on `status?.status === PENDING/RUNNING`, the moment status becomes null that gate closes and (for useRiggingStatus and useAvatarStatus, which have no re-fetch-on-status-change mount effect) polling never resumes — the UI is now permanently stuck showing the empty state even though the real task keeps running or will finish successfully on the backend. The user, seeing 'No rigging task found' / 'Generate Avatar', clicks the button the UI is explicitly offering. Server-side this calls `RiggingService.requestRigging()` -> `supersedeActiveTasks()` (server/src/main/java/com/iyae/service/RiggingService.java:52,220-230, sets the real PENDING/RUNNING task to FAILED 'Superseded by new rigging request') or `GenerationService.regenerate()` -> `supersedeActiveTasks()` (server/src/main/java/com/iyae/service/GenerationService.java:83-104, 'Superseded by regeneration') or `AvatarService`'s equivalent (server/src/main/java/com/iyae/service/AvatarService.java:84, `supersedeActiveTasks(user.getId())`) — irrecoverably discarding real, possibly nearly-complete backend work (and, for Meshy/Tripo3D, burning real paid API credits — 'Logs consumed_credits per task (30 credits/task typical)' per worker/CLAUDE.md) and restarting it from scratch. The failure mode is a transient network blip; the consequence is a destroyed, paid-for, in-progress generation and a user who was never told anything was wrong.

**Suggested fix**

> Add a distinct `error` state (separate from `status`) to each of the three hooks, set it in the `.catch` instead of (or in addition to) nulling `status`, and keep the last-known-good status on screen while showing a 'can't confirm status right now, retry' affordance instead of the 'NONE/empty' template — mirroring the pattern already used for `usePublicConfig`/`CheckoutUnavailableNotice` (three-state loading/error/config) and the `useAdminList` fix applied to `/admin`. Re-arm polling after a transient failure (e.g. retry-with-backoff) rather than permanently closing the gate on the first error, and disable the Generate/Regenerate/Start-Rigging buttons while `error` is true so a confirmed in-flight task can't be superseded by a false empty reading.

## B-30 · `HIGH` — Worker task-queue claim/reclaim is tested only against a mocked MySQL driver -- the row-locking atomicity itself is never exercised against a real database

**Location:** `worker/tests/test_task_queue.py:17`  
**Verification:** CONFIRMED (3/3 lenses)  
**Found by:** test-integrity

**Evidence**

> worker/tests/test_task_queue.py:17-37 patches `queue_base.mysql.connector.connect` and asserts only that a canned `mock_cursor.fetchone.return_value` is returned and `conn.commit()`/`conn.rollback()` were called -- no real SQL ever executes. The one place a real MySQL instance is spun up, `scripts/verify-migrations.sh` (lines 55-97), only applies Flyway DDL; it never calls `claim_task()`/`reclaim_stale_tasks()`.

**Failure path**

> `TaskQueue.claim_task()`, `AvatarTaskQueue.claim_task()` and `RiggingTaskQueue.claim_task()` rely entirely on `SELECT ... FOR UPDATE SKIP LOCKED` to guarantee two worker processes never claim the same PENDING row. Because every test mocks the connector, a change that weakens this guarantee (e.g. a refactor that drops `FOR UPDATE SKIP LOCKED`, moves the SELECT outside the transaction, or changes autocommit/isolation so the lock isn't actually held) leaves every existing test green while two concurrent worker instances in production would double-claim and double-process the same model/avatar/rigging task -- producing duplicate `GarmentAsset` rows or two workers racing to write the same output file.

**Suggested fix**

> Add at least one integration test (gated behind a real MySQL, reusing the throwaway-container pattern from scripts/verify-migrations.sh or a testcontainers-style fixture) that starts two threads/processes calling claim_task() concurrently against seeded PENDING rows and asserts each row is claimed exactly once.

## B-31 · `LOW` — No test pins that run()'s three generation branches still wrap generate() in the task_heartbeat context manager (the context manager itself IS covered)

**Location:** `worker/main.py:234`  
**Verification:** CONFIRMED (2/3 lenses)  
**Found by:** test-integrity
  
**Severity:** downgraded HIGH -> LOW at the unanimous request of the verifiers

**Evidence**

> worker/main.py:82-116 defines the `task_heartbeat` context manager and wraps each of the three `provider.generate()` calls at lines 234, 279 and 317 with `with task_heartbeat(queue, task_id):`. The context manager itself **is** covered: `worker/tests/test_worker_roles.py:73` declares `class TestTaskHeartbeatWiring:` (its docstring citing this very defect) with four tests that import `main` and drive `main_module.task_heartbeat(...)` against a `FakeQueue` at `WORKER_TASK_HEARTBEAT_INTERVAL=0` — `test_heartbeats_while_the_block_runs` (:81) asserts `queue.beats > 0`, `test_stops_beating_once_the_block_exits` (:104) asserts the thread does not outlive the block, `test_a_failing_heartbeat_does_not_escape` (:128) asserts a raising queue cannot kill the task, and `test_all_three_queues_expose_heartbeat` (:144) asserts every queue class provides the method. `TestHeartbeat` (:48) additionally covers `touch_heartbeat()` and `WORKER_HEARTBEAT_PATH`.
>
> What **no** test pins is the wiring in `run()` itself: that each of the three branches still *wraps* its `provider.generate()` call in the context manager. `test_all_three_queues_expose_heartbeat`'s comment asserts this in prose ("main.py wraps the model, avatar and rigging generate() calls in the same context manager") but the test body only checks `callable(getattr(cls, "heartbeat", None))` on the three queue classes — nothing reads `run()`.

**Failure path**

> This exact mechanism was a real, documented production defect once already (per the project's own changelog: "it first shipped implemented, tested and invoked by nothing"). If a future change to `run()` drops the `with task_heartbeat(...)` wrapper around any one of the three generate() calls -- entirely plausible during an unrelated refactor of the poll loop -- no test fails. In production, `reclaim_stale_tasks()` would again reclaim a RUNNING task mid-processing (any real Tripo3D/Meshy/SMPL-X/rigging job that legitimately runs close to or past 15 minutes) and hand it to a second worker, which both then write conflicting output for the same task.

**Suggested fix**

> Only the wiring half remains — **do not re-add direct `task_heartbeat` tests, `TestTaskHeartbeatWiring` already has them.** Refactor `run()`'s three generation branches into a single testable helper (or inject a recording queue into one poll cycle per task type) so a test can assert the heartbeat context manager is actually entered around `provider.generate()` for model, avatar and rigging alike. A cheap stopgap if the refactor is deferred: assert against `inspect.getsource(main.run)` that each `provider.generate(` call site sits inside a `with task_heartbeat(` block — ugly, but it fails loudly on exactly the refactor this finding is about.

---

# Advisory (42)

MEDIUM/LOW findings. All 42 have been adversarially verified; see **Verification** on each. After de-duplication these ~42 rows are **~36 distinct defects** — the clusters are named in the Consolidation section at the end.

**Heading labels are the adjudicated severity, not the as-filed one.** The six findings the verifier panel corrected MEDIUM -> LOW (A-8, A-17, A-23, A-28, A-29, A-30) carry `LOW` in their heading as well as on their `Verification` line, mirroring how B-31 records its HIGH -> LOW downgrade. The tier therefore reads 30 MEDIUM + 12 LOW, matching the "6 downgraded" row in the Results table. One consequence: **this list is ordered by filing sequence, not by severity** — the six corrected rows sit among the MEDIUMs rather than with A-37..A-42. Triage by label, not by position.

## A-1 · `MEDIUM` — No CPU/memory resource limits on any production service

**Location:** `docker-compose.prod.yml:9`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** infra-deploy

**Evidence**

> `docker-compose.prod.yml:9-15` (`x-service-defaults`) sets only `restart: unless-stopped` and the logging caps; none of `mysql`, `server`, `worker`, `web`, or `nginx` declare `deploy.resources.limits` (or `mem_limit`/`cpus`).

**Failure path**

> This is a single-host deployment where `mysql` (the only copy of the database) runs alongside every other service with no memory/CPU ceiling. An unbounded AI/3D-generation request, a memory leak in the long-running Python worker, or a large malicious upload driving the worker's in-memory GLB/image processing can exhaust host RAM/CPU; the kernel OOM killer then picks a victim process arbitrarily among all containers on the host, which can be `mysql` rather than the offending container, taking the database down along with everything that depends on it.

**Suggested fix**

> Add `deploy.resources.limits.memory`/`cpus` (or the legacy `mem_limit`/`cpus` compose keys, since this stack is not a Swarm deployment and `deploy:` is otherwise ignored by plain `docker compose`) to each service in `docker-compose.prod.yml`, sized from observed usage.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None of the load-bearing claims failed. One minor nuance in the suggested-fix text ("deploy: is otherwise ignored by plain docker compose") is debatable — modern Docker Compose V2 (the compose-spec CLI, as opposed to legacy docker-compose V1/non-swarm) does apply deploy.resources.limits even outside Swarm mode in many current versions — but this is a side remark in the suggested fix, not part of the core evidence, and doesn't affect the finding's validity (the repo's own dev docker-compose.yml already relies on exactly this `deploy.resources.limits` key working outside Swarm for the rigging-worker profile, which undercuts the fix text's own caveat but not the main claim that no limits exist in prod).
- None of the core factual claims failed verification. I confirmed directly against docker-compose.prod.yml that no service (mysql, server, worker, web, nginx, certbot, certbot-cli) declares deploy.resources.limits, mem_limit, or cpus anywhere in the file — only restart policy and logging caps are shared via the x-service-defaults anchor. I also cross-checked the report's comparison point: dev's docker-compose.yml does set JAVA_TOOL_OPTIONS=-Xmx384m -Xms128m on server and deploy.resources.limits {memory: 1G, cpus: '2.0'} on the optional rigging-worker profile, confirming prod genuinely dropped protections dev already has for an equivalent workload. One claim in the failure path is overstated rather than false: the OOM killer does not pick "arbitrarily" among all processes — it scores by resident memory usage (oom_score), so in practice it is more likely to kill whichever container is actually leaking/spiking (e.g. worker or server) than mysql specifically. The report's own hedge ("can be mysql rather than the offending container") is defensible but not guaranteed.

## A-2 · `MEDIUM` — docker-compose.prod.yml sets no JVM heap limit and no container memory/CPU ceiling for server or worker

**Location:** `docker-compose.prod.yml`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** perf-scale

**Evidence**

> `grep -n "JAVA_TOOL_OPTIONS\|deploy:\|resources:\|limits:\|memory:\|cpus:" docker-compose.prod.yml` returns zero matches for any of the five services. By contrast, dev's `docker-compose.yml` sets `JAVA_TOOL_OPTIONS: "-Xmx384m -Xms128m"` on `server`, and the optional `rigging-worker` profile (same torch/libigl/Pillow dependency set as the always-on prod `worker`, built from the same `Dockerfile.rigging`) is explicitly fenced with `deploy.resources.limits: {memory: 1G, cpus: '2.0'}`.

**Failure path**

> The prod `worker` container runs torch+smplx+trimesh+scipy+libigl+robust-laplacian+Pillow (server's single always-on worker, `WORKER_ROLES` defaulting to all three queues) with no memory ceiling at all, and the prod `server` JVM gets no `-Xmx`, so both fall back to whatever the container can see on the host with no circuit breaker. `main.py`'s processing loop is single-threaded/serial (one model, one avatar, one rigging task per poll cycle — confirmed by reading `run()`), so peak memory is bounded by one task at a time, but there is nothing containing that peak: a large weight-transfer job (dense `(num_garment_vertices, num_joints)` float64 arrays plus the robust-laplacian solve, on top of the torch/smplx import baseline) can grow until the Linux OOM-killer intervenes at the host level — which, unlike a container-scoped limit, is free to pick any process on the box, including `mysql`. The code even anticipates this (`except MemoryError: ... "OUT_OF_MEMORY"` in main.py), but that `except` only catches a Python-level allocation failure inside the interpreter's own arena, not a SIGKILL delivered to the whole process by the OOM-killer, which is what actually happens when a C extension's `malloc` (numpy/libigl) is the one that exceeds available memory.

**Suggested fix**

> Carry the same `deploy.resources.limits` pattern dev already uses for the equivalent workload (rigging-worker: 1G/2cpu) onto the prod `worker` service, and set an explicit `-Xmx`/`-XX:MaxRAMPercentage` plus a matching container memory limit on the prod `server` service, so a single heavy task or a leak is contained to its own container instead of competing for host memory with MySQL.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None of the load-bearing claims failed verification. The one soft spot is the failure-path narrative's claim that the host OOM-killer is "free to pick any process on the box, including mysql" — in practice the Linux OOM-killer's badness heuristic usually targets the process causing the spike (the worker itself) rather than mysql, so framing it as mysql being killed is somewhat speculative/illustrative rather than the most likely outcome. This doesn't undermine the core defect (total absence of any memory/CPU ceiling), only slightly overstates one dramatic consequence in the failure path.

## A-3 · `MEDIUM` — No disk quota on either named volume and no disk check in any health path

**Location:** `docker-compose.prod.yml:207`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** gap:Generated-asset storage has no retention, no quota and no monitoring, on the same filesystem as the database

**Evidence**

> docker-compose.prod.yml:207-211 — both volumes declared bare, no driver_opts, no size: ```yaml volumes: mysql_data: assets_data: letsencrypt: certbot_www: ``` `prod_deploy.sh` `health)` (447-498) checks container status, `/api/health/ready`, TLS `listen 443`, backup presence and cert expiry — and nothing else. There is no `df`, no `du`, and no quota anywhere in the repo.

**Suggested fix**

> Add a disk section to the `health` branch: `df -P` on the Docker data root and on `$BACKUP_DIR`'s filesystem, `success` above 25% free, `warn` 15-25%, `error` below 15%; plus a `du -sh` of the assets volume and of `$BACKUP_DIR` so growth is visible between runs. If the host supports it, bound `assets_data` with a size-limited driver (`driver_opts: {type: tmpfs}` is wrong here; an LVM/XFS project quota or a separate volume for assets is the right shape) so asset growth can never be the thing that stops MySQL writing. Document the minimum volume size relative to expected catalogue size x BACKUP_KEEP.

**Flagged as overlapping:** A-11

## A-4 · `MEDIUM` — nginx drops X-Content-Type-Options/X-Frame-Options/Referrer-Policy on every asset and upload location, while upload content-type validation trusts the client-declared header only

**Location:** `nginx/conf.d/default.conf:40`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** privacy-assets, infra-deploy (reported independently 2x)

**Evidence**

> nginx/conf.d/default.conf:24-26 sets `add_header X-Content-Type-Options "nosniff" always;` etc. at the `server` level, but every asset/upload `location` block (lines 40-44, 60-95, and identically in `nginx/templates/tls.conf:71-110`) defines its own `add_header Cache-Control "public, immutable"`. Per nginx's documented `add_header` inheritance rule, a location that declares any `add_header` of its own drops ALL headers inherited from the parent context — confirmed empirically against `nginx:alpine` with an equivalent two-location config: a location with its own `add_header Cache-Control` served the response WITHOUT `X-Content-Type-Options`/`X-Frame-Options`, while an identical location with no local `add_header` passed both headers through unchanged. Compounding this, `server/src/main/java/com/iyae/service/FileStorageService.java:31-35` validates uploads purely against the client-supplied `file.getContentType()` (`ALLOWED_TYPES.get(contentType)`), with no server-side magic-byte / content sniffing of the actual bytes.

**Failure path**

> A self-registered DESIGNER account (open registration, no vetting) can call `POST /api/designer/products/upload/image` with `Content-Type: image/jpeg` declared on the multipart part while the actual body is arbitrary bytes (e.g. an HTML document). `FileStorageService` only checks the declared header, so it writes the bytes verbatim to `uploads/products/{uuid}.jpg` and returns `/uploads/products/{uuid}.jpg` on the main origin. Because `location /uploads/` carries its own `add_header`, nginx serves that response without `X-Content-Type-Options: nosniff` (verified above), removing the one header designed to stop a browser or embedding context from re-interpreting mislabeled content — on the same origin the app's JWT-bearing session runs on. This does not by itself guarantee script execution in every current evergreen browser (most respect an explicit `image/jpeg` Content-Type on direct navigation), but it removes a defense-in-depth control at precisely the locations serving attacker-reachable content (uploads) and all generated 3D assets, with no server-side verification that the bytes actually match the declared/allowed type.

**Suggested fix**

> Re-state the security headers inside each location block that defines its own `add_header` (nginx requires repeating them, it does not merge), in both `nginx/conf.d/default.conf` and `nginx/templates/tls.conf`. Separately, harden `FileStorageService` to sniff real file content (e.g. check magic bytes for JPEG/PNG/WebP, or use a library like Apache Tika / ImageIO decode-and-re-encode) rather than trusting the client-declared `Content-Type` header alone.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None of the load-bearing factual claims failed verification. The nginx line-number citations, the server-vs-location add_header split, the identical pattern in nginx/templates/tls.conf (the file actually used once TLS is enabled — where the dropped header set also includes HSTS, which the finding doesn't call out but which strengthens rather than weakens the finding), FileStorageService's client-Content-Type-only validation, the DESIGNER-only gating of the upload endpoint, and open/unvetted DESIGNER self-registration were all confirmed by direct code reading. One nuance the finding understates in the other direction: in current evergreen browsers, an <img> tag consuming the mislabeled file cannot render it as HTML regardless of nosniff (image-element decoding only sniffs among image codecs, never reinterprets as text/html), and nginx itself serves a consistent image/* Content-Type from the forced file extension rather than an ambiguous one — so the realistic trigger is narrower than "any embedding context," essentially requiring direct top-level navigation to the raw asset URL, which is less certain to execute script in 2026 evergreen browsers than the write-up implies. The finding's own hedge ("does not by itself guarantee script execution in every current evergreen browser") already concedes this, so it isn't a false claim, just a point worth weighting in the severity call.

## A-5 · `MEDIUM` — nginx and the Next.js middleware both set overlapping security headers with different values, and CSP has no `frame-ancestors`

**Location:** `nginx/conf.d/default.conf:24`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/LOW)  
**Found by:** web-ts

**Evidence**

> nginx/conf.d/default.conf:24-26 sets `X-Frame-Options "SAMEORIGIN"`, `X-Content-Type-Options "nosniff"`, `Referrer-Policy "strict-origin-when-cross-origin"` on every response proxied through it, while web/middleware.ts:10-11 independently sets `X-Frame-Options: DENY` and the same `X-Content-Type-Options`/`Referrer-Policy` values on the upstream response nginx is proxying — `add_header` in nginx does not strip the upstream's own header of the same name, so the final response carries two `X-Frame-Options` headers with conflicting values. `middleware.ts`'s CSP also has no `frame-ancestors` directive (it has `frame-src 'none'`, which is the opposite control — what this page may embed, not how it may be embedded).

**Suggested fix**

> Pick one layer to own each header (recommend nginx, since it fronts everything including non-Next.js responses) and stop setting the duplicates in `middleware.ts`, or vice versa. Add `frame-ancestors 'none'` (or `'self'`) to the CSP so modern browsers get an unambiguous, CSP-level clickjacking directive instead of relying on two conflicting `X-Frame-Options` headers.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None of the factual claims failed verification. Confirmed by reading the files directly: nginx/conf.d/default.conf:24-26 sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin` via `add_header ... always` on the `location /` block that proxies to the Next.js `web` upstream (and the same three headers are duplicated in nginx/templates/tls.conf:54-57 for the HTTPS variant). web/middleware.ts:9-11 independently sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` on every non-API, non-static route. Grepped the whole nginx/ tree and found no `proxy_hide_header` directive anywhere, so nginx does not strip the upstream (Next.js) response's own headers before adding its own — the claim that both layers' headers survive onto the wire is accurate. The CSP (entirely owned by middleware.ts; nginx sets no CSP in either config) does have `frame-src 'none'` (controls embedding *by* this page) but genuinely has no `frame-ancestors` directive (controls embedding *of* this page) — confirmed by reading the full CSP string in middleware.ts. So the evidence paragraph holds up verbatim against the code.

## A-6 · `MEDIUM` — Verification and password-reset tokens leak into nginx access logs via query string

**Location:** `nginx/nginx.conf:28`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** observability-ops

**Evidence**

> nginx/nginx.conf:28 `access_log /dev/stdout;` with no custom log_format, so nginx uses its built-in `combined` format (`"$request" ... "$http_referer" "$http_user_agent"`), which includes the full request line with query string. `AuthMailService.sendVerificationEmail`/`sendPasswordResetEmail` (server/src/main/java/com/iyae/service/AuthMailService.java:62-71) build `actionUrl = {FRONTEND_BASE_URL}/verify-email?token={rawToken}` and `/reset-password?token={rawToken}`; these are plain page routes (web/app/verify-email/page.tsx, web/app/reset-password/page.tsx), so the user's first click is a GET that nginx proxies and logs verbatim.

**Failure path**

> A user clicks the emailed verify/reset link -> browser issues `GET /verify-email?token=<raw32byte> HTTP/1.1` -> nginx (prod docker-compose logging driver `json-file`, 10m x 3 files per service) writes the full request line including the raw token to its access log on stdout, retained on disk for the rotation window. Anyone with read access to the nginx container's logs (docker logs, a shipped log aggregator, or the host filesystem) can lift a still-valid, single-use token (24h TTL for verification, 1h for reset) and use it to verify an unverified account or take over a password reset before the legitimate user does. SecurityConfig/JWT protections don't apply here because the exposure point is the webserver access log, not the API.

**Suggested fix**

> Have the verify-email/reset-password pages redirect the token out of the query string immediately (e.g., POST it from a one-time client script and clear via history.replaceState before any proxy sees a second request), or add an nginx `map`/regex to redact the `token=` value before logging (e.g., strip query args for these two paths in a dedicated log_format), or move token consumption off a GET entirely.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- Only a trivial line-number discrepancy: the finding cites nginx/nginx.conf:28 for `access_log /dev/stdout;`, but at HEAD that directive is on line 27 (line 28 is `error_log /dev/stderr;`). Not material to the substance of the finding.
- None of the load-bearing claims failed verification. Confirmed: nginx/nginx.conf:28 sets `access_log /dev/stdout;` with no `log_format` directive anywhere in nginx.conf, conf.d/default.conf, or the real production template nginx/templates/tls.conf — so nginx falls back to its built-in `combined` format, whose `$request` field is the full request line including the query string. Confirmed AuthMailService.java:64/76 builds `{FRONTEND_BASE_URL}/verify-email?token={rawToken}` and `/reset-password?token={rawToken}` with the raw (unhashed) token. Confirmed both web/app/verify-email/page.tsx and web/app/reset-password/page.tsx read the token via `useSearchParams` on a plain GET page route (no redirect/history.replaceState/token-stripping anywhere), and that route is proxied by nginx's `location /` block to the Next.js web upstream — so the token-bearing GET is in fact what nginx logs, in both the pre-TLS default.conf and the real tls.conf used once `ssl-init` runs. Confirmed docker-compose.prod.yml's `x-service-defaults` (applied to the nginx service) sets `json-file` logging capped at `max-size: 10m, max-file: 3`, consistent with the report's retention claim. One nuance the report doesn't fully spell out but that strengthens it: SecureTokenService stores only a SHA-256 hash in the DB, so this nginx log is actually the single place the raw, usable token is persisted in plaintext anywhere in the stack.

## A-7 · `MEDIUM` — Plain `docker compose -f docker-compose.prod.yml up` bypasses the TLS gate entirely

**Location:** `prod_deploy.sh:78`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/HIGH)  
**Found by:** infra-deploy

**Evidence**

> `require_tls_or_explicit_optout` (`prod_deploy.sh:78-90`) is only invoked from the `up`/`update` cases (`prod_deploy.sh:321`, `333`) of the bash script. `docker-compose.prod.yml`'s `nginx` service has no built-in gate, and the tracked `nginx/conf.d/default.conf:1-10` is HTTP-only by design (comment: "Do not ship a public deployment on this file").

**Failure path**

> An operator who already has a `.env` (from a prior `setup`) and brings the stack up with `docker compose -f docker-compose.prod.yml up -d --build` directly — reaching for the tool they already know rather than the wrapper script, or restoring onto a fresh host and running compose by habit — gets every service healthy and the whole site reachable on port 80 over plaintext HTTP (port 443 is published but nothing listens on it, since the committed config has no `listen 443` block): every login, JWT and form submission crosses the network in cleartext. Nothing in `docker-compose.prod.yml` or in the Spring Boot app (`ProductionConfigValidator` checks CORS/frontend-URL/mail-secret/Stripe-pairing but not TLS) stops this — it is exactly the scenario the TLS gate was built to close, reachable again through a path the script does not own.

**Suggested fix**

> Have `nginx`'s own startup (e.g. an entrypoint wrapper or a healthcheck that fails when `listen 443` is absent and `ALLOW_INSECURE_HTTP` is unset) perform the same check `prod_deploy.sh` does, so the protection does not depend on which interface the operator chooses.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None of the finding's factual claims failed verification. I confirmed: (1) `require_tls_or_explicit_optout` (prod_deploy.sh:78-90) is called only from the `up` (line 321) and `update` (line 333) subcommand branches of the bash wrapper — nowhere else. (2) `docker-compose.prod.yml`'s `nginx` service (lines 147-174) has no entrypoint/healthcheck logic that checks for `listen 443`; its healthcheck only wgets `http://localhost:80/`, and it mounts whichever file `${NGINX_SITE_CONF_FILE:-default.conf}` resolves to with no validation. (3) The tracked `nginx/conf.d/default.conf` is HTTP-only by design, with a comment explicitly warning "Do not ship a public deployment on this file." (4) `ProductionConfigValidator.java` (server) validates CORS, FRONTEND_BASE_URL, INTERNAL_MAIL_SECRET, RESEND_MAIL_ENDPOINT, and Stripe key/webhook pairing, but has no TLS-related check at all. Notably, its own comment (lines 121-125) reads: "Both-or-neither, enforced here as well as in prod_deploy.sh, because an operator who brings the stack up with plain `docker compose` never runs that script" — the codebase's own authors explicitly anticipated and defended against this exact "plain docker compose bypasses the wrapper" scenario for the Stripe-pairing check, but left TLS enforcement ungated for the identical scenario. This is strong corroboration that the premise (operators realistically invoking compose directly) is a scenario the team itself treats as real, not a far-fetched edge case.

## A-8 · `LOW` — TLS config selection and its survival across `prod_deploy.sh update` -- the exact class of defect that was CRITICAL in the prior review round -- has no automated regression test

**Location:** `prod_deploy.sh`  
**Verification:** CONFIRMED (3/3 lenses, ranks LOW/MEDIUM/LOW) — **severity corrected MEDIUM -> LOW** by unanimous or majority verifier rank  
**Found by:** test-integrity

**Evidence**

> No file under `.github/workflows/` references `prod_deploy.sh`, `ssl-init`, or TLS config selection; no `.bats` or shell test file exists anywhere in the repo referencing `tls-active.conf` or `NGINX_SITE_CONF_FILE` (the mechanism the changelog describes as the fix).

**Failure path**

> The prior review round's CRITICAL finding was `ssl-init` overwriting the git-tracked nginx conf, so a later `update` silently reverted a live site from HTTPS back to plain HTTP. The current fix lives entirely in untested shell script logic; a future edit to `update`'s nginx-config handling (e.g. reintroducing a `cp`/overwrite, or a change to how `NGINX_SITE_CONF_FILE`/`.env` is persisted) could reintroduce that exact regression with no automated signal anywhere in CI.

**Suggested fix**

> Add a lightweight script-level test (bats, or a bash test harness) that runs `ssl-init` against a throwaway checkout, then `update`, and asserts the selected TLS site file is unchanged and still has `listen 443` present.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None of the finding's factual claims failed. Verified: (1) `grep -rln "prod_deploy.sh\|ssl-init\|tls-active\|NGINX_SITE_CONF_FILE" .github/workflows/` returns no matches — no CI job exercises this path. (2) No `.bats` file or any `*test*.sh` file exists anywhere in the repo. (3) The described fix mechanism is real and present at HEAD: prod_deploy.sh:41-71 renders TLS config to `nginx/conf.d/tls-active.conf` and persists the chosen file in `NGINX_SITE_CONF_FILE=` inside `.env` (prod_deploy.sh:62-71, 413-417). (4) Both `.env` and `nginx/conf.d/tls-active.conf` are listed in `.gitignore`, so `update`'s `git pull` (line 338) and the rollback's `git reset --hard "$previous_rev"` (line 353) cannot touch either file — confirming the current code is structurally sound against the prior CRITICAL regression class, and the finding is purely about absent regression-test coverage, not a live bug.
- The finding's literal claim (no CI workflow or bats/shell test references prod_deploy.sh/ssl-init/tls-active.conf/NGINX_SITE_CONF_FILE) is confirmed true by direct grep — .github/workflows/e2e.yml has no reference, and no .bats file or any other test file anywhere in the repo mentions these mechanisms. However, the finding's framing that a regression "could reintroduce that exact regression with no automated signal anywhere" overstates the real risk: prod_deploy.sh already has two independent, automatically-invoked runtime guards around this exact mechanism. (1) require_tls_or_explicit_optout() is called at the start of both `up` and `update` and does `grep -qE '^\s*listen\s+443' "$NGINX_SITE_CONF"`, exiting 1 with an explicit error ("TLS is not configured... Run ssl-init first") unless the operator has set ALLOW_INSECURE_HTTP=true. (2) the `health` subcommand — which `update` calls automatically on success (`"$0" health`) — independently re-checks `listen 443` against $NGINX_SITE_CONF and prints a red "TLS: NOT configured — traffic is plaintext HTTP" line if it has reverted. So unlike the prior round's incident (where there was genuinely zero signal anywhere), a reintroduced regression today would be caught and loudly flagged on the very next `up`/`update` invocation, not silently absorbed. This is a real safety net that the finding does not account for, even though it is admittedly a runtime check rather than a CI/test-suite signal.

## A-9 · `MEDIUM` — prod_deploy.sh health command misreports an unhealthy worker/server container as OK

**Location:** `prod_deploy.sh:458`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** observability-ops

**Evidence**

> prod_deploy.sh:456-462: ``` for svc in mysql server worker web nginx; do local_status=$(docker compose -f "$COMPOSE_FILE" ps "$svc" --format '{{.Status}}' 2>/dev/null || echo "not running") if echo "$local_status" | grep -q "Up"; then success "$svc: $local_status" else error "$svc: $local_status" fi done ```

**Failure path**

> The worker's Docker HEALTHCHECK (docker-compose.prod.yml) watches the heartbeat file main.py touches once per poll cycle; when the worker wedges on a hung provider call, Compose marks it unhealthy and `docker compose ps` reports a Status string like `Up 10 minutes (unhealthy)`. That string still contains the literal substring "Up", so the loop's `grep -q "Up"` matches and prints `[OK] worker: Up 10 minutes (unhealthy)` in green instead of routing it to the `error` branch. At 03:00 when generation has stopped for every user, an operator running the documented `./prod_deploy.sh health` command — the only script-level liveness signal for the worker, since it has no HTTP endpoint — is told the worker is fine even though it is the dead component, delaying diagnosis. (The raw `docker compose ps` table printed a few lines above does show `(unhealthy)`, but the per-service summary immediately below it asserts the opposite in color-coded form for the exact service that matters.)

**Suggested fix**

> Match on the health qualifier explicitly, e.g. `if echo "$local_status" | grep -qE 'Up.*\(unhealthy\)'; then error ...; elif echo "$local_status" | grep -q "Up"; then success ...; else error ...; fi`, or read `--format '{{.Health}}'` instead of parsing `{{.Status}}` text.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None of substance. I verified the exact code at prod_deploy.sh:447-462 (the `health)` case) matches the quoted evidence verbatim: the per-service loop runs `docker compose ps "$svc" --format '{{.Status}}'` and tests `grep -q "Up"`, printing green `success` on match. Docker Compose's Status string for a service with a defined healthcheck is of the form `Up <duration> (unhealthy)` / `(healthy)` / `(starting)`, so the substring "Up" is present regardless of health state. I also confirmed in docker-compose.prod.yml that mysql, server, worker, web, and nginx all define `healthcheck:` blocks, and specifically that worker's healthcheck is heartbeat-file-based with no corresponding HTTP endpoint anywhere else in the script, so for worker there is no later check in the same case block that would catch a false "OK" — unlike server (redundantly re-checked via `curl .../api/health/ready` a few lines later) and web/nginx (later `curl http://localhost` check). One nuance the report doesn't dwell on: the raw `docker compose ps` table is printed unformatted a few lines above the buggy summary loop in the same command invocation, and that table's STATUS column does correctly show "(unhealthy)" — so the correct information is present in the same output, just contradicted by a colorized, more legible summary immediately below it. That bounds real-world impact somewhat: an operator isn't blind, just given conflicting signals.

## A-10 · `MEDIUM` — update rebuilds images on every deploy and on every rollback with no layer reclamation, on the same filesystem as the database

**Location:** `prod_deploy.sh:340`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** gap:Generated-asset storage has no retention, no quota and no monitoring, on the same filesystem as the database

**Evidence**

> prod_deploy.sh:340 and again on the rollback path at :354 — `docker compose build` twice per failed update, never followed by any reclamation (`docker (system|image|builder) prune` matches nowhere in the repo): ``` info "Rebuilding services..." docker compose -f "$COMPOSE_FILE" build ... git reset --hard "$previous_rev" docker compose -f "$COMPOSE_FILE" build ```

**Suggested fix**

> After a successful `up`/`update` (and after the rollback settles), reclaim: `docker image prune -f` plus `docker builder prune -f --filter until=168h`. Keep it after the readiness gate so the previous image is still available to roll back to, and never use `docker system prune` unqualified — it would take the named volumes' pruneable siblings and is too blunt for a host carrying the only copy of the data.

## A-11 · `MEDIUM` — No disk-capacity check or alert anywhere: health, readiness and the container healthchecks all pass at 100% full

**Location:** `prod_deploy.sh:447`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** gap:Generated 3D assets accumulate on the shared volume forever; no retention, cleanup, or disk-usage alerting exists

**Evidence**

> `prod_deploy.sh:447-490` (`health)`) checks container status, `/api/health/ready`, `listen 443`, the most recent backup, web reachability and TLS expiry. There is no `df`, no `docker system df`, and no per-volume size report; the only `du` in the whole script is `:145`, which sizes the backup that was just written. `docker-compose.prod.yml:207-211` declares `mysql_data`, `assets_data`, `letsencrypt`, `certbot_www` as bare named volumes with no `driver_opts`, so all four share Docker's data root filesystem along with the container writable layers and `./backups`. The server healthcheck (`docker-compose.prod.yml:79`) is `curl -sf http://localhost:8080/api/health/ready`, which proves only that a database query succeeded. There is no Spring Boot Actuator dependency in the server build, so the stock `DiskSpaceHealthIndicator` is not present either (grep for `actuator|management\.` across `server/` returns no matches).

**Suggested fix**

> Add a disk section to `prod_deploy.sh health`: `df -h` on the Docker data root and on `BACKUP_DIR`, plus `docker system df -v` for per-volume sizes, and `error` above a threshold (e.g. 80% used) so the existing non-zero-exit convention surfaces it. Also give the application a signal — either add Actuator and let `DiskSpaceHealthIndicator` participate in `/api/health/ready`, or have the new cleanup job log a WARN with free bytes and reclaimed bytes each pass — since the compose healthcheck is the only automated probe in the deployment and today it cannot distinguish a healthy host from one with zero free space.

**Flagged as overlapping:** A-3

## A-12 · `MEDIUM` — Server and worker containers run as root in production (web was hardened, these were not)

**Location:** `server/Dockerfile:8`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** infra-deploy

**Evidence**

> `server/Dockerfile:8-12` (`FROM eclipse-temurin:22-jre ... ENTRYPOINT ["java","-jar","app.jar"]`), `worker/Dockerfile:1-12`, and `worker/Dockerfile.rigging:1-21` — none declare a `USER` directive, so each runs as the base image's default root user. `web/Dockerfile:19-29` was fixed to `USER node` with the comment "The image previously ran as root, which turned any code execution in the Next.js server ... into root inside the container" — the same fix was never applied to the other three images.

**Failure path**

> The worker and rigging-worker containers parse attacker-influenced bytes (uploaded product images via Meshy/Tripo base64 conversion, downloaded GLB files, garment meshes) and mount `assets_data` read-write plus `smplx_models` read-only; the server container handles all user input end-to-end. A future RCE in any of those paths (a dependency CVE, a crafted-GLB parser bug, a deserialization issue) executes as root inside its container instead of an unprivileged user, which is exactly the risk class the web image's own fix comment describes — just not closed here.

**Suggested fix**

> Add a non-root `USER` to `server/Dockerfile` (temurin images ship a non-root option or add one with `useradd`), `worker/Dockerfile`, and `worker/Dockerfile.rigging`, matching the approach already used for `web/Dockerfile`.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- Minor overstatement only: the finding frames the server's attack surface as parsing "attacker-influenced bytes" alongside the worker's GLB/image/mesh parsing. Reading FileStorageService.storeImage shows the server does not parse image bytes at all — it trusts the client Content-Type header and streams the upload straight to disk with no decoding. The server's RCE surface is the generic one (Jackson/Hibernate/JWT/dependency CVEs across a large REST API), not literal binary-format parsing. This doesn't break the finding (the core claim — no USER directive in server/Dockerfile, worker/Dockerfile, worker/Dockerfile.rigging, versus web/Dockerfile's USER node fix — is fully verified by reading all four Dockerfiles and docker-compose.prod.yml), but the server-specific part of the "failure path" narrative is weaker than claimed. The worker-specific claim is well-supported: worker/*.py genuinely does struct.unpack on GLB bytes and imports PIL/libigl (native C++ parsing code), a real malicious-file-parsing surface.

## A-13 · `MEDIUM` — AdminBootstrap's promotion is a one-way, irreversible role overwrite with no path back — a single-owner operator loses designer capability permanently

**Location:** `server/src/main/java/com/iyae/config/AdminBootstrap.java:91`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** gap:Production database seeds to an empty marketplace; no production content/designer-onboarding path exists

**Evidence**

> server/src/main/java/com/iyae/config/AdminBootstrap.java:91-93 overwrites the role in place: ```java existing.setRole(Role.ADMIN); userRepository.save(existing); log.info("Promoted existing account {} to ADMIN", email); ``` `Role` is a single scalar column, not a set (`User.role`), and the only other `setRole` in the main tree is at registration (`AuthService.java:102`). `AdminBootstrap` no-ops forever once an ADMIN exists (`if (userRepository.countByRole(Role.ADMIN) > 0) { ... return; }`, lines 58-61), and nothing anywhere demotes. `AdminModerationService`'s own javadoc describes the intended user as "the single-owner operator".

**Suggested fix**

> Make moderation capability additive rather than exclusive — either a `Set<Role>` / separate `is_admin` flag, or let ADMIN also satisfy the DESIGNER matchers in `SecurityConfig` when a DesignerProfile exists. At minimum, have `AdminBootstrap` refuse to promote an account whose role is DESIGNER (logging why) instead of silently destroying its studio access, and add an admin-only role-management endpoint so the state is recoverable without direct SQL.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None of the report's load-bearing factual claims failed verification. Minor rhetorical note: the title's "permanently" overstates things slightly since the state is recoverable via a direct DB UPDATE (which the report itself implicitly acknowledges via its suggested fix wording "without direct SQL"), not truly permanent/unrecoverable data loss.

## A-14 · `MEDIUM` — No rate-limit rule covers POST /api/products/{id}/reviews — unlike every other UGC-creation endpoint

**Location:** `server/src/main/java/com/iyae/config/RateLimitFilter.java:26`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** gap:No verified-purchase gate or rate limit on product reviews — zero-cost review-bombing of a competitor designer

**Evidence**

> server/src/main/java/com/iyae/config/RateLimitFilter.java:26-76 (`RULES`): every other content-creation route has an explicit bucket — `POST /api/posts` (10/60s, line 59), `POST /api/posts/{id}/comments` (20/60s, line 57), `POST /api/follows/` (30/60s, line 61), `POST /api/events` (60/60s, line 60) — but there is no entry with `pathPrefix="/api/products/"` and `pathSuffix="/reviews"`, and `method="POST"`. `GET /api/products/*/recommended-size` (line 40) is the only `/api/products/` rule and it is GET-scoped with a different suffix, so it does not match `POST /api/products/{id}/reviews`.

**Failure path**

> An authenticated account (one per the HIGH finding above, or even a single legitimate account used maliciously) can call `POST /api/products/{id}/reviews` for every product id in the catalog in a tight loop with no throttling at all — the per-product unique constraint stops a repeat on the same id, but nothing stops one account from reviewing hundreds of different competitors' products back-to-back in seconds, amplifying the blast radius of the missing purchase-gate finding above across the whole catalog rather than one product.

**Suggested fix**

> Add a `RateRule("POST", "/api/products/", "/reviews", <N>, 60_000)` to `RULES`, placed consistently with the other suffix-scoped UGC rules (ahead of any broader `/api/products/` prefix rule, following the same first-match-wins ordering note already documented for the posts rules).

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None of the finding's factual claims failed verification. The cited line numbers, the described absence of a reviews rule, the characterization of the unique constraint's scope, and the suggested fix pattern (suffix-scoped POST rule ahead of broader prefix rules) all check out against the code as written.

## A-15 · `MEDIUM` — GenerateOutfitRequest / ManualOutfitRequest have no Bean Validation and no @Valid at the controller

**Location:** `server/src/main/java/com/iyae/controller/OutfitController.java:24`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/LOW)  
**Found by:** server-java

**Evidence**

> OutfitController.java:23-24 `@PostMapping("/generate")\n public ResponseEntity<OutfitResponse> generate(\n @RequestBody GenerateOutfitRequest request,` — no `@Valid`; dto/GenerateOutfitRequest.java has no constraint annotations on event/style/colorPalette/weather/mood/seedProductIds, and these values flow unbounded into OutfitRecommendation.requestData (persisted JSON) and into the AI provider prompt (buildAiUserMessage, OutfitService.java:377-396) with no length cap.

**Suggested fix**

> Add @Size/@NotBlank constraints to GenerateOutfitRequest and ManualOutfitRequest fields that are persisted or forwarded to the AI provider, and annotate both controller parameters with @Valid, consistent with every other mutating controller in this codebase.

**Flagged as overlapping:** B-2

**Verifier caveats** — the finding holds, but these specific assertions did not:

- Three inaccuracies, none fatal to the premise. (1) "consistent with every other mutating controller in this codebase" is overstated — `CheckoutController.checkout` (line 32) also takes `@RequestBody(required = false) CheckoutRequest` with no `@Valid`, so OutfitController is one of two non-webhook outliers, not the only one. (2) The framing that the fields flow "into the AI provider prompt" applies only to GenerateOutfitRequest; the ManualOutfitRequest path invokes no AI provider (`buildManualExplanation` is a pure `String.format`), and that path's `slots` map is in fact validated in-service at OutfitService.java:237-250 (null/empty, allow-listed slot names, duplicate-product rejection, PUBLISHED-only products), so "no validation" is only true of the two free-text fields `note` and `occasion` there — and `note` is never read by any code, merely persisted. (3) The finding does not disclose that B-2 (CRITICAL, same report) already covers this endpoint's missing `@Valid` and prescribes the identical `@Size` fix, which is what makes the standalone MEDIUM a double-count.

## A-16 · `MEDIUM` — Community Discover feed's hottest query has no (status, created_at) composite index

**Location:** `server/src/main/java/com/iyae/repository/PostRepository.java:13`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/LOW)  
**Found by:** db-migrations

**Evidence**

> PostRepository.java:13 `Page<Post> findByStatusOrderByCreatedAtDesc(PostStatus status, Pageable pageable);` is the default feed (`PostService.java:92`, `feedType="discover"` is the no-param default). Existing indexes on `posts`: `idx_posts_user_status(user_id,status)` (V8), `idx_posts_created(created_at DESC)` (V8), `idx_posts_status_city(status,city)`, `idx_posts_status_topic(status,topic)` (V15) — none has `(status, created_at)` as a leftmost-to-right pair.

**Suggested fix**

> Add `CREATE INDEX idx_posts_status_created ON posts(status, created_at DESC);`, mirroring the pattern V2 already established for the exact same shape on `products` (`idx_products_status_created`). Without it this highest-traffic community query relies on scanning `idx_posts_created` in sorted order and filtering status per row rather than seeking directly.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- Two impact claims do not hold. (a) The title's "hottest query" and the fix note's "this highest-traffic community query" are unsupported: posts ships empty (DataSeeder seeds none) and the feed is only fetched on /community, so /api/products — which already has idx_products_status_created — is by far the hotter path at launch. (b) "relies on scanning idx_posts_created in sorted order and filtering status per row rather than seeking directly" overstates the cost for the common case: the backward index scan short-circuits at the LIMIT, and with ACTIVE being the near-totality of rows it reads only ~LIMIT+epsilon entries, so the plan is already within a constant factor of the proposed index. The finding also omits that the hidden Page count query (O(ACTIVE posts), independent of LIMIT) is the larger scale cost and is NOT addressed by the suggested (status, created_at) index. All schema/location/index-inventory claims were accurate.

## A-17 · `LOW` — Account deletion can permanently delete a RESERVED resale listing that has no Order row yet

**Location:** `server/src/main/java/com/iyae/service/AccountDeletionService.java:164`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/LOW/LOW) — **severity corrected MEDIUM -> LOW** by unanimous or majority verifier rank  
**Found by:** money-orders

**Evidence**

> server/src/main/java/com/iyae/service/AccountDeletionService.java:164-186: for (ResaleListing listing : listings) { if (resaleListingRepository.hasPendingOrder(listing.getId())) { ...continue; } if (listing.getStatus() == ResaleStatus.SOLD || resaleListingRepository.hasAnyOrder(listing.getId())) { ...continue; } resaleListingRepository.delete(listing); } neither check names ResaleStatus.RESERVED directly; both rely on an Order row already existing.

**Suggested fix**

> Add an explicit `listing.getStatus() == ResaleStatus.RESERVED` branch to the keep-condition in deleteResaleListingsExceptLiveSales (same treatment as SOLD), independent of whether an Order row exists yet; alternatively, persist the Order (or a reservation record) atomically with the reserve() call in CheckoutService.initiateResaleCheckout so a RESERVED listing is never without a referencing row.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None of the factual assertions failed verification. Confirmed verbatim: AccountDeletionService.java:164-186 (deleteResaleListingsExceptLiveSales) only checks resaleListingRepository.hasPendingOrder() (Order.status=PENDING referencing the listing), listing.getStatus()==SOLD, and resaleListingRepository.hasAnyOrder() (any Order referencing the listing) — there is no `listing.getStatus() == ResaleStatus.RESERVED` branch anywhere in the loop. I also found the method's own javadoc (lines 160-163) claims "A listing with a live checkout is kept and released back to LISTED instead, which is the same treatment ResaleService.releaseStaleReservations gives it" — but no such release()/LISTED-reversion call exists anywhere in the method; the comment describes behavior that isn't actually implemented, which reinforces the finding. Traced CheckoutService.initiateResaleCheckout: resaleService.reserve(listingId,...) flips the listing LISTED->RESERVED via its own short committed transaction; only afterward does the code call the external Stripe API (stripeGateway.createSession — no lock held across the call) and only after that succeeds does it persist the Order row via txTemplate.executeWithoutResult (a later, separate transaction) with resaleListingId set. Between the reserve() commit and the Order-row commit, the listing is genuinely RESERVED with zero referencing Order rows — exactly the state the finding describes. Under MySQL's default REPEATABLE READ (no isolation override found in application*.yml) and no row lock held across that gap, a concurrent @Transactional deleteAccount() run by the seller could read the listing in that window and call resaleListingRepository.delete(listing), since neither guard fires. The same non-atomic reserve-then-persist gap exists in stubResaleCheckout. I verified the reservation TTL is 45 minutes (ResaleService.RESERVATION_TTL) and the Stripe checkout-session TTL is 30 minutes (CHECKOUT_SESSION_TTL), but for the real-Stripe path the Order row is created synchronously right after session creation within the same request, so for the entire 45-minute "abandoned checkout" lifetime hasPendingOrder() is already true — the unguarded window is only the brief in-request gap awaiting the Stripe API round-trip (or, more rarely, a process crash between session creation and order persistence). In the live-race case, the subsequent Order insert referencing the just-deleted listingId would most likely fail on an FK violation (the row is already gone at insert time), caught by initiateResaleCheckout's catch block — so in practice the likely outcome is a failed/500 checkout for the buyer before any Stripe redirect/payment occurs, not silent money loss; in the rarer crash-before-order-row scenario, any resulting charge-without-fulfilment risk already exists independently of this account-deletion gap (the webhook would already have no Order row to reconcile against, deletion or not).
- The finding's mechanism is accurately described and verified against code (AccountDeletionService.java:164-186, ResaleListingRepository.hasPendingOrder/hasAnyOrder, ResaleService.reserve/CheckoutService.initiateResaleCheckout), but its implicit severity framing (filed under 'money-orders', labeled MEDIUM) overstates current reachability and consequence. It never mentions that CheckoutService.initiateResaleCheckout (the only caller of ResaleService.reserve -- confirmed via grep, there is no other reserve() call site) gates on `if (!stripeFullyConfigured()) requireStubAllowed(...)` *before* calling reserve(), and requireStubAllowed throws PaymentsDisabledException whenever `stubCheckoutEnabled` is false. application-prod.yml pins `app.payments.stub-checkout-enabled: false` (confirmed), and Stripe keys are deliberately unconfigured for launch 1 (documented product decision, checkout ships disabled). So in the actual launch-1 production configuration, a resale listing can never reach RESERVED status at all -- the race window the finding describes literally cannot open. It only becomes reachable once Stripe is fully configured in a future phase. Additionally, even once reachable, the consequence is milder than the 'money-orders' framing implies: the Order insert that follows (resaleListingId referencing the now-deleted listing id) would fail the orders.resale_listing_id FK constraint (V16 migration: FK is ON DELETE SET NULL for existing rows, but does not permit inserting a new child row against a missing parent id), throwing a RuntimeException caught by `catch (RuntimeException ex)` in initiateResaleCheckout, which calls resaleService.release(listingId) (a no-op, listing already gone) and rethrows -- surfacing as a failed checkout for the buyer, not a completed charge: a real Stripe Checkout Session would have been created but never returned to the buyer, so it just expires unused. No money changes hands either way.

## A-18 · `MEDIUM` — Admin moderation lists (/api/admin/products, /posts, /promotions) have no pagination and load entire tables into memory

**Location:** `server/src/main/java/com/iyae/service/AdminModerationService.java:58`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/LOW)  
**Found by:** perf-scale

**Evidence**

> AdminModerationService.java:58-62 `listAllProducts`: `productRepository.findAll()` / `findByStatus(status)` with no `Pageable`. Line 86-92 `listPostsForModeration`: `postRepository.findAll(Sort...)` / `findByStatusOrderByCreatedAtDesc(status)` (the non-paged `List<Post>` overload) with no limit. Line 159-162 `listPromotions`: `promotionRepository.findAll()`. `AdminController` (listProducts/listPosts/listPromotions) exposes all three with no page/size params, unlike `listReports` right next to them which does take `page`/`size` and uses `Pageable`.

**Failure path**

> Every open of the /admin console's Catalog or Community tab runs an unbounded `SELECT *` and serializes the full result set to JSON. At launch-36-products scale this is harmless, but `posts` is user-generated content with no retention cap — unlike `post_reports` (which the same PR paginated), nothing bounds this table's growth, so the admin console's page weight and the query cost both grow linearly with total posts ever created, with no cap and no warning.

**Suggested fix**

> Give `listAllProducts`/`listPostsForModeration`/`listPromotions` the same `Pageable`/`Pagination.clampSize` treatment already used by `listReports`.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- No claim failed — all were confirmed against the source. One omission worth noting, which cuts against my own downgrade and the report missed it: both list paths also carry N+1 lazy loads, so the cost is 1+N queries rather than one. `AdminPostResponse.from` dereferences `post.getUser()` (Post.java:24 `@ManyToOne(fetch = FetchType.LAZY)`) and `ProductResponse.java:48` dereferences `product.getDesignerProfile()`. These resolve rather than throwing because the methods are `@Transactional(readOnly = true)`, but each row costs an extra SELECT, so operator-visible slowness arrives at a few thousand posts rather than at the row count a single-query estimate implies. Even so, it still only degrades the one admin's console while it is open. The report's framing of the cost as purely "unbounded SELECT * ... serializes the full result set" therefore understates the query cost while overstating the severity.

## A-19 · `MEDIUM` — Unvalidated client input to analytics_events can fail the INSERT and throw 500 out of the *caller's* transaction (including after a live Stripe session) — NOT silently dropped, as this finding originally claimed

**Location:** `server/src/main/java/com/iyae/service/AnalyticsService.java:89`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** gap:Analytics/KPI subsystem: client-trusted, unthrottled, silently lossy — and the INVEST/STOP decision gate reads it

**Evidence**

> AnalyticsService.java:88-91: `} catch (Exception e) { log.warn("Failed to record analytics event {} for user {} (swallowed)", type, userId, e); }` — reached whenever MySQL rejects the row (e.g. a non-JSON `metadata` string against the `JSON NULL` column, or a `sizeBracket` longer than `VARCHAR(16)`), both of which TrackEventRequest.java leaves completely unvalidated (only `@NotBlank String type`; `sizeBracket`/`metadata` have no `@Size`/pattern constraint at all).

**Failure path**

> A client sends POST /api/events with metadata:"surface=unknown" (not valid JSON) or sizeBracket longer than 16 chars. Hibernate's IDENTITY generator flushes the INSERT synchronously inside eventRepository.save(), MySQL raises an error (invalid JSON text / data truncation), Spring wraps it as a DataIntegrityViolationException, and AnalyticsService.record's catch(Exception) swallows it — the controller still returns 202 Accepted to the caller. The only trace is one WARN log line per dropped event; there is no counter, no metric, no alert, so a buggy client release (e.g. a stringified-but-malformed metadata payload, which is exactly the shape AvatarViewer.tsx:279 constructs by hand via JSON.stringify — any future call site that passes a raw string instead would silently vanish) can quietly erode the volume feeding kpisByCohort/drapeDecision with nothing in observability surfacing it.

**Suggested fix**

> Add `@Size(max = 16)` to TrackEventRequest.sizeBracket and validate `metadata` is parseable JSON before persisting (reject with 400 rather than silently drop); emit a counter/metric (e.g. a simple AtomicLong exposed via Actuator, or a WARN-level log with a stable marker an alert can match) on each dropped event so volume loss is observable rather than only discoverable by reading logs after the fact.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- The "Found by" tag line calls the endpoint "unthrottled," but POST /api/events is in fact rate-limited to 60 requests/60s per IP via RateLimitFilter.RULES (server/src/main/java/com/iyae/config/RateLimitFilter.java:60). This is a minor inaccuracy in the finding's attribution metadata, not in its evidence/failure-path/fix sections, and does not change the substance of the finding (throttling bounds volume, it does not add validation).
- **CORRECTED — this finding's traced consequence does not hold.** This bullet originally certified that `AnalyticsController.track` "unconditionally returns `ResponseEntity.accepted()` (202) regardless of whether the downstream insert succeeds", which is the assertion the Consolidation section overturns: `AnalyticsService.record` is `@Transactional` (`AnalyticsService.java:72`), so a `DataIntegrityViolationException` from the IDENTITY-generator flush marks the transaction rollback-only and the commit throws out of the transaction proxy **after** the `catch` at :89 — the client gets a **500, not a 202**, and the failure is not silent. See "A-19 — failure path is wrong" under *Findings that change*, which also names the inverse risk this finding missed: `record()` is called from `CheckoutService.initiateResaleCheckout:374`, so a rejected row can poison a caller's transaction *after* a live Stripe session was created. **Keep the fix (`@Size` on `sizeBracket`, parse-check `metadata`); discard the "silently lossy" framing in the title and failure path.**
- The finding's remaining factual claims did check out against the code: `AnalyticsService.record` (AnalyticsService.java:72-92) wraps `eventRepository.save(...)` in `catch (Exception e) { log.warn(...) }` with no counter/metric; `TrackEventRequest` (dto/TrackEventRequest.java) constrains only `@NotBlank String type`, leaving `sizeBracket`/`metadata` completely unvalidated; the `analytics_events` table (V14 migration) defines `size_bracket VARCHAR(16)` and `metadata JSON NULL`; and `app.analytics.enabled` defaults to `true` in `application.yml`, so this path is live by default, not opt-in. No metrics/MeterRegistry infrastructure exists anywhere in the server to provide the suggested operator signal. The AvatarViewer.tsx:279 citation is accurate as described (it currently builds valid JSON via `JSON.stringify`, and the report correctly frames it only as the shape a *future* careless call site could get wrong, not a present trigger for the metadata half of the bug).

## A-20 · `MEDIUM` — User email addresses logged in plaintext across multiple services

**Location:** `server/src/main/java/com/iyae/service/AuthMailService.java:117`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** observability-ops

**Evidence**

> AuthMailService.java:117 `log.info("{} email sent via Resend to {}", type, toEmail);` and :121 `log.error("Failed to send {} email via Resend to {}: {}", type, toEmail, e.getMessage(), e);` log the raw recipient email on every single registration and password-reset send, at INFO and ERROR. The same raw address also ends up baked into `EmailDeliveryException`'s message (`"Failed to deliver email via Resend to " + toEmail`), so it reappears whenever that exception is logged downstream — e.g. CheckoutService.java:211/214 `log.error("Stripe session creation failed for user {}", email, ex)` / `log.error("Checkout failed for user {}", email, ex)`, CheckoutService.java:459 `log.info("...created stub order {} for user {}", order.getId(), user.getEmail())`, and OutfitService.java:312/430 `log.error("Failed to persist OutfitRecommendation for user={}", user.getEmail(), e)`.

**Failure path**

> Every registration, password reset, checkout failure, stub checkout, and outfit-persistence failure writes the user's email address to the application log at INFO/ERROR (levels enabled in prod per application-prod.yml `logging.level.com.iyae: INFO`), with no redaction, unconditionally. This is durable PII in logs, aggregated by whatever ships/retains server logs in prod, which is exactly what AccountDeletionService.java already treats as sensitive enough to redact before logging (`redact(email)` at line 141, masking to `j***@domain`) — showing the team already recognizes raw-email-in-logs as a real risk in one place but not the others.

**Suggested fix**

> Reuse (or extract to a shared util) the `redact()` helper from AccountDeletionService and apply it at the handful of call sites above, or log the user id instead of the email (as AuthService.java already does for its own verification/reset-send failures).

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None — every factual assertion checked out against the code at HEAD: - AuthMailService.java:117 `log.info("{} email sent via Resend to {}", type, toEmail);` — confirmed verbatim, fires unconditionally on every successful send (registration verification + password reset). - AuthMailService.java:121-122 `log.error("Failed to send {} email via Resend to {}: {}", type, toEmail, e.getMessage(), e);` and `throw new EmailDeliveryException("Failed to deliver email via Resend to " + toEmail, e);` — confirmed verbatim; the raw address is baked into the exception message so it reappears wherever that exception is logged downstream. - CheckoutService.java:211 `log.error("Stripe session creation failed for user {}", email, ex);` and :214 `log.error("Checkout failed for user {}", email, ex);` — confirmed verbatim (these are independent log statements, not just propagation of AuthMailService's exception). - CheckoutService.java:459 `log.info("...created stub order {} for user {}", order.getId(), user.getEmail());` — confirmed verbatim. - OutfitService.java:312 and :430 `log.error("Failed to persist OutfitRecommendation for user={}", user.getEmail(), e);` — confirmed verbatim (both occurrences). - AccountDeletionService.java:256-259 `redact()` helper (masks to `x***@domain`) and its use at line 141 `log.info("Deleted account {} (tombstoned as user {})", redact(email), userId);` — confirmed verbatim, proving the team already applies redaction in exactly one place. - AuthService.java logs `user.getId()` (not email) at its own call sites around sendVerificationEmail/sendPasswordResetEmail (lines ~155, 257, 288) — confirmed, matching the finding's claim that AuthService already follows the better pattern. Note this doesn't prevent the leak: AuthMailService's own internal log line (117/121) fires the raw email before AuthService's id-only catch ever runs. - application-prod.yml:15-18 `logging.level.com.iyae: INFO` — confirmed, so these INFO/ERROR statements are live in production, not suppressed. The location cited in the header ("AuthMailService.java:117") is accurate and representative of the broader pattern; nothing in the evidence was fabricated or misquoted.

## A-21 · `MEDIUM` — No operator-facing visibility into stuck tasks for any of the three queues; the scaffolding for it exists but is wired to nothing

**Location:** `server/src/main/java/com/iyae/service/ModelGenerationOrchestrationService.java:60`  
**Verification:** CONFIRMED (3/3 lenses, ranks LOW/MEDIUM/MEDIUM)  
**Found by:** task-queues

**Evidence**

> server/src/main/java/com/iyae/service/ModelGenerationOrchestrationService.java:60-74 `public List<ModelGenerationTask> getPendingTasks() {...}` / `getRunningTasks() {...}` are commented "for monitoring/admin use" but are referenced nowhere outside the class's own unit test.

**Suggested fix**

> Either wire these (and equivalent avatar/rigging queries) into an ADMIN-gated endpoint (e.g. under the existing AdminController) exposing stuck-task counts/age, or remove the dead scaffolding and document that queue health is currently log/DB-only.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None. Verified: ModelGenerationOrchestrationService.java:60-74 contains getPendingTasks()/getRunningTasks() exactly as quoted, Javadoc'd "for monitoring/admin use," and grepping the whole server tree confirms they are referenced only from ModelGenerationOrchestrationServiceTest — no controller, no AdminController endpoint, nothing else. AdminController only exposes /products, /posts, /reports, /comments, /promotions — no task-queue route. AvatarGenerationTaskRepository and RiggingTaskRepository both have findByStatus available but no equivalent "getPendingTasks/getRunningTasks" wrapper exists in AvatarService/RiggingService, matching the finding's framing that avatar/rigging lack even the scaffolding model-generation has. There is no actuator/micrometer/prometheus dependency anywhere in build.gradle.kts or application*.yml, and no log line reports pending/running counts, so DB-only visibility (an operator running a manual SQL query) is genuinely the only recourse today.
- Three sub-claims are inaccurate or overstated, though none breaks the finding. 1. "the scaffolding for it exists but is wired to nothing" — misleading in both directions. It understates the dead code: the ENTIRE ModelGenerationOrchestrationService class is unreachable from production, all five methods (initiateGeneration, checkStatus, retryFailedGeneration, checkAndMaterialize too — SchedulerConfig calls GenerationService.processReadyTasks() directly, not the wrapper), not just the two monitoring ones. And it overstates how much "scaffolding" exists: the two methods are bare findByStatus passthroughs returning raw JPA entities with no aggregation and no task age, so they are not a near-usable monitoring surface — wiring them to an endpoint as-is would also serialize entity graphs under open-in-view: false. "Scaffolding for operator visibility" is a generous reading of two one-line repository calls. 2. "No operator-facing visibility into stuck tasks for any of the three queues" — true only for aggregate/queue-level visibility, and presented as if there were none at all. Per-task status, FAILED state and retry are exposed to the owning designer via GET /api/designer/products/{id}/generation-status and /rigging-status, and to avatar/guest-avatar polling; worker/main.py logs every claim, completion, failure (with task id) and stale-reclaim count; and the prod worker carries a heartbeat-file healthcheck readable from docker compose ps. The finding acknowledges none of this. 3. The finding does not account for the self-healing that bounds how long a task can actually remain "stuck": reclaim_stale_tasks resets RUNNING tasks after 15 minutes, all three queues now cap attempts, and over-cap tasks are terminally FAILED. "Stuck" is therefore time-bounded, which is materially different from the indefinite hang the title implies.

## A-22 · `MEDIUM` — No pre-publish review and no designer-level moderation: a self-registered DESIGNER publishes straight to the live storefront, and suspension is per-product only

**Location:** `server/src/main/java/com/iyae/service/ProductService.java:193`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** gap:Production database seeds to an empty marketplace; no production content/designer-onboarding path exists

**Evidence**

> `ProductStatus` has only `DRAFT`, `PUBLISHED`, `ARCHIVED` — no pending-review state — and `DesignerProfile` (entity/DesignerProfile.java:17-49) has no `verified`/`approved`/`status` field. Products are created DRAFT (`ProductService.java:150` `.status(ProductStatus.DRAFT)`) but the owning designer moves them to PUBLISHED themselves with no review gate (ProductService.java:193-202): ```java if (request.status() != null && request.status() != product.getStatus()) { if (product.isModerationLocked()) { throw new AccessDeniedException(...); } product.setStatus(request.status()); } ``` The only gate on reaching `/api/designer/**` at all is a verified email: `JwtAuthenticationFilter.UNVERIFIED_ALLOWED` is just `GET /api/auth/me` and `POST /api/auth/resend-verification` (JwtAuthenticationFilter.java:46-48). `AdminModerationService` offers only reactive, per-product `setProductStatus` (line 66) — no designer listing, no designer suspension, no bulk action.

**Suggested fix**

> Decide and record the moderation model. If self-serve publishing is intended (the Depop/Etsy model), that is defensible but then add designer-level levers to `AdminModerationService`: list designers, suspend a designer (cascading their listings out of the catalogue), and a bulk archive — a bad actor listing 50 items currently requires 50 separate `PUT /api/admin/products/{id}/status` calls. If curation is intended, add a `PENDING_REVIEW` ProductStatus (or a `DesignerProfile.verified` flag that `ProductSpecifications.catalog` requires) so the first publish passes through an admin queue.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- The "no pre-publish review" half of the title is framed as a defect/unrecorded decision, and that framing is contradicted by the canonical spec: `PRD.md:824` lists as a success metric "Designer onboarding | < 5 min to first product | Time from register to first PUBLISHED product" — i.e. instant self-serve publishing is the specified model, and the suggested `PENDING_REVIEW` status (or a `DesignerProfile.verified` flag required by `ProductSpecifications.catalog`) would contravene it. The finding does hedge this itself ("that is defensible"), but it is filed as one defect when only the second half — no designer-level suspension, no bulk archive — is actionable. The finding also omits two facts that bound its impact: checkout answers 503 in production so there is no fraud-payment vector, and a single-operator deployment retains DB access as a working backstop. Its "50 listings = 50 separate PUT calls" claim is accurate, and it understates rather than overstates the amplification, since it does not note that listing create/publish are entirely unthrottled.

## A-23 · `LOW` — garment_assets.slot_hint ENUM is missing DRESS, out of sync with the 5-value GarmentSlotHint entity enum

**Location:** `server/src/main/resources/db/migration/V1__baseline_schema.sql:67`  
**Verification:** CONFIRMED (3/3 lenses, ranks LOW/MEDIUM/LOW) — **severity corrected MEDIUM -> LOW** by unanimous or majority verifier rank  
**Found by:** db-migrations

**Evidence**

> V1__baseline_schema.sql:67 `slot_hint ENUM('TOP', 'BOTTOM', 'SHOES', 'ACCESSORY'),` — never altered by any later migration (confirmed via grep across V1-V24) — vs `GarmentSlotHint.java:4` `TOP, BOTTOM, DRESS, SHOES, ACCESSORY` mapped via `GarmentAsset.java:34-36` `@Enumerated(EnumType.STRING) @Column(name = "slot_hint") private GarmentSlotHint slotHint;`

**Failure path**

> Currently dormant, not an active outage: the only two call sites that ever set a `slotHint` are `DataSeeder` (which deliberately maps the "Dresses" category to `GarmentSlotHint.TOP`, not `DRESS`, avoiding the gap) and `RiggingService` (which sets it on `RiggingTask`, a different table whose own ENUM is `('TOP','BOTTOM','DRESS')` and is normalized via `resolveSlotHint()` before being written). The live production path, `GenerationService.materializeGarmentAsset`, never sets `slotHint` at all, leaving it NULL. The landmine: any future code path that persists `GarmentSlotHint.DRESS` into `garment_assets.slot_hint` (e.g. wiring outfit-slot matching or the designer product form's slot hint through to this column, a natural next step given dresses are a core, seeded product category) will fail at INSERT/UPDATE time under MySQL's default strict mode ("Data truncated for column 'slot_hint'"), since `ddl-auto: validate` only checks column type/existence, not the permitted ENUM value set.

**Suggested fix**

> Add a migration: `ALTER TABLE garment_assets MODIFY COLUMN slot_hint ENUM('TOP','BOTTOM','DRESS','SHOES','ACCESSORY');` to match the entity's full value set, or constrain `GarmentSlotHint` usage so DRESS is documented as never applicable to `garment_assets` (with a guard in code).

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None — all factual assertions (migration line text, entity enum values, DataSeeder mapping, RiggingService's normalize-and-write-to-RiggingTask behavior, GenerationService.materializeGarmentAsset never setting slotHint, ddl-auto:validate semantics) were verified against the code and held up.
- No claim is outright false, but two are misleading. (1) The finding calls DataSeeder's "Dresses" -> GarmentSlotHint.TOP mapping "deliberate" ("deliberately maps ... avoiding the gap"); there is no comment or test establishing intent, and the mapping lumps Tops/Outerwear/Dresses together (DataSeeder.java:841), which reads as incidental coarseness rather than a conscious workaround for the ENUM gap. (2) More materially, the finding omits that DataSeeder is @Profile({"dev","test"}) and so never runs in production — it presents the seeder as "one of the only two call sites that ever set a slotHint" without noting that neither of them can write this column in prod. That omission makes the residual risk look larger than it is and is the main reason the recorded MEDIUM is one notch too high. Also, the finding's framing of a natural trigger ("wiring outfit-slot matching or the designer product form's slot hint through to this column") is speculative: no such field exists in any DTO or controller today.

## A-24 · `MEDIUM` — Admin KPI queries scan the whole analytics_events table with no retention policy on the highest-write-volume table

**Location:** `server/src/main/resources/db/migration/V14__analytics_events_and_cohorts.sql:27`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/LOW)  
**Found by:** gap:Analytics/KPI subsystem: client-trusted, unthrottled, silently lossy — and the INVEST/STOP decision gate reads it

**Evidence**

> V14__analytics_events_and_cohorts.sql:27-29 declares only `idx_events_cohort_type (cohort, event_type)`, `idx_events_created (created_at)`, `idx_events_user (user_id)` — no `(event_type, created_at)` composite — while AnalyticsEventRepository.countByEventTypeAndCreatedAtBefore/...GreaterThanEqual (lines 19,25) filter on exactly that pair, and AnalyticsService.kpisByCohort (service lines 96-131) calls countByCohortAndEventType()/countPaidBySizeBracket() with no time bound or pagination of any kind.

**Suggested fix**

> Add a composite index `(event_type, created_at)` to support the pre/post drape-decision queries, and either bound /api/admin/kpis to a rolling window or add a scheduled retention/archival job for analytics_events (none exists today — confirmed no cleanup task in SchedulerConfig and no cron/migration performs one), since VIEW alone is emitted on every product-detail page load and the table has no cap on growth.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None of the load-bearing claims failed verification. One minor nuance the report doesn't mention: POST /api/events falls through to `.anyRequest().authenticated()` in SecurityConfig.java (no permitAll matcher for it), so VIEW events are only recorded for logged-in users, not anonymous browsers — slightly lower write volume than "every product-detail page load" might imply to a reader, but still fires on every authenticated page view and the core claim (unbounded growth, no retention, missing composite index) is unaffected.
- Three claims failed, all of which inflate the premise. (1) "VIEW alone is emitted on every product-detail page load" is wrong: POST /api/events falls under SecurityConfig.java:69 anyRequest().authenticated(), so anonymous visitors (the bulk of launch traffic on a deliberately public catalogue) write zero rows — their POST 401s and is swallowed by the fire-and-forget catch in web/lib/api.ts:141. The client emission is additionally ref-guarded to one per product id (web/app/products/[id]/page.tsx:150-153). (2) The gap framing "unthrottled" is wrong: RateLimitFilter.java:60 carries new RateRule("POST", "/api/events", null, 60, 60_000) — 60 req/60s per IP. (3) The title's "scan the whole analytics_events table" is imprecise: countByCohortAndEventType groups by exactly (cohort, event_type), which is the existing covering index, so it is an index-only scan rather than a table scan; the drape before/after queries can use idx_events_created for their range portion; only countPaidBySizeBracket (needs size_bracket, in no index) is a genuine table scan. Separately, countByEventType(EventType) at AnalyticsEventRepository.java:13 has no main-tree caller — dead, though the report does not claim otherwise.

## A-25 · `MEDIUM` — The JWT uid-claim round trip -- the fix for stale tokens re-authenticating as a different account after email recycling -- is never exercised against the real JwtTokenProvider implementation

**Location:** `server/src/test/java/com/iyae/security/JwtTokenProviderTest.java`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** test-integrity

**Evidence**

> `JwtTokenProviderTest.java` constructs a real `JwtTokenProvider` but has no test calling the 3-arg `generateToken(email, tokenVersion, userId)` overload or `extractUserId(token)` (`JwtTokenProvider.java:43-75`). Every other consumer mocks `JwtTokenProvider` entirely: `AuthServiceTest` (`@Mock JwtTokenProvider jwtTokenProvider`) and the otherwise-excellent `JwtAuthenticationFilterTest.aTokenForADifferentAccountIsRejectedEvenWhenTheEmailMatches` (line 279) stub `extractUserId("token123")` to return a canned Long rather than decoding a real signed token.

**Failure path**

> A bug in the real claim serialization/deserialization (e.g. a key-name typo, or JJWT handling of a `Long` claim in an edge case) would make `extractUserId` return null or the wrong value for every real token minted in production, silently breaking login for every user or defeating the anti-impersonation fix -- and no unit test in the suite would fail, since the only test exercising the real encode/decode path doesn't touch this claim at all.

**Suggested fix**

> Add JwtTokenProviderTest cases that call the 3-arg generateToken and assert extractUserId round-trips correctly, including with a legacy 1-arg/2-arg token asserting extractUserId returns null.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None of the finding's factual claims failed verification. Confirmed at HEAD: (1) `server/src/test/java/com/iyae/security/JwtTokenProviderTest.java` has exactly the 9 tests shown (generateToken/extractEmail/validateToken x3/differentEmails/extractTokenVersion x2/extractEmail-roundtrip) and none call the 3-arg `generateToken(email, tokenVersion, userId)` overload or `extractUserId(token)` against a real instance. (2) `JwtTokenProvider.java:43-75` matches the finding's line range and shows the real `uid` claim logic (`builder.claim("uid", userId)` in generateToken, `getClaims(token).get("uid")` with `instanceof Number` cast in extractUserId). (3) `AuthServiceTest.java` declares `@Mock JwtTokenProvider jwtTokenProvider` and stubs `generateToken(eq(email), any(), any())` to return a canned string in all 6 call sites — never invoking the real encoder. (4) `JwtAuthenticationFilterTest.java` declares `@Mock JwtTokenProvider jwtTokenProvider` and stubs `extractUserId("token123")` to return canned Longs/null in all 11 call sites, including the exact test named in the finding (`aTokenForADifferentAccountIsRejectedEvenWhenTheEmailMatches`, confirmed at line 279, stubbing `extractUserId` to return 41L rather than decoding a signed token). (5) A repo-wide grep for `extractUserId(` and the 3-arg `generateToken(` call pattern across `server/src/test` returns only these mocked call sites — no test anywhere calls the real round trip. (6) `WebMvcSecurityConfig` (shared by the `@WebMvcTest` controller tests) also replaces `JwtAuthenticationFilter` itself with a pass-through Mockito mock and `@MockBean`s `JwtTokenProvider`, so the real filter + real token provider are never exercised together in any controller test either. One nuance worth noting that the finding doesn't engage with: the Playwright E2E suite (run against a real running stack in CI) does exercise real login + real JWTs end-to-end, so a *totally broken* encode/decode (e.g., `extractUserId` always returning null) would very likely surface as widespread E2E failures rather than reaching production silently. The specific "defeats the anti-impersonation fix" scenario (a decode bug that coincidentally resolves to the wrong-but-plausible user id) remains genuinely uncovered at any test level, since even E2E doesn't construct the delete-account/re-register/stale-token scenario — only the mocked `JwtAuthenticationFilterTest` does, and it mocks away exactly the part under question.
- None of the finding's factual claims failed verification -- both the test-gap claim (JwtTokenProviderTest never calls the 3-arg generateToken or extractUserId) and the claim that every other consumer mocks JwtTokenProvider instead of exercising the real class were confirmed by reading the files directly.

## A-26 · `MEDIUM` — Stripe webhook idempotency under genuinely concurrent delivery relies on Order's @Version optimistic lock, which no test exercises

**Location:** `server/src/test/java/com/iyae/service/CheckoutServiceTest.java:411`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** test-integrity

**Evidence**

> `CheckoutService.fulfillPaidSession`'s Javadoc states idempotency rests on "the @Version optimistic lock on Order" (`Order.java:32`) for "Stripe's at-least-once, possibly-concurrent webhook delivery." The only idempotency test, `handleWebhook_sessionCompleted_alreadyPaid_skips` (CheckoutServiceTest.java:411-441), mocks `orderRepository` entirely and only covers the sequential case (order already PAID when the second call starts) -- it cannot exercise a real version-conflict. A repo-wide search for `@Version`/`OptimisticLock` in `src/test` finds nothing.

**Failure path**

> If a future refactor of `fulfillPaidSession` breaks the version check's protection (e.g. it stops reloading the entity inside the same transaction, or the save is moved to a separate non-versioned update), the existing mocked test keeps passing while two near-simultaneous Stripe webhook deliveries for the same session could both observe the order PENDING and both call `resaleService.markSold()`/clear the cart, double-processing a unique resale unit -- a money-adjacent defect in the one area (webhook handling) the repo's own comments single out as relying on this exact mechanism.

**Suggested fix**

> Add a @DataJpaTest/@SpringBootTest-backed test that loads the same Order in two separate EntityManagers/transactions, saves a PAID transition on both, and asserts the second commit fails with an optimistic-lock exception rather than silently succeeding.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- The failure path overstates the worst-case consequence. It claims that if the @Version protection silently broke, two concurrent webhooks could "both... double-process a unique resale unit." I verified that `resaleService.markSold()` (ResaleService.java:287-294, backed by `ResaleListingRepository.markSold`, a @Modifying conditional `UPDATE ... WHERE status = RESERVED`) is its OWN independently atomic, idempotent guard against double-selling the same resale unit — and this specific guard already HAS dedicated test coverage (`ResaleListingRepositoryDataJpaTest.markSold_onlyTransitionsFromReserved`, asserting the second call returns 0 rows updated). So a future regression that broke only Order's @Version lock would not, by itself, cause a true double-sale of inventory. The realistic (and still real) worst case is narrower: a duplicate `ORDER_PAID` analytics event, or — because markSold's repository method is `@Modifying(flushAutomatically = true)`, which forces Hibernate to flush the pending Order version-check UPDATE before markSold's own conditional UPDATE runs — a losing thread whose markSold then (incorrectly) reports "not reserved" and gets flagged with a false "REFUND REQUIRED" ERROR log + `paymentStatus=PAID_UNFULFILLABLE` on an order that the winning thread actually fulfilled correctly. That is an operational/data-quality defect, not a money-loss/double-sale defect.

## A-27 · `MEDIUM` — Three disagreeing copies of the product-category vocabulary; the designer fallback list is uppercase and contains a category no outfit slot can match

**Location:** `web/components/ProductForm.tsx:19`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** gap:Production database seeds to an empty marketplace; no production content/designer-onboarding path exists

**Evidence**

> Three independent hardcoded lists. web/components/ProductForm.tsx:19-28 (uppercase, includes ACTIVEWEAR, omits Jewelry): ```ts const FALLBACK_CATEGORIES = [ "TOPS", "BOTTOMS", "DRESSES", "OUTERWEAR", "SHOES", "ACCESSORIES", "BAGS", "ACTIVEWEAR", ]; ``` DataSeeder stores title-case `Tops/Bottoms/Dresses/Outerwear/Shoes/Accessories/Bags/Jewelry` (no Activewear). OutfitService.java:43-46 matches a third vocabulary: ```java SLOT_CATEGORIES.put("top", List.of("top", "outerwear", "dress")); SLOT_CATEGORIES.put("bottom", List.of("bottom", "pant", "skirt")); SLOT_CATEGORIES.put("shoes", List.of("shoe", "footwear")); SLOT_CATEGORIES.put("accessory", List.of("accessory", "bag", "jewelry")); ``` `matchesSlotCategory` lowercases and substring-matches (OutfitService.java:448-452), so "ACTIVEWEAR" matches no slot. The fallback list is what the first production designer sees, because ProductForm only replaces it on a non-empty response (ProductForm.tsx:133-137): `if (data.length > 0) { setCategories(data); }`, and `GET /api/products/categories` returns `[]` on an empty catalogue.

**Suggested fix**

> Make the category vocabulary one authority — a server-side enum or a single checked-in constant the designer form, the catalogue filters and `OutfitService.SLOT_CATEGORIES` all derive from — and either add an outfit-slot mapping for Activewear or remove it from the form. Normalise case on write (`ProductService.createProduct`) so production does not diverge from the seeded convention on the strength of which designer happened to list first; note the slot-hint fix depends on category casing being predictable.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None of the finding's factual claims failed verification. One nuance the report doesn't mention (not a claim it made, so not a failure): the title-case "Accessories" seeded by DataSeeder also fails the substring match against the keyword "accessory" (since "accessories" does not contain "accessory" as a substring -- it diverges at the 9th character, i/y), meaning the accessory-slot matching has a second latent bug beyond ACTIVEWEAR. This doesn't weaken the finding; if anything it understates the vocabulary-mismatch problem.
- Two claims do not survive, both in the direction of mis-describing rather than inflating: 1. The title's "the designer fallback list is uppercase" implies the casing is itself a live defect. It is inert at every consumer I could find: `ProductSpecifications.catalog` filters with `LOWER(category) LIKE '%' || lower(param) || '%'`; `OutfitService.matchesSlotCategory` lowercases; `SizeRecommendationService.selfReportedSizeFor` lowercases. The only exact-case consumers of `products.category` are `DataSeeder.slotHintFromCategory` (dev/test profile only) and `GlbPlaceholderGenerator.colorForCategory` (cosmetic placeholder-GLB tint, falls through to grey). Uppercase is also self-perpetuating but internally consistent, since `/api/products/categories` echoes back whatever was published first. So the live defect is `ACTIVEWEAR` specifically, not the casing. 2. "contains a category no outfit slot can match" is presented as unique to the fallback list. `ACCESSORIES` — present in BOTH the fallback list and the seeder's title-case vocabulary — also matches no slot: the keyword is the singular `"accessory"` and `"accessories".contains("accessory")` is false. Consequently the accessory slot is filled only by Bags/Jewelry, and the manual builder's accessory picker (`category=accessory` -> `LIKE '%accessory%'`) opens with zero products in dev and in prod alike. The finding's enumeration is incomplete and its implicit "the other seven are fine because matching is case-insensitive substring" is wrong. 3. Undercount, not an error: the finding says "three copies". There are more — `SearchFilterBar.FILTER_PILLS`, the `"Clothing"`/`"Accessories"` literals in `app/products/page.tsx:150,180,183`, and `lib/outfit-slots.ts` SLOT_CATEGORY_HINTS. (The `"Clothing"` one is a live zero-result shop filter, already filed separately as B-24.) Separately, `web/CLAUDE.md`'s claim that `SearchFilterBar` fetches categories from `/api/products/categories` is stale — the component I read is static pills with no fetch.

## A-28 · `LOW` — SmartARViewer's iOS branch can pass an empty src to <model-viewer> if a product ever has USDZ with no GLB (currently unreachable, no internal guard)

**Location:** `web/components/SmartARViewer.tsx:70`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/LOW/LOW) — **severity corrected MEDIUM -> LOW** by unanimous or majority verifier rank  
**Found by:** gap:3D/AR viewer render path and its unpinned third-party CDN dependencies

**Evidence**

> web/components/SmartARViewer.tsx:67-74: `if (arQuickLook && effectiveUsdzUrl) { return (<ModelViewerComponent glbUrl={effectiveGlbUrl ?? ""} usdzUrl={effectiveUsdzUrl} className="h-[500px] w-full" />); }` — the branch's own condition only requires a USDZ URL, not a GLB URL, yet it unconditionally passes `glbUrl` (becoming `<model-viewer src="">`).

**Suggested fix**

> Guard the branch itself (`arQuickLook && effectiveUsdzUrl && effectiveGlbUrl`, or omit the `src` attribute when no GLB exists) rather than relying on every current and future caller to pre-filter. `<model-viewer src="">` resolves against the document URL per standard HTML URL-attribute resolution, so the element would attempt to fetch and parse the current HTML page as a GLB and fail silently. Verified both current call sites (app/products/[id]/page.tsx:404-416 gates on a non-empty `glbUrl`; app/outfits/[id]/ar/page.tsx:62-66,135 gates on non-empty `glbUrls`) and the worker's generators (meshy_generator.py only ever sets `usdz_url` alongside an already-written `glb_url`) prevent this today, so this is a latent gap rather than a live defect.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- 1. MECHANISM CLAIM, load-bearing and almost certainly WRONG: "`<model-viewer src=""` resolves against the document URL per standard HTML URL-attribute resolution, so the element would attempt to fetch and parse the current HTML page as a GLB and fail silently." `model-viewer` is an autonomous custom element injected from a CDN script (ModelViewer.tsx:24-30); `src` on it is a JS property, NOT a UA-handled URL attribute, so the browser performs no URL resolution for it whatsoever, and model-viewer gates its own load on the truthiness of `src` ("" is falsy). This is `<img src="">` folklore (which modern browsers do not do either) incorrectly transferred to a custom element. The claim is what makes the finding sound costly; without it the worst case is a blank viewport. I could not execute to be fully certain since the package is not vendored. 2. CALL-SITE ENUMERATION INCOMPLETE: "Verified both current call sites" — there are three, not two. web/app/ar-visualization/page.tsx:326 is omitted. It passes no `usdzUrl`, so it cannot reach the iOS branch and the unreachability conclusion survives, but the sweep was not complete as asserted. 3. Minor framing issue: filing at MEDIUM is internally inconsistent with the finding's own title ("currently unreachable") and its fix text ("latent gap rather than a live defect").

## A-29 · `LOW` — Internal mail route interpolates `actionUrl` into an HTML attribute unescaped, and compares the shared secret with non-constant-time `!==`

**Location:** `web/lib/email-templates.ts:54`  
**Verification:** CONFIRMED (3/3 lenses, ranks LOW/LOW/LOW) — **severity corrected MEDIUM -> LOW** by unanimous or majority verifier rank  
**Found by:** web-ts

**Evidence**

> web/lib/email-templates.ts:54 `<a href="${actionUrl}" ...>` — `actionUrl` is the one field in `buildEmailHtml`'s options that is not passed through `escapeHtml` (compare `title`, `greeting`, `bodyText`, `actionText`, `footnote`, all of which are). `web/app/api/internal/mail/send/route.ts:46-48` validates only `typeof actionUrl === 'string'` with no URL-shape or same-origin check before it reaches the template. The same route compares the shared secret with `secret !== process.env.INTERNAL_MAIL_SECRET` (route.ts:21), a non-constant-time comparison.

**Suggested fix**

> HTML-escape `actionUrl` the same way every other interpolated field is escaped (it still works fine inside an `href` once escaped), and additionally validate it is an absolute URL under the expected frontend origin before templating. Low priority given this route is not reachable from the public internet in prod (nginx routes `/api/*` to the Spring Boot server, not to `web`, and `web`'s port is not published in `docker-compose.prod.yml`) and the only caller holds `INTERNAL_MAIL_SECRET`, but it is still a missing-validation gap worth closing cheaply. If hardening further, switch the secret check to a constant-time comparison (e.g. `crypto.timingSafeEqual` on fixed-length buffers).

**Verifier caveats** — the finding holds, but these specific assertions did not:

- Minor imprecision only: the finding says `title, greeting, bodyText, actionText, footnote` are "all" escaped via `escapeHtml` inside `buildEmailHtml` — but `greeting` (email-templates.ts:48) is interpolated raw inside `buildEmailHtml` itself; it is pre-escaped by the caller (`Hi ${escapeHtml(name)},` at lines 83/94) rather than by the function under review. This doesn't change the core conclusion (actionUrl really is the one value with no escaping anywhere in the pipeline), but the finding's framing of "all of which are escaped" inside that function is not quite accurate for greeting.
- None of the finding's factual claims are wrong — I confirmed both: (1) `web/lib/email-templates.ts:54` interpolates `actionUrl` into the `href` attribute without `escapeHtml`, while every sibling field (`title`, `bodyText`, `actionText`, `footnote`, and the caller-escaped `greeting`) is escaped; (2) `web/app/api/internal/mail/send/route.ts:21` does `secret !== process.env.INTERNAL_MAIL_SECRET`, a non-constant-time JS string comparison. What the finding gets right but underweights in its own severity label is reachability: the report's "Suggested fix" paragraph already concedes this is "low priority" — correctly, as I verified.

## A-30 · `LOW` — useOutfitRiggingStatus polling ticks can overlap without cancelling the superseded tick, letting a stale response re-flag an already-finished rig item

**Location:** `web/lib/hooks/useOutfitRiggingStatus.ts:44`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/LOW/LOW) — **severity corrected MEDIUM -> LOW** by unanimous or majority verifier rank  
**Found by:** web-react

**Evidence**

> lib/hooks/useOutfitRiggingStatus.ts:44-87 — each `poll()` invocation creates its own `controller` and overwrites `abortRef.current = controller`, but the tick's own completion check (`if (controller.signal.aborted) return;`, line 71) only ever tests that same tick's local controller, which nothing aborts except the effect's cleanup (which only ever holds the *latest* controller via `abortRef`). There is no in-flight/re-entrancy guard before `setInterval(poll, 5000)` fires the next tick.

**Suggested fix**

> Add an in-flight guard (e.g. a ref flag) so a new tick skips starting while a previous one is still running, or track all in-flight controllers (not just the latest) and abort every one of them before starting a new tick / on cleanup, so a tardy response from a superseded tick can never commit stale `activeRigging`/`items` state over a fresher result.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- The headline/failure-path claim — that a stale, un-cancelled poll tick can "re-flag an already-finished rig item" (i.e. make a completed item appear pending again to the user) — does not hold. In `useOutfitRiggingStatus.ts:111-113`, `pendingCount` is computed as `items.filter(item => !item.riggedGlbUrl && activeRigging.has(item.productId)).length`. Once an item's `riggedGlbUrl` is set it can never be unset — `setItems` (line 75-83) only overwrites with a truthy value pulled from `updates`, never clears it — so even if a stale/overlapping tick's `setActiveRigging(nowActive)` (line 73, which fully replaces rather than merges the set) spuriously re-adds a finished item's productId to `activeRigging`, the `!item.riggedGlbUrl` guard in `pendingCount` structurally excludes it. The only consumer of `activeRigging`/`pendingCount` (`web/app/outfits/[id]/view/page.tsx:195-200`, the "Rigging N items…" badge) can therefore never re-show a finished item as pending.
- 1) The title's claim that a stale response can "re-flag an already-finished rig item" is false — pendingCount's `!item.riggedGlbUrl` conjunct excludes any item that has resolved, and lines 108-110 document that tolerance as intentional. 2) The suggested-fix rationale that a tardy tick could "commit stale activeRigging/items state over a fresher result" is only half true: activeRigging yes (for <=5s, self-correcting), items no — the setItems path is monotone-additive and cannot regress an item or write a wrong URL. 3) The finding does not account for reachability: /api/designer/** is hasRole("DESIGNER") plus a service-level ownership check, so on the buyer-facing outfit viewer every poll 403s and the hook holds no state to corrupt, which the hook's own 403 test acknowledges. 4) Recorded severity MEDIUM is not supported; real cost is a transient decorative spinner label.

## A-31 · `MEDIUM` — Production CSP keeps `'unsafe-inline'` on script-src, so the policy provides no real script-injection mitigation

**Location:** `web/middleware.ts:19`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** web-ts

**Evidence**

> web/middleware.ts:18-20: `isProd ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://ajax.googleapis.com" : "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://ajax.googleapis.com"` — the only difference between dev and prod is `'unsafe-eval'`; `'unsafe-inline'` is present in both.

**Suggested fix**

> Move to a nonce-based or `'strict-dynamic'` CSP for script-src in production (Next.js supports per-request nonces via middleware), removing `'unsafe-inline'` from the prod policy so CSP actually blocks injected inline `<script>`/`onerror=`-style payloads rather than only documenting an aspiration to do so.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None. Verified directly against web/middleware.ts:12-35: both the prod branch (line 19, `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://ajax.googleapis.com`) and the dev branch (line 20, same plus `'unsafe-eval'`) include `'unsafe-inline'` on script-src, and the only prod/dev delta is `'unsafe-eval'`. No nonce mechanism exists anywhere in the middleware or layout. The finding's evidence quote is accurate verbatim.

## A-32 · `MEDIUM` — CSP omits www.gstatic.com needed by the Draco decoder path every GLB load wires up by default, despite the CSP's own comment claiming reliance on it

**Location:** `web/middleware.ts:19`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/LOW)  
**Found by:** gap:3D/AR viewer render path and its unpinned third-party CDN dependencies

**Evidence**

> web/middleware.ts:16,19-20,27: comment `// wasm-unsafe-eval: required by Three.js Draco decoder for WASM-based mesh decompression` sits above `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://ajax.googleapis.com` (prod) and `connect-src 'self' blob: https://raw.githubusercontent.com https://raw.githack.com https://rawcdn.githack.com https://cdn.jsdelivr.net` — neither directive lists `www.gstatic.com`. Every `useGLTF(url)` call (web/components/AvatarViewer.tsx:106,122,167; web/components/ARViewer.tsx:81) uses drei's default arguments, which per `node_modules/@react-three/drei/core/useGLTF.js` always calls `loader.setDRACOLoader(dracoLoader)` with `decoderPath = 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/'` unless overridden — no call site in this repo overrides it.

**Suggested fix**

> Either self-host the Draco decoder files under `/public/draco/` and call `useGLTF.setDecoderPath('/draco/')` once at app startup (removing the third-party dependency entirely), or add `https://www.gstatic.com` to `connect-src`/`script-src` if CDN delivery is intentional, or disable Draco explicitly (`useGLTF(url, false)`) and drop the now-inaccurate comment/`'wasm-unsafe-eval'` allowance if no asset needs it. Not asserting this fires in production today — no evidence any current GLB carries the `KHR_draco_mesh_compression` extension — but it is a verified configuration inconsistency the codebase's own comment implies should already be covered.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None. Every load-bearing claim verified: (1) middleware.ts's script-src/connect-src genuinely omit www.gstatic.com in both prod and dev branches; (2) drei's useGLTF (core/Gltf.js in the installed ^10.7.7 package) defaults useDraco to true via a JS default parameter and points DRACOLoader at https://www.gstatic.com/draco/versioned/decoders/1.5.5/ unless useGLTF.setDecoderPath is called, which nothing in the repo does; (3) all four call sites (AvatarViewer.tsx:106,122,167; ARViewer.tsx:81) call useGLTF(url) with no overrides; (4) the decoder fetch is lazy (three-stdlib DRACOLoader._initDecoder only runs when GLTFLoader actually decodes a KHR_draco_mesh_compression primitive) and uses three's FileLoader, which uses fetch() -- governed by connect-src, which also omits the origin; (5) a repo-wide grep for "draco" outside node_modules finds nothing in any worker GLB producer, matching the report's own admission that no current asset is known to trigger this.
- None of the finding's factual/technical claims failed verification — the CSP gap, drei's default Draco-enabling behavior, the four unmodified call sites, and the absence of any decoderPath override are all confirmed against the actual installed package source and the four call sites' line numbers. The one caveat the report itself already flags ("no evidence any current GLB carries the extension") was independently confirmed: no worker-generated GLB (stub/Meshy/Tripo3D wrapper/SMPL-X/any rigging provider) ever applies Draco encoding, none of the six bundled static GLBs (default-avatar, demo-outfit, 5 pose files) contain the draco string, there is no raw-GLB upload path for designers (only image upload; 3D is always server-generated), and Meshy's own API reference doc exposes no compression/Draco option at all.

## A-33 · `MEDIUM` — No retry/backoff around Meshy/Tripo3D HTTP calls — a single transient network blip discards an entire (paid) in-flight generation

**Location:** `worker/providers/meshy_generator.py:243`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** worker-python

**Evidence**

> worker/providers/meshy_generator.py:241-259: the 10-minute poll loop calls `requests.get(...); status_resp.raise_for_status()` with no retry/backoff — any transient connection error, timeout, or 5xx on any single poll (including the one that would have reported SUCCEEDED) raises immediately and aborts the whole task. `worker/providers/tripo_generator.py:46-61` has the identical pattern.

**Suggested fix**

> Wrap the polling GET (and the initial POST) in a small retry-with-backoff for transient failures (connection errors, timeouts, 502/503/504), distinct from terminal provider-reported FAILED/CANCELED states which should still fail fast. This avoids burning a paid generation credit (Meshy/Tripo3D) on a single dropped packet 9 minutes into a 10-minute poll.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- Two framing claims overreach, though neither breaks the finding. (1) "discards an entire (paid) in-flight generation" is accurate about the wasted credits, but the title's implied finality is wrong: the loss is one generation's credits (~30, logged as `consumed_credits`), and the task is fully recoverable by one self-service click — `GenerationStatusCard.tsx:69-85` renders the persisted `error_message` with a "Retry Generation" button, `GenerationService.retry` resets the row to PENDING, and `TaskQueue.claim_task` does not filter on `attempt_count`, so repeated blips cannot wedge it permanently. It is neither silent nor unrecoverable. (2) The evidence localizes the gap to the poll loop only; in fact the initial POST, the GLB download and the USDZ download are equally unprotected — an error in the finding's favour. Also unstated: reachability requires an operator to set `MODEL_GENERATION_PROVIDER=meshy|tripo3d`, whereas both `.env.example:70` and `docker-compose.prod.yml:98` default to `mock`, under which the finding has no trigger whatsoever.

## A-34 · `MEDIUM` — No component prunes superseded generation output; guest avatar trees accumulate from an unauthenticated endpoint with no reachable delete path

**Location:** `worker/providers/meshy_generator.py:266`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/MEDIUM)  
**Found by:** gap:Generated-asset storage has no retention, no quota and no monitoring, on the same filesystem as the database

**Evidence**

> Model output is task-id keyed, so every `regenerate` mints a new tree — worker/providers/meshy_generator.py:266-269 (same shape in stub_generator.py:44-47 and tripo_generator.py:64-67): ```python output_dir = os.path.join( self.output_base_dir, f"products/{product_id}/tasks/{task_id}" ) os.makedirs(output_dir, exist_ok=True) ``` GenerationService.java:99-108 `supersedeActiveTasks` flips the prior row to FAILED and touches no files; `materializeGarmentAsset` (155-184) writes a new GarmentAsset and does nothing with the previous task's output. Avatars likewise — smplx_provider.py:318-320 `avatars/{user_id}/{task_id}` — and GuestAvatarService.java:48-55 creates an unconditional new task per anonymous request: ```java AvatarGenerationTask task = AvatarGenerationTask.builder() .user(guest) .status(TaskStatus.PENDING) ```

**Failure path**

> Each `POST /api/designer/products/{id}/regenerate` leaves the previous `products/{id}/tasks/{taskId}/` tree permanently orphaned — never read again (GenerationService.getStatus only reads `tasks.get(0)`) and never deleted. With `MODEL_GENERATION_PROVIDER=meshy` that is 5-15 MB per abandoned attempt. For guest avatars the accumulation has no ceiling at all: every anonymous visitor shares one internal account (`brandProperties.guestEmail()`), so trees pile up under `avatars/{guestUserId}/{taskId}/`, and the only code that deletes an avatar tree — `AvatarService.deleteAvatarFiles`, reached only via `deleteAvatarData(email)` behind authenticated `DELETE /api/avatar` — can never fire for the guest account, whose password is `UUID.randomUUID()` (GuestAvatarService.java:119) and which nothing can log in as. Rate limiting bounds the rate (3/60s per IP) but not the total. Severity is MEDIUM rather than HIGH because the prod compose defaults both providers to `mock` (docker-compose.prod.yml:98-99), whose output is kilobytes; it becomes a real consumer only once smplx/meshy/tripo3d is configured. Note the brief's rigging claim does not hold: all three rigging providers key on garment asset id (python_rigging_provider.py:160, blender_rigging_provider.py:85-86, stub_rigging_provider.py:195), so retries overwrite and `rigging-work/` is bounded.

**Suggested fix**

> Add a sixth `@Scheduled` method in `SchedulerConfig` (it already owns task-row lifecycle and resolves `worker.output-dir`): walk `products/{id}/tasks/*`, delete any directory whose task id is not the current MATERIALIZED/READY row for that product and whose row is older than a grace window (e.g. 24h, so an in-flight claim is never raced); walk `avatars/{userId}/*` with the same rule. For the guest account specifically, add an age-based cap — delete guest avatar trees and their task rows older than the try-on session TTL (hours, not days). Keep the recursive delete in one place by extracting `AvatarService.deleteAvatarFiles` into a shared helper.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- Two things are overstated. (1) The framing "guest avatar trees accumulate from an unauthenticated endpoint" implies organic traffic drives the growth. Nothing in the shipped frontend calls POST /api/public/avatar/generate — `web/lib/api.ts:251-255` exposes only the authenticated `/api/avatar/*` routes, and a repo-wide grep for `public/avatar` outside the server tree and the old audit JSON returns zero web callers. So the guest tree only grows if someone hits the API directly; it is an abuse vector (3/60s per IP, unauthenticated, unbounded total), not an organic one. (2) The report's own severity rationale ("prod defaults both providers to mock ... output is kilobytes") is correct but under-weighted: in the launch-1 default config each guest request writes a ~1 KB 12-triangle box mesh (`worker/providers/smplx_stub_provider.py:239-263`), so at defaults the accumulation is inode/row growth, not bytes — and the privacy-retention angle is also weak at defaults, since the stub mesh is not derived from the submitted measurements at all (`input_payload` is ignored). RIGGING_PROVIDER in docker-compose.prod.yml:104 defaults to `python`, not mock, which the finding does not claim either way.

## A-35 · `MEDIUM` — Rigging output file path is keyed by garment_asset_id, not task_id, so concurrent rigging workers can overwrite each other's output

**Location:** `worker/providers/python_rigging_provider.py:160`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/LOW)  
**Found by:** task-queues

**Evidence**

> worker/providers/python_rigging_provider.py:160 `out_rel = f"rigged/{garment_asset_id}/garment-rigged.glb"` writes to a path scoped only by garment_asset_id (not task_id); worker/providers/skinned_glb_writer.py:340 `gltf.save(str(output_path))` writes directly to that path with no temp-file+atomic-rename and no locking.

**Failure path**

> RiggingService.requestRigging() creates a brand-new RiggingTask row (new task_id) each time it is called, and supersedeActiveTasks() flips any still-RUNNING prior task to FAILED in the DB without stopping the worker that is mid-generate() on it (server/src/main/java/com/iyae/service/RiggingService.java:51-52, 220-230). TaskQueue/AvatarTaskQueue avoid any file collision because their output paths embed the unique task_id (worker/providers/stub_generator.py:45, worker/providers/meshy_generator.py:267), but RiggingTaskQueue's path only embeds garment_asset_id. Under the current single-rigging-worker-per-role topology (docker-compose.yml:94-126, docker-compose.prod.yml single worker) the two tasks are processed strictly sequentially so the final writer happens to be correct; but if the rigging role is ever run with more than one concurrent claimant (the codebase explicitly markets `SKIP LOCKED` as making "multiple worker instances run safely in parallel" — worker/CLAUDE.md), two different RiggingTask rows for the same garment_asset_id can be claimed by two different processes at once, both targeting the identical disk path with no synchronization: whichever process's gltf.save() finishes last wins, independent of which task the database records as RUNNING/READY/FAILED. The database can end up pointing a READY/MATERIALIZED garment_asset.riggedGlbUrl at a public URL whose on-disk bytes were actually written by a different (possibly failed/superseded) task.

**Suggested fix**

> Scope the rigging output path by task_id (mirroring model/avatar paths, e.g. `rigged/{asset_id}/{task_id}/garment-rigged.glb`) and have materialization copy/rename the winning task's file into the asset-stable public path, or write via temp file + os.replace() keyed per-task before any cross-task rename.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None of the evidentiary claims failed verification. I confirmed: (1) python_rigging_provider.py:160 builds `out_rel = f"rigged/{garment_asset_id}/garment-rigged.glb"` with no task_id component; (2) skinned_glb_writer.py's `gltf.save(str(output_path))` (line ~339) writes directly with no temp-file+rename or locking; (3) stub_generator.py and meshy_generator.py both key their output paths by `tasks/{task_id}` (an asymmetry the finding correctly identifies); (4) RiggingTaskQueue.claim_task uses `FOR UPDATE SKIP LOCKED` (rigging_task_queue.py:20-49), which permits two different rows (hence two different task_ids for the same garment_asset_id) to be claimed by two concurrent processes; (5) RiggingService.requestRigging/supersedeActiveTasks (RiggingService.java:51-52, 220-230) flips a RUNNING task to FAILED in the DB without signaling/stopping the in-process Python generate() call, and creates a new PENDING task row for the same garment_asset_id; (6) worker/CLAUDE.md:420 literally states 'SKIP LOCKED ensures multiple worker instances can run safely in parallel,' documenting an in-repo expectation of horizontal scaling that this queue's path-keying violates; (7) both docker-compose.yml and docker-compose.prod.yml currently run exactly one process claiming the rigging role (no `deploy.replicas`, and the compose comments explicitly state 'Production differs on purpose: it runs a single worker... with every role'), so the race is not reachable under the deployment topology that ships today.
- 1) "RiggingService.requestRigging() creates a brand-new RiggingTask row (new task_id) each time it is called" — true for requestRigging (lines 66-76), but the sibling retry() path (lines 150-155) REUSES the same row, resetting it to PENDING and incrementing attemptCount. So the two-rows-one-asset framing does not cover retries at all, and the suggested task_id-keyed path would not disambiguate successive attempts of a retried task either. 2) The finding's own hedge understates the gap: it says the single-worker topology makes "the final writer happen to be correct," implying luck, when in fact the shipped configs structurally guarantee exactly one rigging claimant (prod has no replicas; dev scopes by WORKER_ROLES) and the poll loop is single-threaded — so the described concurrent-overwrite is unreachable rather than merely sequentialized by chance. 3) The finding never mentions the only consequence that can bite at launch: the non-atomic in-place overwrite of the live, publicly-served buyer-facing rigged asset on any re-rig, including the post-write-validation-failure and mid-save-crash paths that destroy a previously-good asset while the DB still advertises it. Its stated failure path is the unreachable one; its reachable cost lies elsewhere.

## A-36 · `MEDIUM` — RiggingTaskQueue.fail_task silently discards a no-op write with no return value or log, unlike the sibling queues

**Location:** `worker/rigging_task_queue.py:75`  
**Verification:** CONFIRMED (3/3 lenses, ranks MEDIUM/MEDIUM/LOW)  
**Found by:** task-queues, silent-failures (reported independently 2x)

**Evidence**

> worker/rigging_task_queue.py:75-88 `def fail_task(self, task_id, error_message, failure_code=None): ... UPDATE rigging_tasks SET status='FAILED' ... WHERE id=%s AND status='RUNNING' ... finally: cursor.close(); conn.close()` — no `cursor.rowcount` check, no return value, no logging when the UPDATE matches zero rows.

**Failure path**

> task_queue.py:70-98 and avatar_task_queue.py:78-107 both check `cursor.rowcount == 0` and log a warning ("was not RUNNING — leaving its status alone"), and worker/main.py:265-268/304-305 consult that boolean to log whether the fail actually took effect. rigging_task_queue.py's fail_task has neither, and none of worker/main.py's five call sites (lines 325-329, 336-340, 351-355, 391-395, 399) check a return value. When a rigging task is superseded (RiggingService.requestRigging/retry flip it to FAILED) while the worker is still inside generate() for it, the worker's eventual fail_task call for that same task silently no-ops with zero trace in the logs — the one failure signal an operator would need to diagnose "why didn't my rigging retry work" never appears anywhere, even though the equivalent model/avatar scenario is explicitly logged.

**Suggested fix**

> Mirror task_queue.py / avatar_task_queue.py: return a bool from rowcount, log a warning when the guard declines to touch the row, and have main.py's rigging exception handlers consult that return value the same way the model/avatar paths already do (worker/main.py:265-268, 304-305).

**Verifier caveats** — the finding holds, but these specific assertions did not:

- Two impact claims in the Failure path do not hold. (a) "the worker's eventual fail_task call for that same task silently no-ops with zero trace in the logs — the one failure signal an operator would need ... never appears anywhere": the error itself IS logged at all five rigging call sites immediately before fail_task (main.py:324, :335, :348, :390, :398); only the declined-write notice is absent. (b) The "why didn't my rigging retry work" diagnosis framing: RiggingService.retry() (RiggingService.java:132-155) reuses the same FAILED row and nulls errorMessage/failureCode, so the superseded task's worker error is not the signal that would explain a failed retry. Additionally the report implies a behavioural parity loss, but in task_queue/avatar_task_queue the returned bool only selects between two log strings — main.py takes identical action either way — so the gap costs exactly one log line, not any action. The report also overlooks that complete_task in the same file already logs its no-op, making the asymmetry intra-file.

## A-37 · `LOW` — parseProductSizes silently swallows a malformed product.sizes JSON column with zero logging, in two services

**Location:** `server/src/main/java/com/iyae/service/CartService.java:164`  
**Verification:** CONFIRMED (3/3 lenses, ranks LOW/LOW/LOW)  
**Found by:** silent-failures

**Evidence**

> server/src/main/java/com/iyae/service/CartService.java:162-166: `try { return OBJECT_MAPPER.readValue(json, ...); } catch (Exception e) { return Collections.emptyList(); }` — no log statement at all. Identical pattern duplicated in server/src/main/java/com/iyae/service/ProductService.java:270-274.

**Suggested fix**

> Add `log.warn("Failed to parse sizes JSON for product {}: {}", product.getId(), e.getMessage())` (or similar) in both catch blocks so a corrupted `products.sizes` column (migration bug, manual DB edit, etc.) leaves a diagnostic trail instead of silently presenting the product as sizeless, which in CartService then produces a confusing 'Product has no sizes; use ONE_SIZE' error for a product that does have sizes.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None of the finding's load-bearing claims failed. Minor nuance the report didn't spell out: the `sizes` column is MySQL `JSON` type, which rejects syntactically malformed JSON at write time, so "malformed JSON" can only actually occur as valid-JSON-but-wrong-shape (e.g. a JSON object instead of a string array) rather than literally unparseable text — this doesn't change the conclusion since Jackson's `readValue(..., List<String>.class)` still throws and is still silently swallowed either way.
- 1) The claimed failure path is wrong for the real client: "which in CartService then produces a confusing 'Product has no sizes; use ONE_SIZE' error for a product that does have sizes". ProductResponse.parseJsonList (ProductResponse.java:96-105) swallows the same parse failure, so the PDP gets sizes: []; web/app/products/[id]/page.tsx:211 sends `selectedSize ?? "ONE_SIZE"` and the add button gate (line 422) only engages when product.sizes.length > 0 — so the cart add succeeds silently as ONE_SIZE instead of erroring. The error requires a direct API caller or a stale client-held size. 2) The named trigger "migration bug" has no instance: no migration writes products.sizes; V1__baseline_schema.sql:52 only declares it `sizes JSON`. 3) The other named trigger, "manual DB edit", is largely blocked too — MySQL's native JSON column type rejects syntactically invalid JSON on write, so only a valid-JSON-but-wrong-shape edit can reach the catch. 4) "in two services" undercounts the duplication: the identical unlogged swallow is in four sites (CartService, ProductService, ProductResponse.parseJsonList, SizeRecommendationService.parseStringArray), three of them services — though the two locations actually cited are correct.

## A-38 · `LOW` — DesignerProfileService has no injection site: shopName, bio and city are unwritable in every environment

**Location:** `server/src/main/java/com/iyae/service/DesignerProfileService.java:34`  
**Verification:** CONFIRMED (3/3 lenses, ranks LOW/LOW/LOW)  
**Found by:** gap:Production database seeds to an empty marketplace; no production content/designer-onboarding path exists

**Evidence**

> `DesignerProfileService.updateProfile(String email, String displayName, String shopName, String bio)` (line 34) is the only code path with setters for these fields, and a repo-wide grep for `designerProfileService|DesignerProfileService` in `server/src/main/java` returns exactly one hit — the class declaration itself (`DesignerProfileService.java:15`). No controller injects it. `shopName` is likewise read nowhere in the main tree (grep hits are only the entity, DataSeeder and tests); `ProductResponse.from` exposes `profile.getDisplayName()` (ProductResponse.java:52), which registration does set, so nothing user-visible breaks today.

**Suggested fix**

> Either wire the service to a `GET/PUT /api/designer/profile` endpoint (the natural home for the city/isLocal write the Local Designers filter needs, and for the shop name and bio the designer storefront concept implies) or delete it. Leaving an unreachable service that looks like the designer-profile write path is what made the missing city/isLocal path hard to see.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- Two precision defects in the framing, neither undermining the finding: 1. The title's "unwritable in every environment" is overstated. `DataSeeder.java:107-129` writes `shopName`, `bio`, `city` and `isLocal` in dev/test, and `AccountDeletionService.java:204-206` writes `shopName` ("Former designer") and `city` (null) in ALL environments including prod. The accurate claim — which the evidence body makes correctly — is that there is no user- or operator-facing write path, not that the fields are unwritable. 2. The title bundles `city` into a sentence about this service's signature, but `updateProfile` does not take a `city` parameter at all (the report's own evidence concedes this: "does not accept city/isLocal at all"). So `city` being unwritable is not a fact about `DesignerProfileService:34`; it belongs to B-15's scope. This is the source of the severity-inflation risk in the title: the one consequence that would justify escalation (`city`/`isLocal`) is not actually this finding's. 3. Minor: the "Found by" attribution ties A-38 to the empty-marketplace gap, but the finding as scoped (dead service, unread shopName/bio) has no bearing on marketplace emptiness.

## A-39 · `LOW` — Email-verification and password-reset expiry columns use DATETIME while every other timestamp in the schema uses TIMESTAMP

**Location:** `server/src/main/resources/db/migration/V4__email_verification_and_password_reset.sql:7`  
**Verification:** CONFIRMED (3/3 lenses, ranks LOW/LOW/LOW)  
**Found by:** db-migrations

**Evidence**

> V4__email_verification_and_password_reset.sql:7 `verification_token_expires_at DATETIME NULL` and lines 25-26 `expires_at DATETIME NOT NULL, used_at DATETIME NULL`, both mapped to `java.time.Instant` fields (`User.verificationTokenExpiresAt`, `PasswordResetToken.expiresAt/usedAt`). Every other timestamp column in the 24 migrations uses `TIMESTAMP`.

**Suggested fix**

> No demonstrated current breakage (JVM/driver/MySQL server timezone appear consistently UTC in this deployment), but DATETIME stores a literal wall-clock value with no timezone normalization at the engine level, unlike TIMESTAMP. For consistency and to remove a latent correctness risk if any component's default timezone ever diverges, migrate these two columns to TIMESTAMP to match the rest of the schema.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- One minor factual incompleteness, which understates rather than overstates: the finding lists three DATETIME columns but there are four. It omits `V4:27 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`. That fourth column is even lower impact than the three cited — it is written by Hibernate's `@CreationTimestamp` as a driver-converted bound parameter (making the server-side `DEFAULT CURRENT_TIMESTAMP` effectively dead weight), and a grep found no reader of `PasswordResetToken.createdAt` anywhere in the main tree. A secondary nit on precision: the supporting grep count conflates column types with `CURRENT_TIMESTAMP` default expressions, so "every other timestamp column uses TIMESTAMP" is less rigorously evidenced than it reads. The directional claim nonetheless holds — there is no other DATETIME column type anywhere in the 24 migrations. Nothing load-bearing failed; the finding's central claim and its own "no demonstrated current breakage" hedge both check out.

## A-40 · `LOW` — idx_follows_follower duplicates the leftmost column of uk_follows_pair

**Location:** `server/src/main/resources/db/migration/V8__community_tables.sql:55`  
**Verification:** CONFIRMED (3/3 lenses, ranks LOW/LOW/LOW)  
**Found by:** db-migrations

**Evidence**

> V8__community_tables.sql:48 `UNIQUE KEY uk_follows_pair (follower_id, following_id)` already serves any lookup on `follower_id` alone as its leftmost prefix; line 55 `CREATE INDEX idx_follows_follower ON follows(follower_id);` is a second, redundant single-column index that only adds write overhead.

**Suggested fix**

> Drop `idx_follows_follower` in a future migration; `idx_follows_following` (line 56) is still needed since `following_id` is not a usable prefix of the unique key.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- The suggested fix states idx_follows_following (V8:56) "is still needed since following_id is not a usable prefix of the unique key." Wrong on MySQL/InnoDB: FOREIGN KEY (following_id) is declared in the same CREATE TABLE and no index with following_id leftmost exists at that point, so InnoDB auto-creates one — line 56 is therefore a second, duplicate index on following_id. The same mechanism makes idx_post_comments_post (V8:54) a duplicate of the auto-created FK index on post_comments.post_id. So V8 contains three redundant indexes; the finding names one and explicitly exonerates another. Also omitted: V24__perf_indexes.sql:11-15 already states this same reasoning about this same table ("A redundant index is not free — it costs on every write"), so the premise is partly already reasoned about in-tree. Finally, the finding's framing of the index as pure overhead is incomplete — in InnoDB the single-column index is narrower than the unique key, so countByFollower / findByFollowerOrderByCreatedAtDesc read slightly fewer pages from it, making the proposed drop a near-wash rather than a clear win.

## A-41 · `LOW` — connect-src allows cdn.jsdelivr.net for drei KTX2/matcap assets that the component tree does not appear to use

**Location:** `web/middleware.ts:26`  
**Verification:** CONFIRMED (3/3 lenses, ranks LOW/LOW/LOW)  
**Found by:** gap:3D/AR viewer render path and its unpinned third-party CDN dependencies

**Evidence**

> web/middleware.ts:25-27: comment `// cdn.jsdelivr.net: drei KTX2 decoder and matcap assets` backs the `connect-src` allowance, but a repo-wide grep for drei's `Ktx2`/`MatcapTexture`/`NormalTexture` helpers (the only drei exports that reference jsdelivr internally) finds no import anywhere in `web/components` or `web/app`.

**Suggested fix**

> Confirm whether any current or planned feature needs jsdelivr; if not, drop the allowance to reduce the CSP's third-party attack surface.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- None. Verified against code: web/middleware.ts:24-27 CSP connect-src includes https://raw.githubusercontent.com, https://rawcdn.githack.com, and https://cdn.jsdelivr.net, each annotated with a comment explaining a specific drei feature it supposedly backs. A repo-wide grep across web/components, web/app, and __tests__ for drei's KTX2/matcap/normal-texture helpers (Ktx2, MatcapTexture, NormalTexture) and for any literal 'jsdelivr' reference in app code found zero matches outside the middleware comment itself. The only drei imports actually present are in components/AvatarViewer.tsx (OrbitControls, Environment, useGLTF, Bounds, useProgress, useEnvironment, Html, ContactShadows), components/DemoOutfitModel.tsx (OrbitControls, Bounds), and components/ARViewer.tsx (useGLTF) -- none of which touch KTX2 compression or matcap/normal textures. By contrast, AvatarViewer.tsx does use drei's <Environment preset=...> / useEnvironment.preload, which is a legitimate, verified consumer of HDR assets served from the github-raw-backed domains (raw.githubusercontent.com / rawcdn.githack.com) -- so those two connect-src entries are justified while cdn.jsdelivr.net is not. The finding's core claim (jsdelivr allowance has no corresponding feature usage in the component tree) holds.

## A-42 · `LOW` — Heartbeat file is touched unconditionally before the per-cycle try/except, so the container healthcheck cannot detect a persistent orchestration-level error loop

**Location:** `worker/main.py:199`  
**Verification:** CONFIRMED (3/3 lenses, ranks LOW/LOW/LOW)  
**Found by:** worker-python

**Evidence**

> worker/main.py:197-200: `while True: poll_count += 1; touch_heartbeat(); try: ...` — the heartbeat is refreshed before any work is attempted, and the broad `except Exception as e: logger.error(...); time.sleep(POLL_INTERVAL)` at the bottom (lines 407-409) means any bug that escapes all the per-queue/per-task guards (which already cover DB errors and provider errors) would loop forever while still reporting healthy to the `docker-compose.prod.yml` healthcheck that keys purely on heartbeat freshness.

**Suggested fix**

> Only touch the heartbeat after at least one full, successful pass through the loop body (or track consecutive failures and stop refreshing the heartbeat past a threshold), so the healthcheck can actually distinguish a working daemon from one stuck in a code-level error loop.

**Verifier caveats** — the finding holds, but these specific assertions did not:

- (1) "the per-queue/per-task guards ... already cover DB errors" is wrong: every queue method calls `get_connection()` outside its own try (queue_base.py:31-32, task_queue.py:16-18), so DB-connect failures are exactly what escapes to the bottom catch. This makes the finding more reachable than it claims, but the stated reasoning is inaccurate. (2) The finding implies the false-healthy has operational consequence; it does not establish one, and there is none — no restart-on-unhealthy in plain Compose, no `depends_on` on worker, and prod_deploy.sh gates only mysql+server. (3) The suggested fix is unsound and misses the larger adjacent defect in the same mechanism: `touch_heartbeat()` runs ONLY at the top of the cycle, never during `provider.generate()` (the DB-level `task_heartbeat` thread bumps `updated_at`, not the file), while the healthcheck window is 10 × WORKER_POLL_INTERVAL = 50 s by default. A legitimate Meshy generation polls up to 10 minutes (worker/providers/meshy_generator.py:241-242 `for _ in range(120): time.sleep(5)`) and PythonRiggingProvider — the prod default via `RIGGING_PROVIDER:-python` — has no timeout at all, so the container reports UNHEALTHY during normal successful work, far more often than the error loop this finding describes. "Only touch the heartbeat after a full successful pass" does not address that and, if anything were ever wired to restart on unhealthy, the false-unhealthy would kill the worker mid-generation — reintroducing exactly the double-processing the task heartbeat was added to prevent. The real remedy is to have the per-task heartbeat thread also touch the file, plus a separate consecutive-failure counter.

---

# Consolidation (cross-finding)

Produced by a final agent given every verification result at once — the judgement no per-finding verifier could make. Its own spot-check counts differ from the pipeline's because it re-checked a subset itself; where it says a finding was "not independently re-verified" it means *it* did not re-check that one, not that the three-lens pass skipped it (all 42 got three lenses).

## Adversarial validation — 42 advisory findings, `docs/reviews/2026-10-13-production-readiness-review.md`

Read the source at HEAD for each claim. **35 verified as written; 1 has a materially wrong failure path; 1 ships a harmful fix; 6 overlap into 3 defects; 7 not independently re-verified** (A-13, A-15, A-22, A-26, A-27, A-28, A-37 — evidence internally consistent, left as-filed).

### Confirmed, evidence exact (no change)

A-1, A-2, A-3, A-4, A-6, A-7, A-8, A-9, A-10, A-11, A-12, A-14, A-16, A-18, A-20, A-21, A-24, A-25, A-31, A-33, A-34, A-35, A-36, A-38, A-41. Spot-checks that held: `/assets/` and `/uploads/` locations each carry their own `add_header` (`nginx/conf.d/default.conf:40-95`); `nginx/nginx.conf:27` is bare `access_log /dev/stdout`; `FileStorageService.java:33-34` reads `file.getContentType()` only; `web/Dockerfile:29` is the only `USER` in any Dockerfile; `AdminModerationService` lines 60/89/161 are unbounded `findAll`, 116 is the one `Pageable`; `JwtTokenProviderTest` calls only the 1- and 2-arg `generateToken`, never `extractUserId`; no `.github/workflows/` file mentions `prod_deploy.sh`/`ssl-init`.

### Findings that change

**A-19 — failure path is wrong.** `AnalyticsService.record` is `@Transactional` (`AnalyticsService.java:72`). A `DataIntegrityViolationException` from the IDENTITY-generator flush marks the transaction rollback-only, so the commit fails **after** the `catch` at :89 and throws out of the transaction proxy. The claim "the controller still returns 202 Accepted… The only trace is one WARN log line" does not hold — the client gets a 500. The under-stated risk the finding misses is the inverse: `record()` is called from `CheckoutService.initiateResaleCheckout:374` and elsewhere, so a rejected row can poison a caller's transaction *after* a live Stripe session was created. Keep the fix (`@Size` on `sizeBracket`, parse-check `metadata`), discard the "silently lossy" framing.

**A-42 — primary suggested fix would regress.** "Only touch the heartbeat after at least one full, successful pass" contradicts the heartbeat thread added 2026-10-11 around the three blocking `generate()` calls. The prod healthcheck window is `10 × WORKER_POLL_INTERVAL` = 50s (`docker-compose.prod.yml:117`); a real `PythonRiggingProvider` job runs for minutes. Deferring the touch to after the loop body marks a healthy worker unhealthy mid-job. Only the parenthetical alternative (consecutive-failure counter) is safe. Defect at `worker/main.py:199` is confirmed, but narrow — all DB and provider errors are already caught by inner guards.

**A-17 — rating is wrong in both directions.** Confirmed: `AccountDeletionService.java:164-186` has no `RESERVED` branch. Two corrections:
- *Not reachable at Launch 1* — `CheckoutService.initiateResaleCheckout:326-330` calls `requireStubAllowed()` **before** `reserve()`, which 503s outside dev/test while payment is off. Latent until Stripe is enabled.
- *Worse than MEDIUM once enabled* — the window between `reserve()` (:331) and the order save (:373) spans a live `stripeGateway.createSession` network call, and the save is its own `txTemplate` transaction. A seller deleting their account inside it deletes the listing; the order INSERT then fails the FK; `catch (RuntimeException)` calls `release()` on a row that no longer exists and rethrows — leaving the buyer holding a **payable Stripe session with no Order row** for `findByStripeSessionId` to find.
- Missed divergence: that method's own Javadoc (:160-162) claims "A listing with a live checkout is kept and released back to LISTED instead." The code only `continue`s. The author believed this case was handled.

**A-30 — impact overstated.** The race is real (`poll()` builds a controller per tick, overwrites `abortRef`, and only the latest is ever aborted). But `setItems` only ever *adds* `riggedGlbUrl`, and `pendingCount` reads `!item.riggedGlbUrl && activeRigging.has(...)` — so a stale commit can corrupt only `activeRigging`, cannot un-resolve an item, and self-corrects on the next 5s tick. "Let a stale response re-flag an already-finished rig item" is false for the item; true only for the count. LOW.

**A-29 — no reachable path.** Confirmed `actionUrl` is the one unescaped field (`email-templates.ts:54` vs `escapeHtml` on title/greeting/bodyText/actionText/footnote). But it is built server-side as `frontendBaseUrl + "/verify-email?token=" + rawToken`; the token is Base64-URL-safe from `SecureRandom` and cannot contain `"`. Nothing attacker-controlled reaches the attribute. Hygiene, LOW.

**A-28 — self-refuted but still ranked MEDIUM.** Its own evidence proves both call sites guard `glbUrl`. LOW. Same inconsistency: A-32 and A-41 are the identical class of defect (a CDN allowance that is missing / unused) rated MEDIUM and LOW respectively.

### The 42 is inflated — 6 findings are 3 defects

- **A-1 ≡ A-2** — one defect (no `deploy.resources`/`JAVA_TOOL_OPTIONS` in `docker-compose.prod.yml`), filed by `infra-deploy` and `perf-scale`. Note A-1's fix text claims `deploy:` is "otherwise ignored by plain `docker compose`" — wrong on Compose v2, which honours `deploy.resources.limits` in non-Swarm mode, as `docker-compose.yml`'s own `rigging-worker` profile demonstrates.
- **A-3 ≡ A-11**, and both restate B-8's "nothing checks disk"; **A-10** is a fourth member of the same disk-exhaustion cluster.
- **A-35 ≡ B-5** — same two lines (`python_rigging_provider.py:160`, `skinned_glb_writer.py:339-340`), split into two findings with **conflicting fixes**: B-5 says temp+rename at the deterministic path, A-35 says make the path task-scoped. A-35 subsumes B-5; fix once. And **A-34's evidence contradicts both**, citing the same asset-id keying approvingly ("retries overwrite and `rigging-work/` is bounded").

### Additions the review missed

1. **A-5/A-4 gap:** `location /_next/static` (`default.conf:103-107`) declares its own `add_header`, so it drops all three server-level security headers — *and* `middleware.ts:54`'s matcher excludes `_next/static`. That location gets security headers from neither layer. Neither finding names it.
2. **A-40 is stronger than filed.** `V24__perf_indexes.sql:11-15` states the principle ("A redundant index is not free — it costs on every write") while asserting `follows.follower_id`'s index arrives automatically from the FK — false, since `uk_follows_pair`'s leftmost prefix already satisfies the constraint, which is exactly why `idx_follows_follower` is pure overhead.
3. **A-39 undercounts:** `V4:27` is also `created_at DATETIME`. Four columns, not three.
4. **A-23's mirror case:** `V7:8` makes `rigging_tasks.slot_hint` `ENUM('TOP','BOTTOM','DRESS')` — missing SHOES/ACCESSORY. The review names it but accepts `resolveSlotHint()` as sufficient, which is the "guard in code, not schema" posture it rejects for `garment_assets` in the same finding.

### Net

No advisory finding is fully refuted. One (A-19) has the wrong traced consequence; one (A-42) carries a fix that would cause an outage; four are over-rated (A-28, A-29, A-30, A-32); one is under-rated once payment is on but unreachable at Launch 1 (A-17). After de-duplication the list is **~36 distinct defects**, and the review's own caveat at line 25 — that the advisory list is lower-confidence by construction — is borne out by exactly one bad failure path and one bad fix in 42, which is a good rate for an unverified tier.

---

# Gaps named by the completeness critics

All 11 were reviewed. Listed here because the *reason* a gap was named is itself useful signal about where the review's own blind spots were.

- **[coverage] 3D/AR viewer render path and its unpinned third-party CDN dependencies** — This is the product's core differentiator and no area opened it. `web/components/ModelViewer.tsx` is the ONLY path to AR for every mobile user (iOS Quick Look and Android Scene Viewer, per the routing table in `SmartARViewer.tsx`), and it loads `@google/model-viewer` at runtime from `https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js` — a package that is NOT in `web/package.json`, injected with no `integrity`, no `crossorigin`, no `onerror` and no fallback. If Google's 
- **[coverage] Generated-asset storage has no retention, no quota and no monitoring, on the same filesystem as the database** — The only on-disk deletion in the entire production tree is `AvatarService.deleteAvatarFiles` (verified by searching for `Files.delete*`/`os.remove`/`rmtree` across the repo). Every 3D generation writes a NEW directory keyed by task id — `worker/providers/meshy_generator.py:266` builds `products/{product_id}/tasks/{task_id}/preview.glb` (+`preview.usdz`, +PBR maps when `WORKER_MESHY_ENABLE_PBR`) — so every regenerate and every retry adds multi-megabyte artifacts and nothing ever removes the super
- **[coverage] Body-scan GLB survives a privacy delete when a worker job is in flight** — `AvatarService.deleteAvatarData` (lines 201-242) documents the race deliberately: PENDING/RUNNING task rows are deleted so the worker's later UPDATE hits 0 rows and 'a completed in-flight task cannot resurrect user.avatarGlbUrl'. That reasoning covers the database and stops there. The worker writes the avatar GLB to `{WORKER_OUTPUT_DIR}/avatars/{userId}/avatar.glb` BEFORE calling `complete_task` (`worker/avatar_task_queue.py:57-76`, which logs the 0-row case as a warning and moves on), and `dele
- **[coverage] Analytics/KPI subsystem: client-trusted, unthrottled, silently lossy — and the INVEST/STOP decision gate reads it** — `POST /api/events` (`AnalyticsController:29`) appears in no area of the review and in no endpoint table in `server/CLAUDE.md`. It has no `RateLimitFilter` rule, so any authenticated account can write unbounded rows into `analytics_events` — two writes on the first event, since `record` calls `assignCohort`. The event `type`, `productId`, `sizeBracket` and `metadata` all come from the client with only `@NotBlank` on `type` (`TrackEventRequest`), while V14 declares `metadata JSON NULL` and `size_b
- **[launch] Production database seeds to an empty marketplace; no production content/designer-onboarding path exists** — server/src/main/java/com/iyae/config/DataSeeder.java is annotated @Profile({"dev", "test"}) (line 26) and deliberately does nothing under SPRING_PROFILES_ACTIVE=prod — confirmed in its own comment: an allow-list was chosen specifically so production seeds nothing. That means the very first production boot has 0 products, 0 designer profiles, 0 promotions. Nothing in the 16-area review (all code-correctness focused) asked 'what does a real visitor see on hour one' — an empty catalog, empty homepa
- **[launch] Email deliverability to real users is unvalidated at prod boot and failures are deliberately silent** — server/src/main/java/com/iyae/config/ProductionConfigValidator.java validates RESEND_MAIL_ENDPOINT (the internal route URL) and INTERNAL_MAIL_SECRET, but never checks RESEND_API_KEY (set on the web container, read in web/app/api/internal/mail/send/route.ts line 51 as `new Resend(process.env.RESEND_API_KEY)`) or RESEND_FROM_EMAIL. .env.example's own comment says the shipped default, onboarding@resend.dev, 'is a sandbox — can only deliver to your Resend account email.' If an operator deploys with 
- **[launch] Generated 3D assets accumulate on the shared volume forever; no retention, cleanup, or disk-usage alerting exists** — The assets_data Docker volume (docker-compose.prod.yml lines 72/107/160) backs WORKER_OUTPUT_DIR, which every model generation, avatar generation, and rigging attempt writes a new file into, keyed by task id or garment_asset id. server/src/main/java/com/iyae/service/ProductService.java's deleteProduct (lines 209-214) only calls productRepository.delete(product) — no file deletion. Of all the services, only AvatarService.deleteAvatarData (a user-initiated, authenticated action) calls Files.delete
- **[launch] prod_deploy.sh update's rollback reverts code but not the database; Flyway migrations are forward-only and auto-apply on boot** — prod_deploy.sh's update command (lines 330-363) does `git pull` -> rebuild -> `docker compose up -d` (which boots the server container, and Spring Boot's flyway-core auto-runs any new V{N} migration on startup per server/src/main/resources/application.yml's `spring.flyway` config) -> gate_readiness. If the gate fails, it runs `git reset --hard "$previous_rev"` and rebuilds — but this only reverts the git tree, not the database. All 24 migrations in server/src/main/resources/db/migration/ are for
- **[adversary] No verified-purchase gate or rate limit on product reviews — zero-cost review-bombing of a competitor designer** — The 16-area review covered authz/IDOR and rate-limit-abuse on chat, outfit-generation, checkout and UGC endpoints, but POST /api/products/{productId}/reviews was not named anywhere in the 50 findings. On a marketplace where designers compete for the same buyers, this is a direct 'destroy another tenant's business' lever: any authenticated BUYER account (self-registration just needs one verified email) can post a 1-star review with a 2000-char comment on ANY product — including a rival designer's
- **[adversary] Payment SDK pinned to an unbounded dynamic version (`26.+`) with no Gradle dependency locking** — This is a supply-chain / dependency-security gap (OWASP Top 10 #9) that falls outside all 16 named areas — money-orders reviewed the checkout/webhook business logic, not the build dependency that implements it. server/build.gradle.kts line 46 declares `implementation("com.stripe:stripe-java:26.+")` — every other dependency in that file (Spring Boot 3.4.1, jjwt 0.12.6, Lombok, Flyway, MySQL connector) is pinned to an exact version; Stripe's SDK is the one exception, resolved dynamically at every 
- **[adversary] Client-emitted analytics events are trusted at face value — any buyer can forge ORDER_PAID/CHECKOUT_INITIATED rows that feed the admin KPI and deploy-decision dashboards** — None of the 16 areas names the analytics ingestion path, and it sits squarely on a trust boundary the review didn't check: who is allowed to assert that money changed hands. POST /api/events (AnalyticsController.track) accepts any `EventType.valueOf(request.type())` from an authenticated caller — including ORDER_PAID and CHECKOUT_INITIATED, the same enum values CheckoutService.handleWebhook and initiateCheckout emit only after a real Stripe-verified payment — with an arbitrary client-supplied pr

---

# Per-area outcome (pass 1)

| Area | Verdict | Findings |
|---|---|---|
| `auth-identity` | CHANGES_REQUESTED | 1 |
| `authz-ownership` | CHANGES_REQUESTED | 1 |
| `money-orders` | CHANGES_REQUESTED | 2 |
| `privacy-assets` | CHANGES_REQUESTED | 2 |
| `task-queues` | APPROVE | 3 |
| `db-migrations` | CHANGES_REQUESTED | 5 |
| `server-java` | CHANGES_REQUESTED | 4 |
| `web-react` | CHANGES_REQUESTED | 2 |
| `web-ts` | CHANGES_REQUESTED | 4 |
| `worker-python` | CHANGES_REQUESTED | 3 |
| `infra-deploy` | CHANGES_REQUESTED | 5 |
| `silent-failures` | CHANGES_REQUESTED | 3 |
| `test-integrity` | CHANGES_REQUESTED | 7 |
| `rate-limit-abuse` | CHANGES_REQUESTED | 2 |
| `observability-ops` | CHANGES_REQUESTED | 3 |
| `perf-scale` | APPROVE | 3 |

