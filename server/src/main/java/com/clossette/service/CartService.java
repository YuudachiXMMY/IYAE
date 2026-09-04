package com.clossette.service;

import com.clossette.dto.AddCartItemRequest;
import com.clossette.dto.CartResponse;
import com.clossette.dto.UpdateCartItemRequest;
import com.clossette.entity.Cart;
import com.clossette.entity.CartItem;
import com.clossette.entity.Product;
import com.clossette.entity.User;
import com.clossette.repository.CartItemRepository;
import com.clossette.repository.CartRepository;
import com.clossette.repository.ProductRepository;
import com.clossette.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CartService {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;

    // -------------------------------------------------------------------------
    // GET /api/cart — get-or-create cart for current user
    // -------------------------------------------------------------------------

    @Transactional
    public CartResponse getCart(String email) {
        User user = requireUser(email);
        Cart cart = getOrCreateCart(user);
        return buildResponse(cart);
    }

    // -------------------------------------------------------------------------
    // POST /api/cart/items — add item; increment quantity if already present
    // -------------------------------------------------------------------------

    @Transactional
    public CartResponse addItem(String email, AddCartItemRequest request) {
        User user = requireUser(email);
        Cart cart = getOrCreateCart(user);
        Product product = requireProduct(request.productId());
        String selectedSize = request.selectedSize() != null ? request.selectedSize().trim() : "ONE_SIZE";

        validateSelectedSize(product, selectedSize);

        cartItemRepository.findByCartIdAndProductIdAndSelectedSize(cart.getId(), product.getId(), selectedSize)
                .ifPresentOrElse(
                        existing -> existing.setQuantity(existing.getQuantity() + request.quantity()),
                        () -> {
                            CartItem newItem = CartItem.builder()
                                    .cart(cart)
                                    .product(product)
                                    .quantity(request.quantity())
                                    .selectedSize(selectedSize)
                                    .build();
                            cartItemRepository.save(newItem);
                        }
                );

        return buildResponse(cart);
    }

    // -------------------------------------------------------------------------
    // PUT /api/cart/items/{id} — update quantity; quantity=0 deletes the item
    // -------------------------------------------------------------------------

    @Transactional
    public CartResponse updateItem(String email, Long itemId, UpdateCartItemRequest request) {
        User user = requireUser(email);
        Cart cart = getOrCreateCart(user);
        CartItem item = requireOwnedItem(itemId, cart.getId());

        if (request.quantity() == 0) {
            cartItemRepository.delete(item);
        } else {
            item.setQuantity(request.quantity());
        }

        return buildResponse(cart);
    }

    // -------------------------------------------------------------------------
    // DELETE /api/cart/items/{id} — remove item from cart
    // -------------------------------------------------------------------------

    @Transactional
    public CartResponse removeItem(String email, Long itemId) {
        User user = requireUser(email);
        Cart cart = getOrCreateCart(user);
        CartItem item = requireOwnedItem(itemId, cart.getId());
        cartItemRepository.delete(item);
        return buildResponse(cart);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
    }

    private Product requireProduct(Long productId) {
        return productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
    }

    private Cart getOrCreateCart(User user) {
        return cartRepository.findByUserId(user.getId())
                .orElseGet(() -> cartRepository.save(Cart.builder().user(user).build()));
    }

    private CartItem requireOwnedItem(Long itemId, Long cartId) {
        CartItem item = cartItemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Cart item not found: " + itemId));
        if (!item.getCart().getId().equals(cartId)) {
            throw new IllegalArgumentException("Cart item not found: " + itemId);
        }
        return item;
    }

    private CartResponse buildResponse(Cart cart) {
        List<CartResponse.CartItemResponse> items = cartItemRepository.findByCartId(cart.getId())
                .stream()
                .map(CartResponse.CartItemResponse::from)
                .toList();
        return new CartResponse(cart.getId(), items);
    }

    private void validateSelectedSize(Product product, String selectedSize) {
        String trimmed = selectedSize.trim();
        List<String> sizes = parseProductSizes(product);
        if (sizes.isEmpty()) {
            if (!"ONE_SIZE".equals(trimmed)) {
                throw new IllegalArgumentException("Product has no sizes; use ONE_SIZE");
            }
            return;
        }
        if (!sizes.contains(trimmed)) {
            throw new IllegalArgumentException("Invalid size: " + trimmed + ". Available: " + sizes);
        }
    }

    private List<String> parseProductSizes(Product product) {
        String json = product.getSizes();
        if (json == null || json.isBlank()) {
            return Collections.emptyList();
        }
        try {
            return OBJECT_MAPPER.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }
}
