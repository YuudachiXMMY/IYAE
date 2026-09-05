# Implementation Report: Rebrand & Foundation (Clossette → IYAE)

## Summary
Executed the mechanical, cross-stack rebrand of the Clossette codebase to **IYAE** plus the CAD single-source-of-truth currency fix and dead-config removal, per `.claude/PRPs/plans/rebrand-and-foundation.plan.md` (PRD Phase 1). ~288 files changed in one atomic relaunch commit. The deterministic renames and content-only literal swaps were applied and verified where a toolchain was available (web fully; worker syntax). Two Java **structural** refactors (BrandConfig DI centralization, email Option-A consolidation) and full **server test execution** were **deferred** because this environment has **no Java runtime** — applying un-compilable Java surgery blind would violate the plan's "never accumulate broken state" rule.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | XL | XL (as predicted; mechanical bulk) |
| Confidence | 8/10 single-pass | ~7/10 delivered — high for verified surfaces, gated by no-JDK |
| Files Changed | ~300 | 288 (1 delete + 67 modified + 220 renamed) |

## Environment Constraint (root cause of all deviations)
- **No Java runtime** (`java`/`javac` are the macOS stubs; no JDK in `/Library/Java`, SDKMAN, or brew cache; `brew install openjdk@22` failed, exit 2). → Cannot compile the server or run the 338 JUnit tests.
- **Web**: Node 22 present; `npm ci` succeeded → web fully validated.
- **Worker**: Python 3.12 present; heavy ML deps (torch/libigl) not installed → `pytest` not run; `py_compile` used instead (changes are string-only).

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | CAD single source of truth | ✅ Complete | ProductService default USD→CAD; 36 DataSeeder products; ProductServiceTest+TestProducts; 8 web formatters en-US/USD→en-CA/CAD (date formatters + USDZ untouched); ProductForm "Price (CAD)" label. Web-verified. |
| 2 | Asset path /var/clossette → /var/iyae | ✅ Complete | All code + compose + nginx + worker (incl. leaking `smplx model_path`); 7 worker test assertions in lockstep. Skipped the *optional* FileStorageService @Value refactor (did literal swap) — needs JDK. |
| 3 | DB relaunch + infra names | ✅ Complete | DB/user, datasource defaults, network iyae-net, container iyae-mailpit, traefik iyae-*, dev.sh backup/restore. |
| 4 | Domain / SSL / nginx / CORS / sender | ✅ Complete | iyae.ca / iyae.localhost / cert-name iyae; fixed the noreply@clossette**.com** vs **.ca** drift → noreply@iyae.ca. |
| 5 | BrandConfig + brand strings + dead config | ⚠️ Partial | Brand **literal swaps** applied (server/web/worker/docs) + `tailwind.config.ts` deleted + `components.json` fixed. **Deferred**: BrandProperties DI + web `lib/brand.ts` centralization (needs JDK to verify DI wiring). |
| 6 | Email consolidation (Option A) | ⚠️ Partial | Email **copy rebranded** (Java + web templates + subjects). **Deferred**: structural consolidation (delete Java `buildEmailHtml`, drop SMTP, delete legacy web route, rewrite `AuthMailServiceTest`) — needs JDK. Email still dual-path but branded. |
| 7 | DataSeeder + fresh-relaunch seed | ✅ Complete | Seed emails @clossette.com → @iyae.ca; currency CAD. V4 UPDATE is a no-op on fresh DB (left per plan). |
| 8 | Java package rename (LAST) | ✅ Complete | 220 files git-mv'd (history preserved); 0 `com.clossette` residue; class + gradle coords renamed. **Compilation unverified (no JDK).** |
| 9 | Full-stack smoke + docs sync | ⚠️ Partial | Web build green; docs synced (CLAUDE.md ×4, README, DESIGN, PRD, CODEMAPS). Docker relaunch smoke + server tests not run (no JDK/Docker). |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (web) | ✅ Pass | `tsc --noEmit`: 0 errors in changed app files. (2 pre-existing errors in `useGenerationStatus.test.ts` + `checkout-flow.spec.ts` — unrelated, not touched.) |
| Static Analysis (worker) | ✅ Pass | `py_compile` clean on all worker `.py`. |
| Static Analysis (server) | ⛔ Not run | No JDK. |
| Unit Tests (web) | ✅ Pass | vitest **214/227 pass, 0 failures**. 13 un-run = 1 pre-existing OOM-crashing file (`useOutfitRiggingStatus.test.ts`, untouched; crashes standalone). Changed tests (internal-mail ×2, cart-context) re-run isolated: **26/26 pass**. |
| Unit Tests (worker) | ⚠️ Not run | No ML deps. Asset-path assertions grep-verified in lockstep. |
| Unit Tests (server) | ⛔ Not run | No JDK (338 tests unverified). |
| Build (web) | ✅ Pass | `next build` exit 0 — all routes compile; confirms `tailwind.config.ts` delete is safe. |
| Integration / Docker relaunch | ⛔ Not run | No Docker/JDK in env. |
| Residue gate | ✅ Pass | `com.clossette`=0, `/var/clossette`=0, infra clossette=0, `"USD"`(server)=0, rendered Clossette=0 (only intentional `clossette:profile-surface-*` events + `clossette_*` keys + picsum seeds remain, per plan). |

