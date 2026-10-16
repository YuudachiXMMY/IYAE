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
  /** Canonical site URL — used as the metadata base. */
  url: "https://iyae.ca",
  /**
   * Default transactional sender address (fallback when MAIL_FROM is unset).
   *
   * Deliberately a different domain from `url`: mail is sent from `i-yae.com`, which is the
   * domain registered in the mail server and the one carrying the SPF, DKIM and DMARC records.
   * A fallback on any other domain would be rejected at the relay, so this value and the mail
   * server's domain list have to agree — that is the only reason it is not derived from `url`.
   */
  mailFrom: "noreply@i-yae.com",
} as const;
