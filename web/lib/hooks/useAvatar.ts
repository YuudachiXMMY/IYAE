"use client";

import { useState, useEffect } from "react";
import { api, type AvatarResponse } from "@/lib/api";

/**
 * Fetches the current user's avatar once. Tolerates 404/empty (returns
 * avatarUrl:null) so callers can gracefully fall back when no avatar exists.
 */
export function useAvatar() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get<AvatarResponse>("/api/avatar")
      .then((res) => {
        if (!cancelled) {
          setAvatarUrl(res.avatarUrl);
          setStatus(res.status);
        }
      })
      .catch(() => {
        if (!cancelled) setAvatarUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { avatarUrl, status, loading };
}