## Files Changed
288 total: **1 deleted** (`web/tailwind.config.ts`), **67 modified**, **220 renamed** (Java package tree). See commit `78db15d`.

## Deviations from Plan
1. **BrandConfig centralization deferred** (Surface F) — WHAT: did literal `Clossette→IYAE` swaps instead of creating `BrandProperties.java` + DI wiring + `web/lib/brand.ts`. WHY: DI wiring across 5 services can't be compile-verified without a JDK; shipping it blind risks broken state. The user-facing rebrand is fully delivered.
2. **Email consolidation deferred** (Surface G, Option A) — WHAT: rebranded email copy but kept the dual Java-HTML + web-Resend paths. WHY: deleting Java methods/fields/imports, removing `spring-boot-starter-mail`, and rewriting the 8 SMTP-based `AuthMailServiceTest` cases to HTTP assertions is high-risk Java surgery that needs compilation to trust.
3. **FileStorageService @Value refactor skipped** (optional in plan) — did the literal path swap only.
4. **Optional raw-`$` outfit-page formatters** — left as-is (bare `$` doubles as CAD symbol; low priority).
5. **docs/huly/* + review_results.json** not rebranded — external-tool historical archives / stale artifact, out of Phase-1 scope.

## Issues Encountered
- **Asset-path sed initially rewrote `/var/clossette/` inside the plan/PRD docs** → restored both docs from HEAD; all later seds exclude `.claude/`.
- **zsh word-splitting**: `for f in $INFRA` (unquoted string) iterated once; fixed by using a zsh array. Re-verified.
- **No JDK / brew openjdk install failed** → server verification gap (documented above).
- **vitest worker OOM** in `useOutfitRiggingStatus.test.ts` — pre-existing (crashes standalone, untouched by this change).

## Tests Written
None — this is a rebrand refactor. Existing test **assertions** were updated in lockstep (ProductServiceTest, TestProducts, AuthMailServiceTest, Health tests, internal-mail ×2, e2e register/auth) so the regression net still pins the new values.

## Next Steps
- [ ] **On a machine with JDK 22**: `cd server && ./gradlew test` to verify the package rename + literal swaps compile and the 338 tests pass. (Expected green — changes are complete-rename + content-only.)
- [ ] **Complete the two deferred Java refactors** (with JDK): BrandProperties DI centralization; email Option-A consolidation + AuthMailServiceTest rewrite.
- [ ] `cd worker && pip install -r requirements.txt && pytest` to confirm the 7 asset-path assertions.
- [ ] `./dev.sh reset && ./dev.sh start` for the Docker relaunch smoke (DB `iyae`, assets under `/var/iyae`, CAD checkout, IYAE emails).
- [ ] Code review via `/code-review`; then mark PRD Phase 1 complete once server is verified.
