"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";

/**
 * Redirects authenticated users away from guest-only pages (login, register, etc.).
 * Returns { loading } so the page can show a loading state while checking auth.
 */
export function useRedirectIfAuthenticated(redirectTo = "/dashboard") {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace(redirectTo);
    }
  }, [user, loading, redirectTo, router]);

  return { isAuthenticated: !!user, loading };
}
