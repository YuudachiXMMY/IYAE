"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * Client-side wishlist of product ids.
 *
 * The server has no "save a product" capability — `/api/looks` persists outfit
 * *recommendations* (a `recommendationId` is required), not catalogue items —
 * so saves live in localStorage alongside the other demo layers
 * (`demo-looks.ts`, `community-feed.ts`). Promoting this to a real table is a
 * follow-up; until then the heart at least reflects a durable state instead of
 * doing nothing.
 */

export const SAVED_PRODUCTS_STORAGE_KEY = "clossette_saved_products";
const CHANGE_EVENT = "clossette:saved-products-changed";

/** Most recently saved first. Tolerates absent, corrupt, or stale payloads. */
export function getSavedProductIds(): number[] {
  return parseIds(readRaw());
}

export function isProductSaved(productId: number): boolean {
  return getSavedProductIds().includes(productId);
}

/** Flips the saved state of one product and returns the state it landed in. */
export function toggleSavedProduct(productId: number): boolean {
  const current = getSavedProductIds();
  const nowSaved = !current.includes(productId);
  const next = nowSaved
    ? [productId, ...current]
    : current.filter((id) => id !== productId);
  write(JSON.stringify(next));
  return nowSaved;
}

export function clearSavedProducts(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SAVED_PRODUCTS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/**
 * Reactive view of the wishlist, synchronised across tabs.
 *
 * Reads the raw JSON string as the store snapshot: a primitive is stable by
 * value, which is what `useSyncExternalStore` needs (a fresh `Set` every call
 * would loop forever). Parsing happens in a `useMemo` keyed on that string.
 */
export function useSavedProductIds(): ReadonlySet<number> {
  const raw = useSyncExternalStore(subscribe, readRaw, readServerSnapshot);
  return useMemo(() => new Set(parseIds(raw)), [raw]);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readRaw(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(SAVED_PRODUCTS_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Server render has no storage; an empty wishlist avoids a hydration mismatch. */
function readServerSnapshot(): string {
  return "";
}

function parseIds(raw: string): number[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<number>();
  return parsed.filter(
    (id): id is number =>
      typeof id === "number" &&
      Number.isInteger(id) &&
      !seen.has(id) &&
      !!seen.add(id),
  );
}

function write(raw: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SAVED_PRODUCTS_STORAGE_KEY, raw);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}
