// Web-side mirror of the server's `app.auth.require-email-verification` gate.
//
// The server (prod) rejects an unverified account's JWT, so authenticating such a
// user on the client only produces a 401 bounce on the first protected call. This
// module centralises the flag + the post-registration redirect decision so the
// register page and the auth context share one source of truth.
//
// NOTE: `NEXT_PUBLIC_*` is inlined into the client bundle at BUILD time — it is a
// deploy-time value, not runtime-configurable. Read it through the function below
// (not a top-level const) so tests can override it per-case with `vi.stubEnv`.

/** True when the deployment requires verified email before authenticating (prod). */
export function requireEmailVerification(): boolean {
  return process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION === "true";
}

/**
 * True when the just-registered user should be parked on the verify-email page
 * instead of being authenticated (gate on AND email not yet verified).
 */
export function isVerificationPending(user: { emailVerified: boolean }): boolean {
  return requireEmailVerification() && !user.emailVerified;
}

/** Post-registration destination: the pending page when verification is required, else the dashboard. */
export function resolvePostRegisterRedirect(user: { emailVerified: boolean; email: string }): string {
  return isVerificationPending(user)
    ? `/verify-email/pending?email=${encodeURIComponent(user.email)}`
    : "/dashboard";
}
