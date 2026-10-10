package com.iyae.service;

import com.iyae.dto.SavedProductResponse;
import com.iyae.entity.Product;
import com.iyae.entity.SavedProduct;
import com.iyae.entity.User;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.SavedProductRepository;
import com.iyae.repository.UserRepository;
import com.iyae.testsupport.TestProducts;
import com.iyae.testsupport.TestUsers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SavedProductServiceTest {

    @Mock SavedProductRepository savedProductRepository;
    @Mock ProductRepository productRepository;
    @Mock UserRepository userRepository;

    @InjectMocks SavedProductService savedProductService;

    private User buyer;
    private Product published;

    @BeforeEach
    void setUp() {
        buyer = TestUsers.aBuyer();
        published = TestProducts.aPublishedProduct();
    }

    private SavedProduct anEntry(Product product) {
        return SavedProduct.builder()
                .id(500L).user(buyer).product(product).createdAt(Instant.now()).build();
    }

    // ── read ────────────────────────────────────────────────────────────────

    @Test
    void getSavedProducts_returnsTheUsersEntriesWithTheProductEmbedded() {
        when(userRepository.findByEmail(buyer.getEmail())).thenReturn(Optional.of(buyer));
        when(savedProductRepository.findByUserIdNewestFirst(buyer.getId()))
                .thenReturn(List.of(anEntry(published)));

        List<SavedProductResponse> result = savedProductService.getSavedProducts(buyer.getEmail());

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().productId()).isEqualTo(published.getId());
        // The embedded product is what spares a wishlist surface a request per item.
        assertThat(result.getFirst().product().name()).isEqualTo(published.getName());
    }

    @Test
    void getSavedProducts_returnsEmptyForAUserWhoHasSavedNothing() {
        when(userRepository.findByEmail(buyer.getEmail())).thenReturn(Optional.of(buyer));
        when(savedProductRepository.findByUserIdNewestFirst(buyer.getId())).thenReturn(List.of());

        assertThat(savedProductService.getSavedProducts(buyer.getEmail())).isEmpty();
    }

    @Test
    void getSavedProducts_rejectsAnUnknownUser() {
        when(userRepository.findByEmail("nobody@test.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> savedProductService.getSavedProducts("nobody@test.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }

    // ── save ────────────────────────────────────────────────────────────────

    @Test
    void saveProduct_persistsANewEntry() {
        when(userRepository.findByEmail(buyer.getEmail())).thenReturn(Optional.of(buyer));
        when(productRepository.findById(published.getId())).thenReturn(Optional.of(published));
        when(savedProductRepository.findByUserIdAndProductId(buyer.getId(), published.getId()))
                .thenReturn(Optional.empty());
        when(savedProductRepository.save(any(SavedProduct.class))).thenReturn(anEntry(published));

        SavedProductResponse result =
                savedProductService.saveProduct(buyer.getEmail(), published.getId());

        assertThat(result.productId()).isEqualTo(published.getId());
        verify(savedProductRepository).save(any(SavedProduct.class));
    }

    @Test
    void saveProduct_isIdempotent_returningTheExistingEntryWithoutWriting() {
        // This is what lets a client replay a localStorage wishlist on first
        // sign-in without diffing it, and makes a double-tapped heart harmless.
        SavedProduct existing = anEntry(published);
        when(userRepository.findByEmail(buyer.getEmail())).thenReturn(Optional.of(buyer));
        when(productRepository.findById(published.getId())).thenReturn(Optional.of(published));
        when(savedProductRepository.findByUserIdAndProductId(buyer.getId(), published.getId()))
                .thenReturn(Optional.of(existing));

        SavedProductResponse result =
                savedProductService.saveProduct(buyer.getEmail(), published.getId());

        assertThat(result.id()).isEqualTo(existing.getId());
        verify(savedProductRepository, never()).save(any(SavedProduct.class));
    }

    @Test
    void saveProduct_rejectsAMissingProduct() {
        when(userRepository.findByEmail(buyer.getEmail())).thenReturn(Optional.of(buyer));
        when(productRepository.findById(9999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> savedProductService.saveProduct(buyer.getEmail(), 9999L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Product not found");
    }

    @Test
    void saveProduct_reportsAnUnpublishedProductAsNotFound() {
        // Same message as a genuinely missing id: a DRAFT must not be detectable
        // by trying to save it.
        Product draft = TestProducts.aDraftProduct();
        when(userRepository.findByEmail(buyer.getEmail())).thenReturn(Optional.of(buyer));
        when(productRepository.findById(draft.getId())).thenReturn(Optional.of(draft));

        assertThatThrownBy(() -> savedProductService.saveProduct(buyer.getEmail(), draft.getId()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Product not found: " + draft.getId());
        verify(savedProductRepository, never()).save(any(SavedProduct.class));
    }

    // ── remove ──────────────────────────────────────────────────────────────

    @Test
    void removeProduct_deletesTheUsersOwnEntry() {
        SavedProduct existing = anEntry(published);
        when(userRepository.findByEmail(buyer.getEmail())).thenReturn(Optional.of(buyer));
        when(savedProductRepository.findByUserIdAndProductId(buyer.getId(), published.getId()))
                .thenReturn(Optional.of(existing));

        savedProductService.removeProduct(buyer.getEmail(), published.getId());

        verify(savedProductRepository).delete(existing);
    }

    @Test
    void removeProduct_isIdempotentWhenNothingIsSaved() {
        when(userRepository.findByEmail(buyer.getEmail())).thenReturn(Optional.of(buyer));
        when(savedProductRepository.findByUserIdAndProductId(buyer.getId(), published.getId()))
                .thenReturn(Optional.empty());

        savedProductService.removeProduct(buyer.getEmail(), published.getId());

        verify(savedProductRepository, never()).delete(any(SavedProduct.class));
    }

    @Test
    void removeProduct_scopesTheLookupToTheCallingUser() {
        // The only thing stopping one shopper clearing another's wishlist is that
        // the lookup is keyed on the resolved user id, so assert the id used.
        when(userRepository.findByEmail(buyer.getEmail())).thenReturn(Optional.of(buyer));
        when(savedProductRepository.findByUserIdAndProductId(buyer.getId(), published.getId()))
                .thenReturn(Optional.empty());

        savedProductService.removeProduct(buyer.getEmail(), published.getId());

        verify(savedProductRepository).findByUserIdAndProductId(buyer.getId(), published.getId());
    }
}
