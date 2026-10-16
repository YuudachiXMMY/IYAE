import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { SEED_USERS, SEED_PASSWORD } from './seed-users';
import { TOKEN_CACHE_FILE, type SeedRole } from './session';

/**
 * Mints one JWT per seed role for the whole run and writes them where
 * `session.ts` can read them.
 *
 * Without this, every Playwright worker process logs in for itself, and
 * `POST /api/auth/login` is capped at five requests per minute per IP
 * (`RateLimitFilter.RULES`). Three workers plus the specs that must drive the
 * real sign-in form already exceed that, which surfaced as unrelated-looking
 * assertion failures scattered across the suite.
 */
const API_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';
// Only the roles specs actually sign in as. Every extra login here eats into
// the same five-per-minute budget the form-login tests need.
// `admin` joined the list for B-11 (admin-catalogue.spec.ts): the operator's
// catalogue-write path is the only one no other persona can exercise, and the
// seeded ADMIN had never been signed in by any spec.
const ROLES: SeedRole[] = ['shopper', 'designer', 'admin'];

async function mint(role: SeedRole): Promise<string | null> {
  const { email } = SEED_USERS[role];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: SEED_PASSWORD }),
    });
    if (res.ok) {
      const body = (await res.json()) as { token?: string };
      return body.token ?? null;
    }
    if (res.status !== 429) return null;
    await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
  }
  return null;
}

export default async function globalSetup(): Promise<void> {
  const tokens: Partial<Record<SeedRole, string>> = {};

  for (const role of ROLES) {
    const token = await mint(role);
    // A role the environment has not seeded is not fatal here — the spec that
    // needs it fails with its own clear message when `session.ts` retries.
    if (token) tokens[role] = token;
  }

  await mkdir(dirname(TOKEN_CACHE_FILE), { recursive: true });
  await writeFile(TOKEN_CACHE_FILE, JSON.stringify(tokens), 'utf8');
}
