/**
 * Single source of truth for IYAE brand values on the web side.
 *
 * Every field here has a real consumer so nothing drifts:
 * - `name`     — wordmarks (nav/footer/landing/headings), document title, email subjects/templates
 * - `tagline`  — document title
 * - `url`      — `metadataBase` in the root layout (resolves canonical / Open Graph URLs)
 * - `mailFrom` — default transactional sender in `app/api/internal/mail/send/route.ts`
 *
 * The server mirrors the server-relevant subset in `com.iyae.config.BrandProperties`.
 */
export const BRAND = {
  /** Wordmark shown in nav, footer, landing, and headings. */
  name: "IYAE",
  /** Short descriptor used in the document title. */
  tagline: "AI-Powered Fashion",
  /**
   * Canonical site URL — the metadata base, and the host of the `privacy@` / `support@`
   * addresses on `/privacy` and `/terms`, which derive from it.
   */
  url: "https://i-yae.com",
  /**
   * Default transactional sender address (fallback when MAIL_FROM is unset).
   *
   * Same domain as `url`, and it has to stay that way for a concrete reason rather than
   * tidiness: this domain is the one registered in the mail server and the one carrying the
   * SPF, DKIM and DMARC records. A fallback on any other domain is rejected at the relay. Kept
   * as its own literal rather than derived from `url` so that a change to the site URL cannot
   * silently repoint the sender to a domain the relay does not serve.
   */
  mailFrom: "noreply@i-yae.com",
} as const;
