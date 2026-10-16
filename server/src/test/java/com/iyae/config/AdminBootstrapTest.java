package com.iyae.config;

import com.iyae.entity.DesignerProfile;
import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import com.iyae.repository.DesignerProfileRepository;
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

    /** Stands in for the key MySQL's IDENTITY column would assign on insert. */
    private static final Long GENERATED_ID = 42L;

    @Mock UserRepository userRepository;
    @Mock DesignerProfileRepository designerProfileRepository;
    @Mock PasswordEncoder passwordEncoder;

    private AdminBootstrap bootstrap;

    @BeforeEach
    void setUp() {
        bootstrap = new AdminBootstrap(userRepository, designerProfileRepository, passwordEncoder);
        when(passwordEncoder.encode(anyString())).thenReturn("$2a$10$encoded");
        // The created account is the argument to ensureOperatorDesignerProfile, so save() has to
        // hand something back rather than Mockito's default null — AND it has to assign an id.
        // `User` is @GeneratedValue(IDENTITY), so a real save cannot return an id-less row; a
        // stub that echoed the argument unchanged made the new-admin case call
        // findByUserId(null), which Mockito answers with Optional.empty() whatever you pass it.
        // The test then could not tell the correct lookup from one scoped to the wrong user.
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User saved = inv.getArgument(0);
            if (saved.getId() == null) {
                saved.setId(GENERATED_ID);
            }
            return saved;
        });
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

    // ---- B-11: the operator DesignerProfile every catalogue write resolves through ----
    //
    // Role.canManageCatalog() lets ADMIN *reach* /api/designer/** and /api/promotions/**, but
    // ownership is resolved from the principal's own profile. An ADMIN without one gets
    // IllegalArgumentException — a 400, not a 403 — from the first thing it tries to create, so
    // the role and the profile have to arrive together.

    @Test
    void createsTheOperatorDesignerProfileAlongsideANewAdmin() {
        configure("ops@iyae.ca", "s3cret-pass");
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(0L);
        when(userRepository.findByEmail("ops@iyae.ca")).thenReturn(Optional.empty());
        when(designerProfileRepository.findByUserId(GENERATED_ID)).thenReturn(Optional.empty());

        bootstrap.run();

        // Scoped to the id the insert assigned, not to whatever Mockito's default answer would
        // have swallowed: this is what fails if the lookup is ever keyed off the wrong user.
        verify(designerProfileRepository).findByUserId(GENERATED_ID);
        verify(designerProfileRepository).save(org.mockito.ArgumentMatchers.argThat(p ->
                "ops@iyae.ca".equals(p.getUser().getEmail())
                        && GENERATED_ID.equals(p.getUser().getId())
                        // Taken from the account's own name rather than a literal — it is public,
                        // rendered as ProductResponse.designerDisplayName on every operator listing.
                        && "IYAE Admin".equals(p.getDisplayName())));
    }

    @Test
    void doesNotCreateASecondProfileForANewAdminThatSomehowAlreadyHasOne() {
        // Absent-only on every path, including the create one. With the lookup now scoped to the
        // generated id, this is the case that proves the guard is read rather than bypassed.
        configure("ops@iyae.ca", "s3cret-pass");
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(0L);
        when(userRepository.findByEmail("ops@iyae.ca")).thenReturn(Optional.empty());
        when(designerProfileRepository.findByUserId(GENERATED_ID)).thenReturn(Optional.of(
                DesignerProfile.builder().id(5L).displayName("Already There").build()));

        bootstrap.run();

        verify(designerProfileRepository).findByUserId(GENERATED_ID);
        verify(designerProfileRepository, never()).save(any(DesignerProfile.class));
    }

    @Test
    void createsTheOperatorDesignerProfileWhenPromotingAnAccountThatHasNone() {
        configure("founder@iyae.ca", "real-password");
        User existing = User.builder()
                .id(7L).email("founder@iyae.ca").name("Dana Reyes").passwordHash("$2a$10$original")
                .role(Role.BUYER).emailVerified(true).build();
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(0L);
        when(userRepository.findByEmail("founder@iyae.ca")).thenReturn(Optional.of(existing));
        when(passwordEncoder.matches("real-password", "$2a$10$original")).thenReturn(true);
        when(designerProfileRepository.findByUserId(7L)).thenReturn(Optional.empty());

        bootstrap.run();

        verify(designerProfileRepository).save(org.mockito.ArgumentMatchers.argThat(p ->
                p.getUser() == existing && "Dana Reyes".equals(p.getDisplayName())));
    }

    @Test
    void leavesAnExistingDesignerProfileAlone() {
        // A promoted account that was already a DESIGNER keeps its profile and its listings, and
        // re-running on every boot must not reset displayName back over the operator's own edit.
        configure("luna@iyae.ca", "real-password");
        User designer = User.builder()
                .id(3L).email("luna@iyae.ca").name("Luna Kim").passwordHash("$2a$10$original")
                .role(Role.DESIGNER).emailVerified(true).build();
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(0L);
        when(userRepository.findByEmail("luna@iyae.ca")).thenReturn(Optional.of(designer));
        when(passwordEncoder.matches("real-password", "$2a$10$original")).thenReturn(true);
        when(designerProfileRepository.findByUserId(3L)).thenReturn(Optional.of(
                DesignerProfile.builder().id(11L).user(designer).displayName("Luna Studio").build()));

        bootstrap.run();

        assertThat(designer.getRole()).isEqualTo(Role.ADMIN);
        verify(designerProfileRepository, never()).save(any(DesignerProfile.class));
    }

    @Test
    void backfillsTheOperatorProfileOnAnInstanceThatAlreadyHasAnAdmin() {
        // The upgrade path. An instance deployed before B-11 has an ADMIN and no profile, so the
        // already-exists branch cannot just return — it would leave every catalogue write 400ing
        // on a deployment where the matcher now lets ADMIN through.
        configure("ops@iyae.ca", "s3cret-pass");
        User admin = User.builder()
                .id(5L).email("ops@iyae.ca").name("IYAE Admin").passwordHash("$2a$10$existing")
                .role(Role.ADMIN).emailVerified(true).build();
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(1L);
        when(userRepository.findByEmail("ops@iyae.ca")).thenReturn(Optional.of(admin));
        when(designerProfileRepository.findByUserId(5L)).thenReturn(Optional.empty());

        bootstrap.run();

        verify(designerProfileRepository).save(org.mockito.ArgumentMatchers.argThat(p ->
                p.getUser() == admin));
        // Still must not touch the live administrator's own row.
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void doesNotBackfillAProfileForAnAccountThatIsNotTheAdmin() {
        // countByRole is non-zero because of some *other* administrator. The configured address
        // here belongs to an ordinary account, and handing it a designer profile off the back of
        // a name match would be a silent grant.
        configure("ops@iyae.ca", "s3cret-pass");
        User buyer = User.builder()
                .id(5L).email("ops@iyae.ca").name("Squatter").passwordHash("$2a$10$x")
                .role(Role.BUYER).emailVerified(true).build();
        when(userRepository.countByRole(Role.ADMIN)).thenReturn(1L);
        when(userRepository.findByEmail("ops@iyae.ca")).thenReturn(Optional.of(buyer));

        bootstrap.run();

        verify(designerProfileRepository, never()).save(any(DesignerProfile.class));
        assertThat(buyer.getRole()).isEqualTo(Role.BUYER);
    }
}
