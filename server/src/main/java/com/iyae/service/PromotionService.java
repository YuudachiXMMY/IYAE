package com.iyae.service;

import com.iyae.dto.PromotionRequest;
import com.iyae.dto.PromotionResponse;
import com.iyae.entity.Product;
import com.iyae.entity.Promotion;
import com.iyae.entity.User;
import com.iyae.entity.enums.SlotType;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.PromotionRepository;
import com.iyae.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PromotionService {

    private final PromotionRepository promotionRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<PromotionResponse> getFeatured() {
        return promotionRepository.findActiveBySlotType(SlotType.FEATURED, Instant.now())
                .stream()
                .map(PromotionResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PromotionResponse> getDesignerPromotions(String email) {
        User user = resolveUser(email);
        return promotionRepository.findByDesignerUserId(user.getId())
                .stream()
                .map(PromotionResponse::from)
                .toList();
    }

    @Transactional
    public PromotionResponse createPromotion(String email, PromotionRequest request) {
        User user = resolveUser(email);
        Product product = resolveOwnedProduct(request.productId(), user.getId());

        Promotion promotion = Promotion.builder()
                .product(product)
                .slotType(request.slotType())
                .weight(request.weight() != null ? request.weight() : 0)
                .startAt(request.startAt())
                .endAt(request.endAt())
                .build();

        return PromotionResponse.from(promotionRepository.save(promotion));
    }

    @Transactional
    public PromotionResponse updatePromotion(String email, Long id, PromotionRequest request) {
        User user = resolveUser(email);
        Promotion promotion = promotionRepository.findByIdAndProductDesignerProfileUserId(id, user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Promotion not found: " + id));

        if (request.slotType() != null) {
            promotion.setSlotType(request.slotType());
        }
        if (request.weight() != null) {
            promotion.setWeight(request.weight());
        }
        if (request.startAt() != null) {
            promotion.setStartAt(request.startAt());
        }
        if (request.endAt() != null) {
            promotion.setEndAt(request.endAt());
        }

        return PromotionResponse.from(promotionRepository.save(promotion));
    }

    @Transactional
    public void deletePromotion(String email, Long id) {
        User user = resolveUser(email);
        Promotion promotion = promotionRepository.findByIdAndProductDesignerProfileUserId(id, user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Promotion not found: " + id));
        promotionRepository.delete(promotion);
    }

    private User resolveUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
    }

    private Product resolveOwnedProduct(Long productId, Long userId) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
        if (!product.getDesignerProfile().getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Product not found: " + productId);
        }
        return product;
    }
}
