package com.iyae.service;

import com.iyae.dto.PromotionRequest;
import com.iyae.dto.PromotionResponse;
import com.iyae.entity.Promotion;
import com.iyae.entity.enums.SlotType;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.PromotionRepository;
import com.iyae.repository.UserRepository;
import com.iyae.testsupport.TestProducts;
import com.iyae.testsupport.TestUsers;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PromotionServiceTest {

    @Mock
    PromotionRepository promotionRepository;

    @Mock
    ProductRepository productRepository;

    @Mock
    UserRepository userRepository;

    @InjectMocks
    PromotionService promotionService;

    @Test
    void getFeatured_returnsActivePromotions() {
        Promotion promo = buildPromotion(1L, SlotType.FEATURED);
        when(promotionRepository.findActiveBySlotType(eq(SlotType.FEATURED), any(Instant.class)))
                .thenReturn(List.of(promo));

        List<PromotionResponse> result = promotionService.getFeatured();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).slotType()).isEqualTo(SlotType.FEATURED);
    }

    @Test
    void getFeatured_noActivePromotions_returnsEmpty() {
        when(promotionRepository.findActiveBySlotType(eq(SlotType.FEATURED), any(Instant.class)))
                .thenReturn(List.of());

        List<PromotionResponse> result = promotionService.getFeatured();

        assertThat(result).isEmpty();
    }

    @Test
    void getDesignerPromotions_returnsPromotionsForUser() {
        var designer = TestUsers.aDesigner();
        Promotion promo = buildPromotion(2L, SlotType.SPONSORED);
        when(userRepository.findByEmail(designer.getEmail())).thenReturn(Optional.of(designer));
        when(promotionRepository.findByDesignerUserId(designer.getId())).thenReturn(List.of(promo));

        List<PromotionResponse> result = promotionService.getDesignerPromotions(designer.getEmail());

        assertThat(result).hasSize(1);
    }

    @Test
    void createPromotion_ownedProduct_savesPromotion() {
        var designer = TestUsers.aDesigner();
        var product = TestProducts.aPublishedProduct();
        Instant start = Instant.now();
        Instant end = start.plusSeconds(3600);
        PromotionRequest request = new PromotionRequest(product.getId(), SlotType.FEATURED, 10, start, end);
        Promotion saved = buildPromotion(3L, SlotType.FEATURED);

        when(userRepository.findByEmail(designer.getEmail())).thenReturn(Optional.of(designer));
        when(productRepository.findById(product.getId())).thenReturn(Optional.of(product));
        when(promotionRepository.save(any(Promotion.class))).thenReturn(saved);

        PromotionResponse result = promotionService.createPromotion(designer.getEmail(), request);

        assertThat(result.id()).isEqualTo(3L);
        verify(promotionRepository).save(any(Promotion.class));
    }

    @Test
    void createPromotion_productNotOwnedByUser_throwsIllegalArgumentException() {
        var buyer = TestUsers.aBuyer();
        var product = TestProducts.aPublishedProduct(); // owned by designer (id=2), not buyer (id=1)
        Instant start = Instant.now();
        PromotionRequest request = new PromotionRequest(product.getId(), SlotType.FEATURED, 5, start, start.plusSeconds(3600));

        when(userRepository.findByEmail(buyer.getEmail())).thenReturn(Optional.of(buyer));
        when(productRepository.findById(product.getId())).thenReturn(Optional.of(product));

        assertThatThrownBy(() -> promotionService.createPromotion(buyer.getEmail(), request))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updatePromotion_owned_updatesFields() {
        var designer = TestUsers.aDesigner();
        Promotion promo = buildPromotion(5L, SlotType.FEATURED);
        Instant newEnd = Instant.now().plusSeconds(7200);
        PromotionRequest request = new PromotionRequest(1L, SlotType.SPONSORED, 20, null, newEnd);

        when(userRepository.findByEmail(designer.getEmail())).thenReturn(Optional.of(designer));
        when(promotionRepository.findByIdAndProductDesignerProfileUserId(5L, designer.getId()))
                .thenReturn(Optional.of(promo));
        when(promotionRepository.save(promo)).thenReturn(promo);

        PromotionResponse result = promotionService.updatePromotion(designer.getEmail(), 5L, request);

        assertThat(result).isNotNull();
        verify(promotionRepository).save(promo);
    }

    @Test
    void updatePromotion_notOwned_throwsIllegalArgumentException() {
        var designer = TestUsers.aDesigner();
        when(userRepository.findByEmail(designer.getEmail())).thenReturn(Optional.of(designer));
        when(promotionRepository.findByIdAndProductDesignerProfileUserId(99L, designer.getId()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> promotionService.updatePromotion(designer.getEmail(), 99L,
                new PromotionRequest(1L, SlotType.FEATURED, 1, Instant.now(), Instant.now().plusSeconds(60))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Promotion not found");
    }

    @Test
    void deletePromotion_owned_deletesPromotion() {
        var designer = TestUsers.aDesigner();
        Promotion promo = buildPromotion(7L, SlotType.FEATURED);

        when(userRepository.findByEmail(designer.getEmail())).thenReturn(Optional.of(designer));
        when(promotionRepository.findByIdAndProductDesignerProfileUserId(7L, designer.getId()))
                .thenReturn(Optional.of(promo));

        promotionService.deletePromotion(designer.getEmail(), 7L);

        verify(promotionRepository).delete(promo);
    }

    @Test
    void deletePromotion_notOwned_throwsIllegalArgumentException() {
        var designer = TestUsers.aDesigner();
        when(userRepository.findByEmail(designer.getEmail())).thenReturn(Optional.of(designer));
        when(promotionRepository.findByIdAndProductDesignerProfileUserId(99L, designer.getId()))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> promotionService.deletePromotion(designer.getEmail(), 99L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Promotion not found");
    }

    // -------------------------------------------------------------------------

    private Promotion buildPromotion(Long id, SlotType slotType) {
        var product = TestProducts.aPublishedProduct();
        return Promotion.builder()
                .id(id)
                .product(product)
                .slotType(slotType)
                .weight(10)
                .startAt(Instant.now().minusSeconds(60))
                .endAt(Instant.now().plusSeconds(3600))
                .build();
    }
}
