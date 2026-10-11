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

export function getPublicConfig(signal?: AbortSignal): Promise<PublicConfig> {
  if (cache) return Promise.resolve(cache);
  if (inFlight) return inFlight;

  inFlight = publicConfig
    .get(signal)
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
