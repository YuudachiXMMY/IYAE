package com.iyae.config;

import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import com.iyae.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * B-14. Creates or promotes exactly one ADMIN account from deploy-time configuration.
 *
 * <p>Before this existed, production had no administrator and could not get one. The only
 * {@code Role.ADMIN} assignment in the non-test tree was inside {@link DataSeeder}, which does
 * not run in prod; {@code AuthService.register} hard-rejects the role; and no migration inserts
 * an ADMIN row. So {@code /api/admin/**} and the {@code /admin} console were live but permanently
 * unreachable — the catalogue moderation, the comment removal and the whole {@code post_reports}
 * queue had nobody who could act on them, on a product that ships user-generated content.
 *
 * <p>Idempotent by design: it is a {@code CommandLineRunner} that runs on every boot, so it
 * no-ops once an ADMIN exists rather than resetting the password of a live account.
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class AdminBootstrap implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.bootstrap-email:}")
    private String bootstrapEmail;

    @Value("${app.admin.bootstrap-password:}")
    private String bootstrapPassword;

    @Override
    @Transactional
    public void run(String... args) {
        if (bootstrapEmail == null || bootstrapEmail.isBlank()) {
            if (userRepository.countByRole(Role.ADMIN) == 0) {
                log.warn("No ADMIN account exists and ADMIN_BOOTSTRAP_EMAIL is unset — "
                        + "/api/admin/** and the /admin console are unreachable. Moderation of "
                        + "user-generated content is not possible in this deployment.");
            }
            return;
        }

        if (userRepository.countByRole(Role.ADMIN) > 0) {
            log.info("ADMIN account already exists — admin bootstrap is a no-op");
            return;
        }

        String email = bootstrapEmail.trim().toLowerCase();
        User existing = userRepository.findByEmail(email).orElse(null);
        if (existing != null) {
            // Promote in place. Deliberately does not touch the password: the operator already
            // holds working credentials for this account.
            existing.setRole(Role.ADMIN);
            userRepository.save(existing);
            log.info("Promoted existing account {} to ADMIN", email);
            return;
        }

        if (bootstrapPassword == null || bootstrapPassword.isBlank()) {
            // Refusing beats creating a passwordless admin or inventing a password nobody holds.
            log.error("ADMIN_BOOTSTRAP_EMAIL is set to {} but no such account exists and "
                    + "ADMIN_BOOTSTRAP_PASSWORD is empty — cannot create the ADMIN account.", email);
            return;
        }

        userRepository.save(User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(bootstrapPassword))
                .name("IYAE Admin")
                .role(Role.ADMIN)
                .emailVerified(true)
                .build());
        log.info("Created ADMIN account {} from deploy-time configuration", email);
    }
}
