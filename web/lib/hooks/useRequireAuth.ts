"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";
import type { Role } from "../roles";

/**
 * Redirects anonymous visitors to /login, and — when `requiredRole` is given — anyone whose role
 * is not permitted to /dashboard.
 *
 * `requiredRole` accepts a set as well as a single role (B-11), because the catalogue surfaces
 * admit DESIGNER *and* ADMIN. Pass `CATALOG_MANAGER_ROLES` from `lib/roles` rather than spelling
 * the pair out at the call site. A single role still works and still means exactly that one role.
 *
 * Note this redirects from an effect, so the hook returns the real user on the render where the
 * mismatch is detected — a page that renders privileged content must also guard its own body, the
 * way `/admin` does, or it will paint once before the route swaps.
 */
export function useRequireAuth(requiredRole?: Role | readonly Role[]) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Collapsed to a primitive before it reaches the effect's dependency array, so an inline
  // `useRequireAuth(["DESIGNER", "ADMIN"])` — a fresh array every render — cannot make the effect
  // re-run on every unrelated render of the owning component and re-issue `router.replace` while
  // a redirect is already in flight. `exhaustive-deps` does not catch that: it checks that
  // reactive values *used* in the effect are *listed*, not that a value handed in by the caller
  // is referentially stable. Round-trips safely because role names contain no comma.
  const permittedKey = requiredRole
    ? (typeof requiredRole === "string" ? [requiredRole] : requiredRole).join(",")
    : null;

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (permittedKey === null) return;
    if (!permittedKey.split(",").includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [user, loading, permittedKey, router]);

  return { user, loading };
}
