/**
 * Single source of truth for IYAE brand values on the web side.
 *
 * All user-visible wordmarks, the document title, email subjects, and email-template copy
 * read from here so the brand name/domain is never copy-pasted (and can never drift) across
 * components. The server mirrors the server-relevant subset in
 * `com.iyae.config.BrandProperties`.
 */
export const BRAND = {
  /** Wordmark shown in nav, footer, landing, and headings. */
  name: "IYAE",
  /** Short descriptor used in the document title. */
  tagline: "AI-Powered Fashion",
  /** Registrable domain. */
  domain: "iyae.ca",
  /** Canonical site URL. */
  url: "https://iyae.ca",
  /** Default transactional sender address. */
  mailFrom: "noreply@iyae.ca",
} as const;
