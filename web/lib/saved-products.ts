"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { hasAuthToken, savedProducts as savedProductsApi } from "@/lib/api";

/**
 * A shopper's wishlist of product ids.
 *
 * Signed in, `/api/saved-products` (V21) is the source of truth and localStorage
 * is a cache of it — which is what makes a save survive a change of device.
 * Signed out there is no server to talk to, so localStorage *is* the store and
 * the set is replayed up to the server on first sign-in.
 *
 * Reads stay synchronous off that cache on purpose: the shop grid renders twenty
 * hearts and must not wait on a request to know their state. Writes are
 * optimistic — the cache changes immediately, the request follows, and a failure
 * rolls the cache back so the heart reverts rather than lying.
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

/**
 * Flips the saved state of one product.
 *
 * The cache is updated before the request, so `useSavedProductIds` subscribers
 * re-render immediately and the returned promise can be ignored by call sites
 * that only need the optimistic result. It resolves to the state actually
 * **settled** on — equal to the optimistic value unless the request failed and
 * the change was rolled back. It never rejects, so an ignored return value
 * cannot produce an unhandled rejection; the reverted heart is the signal.
 */
export async function toggleSavedProduct(productId: number): Promise<boolean> {
  const before = getSavedProductIds();
  const nowSaved = !before.includes(productId);
  const next = nowSaved
    ? [productId, ...before]
    : before.filter((id) => id !== productId);
  write(JSON.stringify(next));

  if (!hasAuthToken()) return nowSaved;

  try {
    if (nowSaved) {
      await savedProductsApi.save(productId);
    } else {
      await savedProductsApi.remove(productId);
    }
    return nowSaved;
  } catch (error) {
    // Roll back to exactly what was there, not to the inverse of the optimistic
    // value: another tab may have changed the set while the request was in
    // flight, and inverting would clobber it.
    write(JSON.stringify(before));
    console.error(
      `Failed to ${nowSaved ? "save" : "unsave"} product ${productId}; reverted`,
      error,
    );
    return before.includes(productId);
  }
}

export function clearSavedProducts(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SAVED_PRODUCTS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/**
 * Pull the server's set into the cache, and push up anything saved while signed
 * out.
 *
 * Runs at most once per page load (`hydration` memoises the promise) because
 * every mounted `useSavedProductIds` would otherwise trigger its own copy.
 * No-ops when signed out.
 *
 * The merge direction is deliberate: ids cached locally but absent server-side
 * are saved up rather than discarded, because signing in should not lose the
 * hearts you tapped beforehand. The reverse — server ids missing locally — needs
 * no action beyond the cache write. Nothing is removed server-side here: this
 * cannot tell "saved on another device" from "unsaved on this one", and
 * forgetting a save is the worse failure.
 */
let hydration: Promise<void> | null = null;

export function syncSavedProducts(): Promise<void> {
  if (!hasAuthToken()) return Promise.resolve();
  hydration ??= hydrate();
  return hydration;
}

/** Test seam — the memoised hydration would otherwise leak across cases. */
export function resetSavedProductsSync(): void {
  hydration = null;
}

async function hydrate(): Promise<void> {
  try {
    const entries = await savedProductsApi.list();
    const serverIds = entries.map((entry) => entry.productId);
    const localOnly = getSavedProductIds().filter((id) => !serverIds.includes(id));

    // Cache the union first so the UI settles even if a replay below fails.
    write(JSON.stringify([...localOnly, ...serverIds]));

    const replays = await Promise.allSettled(
      localOnly.map((id) => savedProductsApi.save(id)),
    );
    const failed = localOnly.filter((_, i) => replays[i].status === "rejected");
    if (failed.length > 0) {
      // Left in the cache, so the next sync tries again.
      console.error("Failed to upload locally saved products", failed);
    }
  } catch (error) {
    // The cache already holds whatever this device knows, so the wishlist still
    // renders; it just is not confirmed against the server yet.
    hydration = null;
    console.error("Failed to load saved products from the server", error);
  }
}

/**
 * Reactive view of the wishlist, synchronised across tabs, hydrated from the
 * server when signed in.
 *
 * Reads the raw JSON string as the store snapshot: a primitive is stable by
 * value, which is what `useSyncExternalStore` needs (a fresh `Set` every call
 * would loop forever). Parsing happens in a `useMemo` keyed on that string.
 */
export function useSavedProductIds(): ReadonlySet<number> {
  const raw = useSyncExternalStore(subscribe, readRaw, readServerSnapshot);

  useEffect(() => {
    void syncSavedProducts();
  }, []);

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
