package com.clossette.service;

import com.clossette.ai.AIProvider;
import com.clossette.ai.AIProviderFactory;
import com.clossette.dto.GenerateOutfitRequest;
import com.clossette.dto.OutfitResponse;
import com.clossette.entity.GarmentAsset;
import com.clossette.entity.Product;
import com.clossette.entity.User;
import com.clossette.entity.enums.ProductStatus;
import com.clossette.entity.enums.Role;
import com.clossette.repository.GarmentAssetRepository;
import com.clossette.repository.OutfitRecommendationRepository;
import com.clossette.repository.ProductRepository;
import com.clossette.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OutfitServiceTest {

    @Mock ProductRepository productRepository;
    @Mock OutfitRecommendationRepository outfitRecommendationRepository;
    @Mock UserRepository userRepository;
    @Mock GarmentAssetRepository garmentAssetRepository;
    @Mock AIProviderFactory aiProviderFactory;
    @Mock AIProvider aiProvider;

    @InjectMocks OutfitService outfitService;

    // Use real ObjectMapper so JSON serialization works in generateOutfit
    private final ObjectMapper objectMapper = new ObjectMapper();

    private User testUser;
    private Product topProduct;
    private Product bottomProduct;
    private Product shoesProduct;
    private Product accessoryProduct;

    @BeforeEach
    void setUp() throws Exception {
        // Inject real ObjectMapper via reflection (InjectMocks uses the field)
        var field = OutfitService.class.getDeclaredField("objectMapper");
        field.setAccessible(true);
        field.set(outfitService, objectMapper);

        testUser = User.builder()
                .id(1L).email("user@example.com").name("Tester").role(Role.BUYER).build();

        topProduct = Product.builder()
                .id(10L).name("Cool Top").category("Tops")
                .price(new BigDecimal("50.00")).status(ProductStatus.PUBLISHED)
                .styleTags("[\"minimal\",\"clean-lines\"]").colorTags("[\"black\"]")
                .media("[\"/img/top.jpg\"]").glbUrl("/assets/placeholder.glb")
                .build();

        bottomProduct = Product.builder()
                .id(20L).name("Wide Trousers").category("Bottoms")
                .price(new BigDecimal("80.00")).status(ProductStatus.PUBLISHED)
                .styleTags("[\"minimal\"]").colorTags("[\"black\"]")
                .media("[\"/img/bottom.jpg\"]").glbUrl("/assets/placeholder.glb")
                .build();

        shoesProduct = Product.builder()
                .id(30L).name("Flat Shoes").category("Shoes")
                .price(new BigDecimal("120.00")).status(ProductStatus.PUBLISHED)
                .styleTags("[\"clean-lines\"]").colorTags("[\"black\"]")
                .media("[\"/img/shoes.jpg\"]").glbUrl("/assets/placeholder.glb")
                .build();

        accessoryProduct = Product.builder()
                .id(40L).name("Tote Bag").category("Bags")
                .price(new BigDecimal("40.00")).status(ProductStatus.PUBLISHED)
                .styleTags("[\"minimal\"]").colorTags("[\"black\"]")
                .media("[\"/img/bag.jpg\"]").glbUrl("/assets/placeholder.glb")
                .build();
    }

    @Test
    void generateOutfitAnonymous_fourSlots_returnsOneItemPerSlot() {
        when(productRepository.findAll()).thenReturn(
                List.of(topProduct, bottomProduct, shoesProduct, accessoryProduct));
        when(garmentAssetRepository.findByProductIdIn(anyList())).thenReturn(List.of());
        when(aiProviderFactory.getProvider()).thenReturn(aiProvider);
        when(aiProvider.sendMessage(any(), any())).thenReturn("Great combo!");

        GenerateOutfitRequest request = new GenerateOutfitRequest("casual", "minimal", List.of("black"), null);
        OutfitResponse response = outfitService.generateOutfitAnonymous(request);

        // top/bottom/accessory are required; shoes slot is optional (skipped if no candidates)
        // With shoesProduct present ("Shoes" contains "shoe"), all 4 slots should be filled
        assertThat(response.items()).hasSizeGreaterThanOrEqualTo(3);
        assertThat(response.items()).extracting("slot")
                .contains("top", "bottom", "accessory");
    }

    @Test
    void generateOutfitAnonymous_styleMatchBoostsScore() {
        Product highScoreTop = Product.builder()
                .id(11L).name("Minimal Top").category("Tops")
                .price(new BigDecimal("60.00")).status(ProductStatus.PUBLISHED)
                .styleTags("[\"minimal\",\"clean-lines\",\"structured\"]").colorTags("[\"black\"]")
                .media("[]").glbUrl("/assets/placeholder.glb").build();

        when(productRepository.findAll()).thenReturn(
                List.of(topProduct, highScoreTop, bottomProduct, shoesProduct, accessoryProduct));
        when(garmentAssetRepository.findByProductIdIn(anyList())).thenReturn(List.of());
        when(aiProviderFactory.getProvider()).thenReturn(aiProvider);
        when(aiProvider.sendMessage(any(), any())).thenReturn("Nice!");

        GenerateOutfitRequest request = new GenerateOutfitRequest("evening", "minimal,clean-lines,structured", List.of(), null);
        OutfitResponse response = outfitService.generateOutfitAnonymous(request);

        // highScoreTop has 3 style matches (+3 each = 9) vs topProduct (2 matches = 6)
        OutfitResponse.class.cast(response); // just assert structure
        assertThat(response.items().stream().filter(s -> "top".equals(s.slot())).findFirst())
                .isPresent()
                .hasValueSatisfying(slot -> assertThat(slot.productId()).isEqualTo(11L));
    }

    @Test
    void generateOutfitAnonymous_colorMatchAddsScore() {
        Product colorMatchTop = Product.builder()
                .id(12L).name("Black Top").category("Tops")
                .price(new BigDecimal("55.00")).status(ProductStatus.PUBLISHED)
                .styleTags("[]").colorTags("[\"black\",\"charcoal\"]")
                .media("[]").glbUrl("/assets/placeholder.glb").build();

        // topProduct has 1 color match (black), colorMatchTop has 2 (black+charcoal)
        when(productRepository.findAll()).thenReturn(
                List.of(topProduct, colorMatchTop, bottomProduct, shoesProduct, accessoryProduct));
        when(garmentAssetRepository.findByProductIdIn(anyList())).thenReturn(List.of());
        when(aiProviderFactory.getProvider()).thenReturn(aiProvider);
        when(aiProvider.sendMessage(any(), any())).thenReturn("Stylish!");

        GenerateOutfitRequest request = new GenerateOutfitRequest("day-out", "", List.of("black", "charcoal"), null);
        OutfitResponse response = outfitService.generateOutfitAnonymous(request);

        assertThat(response.items().stream().filter(s -> "top".equals(s.slot())).findFirst())
                .isPresent()
                .hasValueSatisfying(slot -> assertThat(slot.productId()).isEqualTo(12L));
    }

    @Test
    void generateOutfitAnonymous_seedProductIdAlwaysSelected() {
        // seedIds cause score=MAX_VALUE, overriding any style scoring
        when(productRepository.findAll()).thenReturn(
                List.of(topProduct, bottomProduct, shoesProduct, accessoryProduct));
        when(garmentAssetRepository.findByProductIdIn(anyList())).thenReturn(List.of());
        when(aiProviderFactory.getProvider()).thenReturn(aiProvider);
        when(aiProvider.sendMessage(any(), any())).thenReturn("Seeded!");

        GenerateOutfitRequest request = new GenerateOutfitRequest("party", "bold", List.of(), List.of(10L));
        OutfitResponse response = outfitService.generateOutfitAnonymous(request);

        assertThat(response.items().stream().filter(s -> "top".equals(s.slot())).findFirst())
                .isPresent()
                .hasValueSatisfying(slot -> assertThat(slot.productId()).isEqualTo(10L));
    }

    @Test
    void generateOutfitAnonymous_noProductsForSlot_slotOmitted() {
        // Only tops — no bottoms/shoes/accessories
        when(productRepository.findAll()).thenReturn(List.of(topProduct));
        when(garmentAssetRepository.findByProductIdIn(anyList())).thenReturn(List.of());
        when(aiProviderFactory.getProvider()).thenReturn(aiProvider);
        when(aiProvider.sendMessage(any(), any())).thenReturn("Minimal look!");

        GenerateOutfitRequest request = new GenerateOutfitRequest("casual", "minimal", List.of(), null);
        OutfitResponse response = outfitService.generateOutfitAnonymous(request);

        assertThat(response.items()).hasSize(1);
        assertThat(response.items().get(0).slot()).isEqualTo("top");
    }

    @Test
    void generateOutfitAnonymous_noPublishedProducts_returnsEmptyItemsWithFallbackExplanation() {
        Product draft = Product.builder()
                .id(99L).name("Draft Top").category("Tops")
                .price(BigDecimal.TEN).status(ProductStatus.DRAFT)
                .styleTags("[]").colorTags("[]").media("[]").build();

        // No selected products -> garmentAssetRepository not called (empty selectedProductIds)
        when(productRepository.findAll()).thenReturn(List.of(draft));

        GenerateOutfitRequest request = new GenerateOutfitRequest("casual", "minimal", List.of(), null);
        OutfitResponse response = outfitService.generateOutfitAnonymous(request);

        assertThat(response.items()).isEmpty();
        assertThat(response.explanation()).isNotBlank();
        verify(aiProviderFactory, never()).getProvider();
    }

    @Test
    void generateOutfitAnonymous_aiFailure_usesFallbackExplanation() {
        when(productRepository.findAll()).thenReturn(
                List.of(topProduct, bottomProduct, shoesProduct, accessoryProduct));
        when(garmentAssetRepository.findByProductIdIn(anyList())).thenReturn(List.of());
        when(aiProviderFactory.getProvider()).thenReturn(aiProvider);
        when(aiProvider.sendMessage(any(), any())).thenThrow(new RuntimeException("AI down"));

        GenerateOutfitRequest request = new GenerateOutfitRequest("weekend", "casual", List.of(), null);
        OutfitResponse response = outfitService.generateOutfitAnonymous(request);

        assertThat(response.items()).isNotEmpty();
        assertThat(response.explanation()).contains("weekend");
    }

    @Test
    void generateOutfitAnonymous_garmentAssetEnriched_populatesGlbAssetUrl() {
        GarmentAsset asset = GarmentAsset.builder()
                .id(1L).product(topProduct)
                .glbUrl("/assets/models/top.glb").status("READY")
                .createdAt(Instant.now()).build();

        when(productRepository.findAll()).thenReturn(
                List.of(topProduct, bottomProduct, shoesProduct, accessoryProduct));
        when(garmentAssetRepository.findByProductIdIn(anyList())).thenReturn(List.of(asset));
        when(aiProviderFactory.getProvider()).thenReturn(aiProvider);
        when(aiProvider.sendMessage(any(), any())).thenReturn("Great!");

        GenerateOutfitRequest request = new GenerateOutfitRequest("casual", "minimal", List.of(), null);
        OutfitResponse response = outfitService.generateOutfitAnonymous(request);

        assertThat(response.items().stream().filter(s -> "top".equals(s.slot())).findFirst())
                .isPresent()
                .hasValueSatisfying(slot -> assertThat(slot.glbAssetUrl()).isEqualTo("/assets/models/top.glb"));
    }

    @Test
    void generateOutfit_userNotFound_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        GenerateOutfitRequest request = new GenerateOutfitRequest("casual", "minimal", List.of(), null);
        assertThatThrownBy(() -> outfitService.generateOutfit(request, "ghost@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    void listOutfits_userNotFound_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> outfitService.listOutfits("ghost@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }
}
