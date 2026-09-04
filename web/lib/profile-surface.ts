"use client";

import { useState, useEffect, useCallback } from "react";

const LEGACY_STORAGE_KEY = "clossette_profile_surface";
const LEGACY_EVENT = "clossette:profile-surface-changed";

function getStorageKey(userId?: string): string {
  return userId ? `clossette.profile-surface.${userId}` : LEGACY_STORAGE_KEY;
}

function getEventName(userId?: string): string {
  return userId ? `clossette:profile-surface-updated:${userId}` : LEGACY_EVENT;
}

export interface ProfileSurface {
  username: string | null;
  displayName: string | null;
  avatarMode: string | null;
  avatarPreset: string | null;
  avatarDataUrl: string | null;
  bannerDataUrl: string | null;
  bio: string;
}

const defaultSurface: ProfileSurface = {
  username: null,
  displayName: null,
  avatarMode: null,
  avatarPreset: null,
  avatarDataUrl: null,
  bannerDataUrl: null,
  bio: "",
};

function readSurface(storageKey: string): ProfileSurface {
  if (typeof window === "undefined") return defaultSurface;
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? { ...defaultSurface, ...JSON.parse(raw) } : defaultSurface;
  } catch {
    return defaultSurface;
  }
}

function writeSurface(storageKey: string, eventName: string, surface: ProfileSurface): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(surface));
  window.dispatchEvent(new CustomEvent(eventName, { detail: surface }));
}

export function useProfileSurface(userId?: string) {
  const storageKey = getStorageKey(userId);
  const eventName = getEventName(userId);

  const [surface, setSurface] = useState<ProfileSurface>(defaultSurface);

  useEffect(() => {
    setSurface(readSurface(storageKey));

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ProfileSurface>).detail;
      setSurface(detail);
    };

    const storageHandler = () => setSurface(readSurface(storageKey));

    window.addEventListener(eventName, handler);
    window.addEventListener("storage", storageHandler);

    return () => {
      window.removeEventListener(eventName, handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, [storageKey, eventName]);

  const updateSurface = useCallback(
    (updates: Partial<ProfileSurface>) => {
      const next = { ...readSurface(storageKey), ...updates };
      writeSurface(storageKey, eventName, next);
      setSurface(next);
    },
    [storageKey, eventName]
  );

  const clearSurface = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
    setSurface(defaultSurface);
  }, [storageKey]);

  return { surface, updateSurface, clearSurface };
}

export function subscribeToProfileSurface(
  userId: string,
  callback: (surface: ProfileSurface) => void
): () => void {
  const storageKey = getStorageKey(userId);
  const eventName = getEventName(userId);

  const customEventHandler = (e: Event) => {
    callback((e as CustomEvent<ProfileSurface>).detail);
  };

  const storageHandler = () => {
    callback(readSurface(storageKey));
  };

  window.addEventListener(eventName, customEventHandler);
  window.addEventListener("storage", storageHandler);

  return () => {
    window.removeEventListener(eventName, customEventHandler);
    window.removeEventListener("storage", storageHandler);
  };
}
