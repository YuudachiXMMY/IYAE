// Web-side view of the server's `app.auth.require-email-verification` gate.
//
// The server (prod) rejects an unverified account's JWT, so authenticating such a user on the
// client only produces a bounce on the first protected call. This module centralises the
// post-registration redirect decision so the register page and the auth context share one
// source of truth.
//
// The flag is read from the server at RUNTIME (`GET /api/public/config`), not from a
// `NEXT_PUBLIC_*` build-time variable. The build-time version was unreachable in production:
// `web/Dockerfile` declared no build arg for it, so the inlined value was always the default
// and every new signup was bounced to a dashboard it could not use. Plumbing the build arg
// would have fixed that one instance and left two independently-configured booleans that must
// agree — so instead there is now only one, and it lives on the server that enforces it.

import { getPublicConfig } from "./public-config";

/** True when the deployment requires verified email before authenticating. */
export async function requireEmailVerification(): Promise<boolean> {
  try {
    return (await getPublicConfig()).requireEmailVerification;
  } catch {
    // Fail closed. If we cannot tell, assume verification IS required: parking the user on the
    // "check your inbox" page is recoverable, whereas authenticating them optimistically lands
    // them on a dashboard where every call fails with no explanation.
    return true;
  }
}

/**
 * True when the just-registered user should be parked on the verify-email page instead of being
 * authenticated (gate on AND email not yet verified).
 */
export async function isVerificationPending(user: { emailVerified: boolean }): Promise<boolean> {
  if (user.emailVerified) return false;
  return requireEmailVerification();
}

/** Post-registration destination: the pending page when verification is required, else the dashboard. */
export async function resolvePostRegisterRedirect(user: {
  emailVerified: boolean;
  email: string;
}): Promise<string> {
  return (await isVerificationPending(user))
    ? `/verify-email/pending?email=${encodeURIComponent(user.email)}`
    : "/dashboard";
}
