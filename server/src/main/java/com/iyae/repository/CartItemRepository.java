package com.iyae.repository;

import com.iyae.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CartItemRepository extends JpaRepository<CartItem, Long> {
    List<CartItem> findByCartId(Long cartId);
    Optional<CartItem> findByCartIdAndProductId(Long cartId, Long productId);
    Optional<CartItem> findByCartIdAndProductIdAndSelectedSize(Long cartId, Long productId, String selectedSize);
    void deleteByCartId(Long cartId);
}
