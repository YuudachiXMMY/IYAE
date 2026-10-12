package com.iyae.repository;

import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

/**
 * Identity lookups here all exclude tombstoned accounts ({@code deleted_at IS NOT NULL}).
 *
 * <p>The filter is on the queries rather than on their callers — {@code findByEmail} alone has
 * nine (login, registration's duplicate check, the JWT filter, profile reads, password reset,
 * avatar, checkout, …) and one missed site would leave a deleted account partly alive, able to
 * log in or to block its own address from being re-registered.
 *
 * <p>It is deliberately NOT an entity-level {@code @SQLRestriction}. That applies to the
 * single-id loader too on Hibernate 6.6, so a to-one association from an {@code Order} to a
 * tombstoned customer threw {@code EntityNotFoundException} — breaking the Stripe webhook's
 * fulfilment path, which is the one thing the tombstone exists to keep working. Inherited
 * {@code findById} stays unfiltered for exactly that reason.
 */
public interface UserRepository extends JpaRepository<User, Long> {

    @Query("SELECT u FROM User u WHERE u.email = :email AND u.deletedAt IS NULL")
    Optional<User> findByEmail(@Param("email") String email);

    /**
     * Tombstone-aware by-id lookup, for resolving a user the <em>request</em> named.
     *
     * <p>Inherited {@code findById} has to stay unfiltered so {@code order.getUser()} keeps
     * resolving a deleted customer, but that made it the wrong tool for every id that arrives from
     * a client: {@code POST /api/follows/{id}} against a tombstoned account wrote a live Follow row
     * pointing at a deleted user, and the profile-feed read exposed it as a normal account. Use
     * this for any id a caller supplies; use {@code findById} only for genuinely historical,
     * record-keeping navigation.
     */
    @Query("SELECT u FROM User u WHERE u.id = :id AND u.deletedAt IS NULL")
    Optional<User> findActiveById(@Param("id") Long id);

    @Query("SELECT u FROM User u WHERE u.verificationToken = :token AND u.deletedAt IS NULL")
    Optional<User> findByVerificationToken(@Param("token") String verificationToken);

    @Query("SELECT COUNT(u) > 0 FROM User u "
           + "WHERE LOWER(u.username) = LOWER(:username) AND u.deletedAt IS NULL")
    boolean existsByUsernameIgnoreCase(@Param("username") String username);

    @Query("SELECT u FROM User u "
           + "WHERE LOWER(u.username) = LOWER(:username) AND u.deletedAt IS NULL")
    Optional<User> findByUsernameIgnoreCase(@Param("username") String username);

    /** Backs the admin bootstrap's idempotence check (see AdminBootstrap). */
    @Query("SELECT COUNT(u) FROM User u WHERE u.role = :role AND u.deletedAt IS NULL")
    long countByRole(@Param("role") Role role);
}
