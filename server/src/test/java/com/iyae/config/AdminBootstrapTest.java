package com.iyae.config;

import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import com.iyae.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** B-14: production must be able to have an administrator, exactly one, idempotently. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminBootstrapTest {

    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;

    private AdminBootstrap bootstrap;

    @BeforeEach
    void setUp() {
        bootstrap = new AdminBootstrap(userRepository, passwordEncoder);
        when(passwordEncoder.encode(anyString())).thenReturn("$2a$10$encoded");
    }

    private void configure(String email, String password) {
        ReflectionTestUtils.setField(bootstrap, "bootstrapEmail", email);
        ReflectionTestUtils.setField(bootstrap, "bootstrapPassword", password);
    }

    @Test
    void createsAdminWhenNoneExists() {
        configure("ops@iyae.ca", "s3cret-pass");
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(0L);
        when(userRepository.findByEmail("ops@iyae.ca")).thenReturn(Optional.empty());

        bootstrap.run();

        verify(userRepository).save(org.mockito.ArgumentMatchers.argThat(u ->
                u.getRole() == Role.ADMIN
                        && "ops@iyae.ca".equals(u.getEmail())
                        && Boolean.TRUE.equals(u.getEmailVerified())
                        && "$2a$10$encoded".equals(u.getPasswordHash())));
    }

    @Test
    void promotesAnExistingAccountWithoutTouchingItsPassword() {
        configure("founder@iyae.ca", "real-password");
        User existing = User.builder()
                .id(7L).email("founder@iyae.ca").passwordHash("$2a$10$original")
                .role(Role.BUYER).emailVerified(true).build();
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(0L);
        when(userRepository.findByEmail("founder@iyae.ca")).thenReturn(Optional.of(existing));
        when(passwordEncoder.matches("real-password", "$2a$10$original")).thenReturn(true);

        bootstrap.run();

        assertThat(existing.getRole()).isEqualTo(Role.ADMIN);
        // The operator already holds working credentials; resetting them would lock them out.
        assertThat(existing.getPasswordHash()).isEqualTo("$2a$10$original");
        verify(userRepository).save(existing);
    }

    // ---- Promotion is a privilege grant, so it needs proof the operator owns the account ----

    @Test
    void refusesToPromoteAnUnverifiedAccount() {
        // Registration is open and needs no proof of email ownership, and the intended admin
        // address is usually guessable. An attacker who self-registers it before the operator's
        // first deploy would otherwise be handed ADMIN over an account whose password they set.
        configure("admin@iyae.ca", "deploy-password");
        User squatter = User.builder()
                .id(9L).email("admin@iyae.ca").passwordHash("$2a$10$attacker")
                .role(Role.BUYER).emailVerified(false).build();
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(0L);
        when(userRepository.findByEmail("admin@iyae.ca")).thenReturn(Optional.of(squatter));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);

        bootstrap.run();

        assertThat(squatter.getRole()).isEqualTo(Role.BUYER);
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void refusesToPromoteWhenTheConfiguredPasswordIsNotTheAccountsPassword() {
        // Verified, but not by the person holding the deploy config.
        configure("admin@iyae.ca", "deploy-password");
        User other = User.builder()
                .id(9L).email("admin@iyae.ca").passwordHash("$2a$10$someoneelse")
                .role(Role.BUYER).emailVerified(true).build();
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(0L);
        when(userRepository.findByEmail("admin@iyae.ca")).thenReturn(Optional.of(other));
        when(passwordEncoder.matches("deploy-password", "$2a$10$someoneelse")).thenReturn(false);

        bootstrap.run();

        assertThat(other.getRole()).isEqualTo(Role.BUYER);
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void isIdempotent_noOpsWhenAnAdminAlreadyExists() {
        // Runs on every boot, so it must not reset a live administrator's password.
        configure("ops@iyae.ca", "s3cret-pass");
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(1L);

        bootstrap.run();

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void doesNothingWhenUnconfigured() {
        configure("", "");
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(0L);

        bootstrap.run();

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void refusesToCreateAnAdminWithoutAPassword() {
        // Better to leave the instance unadministrable and loud than to create an account whose
        // password nobody holds.
        configure("ops@iyae.ca", "");
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(0L);
        when(userRepository.findByEmail("ops@iyae.ca")).thenReturn(Optional.empty());

        bootstrap.run();

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void normalisesTheConfiguredEmail() {
        configure("  OPS@IYAE.CA  ", "s3cret-pass");
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(0L);
        when(userRepository.findByEmail("ops@iyae.ca")).thenReturn(Optional.empty());

        bootstrap.run();

        verify(userRepository).save(org.mockito.ArgumentMatchers.argThat(
                u -> "ops@iyae.ca".equals(u.getEmail())));
    }
}
