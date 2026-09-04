package com.clossette.service;

import com.clossette.dto.AddCartItemRequest;
import com.clossette.dto.CartResponse;
import com.clossette.entity.Cart;
import com.clossette.entity.CartItem;
import com.clossette.entity.Product;
import com.clossette.entity.User;
import com.clossette.entity.enums.Role;
import com.clossette.repository.CartItemRepository;
import com.clossette.repository.CartRepository;
import com.clossette.repository.ProductRepository;
import com.clossette.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CartServiceTest {

    @Mock
    CartRepository cartRepository;

    @Mock
    CartItemRepository cartItemRepository;

    @Mock
    UserRepository userRepository;

    @Mock
    ProductRepository productRepository;

    @InjectMocks
    CartService cartService;

    private User testUser;
    private Cart testCart;
    private Product testProduct;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L)
                .email("buyer@example.com")
                .passwordHash("$2a$10$hash")
                .name("Buyer")
                .role(Role.BUYER)
                .build();

        testCart = Cart.builder()
                .id(10L)
                .user(testUser)
                .build();

        testProduct = Product.builder()
                .id(100L)
                .name("Test Dress")
                .price(new BigDecimal("99.99"))
                .sizes("[\"S\",\"M\",\"L\"]")
                .build();
    }

    @Test
    void getCart_existingCart_returnsCart() {
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of());

        CartResponse response = cartService.getCart("buyer@example.com");

        assertThat(response.id()).isEqualTo(10L);
        assertThat(response.items()).isEmpty();
    }

    @Test
    void getCart_noExistingCart_createsNewCart() {
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(cartRepository.save(any(Cart.class))).thenReturn(testCart);
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of());

        CartResponse response = cartService.getCart("buyer@example.com");

        assertThat(response.id()).isEqualTo(10L);
        verify(cartRepository).save(any(Cart.class));
    }

    @Test
    void addItem_newProduct_createsCartItem() {
        AddCartItemRequest request = new AddCartItemRequest(100L, 2, "M");

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(cartItemRepository.findByCartIdAndProductIdAndSelectedSize(10L, 100L, "M")).thenReturn(Optional.empty());
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of());

        cartService.addItem("buyer@example.com", request);

        verify(cartItemRepository).save(any(CartItem.class));
    }

    @Test
    void addItem_existingProduct_incrementsQuantity() {
        AddCartItemRequest request = new AddCartItemRequest(100L, 1, "M");
        CartItem existingItem = CartItem.builder()
                .id(200L)
                .cart(testCart)
                .product(testProduct)
                .quantity(3)
                .selectedSize("M")
                .build();

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(cartItemRepository.findByCartIdAndProductIdAndSelectedSize(10L, 100L, "M")).thenReturn(Optional.of(existingItem));
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of(existingItem));

        cartService.addItem("buyer@example.com", request);

        assertThat(existingItem.getQuantity()).isEqualTo(4);
        verify(cartItemRepository, never()).save(any(CartItem.class));
    }

    @Test
    void removeItem_owned_deletesItem() {
        CartItem item = CartItem.builder()
                .id(200L)
                .cart(testCart)
                .product(testProduct)
                .quantity(1)
                .selectedSize("M")
                .build();

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(cartItemRepository.findById(200L)).thenReturn(Optional.of(item));
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of());

        cartService.removeItem("buyer@example.com", 200L);

        verify(cartItemRepository).delete(item);
    }

    @Test
    void removeItem_notOwned_throwsIllegalArgumentException() {
        Cart otherCart = Cart.builder().id(99L).user(testUser).build();
        CartItem item = CartItem.builder()
                .id(200L)
                .cart(otherCart)
                .product(testProduct)
                .quantity(1)
                .selectedSize("M")
                .build();

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(cartItemRepository.findById(200L)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> cartService.removeItem("buyer@example.com", 200L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Cart item not found");
    }

    @Test
    void getCart_unknownUser_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> cartService.getCart("ghost@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }

    // ---- size-aware tests ----

    @Test
    void addItem_sameProductSameSize_incrementsQuantity() {
        AddCartItemRequest request = new AddCartItemRequest(100L, 2, "M");
        CartItem existingItem = CartItem.builder()
                .id(201L)
                .cart(testCart)
                .product(testProduct)
                .quantity(1)
                .selectedSize("M")
                .build();

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(cartItemRepository.findByCartIdAndProductIdAndSelectedSize(10L, 100L, "M")).thenReturn(Optional.of(existingItem));
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of(existingItem));

        cartService.addItem("buyer@example.com", request);

        assertThat(existingItem.getQuantity()).isEqualTo(3);
        verify(cartItemRepository, never()).save(any(CartItem.class));
    }

    @Test
    void addItem_sameProductDifferentSize_createsNewItem() {
        AddCartItemRequest request = new AddCartItemRequest(100L, 1, "L");
        CartItem existingMItem = CartItem.builder()
                .id(201L)
                .cart(testCart)
                .product(testProduct)
                .quantity(1)
                .selectedSize("M")
                .build();

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));
        when(cartItemRepository.findByCartIdAndProductIdAndSelectedSize(10L, 100L, "L")).thenReturn(Optional.empty());
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of(existingMItem));

        cartService.addItem("buyer@example.com", request);

        verify(cartItemRepository).save(any(CartItem.class));
    }

    @Test
    void addItem_invalidSize_throwsException() {
        AddCartItemRequest request = new AddCartItemRequest(100L, 1, "XXL");

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(productRepository.findById(100L)).thenReturn(Optional.of(testProduct));

        assertThatThrownBy(() -> cartService.addItem("buyer@example.com", request))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void addItem_noSizesProduct_acceptsOneSize() {
        Product noSizesProduct = Product.builder()
                .id(101L)
                .name("One Size Scarf")
                .price(new BigDecimal("29.99"))
                .sizes(null)
                .build();

        AddCartItemRequest request = new AddCartItemRequest(101L, 1, "ONE_SIZE");

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(productRepository.findById(101L)).thenReturn(Optional.of(noSizesProduct));
        when(cartItemRepository.findByCartIdAndProductIdAndSelectedSize(10L, 101L, "ONE_SIZE")).thenReturn(Optional.empty());
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of());

        cartService.addItem("buyer@example.com", request);

        verify(cartItemRepository).save(any(CartItem.class));
    }
}
