package com.iyae.repository;

import com.iyae.entity.PasswordResetToken;
import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises the atomic {@link PasswordResetTokenRepository#consumeToken} UPDATE against an embedded
 * database. This is the query that previously assigned JPQL {@code CURRENT_TIMESTAMP} to the
 * {@code Instant usedAt} path (and compared {@code expiresAt} to it) — which Hibernate 6.6 rejects at
 * bootstrap — now rewritten to bind an {@code Instant :now} parameter for both the SET and the WHERE
 * (mirrors {@link ResaleListingRepository#reserve}).
 *
 * <p>Loading this single-repository slice eagerly validates that HQL at startup, so a regression to
 * the old {@code CURRENT_TIMESTAMP} form fails here instead of silently slipping through (the exact
 * blind spot that let the original bug persist). The tests then pin the runtime consume semantics:
 * a fresh unexpired token is consumed exactly once; already-used and expired tokens are refused.
 */
@DataJpaTest
@ActiveProfiles("test")
@EnableJpaRepositories(
        basePackageClasses = PasswordResetTokenRepository.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.REGEX,
                pattern = "com\\.iyae\\.repository\\.(?!PasswordResetTokenRepository).*"))
class PasswordResetTokenRepositoryDataJpaTest {

    @Autowired
    TestEntityManager em;

    @Autowired
    PasswordResetTokenRepository repo;

    private void persistToken(String hash, Instant expiresAt, Instant usedAt) {
        User user = em.persist(User.builder()
                .email(hash + "@ex.com").passwordHash("x").name(hash).role(Role.BUYER).build());
        em.persist(PasswordResetToken.builder()
                .user(user).tokenHash(hash).expiresAt(expiresAt).usedAt(usedAt).build());
    }

    @Test
    void consumeToken_marksFreshTokenUsed_andReturnsOne() {
        Instant now = Instant.now();
        persistToken("hashfresh", now.plus(1, ChronoUnit.HOURS), null);
        em.flush();
        em.clear();

        int updated = repo.consumeToken("hashfresh", now);

        assertThat(updated).isEqualTo(1);
        em.clear();
        Optional<PasswordResetToken> reloaded = repo.findByTokenHash("hashfresh");
        assertThat(reloaded).isPresent();
        assertThat(reloaded.get().getUsedAt()).isNotNull();
    }

    @Test
    void consumeToken_refusesAlreadyUsedToken() {
        Instant now = Instant.now();
        persistToken("hashused", now.plus(1, ChronoUnit.HOURS), now.minus(5, ChronoUnit.MINUTES));
        em.flush();
        em.clear();

        int updated = repo.consumeToken("hashused", now);

        assertThat(updated).isZero();
    }

    @Test
    void consumeToken_refusesExpiredToken() {
        Instant now = Instant.now();
        persistToken("hashexpired", now.minus(1, ChronoUnit.HOURS), null);
        em.flush();
        em.clear();

        int updated = repo.consumeToken("hashexpired", now);

        assertThat(updated).isZero();
    }

    @Test
    void consumeToken_refusesUnknownHash() {
        int updated = repo.consumeToken("no-such-hash", Instant.now());
        assertThat(updated).isZero();
    }
}
