import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { SEED_USERS, SEED_PASSWORD } from './seed-users';

/**
 * Shared authentication for specs whose subject is NOT the login UI.
 *
 * `POST /api/auth/login` is rate-limited to 5 requests per minute per IP
 * (`RateLimitFilter.RULES`), so a spec that drives the sign-in form in
 * `beforeEach` starts failing with 429 by its sixth test — regardless of
 * whether its selectors are correct. These helpers mint one token per role per
 * worker process and seed it straight into `localStorage`, which keeps the
 * whole matrix under the limit.
 *
 * The sign-in *form* stays covered by `auth.spec.ts`, which owns that journey.
 * Every other spec treats being logged in as a precondition, not a subject.
 */
const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';

/** The app reads its JWT from this key — note the pre-rebrand name. */
const TOKEN_KEY = 'clossette_token';

export type SeedRole = keyof typeof SEED_USERS;

/**
 * Where `global-setup.ts` parks the run's tokens. Workers are separate
 * processes, so an in-memory cache alone still costs one login per worker —
 * and the API allows only five per minute per IP.
 */
export const TOKEN_CACHE_FILE = join(tmpdir(), 'iyae-e2e-tokens.json');

function tokenFromRunCache(role: SeedRole): string | null {
  try {
    const parsed = JSON.parse(readFileSync(TOKEN_CACHE_FILE, 'utf8')) as Record<
      string,
      string | undefined
    >;
    return parsed[role] ?? null;
  } catch {
    return null; // no global setup ran, or the file is unreadable
  }
}

const tokenCache = new Map<SeedRole, Promise<string>>();

async function requestToken(role: SeedRole): Promise<string> {
  const { email } = SEED_USERS[role];
  let lastStatus = 0;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    // A plain fetch sends no Origin header, so this never trips the server's
    // CORS allowlist no matter which port the dev server is on.
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: SEED_PASSWORD }),
    });
    if (res.ok) {
      const body = (await res.json()) as { token?: string };
      if (!body.token) throw new Error(`Login for ${email} returned no token`);
      return body.token;
    }
    lastStatus = res.status;
    if (res.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
  }

  throw new Error(
    `Seed login failed for ${email} (${lastStatus}). Is the API running and ` +
      `seeded? Override the domain with PLAYWRIGHT_SEED_DOMAIN.`,
  );
}

function tokenFor(role: SeedRole): Promise<string> {
  const cached = tokenCache.get(role);
  if (cached) return cached;

  const fromRun = tokenFromRunCache(role);
  const pending = fromRun ? Promise.resolve(fromRun) : requestToken(role);
  tokenCache.set(role, pending);
  return pending;
}

/**
 * Seeds the JWT so the next navigation loads already authenticated. Must be
 * called *before* the `page.goto` it should apply to.
 */
export async function signIn(page: Page, role: SeedRole): Promise<void> {
  const token = await tokenFor(role);
  await page.addInitScript(
    ([key, value]) => {
      // Runs in every document, including an opaque-origin about:blank where
      // storage access throws.
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* no storage on this origin */
      }
    },
    [TOKEN_KEY, token] as const,
  );
}

/**
 * Undoes `signIn` for a test that needs the guest experience.
 *
 * Clearing `localStorage` by hand is not enough: `signIn` installs an init
 * script, so the token is re-seeded on the very next navigation. Init scripts
 * run in registration order, so a later script that *removes* the key wins.
 */
export async function signOut(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* no storage on this origin */
    }
  }, TOKEN_KEY);
}

/**
 * Authenticated API call for building fixtures a spec needs on the server.
 * Bypasses the UI on purpose: a spec that depends on ambient database state is
 * a spec that silently skips when the state is absent.
 */
export async function apiAs<T>(
  role: SeedRole,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await tokenFor(role);
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
