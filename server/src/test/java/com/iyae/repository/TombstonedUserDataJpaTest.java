package com.iyae.repository;

import com.iyae.entity.Order;
import com.iyae.entity.User;
import com.iyae.entity.enums.OrderStatus;
import com.iyae.entity.enums.Role;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the two halves of the account-deletion tombstone against a real persistence context.
 *
 * <p>This exists because the first implementation got it wrong in a way no mocked-repository
 * test could see. It put {@code @SQLRestriction("deleted_at is null")} on the {@code User}
 * entity, on the belief that Hibernate exempts by-id and to-one association loads. It does not:
 * the restriction is baked into every loader, so {@code order.getUser()} on a tombstoned
 * customer threw {@code EntityNotFoundException} — and
 * {@code CheckoutService.fulfillPaidSession} dereferences it four times, so a buyer who
 * deleted their account between checkout and Stripe's webhook broke their own fulfilment.
 *
 * <p>The filtering now lives on {@code UserRepository}'s identity lookups. Both properties are
 * asserted here because they pull in opposite directions and a future change to either side
 * would otherwise go unnoticed.
 */
@DataJpaTest
@ActiveProfiles("test")
class TombstonedUserDataJpaTest {

    @Autowired UserRepository userRepository;
    @Autowired OrderRepository orderRepository;
    @Autowired EntityManager entityManager;

    private User persistTombstonedUser() {
        User user = userRepository.save(User.builder()
                .email("gone@test.com")
                .passwordHash("$2a$10$hash")
                .name("Deleted account")
                .username("goneuser")
                .role(Role.BUYER)
                .emailVerified(true)
                .build());
        user.setDeletedAt(Instant.now());
        return userRepository.save(user);
    }

    @Test
    void identityLookupsCannotSeeATombstonedAccount() {
        persistTombstonedUser();
        entityManager.flush();
        entityManager.clear();

        // Login, the JWT filter, registration's duplicate check and the public profile all go
        // through these. A tombstoned account must be indistinguishable from one that never
        // existed — including for the duplicate checks, so the address and handle are free
        // for someone else.
        assertThat(userRepository.findByEmail("gone@test.com")).isEmpty();
        assertThat(userRepository.findByUsernameIgnoreCase("goneuser")).isEmpty();
        assertThat(userRepository.existsByUsernameIgnoreCase("goneuser")).isFalse();
        assertThat(userRepository.countByRole(Role.BUYER)).isZero();
    }

    @Test
    void anOrderStillResolvesItsDeletedCustomer() {
        User user = persistTombstonedUser();
        Order order = orderRepository.save(Order.builder()
                .user(user)
                .status(OrderStatus.PAID)
                .totalAmount(new BigDecimal("59.99"))
                .paymentStatus("PAID")
                .itemsSnapshot("[]")
                .build());
        Long orderId = order.getId();
        entityManager.flush();
        entityManager.clear();

        Order reloaded = orderRepository.findById(orderId).orElseThrow();

        // The whole point of tombstoning instead of deleting: the financial record keeps its
        // customer reference. Dereferencing the association must not throw.
        assertThat(reloaded.getUser()).isNotNull();
        assertThat(reloaded.getUser().getId()).isEqualTo(user.getId());
    }

    @Test
    void findByIdStillReturnsATombstonedAccount() {
        User user = persistTombstonedUser();
        entityManager.flush();
        entityManager.clear();

        // Deliberately unfiltered — this is the loader the association above uses. Filtering it
        // is what broke the webhook.
        assertThat(userRepository.findById(user.getId())).isPresent();
    }

    @Test
    void aLiveAccountIsUnaffected() {
        userRepository.save(User.builder()
                .email("here@test.com")
                .passwordHash("$2a$10$hash")
                .name("Live")
                .username("liveuser")
                .role(Role.BUYER)
                .emailVerified(true)
                .build());
        entityManager.flush();
        entityManager.clear();

        assertThat(userRepository.findByEmail("here@test.com")).isPresent();
        assertThat(userRepository.findByUsernameIgnoreCase("LIVEUSER")).isPresent();
        assertThat(userRepository.existsByUsernameIgnoreCase("liveuser")).isTrue();
        assertThat(userRepository.countByRole(Role.BUYER)).isEqualTo(1);
    }
}
