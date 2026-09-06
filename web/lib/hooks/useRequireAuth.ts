"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth-context";

export function useRequireAuth(requiredRole?: "BUYER" | "DESIGNER" | "ADMIN") {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (requiredRole && user.role !== requiredRole) {
      router.replace("/dashboard");
    }
  }, [user, loading, requiredRole, router]);

  return { user, loading };
}
