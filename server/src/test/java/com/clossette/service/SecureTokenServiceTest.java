package com.clossette.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SecureTokenServiceTest {

    private SecureTokenService secureTokenService;

    @BeforeEach
    void setUp() {
        secureTokenService = new SecureTokenService();
    }

    @Test
    void generateRawToken_returnsBase64UrlSafeString() {
        String token = secureTokenService.generateRawToken();

        assertThat(token).isNotEmpty();
        // Base64 URL-safe charset: A-Za-z0-9, -, _  (no padding =)
        assertThat(token).matches("[A-Za-z0-9_-]+");
    }

    @Test
    void generateRawToken_returnsDifferentTokensEachCall() {
        String token1 = secureTokenService.generateRawToken();
        String token2 = secureTokenService.generateRawToken();

        assertThat(token1).isNotEqualTo(token2);
    }

    @Test
    void hashToken_returns64CharHexString() {
        String hash = secureTokenService.hashToken("some-raw-token");

        assertThat(hash).hasSize(64);
        assertThat(hash).matches("[0-9a-f]{64}");
    }

    @Test
    void hashToken_isIdempotent() {
        String input = "stable-input-token";
        String hash1 = secureTokenService.hashToken(input);
        String hash2 = secureTokenService.hashToken(input);

        assertThat(hash1).isEqualTo(hash2);
    }

    @Test
    void hashToken_differentInputsProduceDifferentHashes() {
        String hash1 = secureTokenService.hashToken("token-alpha");
        String hash2 = secureTokenService.hashToken("token-beta");

        assertThat(hash1).isNotEqualTo(hash2);
    }
}
