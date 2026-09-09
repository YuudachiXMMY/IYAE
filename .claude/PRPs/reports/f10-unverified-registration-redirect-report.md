# Implementation Report: F10 — Route unverified registrants to a "check your email" page (prod)

## Summary
Implemented the web-side mirror of the server's `app.auth.require-email-verification` gate. In production (gate on), a freshly-registered unverified user is no longer authenticated on the client and is routed to a new `/verify-email/pending` page (with a Resend button) instead of `/dashboard`. This removes the `register → dashboard → 401 → /login` dead-end. Dev (gate off) behavior is byte-for-byte unchanged.

## Assessment vs Reality

| Metric | Predicted (Plan) | Actual |
|---|---|---|
| Complexity | Medium | Medium (as predicted) |
| Confidence | 8/10 | Single-pass — only deviation was a test-mock hoisting fix |
| Files Changed | 6 source + 2 test | 6 source + 2 test (exact) |

## Tasks Completed

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Create `auth-config.ts` gate helper + resolver | Complete | Pure module, no imports |
| 2 | `register()` returns `User`, skips auth when pending | Complete | Widened `Promise<void>`→`Promise<User>` |
| 3 | Register page routes via resolver | Complete | Replaced hard `router.push("/dashboard")` |
| 4 | Add `auth.resendVerification` API client | Complete | Endpoint confirmed permitAll + rate-limited |
| 5 | Create `/verify-email/pending` page | Complete | Mirrors `verify-email/page.tsx` (Card/Suspense/toast) |
| 6 | Document env var in `.env.example` | Complete | With build-time-inline + sync-with-server caveat |
| 7 | Tests (auth-config + pending page) | Complete | Deviated — see below |

## Validation Results

| Level | Status | Notes |
|---|---|---|
| Static Analysis (tsc) | Pass | `tsc --noEmit` clean (exit 0) |
| Lint | Pass (no new errors) | Only pre-existing baseline error at `auth-context.tsx:53` (untouched mount effect, `react-hooks/set-state-in-effect`); my new files produce zero lint errors |
| Unit Tests | Pass | 316/316 (33 files); +12 new cases, existing auth-context register regression tests green |
| Build | Pass | `next build` exit 0; `/verify-email/pending` emitted as a static route |
| Integration | N/A | Prod gate path not exercisable under dev E2E (documented in plan) |
| Edge Cases | Pass | Email URL-encoding, missing-email disables Resend, gate-off regression |

## Files Changed

| File | Action | Lines |
|---|---|---|
| `web/lib/auth-config.ts` | CREATED | +30 |
| `web/app/verify-email/pending/page.tsx` | CREATED | +90 |
| `web/lib/auth-context.tsx` | UPDATED | +9 / -3 |
| `web/app/register/page.tsx` | UPDATED | +4 / -1 |
| `web/lib/api.ts` | UPDATED | +3 |
| `.env.example` | UPDATED | +9 |
| `web/__tests__/lib/auth-config.test.ts` | CREATED | +77 |
| `web/__tests__/app/verify-email-pending.test.tsx` | CREATED | +65 |

## Deviations from Plan
- **Test mocking (Task 7)**: The pending-page test's `vi.mock` factories reference shared mock fns; plain top-level `const`s failed with "Cannot access 'mockToast' before initialization" (vi.mock hoisting). Switched to `vi.hoisted(() => ({ ... }))` to create the mocks above the hoisted factories. Behavior/coverage unchanged; this is the robust vitest idiom.

## Issues Encountered
- **Fresh worktree had no `web/node_modules`** — ran `npm install` (known worktree setup step). Resolved.
- Nothing else; implementation matched the plan.

## Tests Written

| Test File | Tests | Coverage |
|---|---|---|
| `__tests__/lib/auth-config.test.ts` | 9 | `requireEmailVerification` / `isVerificationPending` / `resolvePostRegisterRedirect` across gate on/off × verified/unverified + email encoding |
| `__tests__/app/verify-email-pending.test.tsx` | 3 | Renders email from query param, Resend calls `auth.resendVerification`, empty email disables Resend |

## Next Steps
- [x] Code changes committed to worktree branch
- [ ] Draft PR #33 updated with implementation (was plan-only)
- [ ] Follow-up (separate): `/login` "resend verification" affordance; `CLAUDE.md` env-table entry for `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION`
