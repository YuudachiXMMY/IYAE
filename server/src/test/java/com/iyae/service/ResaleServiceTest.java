package com.iyae.service;

import com.iyae.dto.CreateResaleListingRequest;
import com.iyae.dto.ResaleEligibleItemResponse;
import com.iyae.dto.ResaleListingResponse;
import com.iyae.entity.Order;
import com.iyae.entity.Product;
import com.iyae.entity.ResaleListing;
import com.iyae.entity.User;
import com.iyae.entity.enums.OrderStatus;
import com.iyae.entity.enums.ResaleCondition;
import com.iyae.entity.enums.ResaleStatus;
import com.iyae.entity.enums.Role;
import com.iyae.repository.OrderRepository;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.ResaleListingRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResaleServiceTest {

    @Mock ResaleListingRepository resaleRepo;
    @Mock OrderRepository orderRepository;
    @Mock UserRepository userRepository;
    @Mock ProductRepository productRepository;
    @Spy ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks ResaleService service;

    private User buyer;
    private Product product;
    private static final String SNAPSHOT =
            "[{\"productId\":100,\"productName\":\"Test Dress\",\"quantity\":1,\"unitPrice\":\"59.99\",\"selectedSize\":\"M\"}]";

    @BeforeEach
    void setUp() {
        buyer = User.builder().id(1L).email("buyer@test.com").passwordHash("x")
                .name("Emma").username("emma").role(Role.BUYER).build();
        product = Product.builder().id(100L).name("Test Dress").media("[\"/p.jpg\"]")
                .price(new BigDecimal("59.99")).build();
    }

    private Order paidOrder() {
        return Order.builder().id(10L).user(buyer).status(OrderStatus.PAID)
                .totalAmount(new BigDecimal("59.99")).itemsSnapshot(SNAPSHOT).build();
    }

    // ---- eligibility ----

    @Test
    void listEligibleItems_fromPaidOrder_returnsItem() {
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(buyer));
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(paidOrder()));
        when(resaleRepo.findBySellerIdAndStatusIn(eq(1L), any())).thenReturn(List.of());
        when(productRepository.findAllById(anyIterable())).thenReturn(List.of(product));

        List<ResaleEligibleItemResponse> items = service.listEligibleItems("buyer@test.com");

        assertThat(items).hasSize(1);
        assertThat(items.get(0).productId()).isEqualTo(100L);
        assertThat(items.get(0).sizeLabel()).isEqualTo("M");
        assertThat(items.get(0).orderId()).isEqualTo(10L);
        assertThat(items.get(0).productMedia()).containsExactly("/p.jpg");
    }

    @Test
    void listEligibleItems_pendingOrder_excluded() {
        Order pending = Order.builder().id(11L).user(buyer).status(OrderStatus.PENDING)
                .itemsSnapshot(SNAPSHOT).build();
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(buyer));
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(pending));

        assertThat(service.listEligibleItems("buyer@test.com")).isEmpty();
    }

    @Test
    void listEligibleItems_alreadyListed_excluded() {
        ResaleListing active = ResaleListing.builder().id(5L).seller(buyer).product(product)
                .sizeLabel("M").status(ResaleStatus.LISTED).build();
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(buyer));
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(paidOrder()));
        when(resaleRepo.findBySellerIdAndStatusIn(eq(1L), any())).thenReturn(List.of(active));
        when(productRepository.findAllById(anyIterable())).thenReturn(List.of(product));

        assertThat(service.listEligibleItems("buyer@test.com")).isEmpty();
    }

    // ---- create ----

    @Test
    void createListing_notPurchased_throws() {
        Order otherSize = Order.builder().id(12L).user(buyer).status(OrderStatus.PAID)
                .itemsSnapshot("[{\"productId\":100,\"productName\":\"x\",\"quantity\":1,\"unitPrice\":\"1\",\"selectedSize\":\"XL\"}]")
                .build();
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(buyer));
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(otherSize));

        CreateResaleListingRequest req = new CreateResaleListingRequest(
                100L, "M", ResaleCondition.EXCELLENT, new BigDecimal("32.00"), null, null);

        assertThatThrownBy(() -> service.createListing("buyer@test.com", req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("purchased");
    }

    @Test
    void createListing_owned_savesListed() {
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(buyer));
        when(orderRepository.findByUserIdOrderByCreatedAtDesc(1L)).thenReturn(List.of(paidOrder()));
        when(productRepository.findById(100L)).thenReturn(Optional.of(product));
        when(resaleRepo.save(any(ResaleListing.class))).thenAnswer(inv -> inv.getArgument(0));

        CreateResaleListingRequest req = new CreateResaleListingRequest(
                100L, "M", ResaleCondition.EXCELLENT, new BigDecimal("32.00"), "great", List.of("/a.jpg"));

        ResaleListingResponse resp = service.createListing("buyer@test.com", req);

        assertThat(resp.productId()).isEqualTo(100L);
        assertThat(resp.status()).isEqualTo(ResaleStatus.LISTED);
        assertThat(resp.askingPrice()).isEqualByComparingTo("32.00");
        verify(resaleRepo).save(any(ResaleListing.class));
    }

    // ---- ownership ----

    @Test
    void removeListing_notOwner_throwsNotFound() {
        User other = User.builder().id(2L).email("other@test.com").role(Role.BUYER).build();
        ResaleListing listing = ResaleListing.builder().id(9L).seller(other).product(product)
                .status(ResaleStatus.LISTED).build();
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(buyer));
        when(resaleRepo.findById(9L)).thenReturn(Optional.of(listing));

        assertThatThrownBy(() -> service.removeListing("buyer@test.com", 9L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not found");
    }

    // ---- reserve / mark sold ----

    @Test
    void reserve_ownListing_throws() {
        ResaleListing listing = ResaleListing.builder().id(500L).seller(buyer).product(product)
                .sizeLabel("M").condition(ResaleCondition.GOOD).askingPrice(new BigDecimal("32.00"))
                .currency("CAD").status(ResaleStatus.LISTED).build();
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(buyer));
        when(resaleRepo.findById(500L)).thenReturn(Optional.of(listing));

        assertThatThrownBy(() -> service.reserve(500L, "buyer@test.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("your own");
    }

    @Test
    void reserve_unavailable_throws() {
        User seller = User.builder().id(2L).email("seller@test.com").role(Role.BUYER).build();
        ResaleListing listing = ResaleListing.builder().id(500L).seller(seller).product(product)
                .sizeLabel("M").condition(ResaleCondition.GOOD).askingPrice(new BigDecimal("32.00"))
                .currency("CAD").status(ResaleStatus.LISTED).build();
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(buyer));
        when(resaleRepo.findById(500L)).thenReturn(Optional.of(listing));
        when(resaleRepo.reserve(eq(500L), eq(ResaleStatus.RESERVED), eq(ResaleStatus.LISTED), any()))
                .thenReturn(0);

        assertThatThrownBy(() -> service.reserve(500L, "buyer@test.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("no longer available");
    }

    @Test
    void reserve_available_returnsSnapshot() {
        User seller = User.builder().id(2L).email("seller@test.com").role(Role.BUYER).build();
        ResaleListing listing = ResaleListing.builder().id(500L).seller(seller).product(product)
                .sizeLabel("M").condition(ResaleCondition.GOOD).askingPrice(new BigDecimal("32.00"))
                .currency("CAD").status(ResaleStatus.LISTED).build();
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(buyer));
        when(resaleRepo.findById(500L)).thenReturn(Optional.of(listing));
        when(resaleRepo.reserve(eq(500L), eq(ResaleStatus.RESERVED), eq(ResaleStatus.LISTED), any()))
                .thenReturn(1);

        ResaleService.ReservedListing snap = service.reserve(500L, "buyer@test.com");

        assertThat(snap.listingId()).isEqualTo(500L);
        assertThat(snap.productId()).isEqualTo(100L);
        assertThat(snap.askingPrice()).isEqualByComparingTo("32.00");
        assertThat(snap.sizeLabel()).isEqualTo("M");
        assertThat(snap.condition()).isEqualTo(ResaleCondition.GOOD);
    }

    @Test
    void markSold_delegatesToRepository() {
        service.markSold(500L);
        verify(resaleRepo).markSold(500L, ResaleStatus.SOLD, ResaleStatus.RESERVED);
    }
}
