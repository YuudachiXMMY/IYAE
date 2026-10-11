package com.iyae.repository;

import com.iyae.entity.Cart;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CartRepository extends JpaRepository<Cart, Long> {
    Optional<Cart> findByUserId(Long userId);

    // Account deletion (AccountDeletionService): removes this user's cart.
    void deleteByUserId(Long userId);

}
