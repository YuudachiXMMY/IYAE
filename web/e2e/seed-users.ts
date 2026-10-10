/**
 * The accounts `DataSeeder` creates, in one place.
 *
 * Seed emails are built from `app.brand.domain` (`BRAND_DOMAIN`, default
 * `iyae.ca`) — see `server/src/main/java/com/iyae/config/DataSeeder.java`. Specs
 * must not hardcode a domain: when it drifts, every login-dependent test fails
 * at the sign-in step with no hint as to why.
 */

export const SEED_DOMAIN = process.env.PLAYWRIGHT_SEED_DOMAIN ?? 'iyae.ca';
export const SEED_PASSWORD = 'password123';

export const SEED_USERS = {
  /** BUYER — the default shopper persona. */
  shopper: { email: `emma@${SEED_DOMAIN}`, name: 'Emma Wilson' },
  /** BUYER — second shopper, for multi-user scenarios. */
  shopperAlt: { email: `james@${SEED_DOMAIN}`, name: 'James Park' },
  /** DESIGNER — owns the first seeded products. */
  designer: { email: `luna@${SEED_DOMAIN}`, name: 'Luna Kim' },
  /** ADMIN — granted only via seed/DB; public registration rejects ADMIN. */
  admin: { email: `admin@${SEED_DOMAIN}`, name: 'IYAE Admin' },
} as const;

/** An address guaranteed not to exist, for registration and 400-path tests. */
export function uniqueEmail(prefix = 'testuser'): string {
  return `${prefix}+${Date.now()}@example.com`;
}
