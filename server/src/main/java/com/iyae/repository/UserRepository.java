package com.iyae.repository;

import com.iyae.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    Optional<User> findByVerificationToken(String verificationToken);
    boolean existsByUsernameIgnoreCase(String username);
    Optional<User> findByUsernameIgnoreCase(String username);

    /** Backs the admin bootstrap's idempotence check (see AdminBootstrap). */
    long countByRole(com.iyae.entity.enums.Role role);
}
