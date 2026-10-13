package com.iyae.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final long expirationMs;

    public JwtTokenProvider(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiration-ms}") long expirationMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    public String generateToken(String email) {
        return generateToken(email, 0, null);
    }

    public String generateToken(String email, Integer tokenVersion) {
        return generateToken(email, tokenVersion, null);
    }

    /**
     * @param userId the account's immutable id. Carried as a {@code uid} claim because the
     *               subject (an email address) is NOT a stable identity: account deletion
     *               scrubs the row's address, which frees the original for someone else to
     *               register. Without {@code uid}, a token minted for the deleted account
     *               resolved by email to the *new* account, and the {@code ver} check compared
     *               the old token's version against the new row's own version — 0 against 0 —
     *               so it passed and authenticated the wrong person.
     */
    public String generateToken(String email, Integer tokenVersion, Long userId) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMs);
        var builder = Jwts.builder()
                .subject(email)
                .claim("ver", tokenVersion != null ? tokenVersion : 0)
                .issuedAt(now)
                .expiration(expiry);
        if (userId != null) {
            builder.claim("uid", userId);
        }
        return builder.signWith(key).compact();
    }

    public String extractEmail(String token) {
        return getClaims(token).getSubject();
    }

    /** Token version claim; defaults to 0 for legacy tokens minted before the claim existed. */
    public int extractTokenVersion(String token) {
        Object ver = getClaims(token).get("ver");
        return ver instanceof Number ? ((Number) ver).intValue() : 0;
    }

    /**
     * The account id the token was minted for, or null for a token minted before the claim
     * existed. The filter rejects a null here rather than trusting the subject alone — see
     * {@link #generateToken(String, Integer, Long)}.
     */
    public Long extractUserId(String token) {
        Object uid = getClaims(token).get("uid");
        return uid instanceof Number ? ((Number) uid).longValue() : null;
    }

    public boolean validateToken(String token) {
        try {
            getClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
