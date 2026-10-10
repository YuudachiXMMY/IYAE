"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

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

/**
 * The stored JSON rather than the parsed surface: a `useSyncExternalStore`
 * snapshot has to be stable by value, and a fresh object per read would loop.
 */
function readRaw(storageKey: string): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

/** Server render has no storage; the default surface avoids a hydration mismatch. */
function readServerRaw(): string {
  return "";
}

function parseSurface(raw: string): ProfileSurface {
  if (!raw) return defaultSurface;
  try {
    return { ...defaultSurface, ...JSON.parse(raw) };
  } catch {
    return defaultSurface;
  }
}

function readSurface(storageKey: string): ProfileSurface {
  return parseSurface(readRaw(storageKey));
}

function writeSurface(storageKey: string, eventName: string, surface: ProfileSurface): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify(surface));
  window.dispatchEvent(new CustomEvent(eventName, { detail: surface }));
}

export function useProfileSurface(userId?: string) {
  const storageKey = getStorageKey(userId);
  const eventName = getEventName(userId);

  const subscribe = useCallback(
    (onChange: () => void) => {
      window.addEventListener(eventName, onChange);
      window.addEventListener("storage", onChange);

      return () => {
        window.removeEventListener(eventName, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    [eventName]
  );

  const getSnapshot = useCallback(() => readRaw(storageKey), [storageKey]);

  const raw = useSyncExternalStore(subscribe, getSnapshot, readServerRaw);
  const surface = useMemo(() => parseSurface(raw), [raw]);

  const updateSurface = useCallback(
    (updates: Partial<ProfileSurface>) => {
      const next = { ...readSurface(storageKey), ...updates };
      writeSurface(storageKey, eventName, next);
    },
    [storageKey, eventName]
  );

  const clearSurface = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(storageKey);
    // Announced like any other write so the store re-reads the now-absent entry.
    window.dispatchEvent(new CustomEvent(eventName, { detail: defaultSurface }));
  }, [storageKey, eventName]);

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
