package com.iyae.dto;

/**
 * Runtime feature flags the web client needs before it can render honestly.
 *
 * <p>Deliberately served at runtime rather than inlined as {@code NEXT_PUBLIC_*} at build time:
 * a build-time flag in this repo has already proved able to go permanently stale (the production
 * image had no build-arg plumbing for the email-verification flag, so it could never be true).
 * A runtime read cannot drift from what the server actually does.
 *
 * @param checkoutEnabled whether a buyer can actually pay. False for launch #1 — the web client
 *                        hides the checkout and resale buy-now entry points rather than leaving a
 *                        live-looking button in front of a 503.
 * @param requireEmailVerification mirrors the server's own {@code app.auth.require-email-verification}
 *                        gate. Served from here rather than duplicated as a web build-time flag:
 *                        the web copy had no build-arg plumbing in the production image, so it
 *                        could never be true and every new signup was bounced — and even with the
 *                        plumbing added, two independently-configured booleans that must agree is
 *                        the same defect waiting to recur.
 */
public record PublicConfigResponse(boolean checkoutEnabled, boolean requireEmailVerification) {}
