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

export function useCommunityState(user: CommunityStateUser | null) {
  const [state, setState] = useState<PersistedCommunityState | null>(null);

  useEffect(() => {
    if (!user) return;
    const initial = loadCommunityState(
      String(user.id),
      user.name ?? "",
      user.username ?? "",
      user.styleAesthetics?.[0] ?? "Everyday"
    );
    setState(initial);
  }, [user]);

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
