-- F11: JWT revocation on password reset.
-- token_version is embedded as the "ver" claim in issued JWTs; JwtAuthenticationFilter rejects any
-- token whose version is below the user's current value. resetPassword increments this, invalidating
-- every token minted before the reset (otherwise a leaked session survives until the 24h token TTL).
ALTER TABLE users
    ADD COLUMN token_version INT NOT NULL DEFAULT 0;
