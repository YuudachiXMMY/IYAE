"use client";

import { useState, useEffect, useCallback } from "react";
import {
  loadCommunityState,
  saveCommunityState,
  updatePostInState,
  toggleFollow,
  createPost,
  archivePost,
  restorePost,
  addPostToState,
  type SocialPost,
  type PersistedCommunityState,
  type CreatePostInput,
} from "@/lib/community-feed";

interface CommunityStateUser {
  id: number;
  name?: string | null;
  username?: string | null;
  styleAesthetics?: string[] | null;
}

function loadFor(user: CommunityStateUser | null): PersistedCommunityState | null {
  if (!user) return null;
  return loadCommunityState(
    String(user.id),
    user.name ?? "",
    user.username ?? "",
    user.styleAesthetics?.[0] ?? "Everyday"
  );
}

// Everything `loadCommunityState` reads, as a value signature: reloading on this
// rather than on the `user` object identity skips the reloads AuthContext's
// refreshUser used to cause, while still reloading when the user (or the display
// name baked into the seeded posts) actually changes.
function loadKey(user: CommunityStateUser | null): string | null {
  if (!user) return null;
  return [
    user.id,
    user.name ?? "",
    user.username ?? "",
    user.styleAesthetics?.[0] ?? "Everyday",
  ].join("|");
}

export function useCommunityState(user: CommunityStateUser | null) {
  const [state, setState] = useState<PersistedCommunityState | null>(() => loadFor(user));

  // The load is a localStorage read-through, so it runs in the initialiser above
  // and during render on a user change instead of from an effect — the first
  // render already has the feed.
  // A null key (signed out) leaves the last loaded state in place, as the previous
  // `if (!user) return` effect did.
  const key = loadKey(user);
  const [loadedKey, setLoadedKey] = useState(key);
  if (key !== null && loadedKey !== key) {
    setLoadedKey(key);
    setState(loadFor(user));
  }

  // Persist on change
  useEffect(() => {
    if (user && state) saveCommunityState(String(user.id), state);
  }, [state, user]);

  // Cross-tab sync
  useEffect(() => {
    if (!user) return;
    const handler = () => {
      const fresh = loadCommunityState(
        String(user.id),
        user.name ?? "",
        user.username ?? "",
        user.styleAesthetics?.[0] ?? "Everyday"
      );
      setState(fresh);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [user]);

  const handlePostUpdate = useCallback((updatedPost: SocialPost) => {
    setState((prev) => (prev ? updatePostInState(prev, updatedPost) : prev));
  }, []);

  const handleToggleFollow = useCallback((username: string) => {
    setState((prev) => (prev ? toggleFollow(prev, username) : prev));
  }, []);

  const handleCreatePost = useCallback((input: CreatePostInput) => {
    const post = createPost(input);
    setState((prev) => (prev ? addPostToState(prev, post) : prev));
    return post;
  }, []);

  const handleArchivePost = useCallback((post: SocialPost) => {
    const archived = archivePost(post);
    setState((prev) => (prev ? updatePostInState(prev, archived) : prev));
  }, []);

  const handleRestorePost = useCallback((post: SocialPost) => {
    const restored = restorePost(post);
    setState((prev) => (prev ? updatePostInState(prev, restored) : prev));
  }, []);

  return {
    state,
    handlePostUpdate,
    handleToggleFollow,
    handleCreatePost,
    handleArchivePost,
    handleRestorePost,
  };
}
