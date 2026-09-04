package com.clossette.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenProviderTest {

    private static final String TEST_SECRET = "test-secret-key-for-unit-testing-minimum-32-chars";
    private static final long EXPIRATION_MS = 3600000L; // 1 hour

    private JwtTokenProvider jwtTokenProvider;

    @BeforeEach
    void setUp() {
        jwtTokenProvider = new JwtTokenProvider(TEST_SECRET, EXPIRATION_MS);
    }

    @Test
    void generateToken_returnsNonNullToken() {
        String token = jwtTokenProvider.generateToken("user@example.com");

        assertThat(token).isNotNull().isNotBlank();
    }

    @Test
    void extractEmail_returnsCorrectEmail() {
        String email = "user@example.com";
        String token = jwtTokenProvider.generateToken(email);

        assertThat(jwtTokenProvider.extractEmail(token)).isEqualTo(email);
    }

    @Test
    void validateToken_validToken_returnsTrue() {
        String token = jwtTokenProvider.generateToken("user@example.com");

        assertThat(jwtTokenProvider.validateToken(token)).isTrue();
    }

    @Test
    void validateToken_tamperedToken_returnsFalse() {
        String token = jwtTokenProvider.generateToken("user@example.com");
        String tampered = token.substring(0, token.length() - 5) + "XXXXX";

        assertThat(jwtTokenProvider.validateToken(tampered)).isFalse();
    }

    @Test
    void validateToken_expiredToken_returnsFalse() throws InterruptedException {
        JwtTokenProvider shortLivedProvider = new JwtTokenProvider(TEST_SECRET, 1L); // 1ms TTL
        String token = shortLivedProvider.generateToken("user@example.com");
        Thread.sleep(10); // ensure expiry

        assertThat(shortLivedProvider.validateToken(token)).isFalse();
    }

    @Test
    void generateToken_differentEmails_produceDifferentTokens() {
        String token1 = jwtTokenProvider.generateToken("alice@example.com");
        String token2 = jwtTokenProvider.generateToken("bob@example.com");

        assertThat(token1).isNotEqualTo(token2);
    }

    @Test
    void extractEmail_afterRoundTrip_preservesEmail() {
        String[] emails = {"alice@example.com", "designer+shop@example.com", "user123@test.org"};
        for (String email : emails) {
            String token = jwtTokenProvider.generateToken(email);
            assertThat(jwtTokenProvider.extractEmail(token)).isEqualTo(email);
        }
    }
}
