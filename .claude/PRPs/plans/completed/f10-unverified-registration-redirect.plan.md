# Plan: F10 — Route unverified registrants to a "check your email" page (prod)

## Summary
The server (PR #32) correctly makes an unverified user's JWT inert when `app.auth.require-email-verification=true` (prod default), but the web never got the matching change: after `register()` the app still `router.push("/dashboard")`, whose protected calls 401 → `api.ts` wipes the token and hard-redirects to `/login`, where an unverified user cannot sign in. This plan makes the web mirror the server gate: in prod, a freshly-registered unverified user is sent to a new `/verify-email/pending` page (with a Resend button) and is **not** authenticated on the client, so no 401 bounce ever happens. Dev (gate off) behavior is unchanged.

## User Story
As a newly-registered shopper whose email isn't verified yet (in production),
I want to land on a clear "check your inbox" screen with a way to resend the link,
So that I'm not silently bounced to a login page I can't use until I verify.

## Problem → Solution
**Current (prod):** register → `router.push("/dashboard")` → dashboard fires protected calls (incl. the new F14 `follows.counts(user.id)`) → first `401` → `api.ts` clears `clossette_token` + `window.location.href = "/login"` → unverified user can't log in (`EmailNotVerifiedException`). Confusing dead-end.
**Desired (prod):** register → detect unverified + gate-on → do NOT store the (inert) token or set client auth state → `router.push("/verify-email/pending?email=…")` → page shows "we emailed you a link" + Resend. **Dev (gate off):** unchanged — store token, `setUser`, go to `/dashboard`.

## Metadata
- **Complexity**: Medium (web-only; 2 new files + 4 edits + 2 tests; no server, no migrations)
- **Source PRD**: N/A — follow-up to code review of PR #32 (`.claude/reviews/pr-32-review.md`, finding F10)
- **PRD Phase**: N/A
- **Estimated Files**: 6 source + 2 test

---

## UX Design

### Before (prod, unverified)
```
Register wizard ── submit ──▶ /dashboard
                                  │  (protected fetch: follows.counts, orders…)
                                  ▼
                             HTTP 401 ──▶ api.ts clears token ──▶ /login
                                  │
                                  ▼
                    "Please verify your email before signing in"  ← dead end
```

### After (prod, unverified)
```
Register wizard ── submit ──▶ /verify-email/pending?email=user@x.com
                                  │  (no token stored, no auth state, no protected calls)
                                  ▼
                 ┌───────────────────────────────────────────┐
                 │  Check your inbox                          │
                 │  We sent a verification link to            │
                 │  user@x.com. Click it to activate your     │
                 │  account.                                  │
                 │                                            │
                 │  [ Resend email ]      Already verified?   │
                 │                        [ Sign in ]         │
                 └───────────────────────────────────────────┘
```
(Dev, gate off: submit ──▶ /dashboard, exactly as today.)

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| Register submit (prod, unverified) | `/dashboard` → 401 → `/login` | `/verify-email/pending` | Gated on `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` |
| Register submit (dev / gate off) | `/dashboard` | `/dashboard` | **Unchanged** |
| Client auth state after register (prod, unverified) | token stored + `setUser` (both useless) | **not** stored, user stays `null` | Prevents AuthProvider `/me` 401 bounce on refresh |
| New page `/verify-email/pending` | — | New | Resend link via `/api/auth/resend-verification` |

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `web/lib/auth-context.tsx` | 44-75 | `register()` stores token + `setUser`; mount effect calls `/api/auth/me`. This is where the prod skip-storage branch goes. |
| P0 | `web/app/register/page.tsx` | 36-45, 78-103 | `useRedirectIfAuthenticated()` + `handleSubmit`'s hard `router.push("/dashboard")` — the redirect site to change. |
| P0 | `web/lib/hooks/useRedirectIfAuthenticated.ts` | all | **Gotcha**: on `user` becoming set it `router.replace("/dashboard")`. The prod fix relies on NOT setting `user`, so this hook never fires for the pending path (no race). |
| P0 | `web/lib/api.ts` | 39-45, 165-170 | 401 handler (`window.location.href="/login"`); the `auth` client object to extend with `resendVerification`. |
| P1 | `web/app/verify-email/page.tsx` | all | Structural + style template for the new pending page (Card + `Suspense` + `useSearchParams` + `sonner` toast). |
| P1 | `web/__tests__/lib/auth-context.test.tsx` | all | Register test patterns; confirms default (gate-off) behavior must stay green. |
| P2 | `server/src/main/java/com/iyae/controller/AuthController.java` | 38-40 | `POST /api/auth/resend-verification` takes `{ email }` → `MessageResponse`. permitAll in `SecurityConfig`. |
| P2 | `server/src/main/resources/application.yml` / `application-dev.yml` | 52 / 7 | Server flag: prod `true`, dev `false`. The web env var must mirror this. |
| P2 | `.env.example` | — | Add `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION`. |

## External Documentation
No external research needed — feature uses established internal patterns (Next.js client pages, `process.env.NEXT_PUBLIC_*`, existing `auth` API client, `sonner` toasts).

---

## Patterns to Mirror

### NEXT_PUBLIC env read (build-time inlined)
```ts
// SOURCE: web/lib/api.ts:1
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
```

### auth API client entry
```ts
// SOURCE: web/lib/api.ts:165-170
export const auth = {
  register: (data: RegisterRequest) => api.post<{ token: string; user: UserResponse }>("/api/auth/register", data),
  login: (email: string, password: string) => api.post<{ token: string; user: UserResponse }>("/api/auth/login", { email, password }),
  me: () => api.get<UserResponse>("/api/auth/me"),
  updateProfile: (data: UpdateProfileRequest) => api.put<UserResponse>("/api/auth/me", data),
};
```

### Client page: Card + Suspense + useSearchParams + toast (template for the pending page)
```tsx
// SOURCE: web/app/verify-email/page.tsx (VerifyEmailContent + default export)
"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
// ... reads searchParams.get(...), api.post(...).then(toast.success).catch(ApiError→toast.error)
export default function Page() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brand" /></div>}><Content /></Suspense>;
}
```

### auth-context register (current — to be extended)
```ts
// SOURCE: web/lib/auth-context.tsx:69-73
const register = useCallback(async (data: RegisterRequest) => {
  const res = await api.post<{ token: string; user: User }>("/api/auth/register", data);
  localStorage.setItem("clossette_token", res.token);
  setUser(res.user);
}, []);
```

### Register submit redirect (current — to be changed)
```tsx
// SOURCE: web/app/register/page.tsx:91-92
await register({ email, password, role, ...optionalFields } as RegisterRequest);
router.push("/dashboard");
```

### vitest structure (auth-context test)
```tsx
// SOURCE: web/__tests__/lib/auth-context.test.tsx
// mocks @/lib/api (api.post/get/put), renders a consumer, fireEvent, await waitFor(expect(...))
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `web/lib/auth-config.ts` | CREATE | Single source of truth for the gate flag + redirect resolver (pure, testable) |
| `web/app/verify-email/pending/page.tsx` | CREATE | New "check your inbox" landing with Resend |
| `web/lib/auth-context.tsx` | UPDATE | `register()` returns `User`; skips token/`setUser` when gate-on + unverified |
| `web/app/register/page.tsx` | UPDATE | Use the resolver for the post-register redirect (dashboard vs pending) |
| `web/lib/api.ts` | UPDATE | Add `auth.resendVerification(email)` |
| `.env.example` | UPDATE | Document `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` |
| `web/__tests__/lib/auth-config.test.ts` | CREATE | Unit-test the pure resolver (gate on/off × verified/unverified) |
| `web/__tests__/app/verify-email-pending.test.tsx` | CREATE | Renders email, Resend calls `auth.resendVerification` |

## NOT Building
- **Server changes** — the gate is already correct (PR #32). This is web-only.
- **Login-page "resend verification" affordance** — nice-to-have; the login page already surfaces the `EmailNotVerifiedException` message. Track separately.
- **Reworking `api.ts`'s global 401 → `/login` behavior** — the skip-storage approach makes it unnecessary for this flow; a broader "soft 401" redesign is out of scope.
- **A server-exposed `/config` endpoint** to advertise the flag — rejected in favor of the established `NEXT_PUBLIC_*` env pattern (no extra round-trip). See Risks for the coupling note.
- **E2E for the prod path** — Playwright runs against dev (gate off), so the prod branch can't be exercised there; covered by unit tests instead.

---

## Step-by-Step Tasks

### Task 1: Create the gate helper + redirect resolver
- **ACTION**: New pure module `web/lib/auth-config.ts`.
- **IMPLEMENT**:
  ```ts
  // Mirrors the server's app.auth.require-email-verification. Prod sets this to "true";
  // unset/absent (dev) → false, preserving today's straight-to-dashboard flow.
  export function requireEmailVerification(): boolean {
    return process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION === "true";
  }

  /** True when the just-registered user should be parked on the verify-email page
   *  instead of being authenticated (gate on AND email not yet verified). */
  export function isVerificationPending(user: { emailVerified: boolean }): boolean {
    return requireEmailVerification() && !user.emailVerified;
  }

  /** Post-registration destination. */
  export function resolvePostRegisterRedirect(user: { emailVerified: boolean; email: string }): string {
    return isVerificationPending(user)
      ? `/verify-email/pending?email=${encodeURIComponent(user.email)}`
      : "/dashboard";
  }
  ```
- **MIRROR**: `process.env.NEXT_PUBLIC_*` read from `web/lib/api.ts:1`.
- **IMPORTS**: none.
- **GOTCHA**: `process.env.NEXT_PUBLIC_*` is **inlined at build time** in the client bundle — it's not runtime-configurable. That's fine (deploy-time value). For tests, read it via the function (so `vi.stubEnv` works per-test) rather than a top-level `const`.
- **VALIDATE**: `npx tsc --noEmit`; unit tests in Task 7.

### Task 2: `register()` returns the user and skips client auth when verification is pending
- **ACTION**: Update `web/lib/auth-context.tsx`.
- **IMPLEMENT**:
  - Change the context type `register: (data: RegisterRequest) => Promise<void>` → `Promise<User>`.
  - Body:
    ```ts
    import { isVerificationPending } from "./auth-config";
    // ...
    const register = useCallback(async (data: RegisterRequest): Promise<User> => {
      const res = await api.post<{ token: string; user: User }>("/api/auth/register", data);
      // In prod the server rejects an unverified account's token, so storing it only
      // triggers a 401 bounce on the first protected call. Skip client auth entirely and
      // let the page route to the verify-email page. Dev (gate off) behaves as before.
      if (!isVerificationPending(res.user)) {
        localStorage.setItem("clossette_token", res.token);
        setUser(res.user);
      }
      return res.user;
    }, []);
    ```
- **MIRROR**: current `register` at `web/lib/auth-context.tsx:69-73`.
- **IMPORTS**: `import { isVerificationPending } from "./auth-config";`
- **GOTCHA**: Callers currently `await register(...)` and ignore the return — widening to `Promise<User>` is backward-compatible. Do **not** touch `login()` (verified users only reach it; server blocks unverified logins). Existing `auth-context.test.tsx` runs with the env unset (gate off) so the storage/`setUser` path is unchanged and stays green.
- **VALIDATE**: `npm run test -- auth-context`; `npx tsc --noEmit`.

### Task 3: Register page routes via the resolver
- **ACTION**: Update `web/app/register/page.tsx` `handleSubmit`.
- **IMPLEMENT**:
  ```ts
  import { resolvePostRegisterRedirect } from "@/lib/auth-config";
  // ...in handleSubmit, replace `router.push("/dashboard")`:
  const registeredUser = await register({ email, password, role, ...optionalFields } as RegisterRequest);
  router.push(resolvePostRegisterRedirect(registeredUser));
  ```
- **MIRROR**: existing try/catch + `ApiError` handling already in `handleSubmit` (unchanged).
- **IMPORTS**: `resolvePostRegisterRedirect` from `@/lib/auth-config`.
- **GOTCHA**: `useRedirectIfAuthenticated()` (default `/dashboard`) fires on `user` becoming set. For the **pending** path we deliberately did NOT `setUser` (Task 2), so `user` stays `null`, the hook never redirects, and `handleSubmit`'s push wins — no race. For the **dashboard** path `setUser` ran, so both the hook and the push target `/dashboard` (same as today). Leave `useRedirectIfAuthenticated()` as-is.
- **VALIDATE**: manual dev run (gate off) → still lands on `/dashboard`; typecheck.

### Task 4: Add the `resendVerification` API client
- **ACTION**: Extend the `auth` object in `web/lib/api.ts`.
- **IMPLEMENT**:
  ```ts
  // in export const auth = { ... }
  resendVerification: (email: string) =>
    api.post<{ message: string }>("/api/auth/resend-verification", { email }),
  ```
- **MIRROR**: sibling entries at `web/lib/api.ts:165-170`.
- **IMPORTS**: none.
- **GOTCHA**: Endpoint is `permitAll` (no token needed) and returns `MessageResponse` (`{ message }`). The server always responds generically (enumeration-safe), so treat any 2xx as success.
- **VALIDATE**: typecheck; used by Task 5.

### Task 5: Create the `/verify-email/pending` page
- **ACTION**: New file `web/app/verify-email/pending/page.tsx`.
- **IMPLEMENT**: Mirror `web/app/verify-email/page.tsx`'s Card + `Suspense` shell. Content:
  - Read `const email = useSearchParams().get("email") ?? ""`.
  - Icon `MailCheck` (lucide-react), title "Check your inbox", body "We sent a verification link to **{email}**. Click it to activate your account."
  - `[ Resend email ]` `Button` → `const [sending, setSending] = useState(false)`; on click `setSending(true); auth.resendVerification(email).then(() => toast.success("Verification email sent")).catch((e) => toast.error(e instanceof ApiError ? e.message : "Couldn't resend right now")).finally(() => setSending(false));` Disable while `sending` or when `!email`.
  - Footer: "Already verified?" → `<Link href="/login">Sign in</Link>`.
  - Wrap default export in `<Suspense fallback={…}>` (required because `useSearchParams` needs a Suspense boundary in Next.js 16 — same as `verify-email/page.tsx`).
- **MIRROR**: `web/app/verify-email/page.tsx` (Card, Suspense, toast, `ApiError` catch), `Button` from `@/components/ui/button`, `Link` from `next/link`.
- **IMPORTS**: `Suspense, useState` (react); `useSearchParams` (next/navigation); `Link` (next/link); `toast` (sonner); `MailCheck, Loader2` (lucide-react); `Card, CardContent, CardHeader, CardTitle` (`@/components/ui/card`); `Button` (`@/components/ui/button`); `auth, ApiError` (`@/lib/api`).
- **GOTCHA**: Do NOT read auth state here — the page must work with no token (that's the whole point of skip-storage). Use only the `email` query param. Use semantic color tokens (`text-foreground`, `text-muted-foreground`, `text-brand`) per repo convention — no hardcoded `stone-*`/`bg-white`.
- **VALIDATE**: manual: visit `/verify-email/pending?email=a@b.com`, click Resend → toast; typecheck + lint.

### Task 6: Document the env var
- **ACTION**: Add to `.env.example` (and the prod deploy env docs / `CLAUDE.md` env table in a follow-up doc-sync).
- **IMPLEMENT**:
  ```
  # Web: mirror of server app.auth.require-email-verification. Set to "true" in production so the
  # web sends unverified registrants to /verify-email/pending instead of the dashboard. Leave unset
  # (or "false") in dev, where the server gate is off.
  NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=false
  ```
- **MIRROR**: existing `NEXT_PUBLIC_*` entries in `.env.example`.
- **GOTCHA**: Must be kept in sync with the server's `app.auth.require-email-verification` per environment (see Risks). It's build-time inlined, so the web image must be rebuilt (not just restarted) when this changes.
- **VALIDATE**: n/a (doc).

### Task 7: Tests
- **ACTION**: Add unit tests.
- **IMPLEMENT**:
  - `web/__tests__/lib/auth-config.test.ts`:
    ```ts
    import { describe, it, expect, afterEach, vi } from "vitest";
    import { resolvePostRegisterRedirect, requireEmailVerification } from "@/lib/auth-config";
    afterEach(() => vi.unstubAllEnvs());
    it("gate off → dashboard even if unverified", () => {
      vi.stubEnv("NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION", "false");
      expect(resolvePostRegisterRedirect({ emailVerified: false, email: "a@b.com" })).toBe("/dashboard");
    });
    it("gate on + unverified → pending with encoded email", () => {
      vi.stubEnv("NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION", "true");
      expect(resolvePostRegisterRedirect({ emailVerified: false, email: "a+x@b.com" }))
        .toBe("/verify-email/pending?email=a%2Bx%40b.com");
    });
    it("gate on + verified → dashboard", () => {
      vi.stubEnv("NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION", "true");
      expect(resolvePostRegisterRedirect({ emailVerified: true, email: "a@b.com" })).toBe("/dashboard");
    });
    ```
  - `web/__tests__/app/verify-email-pending.test.tsx`: mock `@/lib/api` (`auth.resendVerification` → resolved), mock `next/navigation` `useSearchParams` → `{ get: () => "a@b.com" }`, render the page, assert the email text is shown, click "Resend" → `expect(auth.resendVerification).toHaveBeenCalledWith("a@b.com")`.
- **MIRROR**: `web/__tests__/lib/auth-context.test.tsx` (api mock), `web/__tests__/lib/pose-config.test.ts` (pure-fn tests) style.
- **GOTCHA**: `vi.stubEnv` requires reading the env through `requireEmailVerification()` at call time (Task 1 already does). Vitest reads `NEXT_PUBLIC_*` from `process.env` at runtime in jsdom (not Next's build inliner), so stubbing works.
- **VALIDATE**: `npm run test`.

---

## Testing Strategy

### Unit Tests
| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| resolver gate-off | `{emailVerified:false}`, env unset | `/dashboard` | dev default |
| resolver gate-on unverified | `{emailVerified:false,email:"a+x@b.com"}`, env `"true"` | `/verify-email/pending?email=a%2Bx%40b.com` | email encoding |
| resolver gate-on verified | `{emailVerified:true}`, env `"true"` | `/dashboard` | verified-in-prod |
| register skips auth when pending | env `"true"`, register → unverified user | no `setItem`, no `setUser`, returns user | prod path |
| register stores when not pending | env unset, register | `setItem` + `setUser` (as today) | regression guard |
| pending page renders + resend | `?email=a@b.com` | shows email; Resend → `auth.resendVerification("a@b.com")` | — |

### Edge Cases Checklist
- [x] Email with `+`/`@` correctly URL-encoded in the redirect
- [x] Missing `?email=` on pending page → Resend disabled (empty email)
- [x] Gate off (dev) — zero behavior change (regression guard test)
- [x] Verified user in prod (e.g. re-register edge) → dashboard, not pending
- [ ] Resend endpoint failure → toast.error, no crash
- [ ] Refresh of `/verify-email/pending` with no token → page still renders (no AuthProvider `/me` 401 bounce, because no token was stored)

---

## Validation Commands

### Static Analysis
```bash
cd web && npx tsc --noEmit && npm run lint
```
EXPECT: Zero type/lint errors.

### Unit Tests
```bash
cd web && npm run test
```
EXPECT: All pass (306 existing + new auth-config/pending tests; auth-context regression tests still green).

### Browser Validation (dev, gate off — must be unchanged)
```bash
cd web && npm run dev   # NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION unset
```
EXPECT: Complete the register wizard → lands on `/dashboard` exactly as before.

### Browser Validation (simulate prod gate)
```bash
cd web && NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=true npm run dev
```
EXPECT: Register → lands on `/verify-email/pending?email=…` showing the address + Resend; no bounce to `/login`; refreshing the page keeps you there.

### Manual Validation
- [ ] Dev (gate off): register → `/dashboard`, still authenticated.
- [ ] Gate on: register → pending page; no token in `localStorage` (`clossette_token` absent); Resend shows a success toast.
- [ ] Gate on: from pending page, click "Sign in" → `/login`; after clicking the real email link (`/verify-email?token=…`) → verified → can log in.

---

## Acceptance Criteria
- [ ] Register in prod (gate on) with an unverified account lands on `/verify-email/pending`, never `/dashboard`→`/login`.
- [ ] Dev (gate off) register flow is byte-for-byte unchanged (→ `/dashboard`, authenticated).
- [ ] No client token is stored for an unverified-in-prod registrant (no AuthProvider `/me` 401 bounce).
- [ ] Resend button calls `POST /api/auth/resend-verification` with the email and toasts.
- [ ] All validation commands pass; no type/lint errors.

## Completion Checklist
- [ ] Redirect logic lives in one pure module (`auth-config.ts`), reused by page + context.
- [ ] `NEXT_PUBLIC_*` read pattern matches `api.ts`.
- [ ] New page mirrors `verify-email/page.tsx` (Card/Suspense/toast/semantic tokens).
- [ ] `register()` return-type widening is backward compatible; existing tests green.
- [ ] `.env.example` documents the new var + the sync-with-server caveat.
- [ ] No hardcoded colors; Suspense boundary around `useSearchParams`.

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Env drift: `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION` not set to `true` in prod while the server gate is on | Med | Med | Document in `.env.example` + prod deploy checklist; the failure mode is the *current* bug (no regression), so it's fail-safe, not fail-dangerous |
| `register()` return-type change ripples to other callers | Low | Low | Only `register/page.tsx` consumes it; widening `void`→`User` is compatible with `await`-and-ignore |
| Pending page refresh still bounces if a token somehow exists | Low | Low | Skip-storage guarantees no token for this path; if a stale token exists AuthProvider clears it on `/me` 401 (pre-existing behavior) |
| `useSearchParams` without Suspense → Next 16 build error | Low | Med | Wrap default export in `<Suspense>` exactly like `verify-email/page.tsx` |
| Build-time env inlining surprises (changing the var needs a rebuild, not a restart) | Med | Low | Note in `.env.example`; standard Next.js `NEXT_PUBLIC_*` behavior |

## Notes
- **Why skip client auth instead of just changing the redirect?** If we merely `router.push("/verify-email/pending")` but still `setUser`+store the token, two problems remain: (1) `useRedirectIfAuthenticated()` races our push and can send the user to `/dashboard`; (2) any later `AuthProvider` remount (page refresh) calls `/api/auth/me` → 401 → `api.ts` hard-redirects to `/login`. Not authenticating the client for unverified-in-prod registrants removes both, and the token was inert anyway.
- The server side (F10 in PR #32) is already correct and unchanged by this plan.
- Token localStorage key is `clossette_token` (pre-existing naming drift vs. the `iyae_*` the docs imply) — don't "fix" it here.
- Follow-up (separate): add a "resend verification" affordance on `/login` for users who bounce there, and a `CLAUDE.md` env-table entry for the new var.
