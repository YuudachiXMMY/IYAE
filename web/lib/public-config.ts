import { publicConfig, type PublicConfig } from "@/lib/api";

/**
 * Single cached read of the server's runtime feature flags.
 *
 * Shared by `usePublicConfig` (for rendering) and `auth-config` (for the registration
 * decision), so there is exactly one place the flags come from. They cannot change without a
 * server restart, so one in-flight promise is cached and reused rather than refetched per
 * caller; a failed read is not cached, so the next caller retries.
 */
let cache: PublicConfig | null = null;
let inFlight: Promise<PublicConfig> | null = null;

export function getCachedPublicConfig(): PublicConfig | null {
  return cache;
}

/**
 * Deliberately takes no AbortSignal.
 *
 * The shared request must not be cancellable by any one caller. When it was, the first
 * caller's unmount aborted a fetch that every other caller was still awaiting: the rejection
 * propagated to all of them, and their own `signal.aborted` guards were false — their
 * controllers had never been aborted — so they committed an error state over a request they
 * had not cancelled. With three surfaces using this hook and StrictMode replaying mounts in
 * dev, that reproduced readily.
 *
 * Callers still own their own cancellation: they check their signal before committing the
 * result, so an unmounted consumer ignores the answer. The request itself is cheap, runs once
 * per page load, and its result is cached — there is nothing worth cancelling.
 */
export function getPublicConfig(): Promise<PublicConfig> {
  if (cache) return Promise.resolve(cache);
  if (inFlight) return inFlight;

  inFlight = publicConfig
    .get()
    .then((value) => {
      cache = value;
      inFlight = null;
      return value;
    })
    .catch((err) => {
      // Not cached: a transient network failure must not pin the app into a wrong answer.
      inFlight = null;
      throw err;
    });
  return inFlight;
}

/** Test seam: drops both the resolved value and any in-flight request. */
export function __resetPublicConfigCache() {
  cache = null;
  inFlight = null;
}
