package com.iyae.service;

import com.iyae.dto.SavedProductResponse;
import com.iyae.entity.Product;
import com.iyae.entity.SavedProduct;
import com.iyae.entity.User;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.SavedProductRepository;
import com.iyae.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class SavedProductService {

    private final SavedProductRepository savedProductRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<SavedProductResponse> getSavedProducts(String email) {
        User user = resolveUser(email);
        return savedProductRepository.findByUserIdNewestFirst(user.getId())
                .stream()
                .map(SavedProductResponse::from)
                .toList();
    }

    /**
     * Idempotent: saving an already-saved product returns the existing entry
     * rather than erroring or creating a duplicate. That is what lets the client
     * replay a localStorage wishlist on first sign-in without having to diff it
     * first, and it makes a double-tapped heart harmless.
     */
    @Transactional
    public SavedProductResponse saveProduct(String email, Long productId) {
        User user = resolveUser(email);
        Product product = resolvePublishedProduct(productId);

        return savedProductRepository.findByUserIdAndProductId(user.getId(), productId)
                .map(SavedProductResponse::from)
                .orElseGet(() -> SavedProductResponse.from(
                        savedProductRepository.save(
                                SavedProduct.builder().user(user).product(product).build()
                        )
                ));
    }

    /** Also idempotent — removing something that is not saved is not an error. */
    @Transactional
    public void removeProduct(String email, Long productId) {
        User user = resolveUser(email);
        savedProductRepository.findByUserIdAndProductId(user.getId(), productId)
                .ifPresent(savedProductRepository::delete);
    }

    /**
     * Only PUBLISHED products can be saved, and anything else reports the same
     * "Product not found" as a missing id so the error cannot reveal that a
     * DRAFT exists.
     *
     * <p>Deliberately simpler than {@code ProductService.getProductById}, which
     * additionally exempts the owning designer. Saving one's own unpublished
     * draft is not a use case — a wishlist is a shopper feature — and that gate
     * already exists in two places that have to be kept in sync. A third copy
     * would be a liability, so this does not have one.
     */
    private Product resolvePublishedProduct(Long productId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
        if (product.getStatus() != ProductStatus.PUBLISHED) {
            throw new IllegalArgumentException("Product not found: " + productId);
        }
        return product;
    }

    private User resolveUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
    }
}
