package com.iyae.service;

import com.iyae.dto.CheckoutRequest;
import com.iyae.entity.Cart;
import com.iyae.entity.CartItem;
import com.iyae.entity.Order;
import com.iyae.entity.Product;
import com.iyae.entity.User;
import com.iyae.entity.enums.FulfillmentMethod;
import com.iyae.entity.enums.OrderStatus;
import com.iyae.entity.enums.Role;
import com.iyae.entity.enums.ShippingCarrier;
import com.iyae.exception.PaymentsDisabledException;
import com.iyae.repository.CartItemRepository;
import com.iyae.repository.CartRepository;
import com.iyae.repository.OrderRepository;
import com.iyae.repository.UserRepository;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.model.Event;
import com.stripe.model.EventDataObjectDeserializer;
import com.stripe.model.checkout.Session;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CheckoutServiceTest {

    @Mock
    UserRepository userRepository;

    @Mock
    CartRepository cartRepository;

    @Mock
    CartItemRepository cartItemRepository;

    @Mock
    OrderRepository orderRepository;

    @Mock
    TransactionTemplate txTemplate;

    @Mock
    StripeCheckoutGateway stripeGateway;

    @Spy
    ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    AnalyticsService analyticsService;

    @Mock
    ResaleService resaleService;

    @Mock
    FulfillmentService fulfillmentService;

    @InjectMocks
    CheckoutService checkoutService;

    private User testUser;
    private Cart testCart;
    private CartItem testCartItem;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L)
                .email("buyer@test.com")
                .passwordHash("$2a$10$hash")
                .name("Test Buyer")
                .role(Role.BUYER)
                .build();

        testCart = Cart.builder()
                .id(10L)
                .user(testUser)
                .build();

        Product product = Product.builder()
                .id(100L)
                .name("Test Dress")
                .price(new BigDecimal("59.99"))
                .build();

        testCartItem = CartItem.builder()
                .id(200L)
                .cart(testCart)
                .product(product)
                .quantity(1)
                .selectedSize("M")
                .build();

        lenient().when(fulfillmentService.resolve(org.mockito.ArgumentMatchers.any()))
                .thenReturn(new FulfillmentService.ResolvedFulfillment(
                        FulfillmentMethod.SHIP, null, null, java.math.BigDecimal.ZERO));

        // The free-order stub is a dev-only convenience and is OFF by default, so every test that
        // exercises it has to opt in explicitly. See initiateCheckout_stubDisabled_* for the
        // production behaviour.
        setStubCheckoutEnabled(true);
    }

    private void setStubCheckoutEnabled(boolean enabled) {
        try {
            java.lang.reflect.Field f = CheckoutService.class.getDeclaredField("stubCheckoutEnabled");
            f.setAccessible(true);
            f.set(checkoutService, enabled);
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }

    // ---- stub path (no Stripe key configured) ----

    @Test
    void initiateCheckout_noStripeKey_returnsStubSession() {
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of(testCartItem));
        doAnswer(inv -> {
            ((java.util.function.Consumer<org.springframework.transaction.TransactionStatus>)
                    inv.getArgument(0)).accept(null);
            return null;
        }).when(txTemplate).executeWithoutResult(any());

        Map<String, String> result = checkoutService.initiateCheckout("buyer@test.com", null);

        assertThat(result).containsKey("sessionId");
        assertThat(result).containsKey("url");
        assertThat(result.get("sessionId")).startsWith("cs_test_");
        assertThat(result.get("url")).contains("/checkout/success");
        verify(orderRepository).save(any(Order.class));
    }

    @Test
    void initiateCheckout_stubPath_emptyCart_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of());

        assertThatThrownBy(() -> checkoutService.initiateCheckout("buyer@test.com", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Cart is empty");
    }

    @Test
    void initiateCheckout_stubPath_noCart_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> checkoutService.initiateCheckout("buyer@test.com", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Cart not found");
    }

    @Test
    void initiateCheckout_unknownUser_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("ghost@test.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> checkoutService.initiateCheckout("ghost@test.com", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    void initiateCheckout_stubPath_itemsSnapshotPopulated() {
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of(testCartItem));
        doAnswer(inv -> {
            ((java.util.function.Consumer<org.springframework.transaction.TransactionStatus>)
                    inv.getArgument(0)).accept(null);
            return null;
        }).when(txTemplate).executeWithoutResult(any());

        checkoutService.initiateCheckout("buyer@test.com", null);

        verify(orderRepository).save(argThat(order ->
                order.getItemsSnapshot() != null
                        && order.getItemsSnapshot().contains("\"productId\":100")
                        && order.getItemsSnapshot().contains("\"productName\":\"Test Dress\"")
                        && order.getItemsSnapshot().contains("\"quantity\":1")
                        && order.getItemsSnapshot().contains("\"unitPrice\":\"59.99\"")
                        && order.getItemsSnapshot().contains("\"selectedSize\":\"M\"")
        ));
    }

    @Test
    void initiateCheckout_stubPath_totalCalculatedCorrectly() {
        Product p1 = Product.builder().id(101L).name("Top").price(new BigDecimal("30.00")).build();
        Product p2 = Product.builder().id(102L).name("Skirt").price(new BigDecimal("40.00")).build();
        CartItem item1 = CartItem.builder().id(201L).cart(testCart).product(p1).quantity(2).selectedSize("S").build();
        CartItem item2 = CartItem.builder().id(202L).cart(testCart).product(p2).quantity(1).selectedSize("ONE_SIZE").build();

        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of(item1, item2));
        doAnswer(inv -> {
            ((java.util.function.Consumer<org.springframework.transaction.TransactionStatus>)
                    inv.getArgument(0)).accept(null);
            return null;
        }).when(txTemplate).executeWithoutResult(any());

        checkoutService.initiateCheckout("buyer@test.com", null);

        // 2 * 30.00 + 1 * 40.00 = 100.00
        verify(orderRepository).save(argThat(order ->
                order.getTotalAmount().compareTo(new BigDecimal("100.00")) == 0
                        && order.getItemsSnapshot() != null
                        && order.getItemsSnapshot().contains("\"productId\":101")
                        && order.getItemsSnapshot().contains("\"productId\":102")
        ));
    }

    // ---- Stripe path (gateway mock) ----

    @Test
    void initiateCheckout_stripeKey_callsGatewayCreateSession() throws Exception {
        // inject a non-blank Stripe key so the real Stripe path is taken
        java.lang.reflect.Field f = CheckoutService.class.getDeclaredField("stripeSecretKey");
        f.setAccessible(true);
        f.set(checkoutService, "sk_test_key");

        Session mockSession = mock(Session.class);
        when(mockSession.getId()).thenReturn("cs_live_abc123");
        when(mockSession.getUrl()).thenReturn("https://checkout.stripe.com/pay/cs_live_abc123");
        when(stripeGateway.createSession(any(), any())).thenReturn(mockSession);

        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of(testCartItem));
        doAnswer(inv -> {
            ((java.util.function.Consumer<org.springframework.transaction.TransactionStatus>)
                    inv.getArgument(0)).accept(null);
            return null;
        }).when(txTemplate).executeWithoutResult(any());

        Map<String, String> result = checkoutService.initiateCheckout("buyer@test.com", null);

        verify(stripeGateway).createSession(any(), any());
        assertThat(result.get("sessionId")).isEqualTo("cs_live_abc123");
        assertThat(result.get("url")).contains("checkout.stripe.com");
        verify(orderRepository).save(argThat(order ->
                "cs_live_abc123".equals(order.getStripeSessionId())
                        && order.getStatus() == OrderStatus.PENDING
                        && "PENDING".equals(order.getPaymentStatus())
        ));
    }

    @Test
    void initiateCheckout_stripeKey_itemsSnapshotPopulated() throws Exception {
        java.lang.reflect.Field f = CheckoutService.class.getDeclaredField("stripeSecretKey");
        f.setAccessible(true);
        f.set(checkoutService, "sk_test_key");

        Session mockSession = mock(Session.class);
        when(mockSession.getId()).thenReturn("cs_live_snap");
        when(mockSession.getUrl()).thenReturn("https://checkout.stripe.com/pay/cs_live_snap");
        when(stripeGateway.createSession(any(), any())).thenReturn(mockSession);

        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of(testCartItem));
        doAnswer(inv -> {
            ((java.util.function.Consumer<org.springframework.transaction.TransactionStatus>)
                    inv.getArgument(0)).accept(null);
            return null;
        }).when(txTemplate).executeWithoutResult(any());

        checkoutService.initiateCheckout("buyer@test.com", null);

        verify(orderRepository).save(argThat(order ->
                order.getItemsSnapshot() != null
                        && order.getItemsSnapshot().contains("\"productId\":100")
                        && order.getItemsSnapshot().contains("\"productName\":\"Test Dress\"")
                        && order.getItemsSnapshot().contains("\"quantity\":1")
                        && order.getItemsSnapshot().contains("\"unitPrice\":\"59.99\"")
                        && order.getItemsSnapshot().contains("\"selectedSize\":\"M\"")
        ));
    }

    @Test
    void initiateCheckout_stripeKey_emptyCart_throwsIllegalArgumentException() throws Exception {
        java.lang.reflect.Field f = CheckoutService.class.getDeclaredField("stripeSecretKey");
        f.setAccessible(true);
        f.set(checkoutService, "sk_test_key");

        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of());

        assertThatThrownBy(() -> checkoutService.initiateCheckout("buyer@test.com", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Cart is empty");
    }

    @Test
    void initiateCheckout_stripeGatewayThrows_wrapsAsRuntimeException() throws Exception {
        java.lang.reflect.Field f = CheckoutService.class.getDeclaredField("stripeSecretKey");
        f.setAccessible(true);
        f.set(checkoutService, "sk_test_key");

        when(stripeGateway.createSession(any(), any())).thenThrow(new RuntimeException("Stripe API error"));

        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of(testCartItem));

        assertThatThrownBy(() -> checkoutService.initiateCheckout("buyer@test.com", null))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Checkout failed");
    }

    // ---- webhook path ----

    @Test
    void handleWebhook_noWebhookSecret_throwsIllegalArgumentException() {
        // stripeWebhookSecret defaults to "" (no env var injected in unit test)
        assertThatThrownBy(() -> checkoutService.handleWebhook("payload", "sig"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Webhook secret not configured");
    }

    @Test
    void handleWebhook_invalidSignature_throwsIllegalArgumentException() throws Exception {
        java.lang.reflect.Field f = CheckoutService.class.getDeclaredField("stripeWebhookSecret");
        f.setAccessible(true);
        f.set(checkoutService, "whsec_test_secret");

        when(stripeGateway.constructEvent(any(), any(), any()))
                .thenThrow(mock(SignatureVerificationException.class));

        assertThatThrownBy(() -> checkoutService.handleWebhook("{}", "bad_signature"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid Stripe webhook signature");
    }

    @Test
    void handleWebhook_sessionCompleted_marksOrderPaid() throws Exception {
        java.lang.reflect.Field f = CheckoutService.class.getDeclaredField("stripeWebhookSecret");
        f.setAccessible(true);
        f.set(checkoutService, "whsec_test_secret");

        // build a mock Session
        Session mockSession = mock(Session.class);
        when(mockSession.getId()).thenReturn("cs_live_abc123");
        when(mockSession.getPaymentStatus()).thenReturn("paid");
        when(mockSession.getPaymentIntent()).thenReturn("pi_test_123");

        // build a mock EventDataObjectDeserializer
        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        when(deserializer.getObject()).thenReturn(Optional.of(mockSession));

        // build a mock Event
        Event mockEvent = mock(Event.class);
        when(mockEvent.getType()).thenReturn("checkout.session.completed");
        when(mockEvent.getDataObjectDeserializer()).thenReturn(deserializer);

        when(stripeGateway.constructEvent(any(), any(), any())).thenReturn(mockEvent);

        Order pendingOrder = Order.builder()
                .id(99L)
                .user(testUser)
                .status(OrderStatus.PENDING)
                .totalAmount(new BigDecimal("59.99"))
                .stripeSessionId("cs_live_abc123")
                .paymentStatus("PENDING")
                .build();
        when(orderRepository.findByStripeSessionId("cs_live_abc123")).thenReturn(Optional.of(pendingOrder));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));

        checkoutService.handleWebhook("{}", "sig_valid");

        verify(orderRepository).save(argThat(order ->
                order.getStatus() == OrderStatus.PAID
                        && "PAID".equals(order.getPaymentStatus())
                        && "pi_test_123".equals(order.getStripePaymentIntent())
        ));
        verify(cartItemRepository).deleteByCartId(10L);
    }

    @Test
    void handleWebhook_sessionCompleted_alreadyPaid_skips() throws Exception {
        java.lang.reflect.Field f = CheckoutService.class.getDeclaredField("stripeWebhookSecret");
        f.setAccessible(true);
        f.set(checkoutService, "whsec_test_secret");

        Session mockSession = mock(Session.class);
        when(mockSession.getId()).thenReturn("cs_live_dup");
        when(mockSession.getPaymentStatus()).thenReturn("paid");

        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        when(deserializer.getObject()).thenReturn(Optional.of(mockSession));

        Event mockEvent = mock(Event.class);
        when(mockEvent.getType()).thenReturn("checkout.session.completed");
        when(mockEvent.getDataObjectDeserializer()).thenReturn(deserializer);

        when(stripeGateway.constructEvent(any(), any(), any())).thenReturn(mockEvent);

        Order alreadyPaid = Order.builder()
                .id(88L)
                .user(testUser)
                .status(OrderStatus.PAID)
                .stripeSessionId("cs_live_dup")
                .paymentStatus("PAID")
                .build();
        when(orderRepository.findByStripeSessionId("cs_live_dup")).thenReturn(Optional.of(alreadyPaid));

        checkoutService.handleWebhook("{}", "sig_valid");

        verify(orderRepository, never()).save(any());
    }

    @Test
    void handleWebhook_sessionCompleted_unpaid_doesNotFulfill() throws Exception {
        // F2: async payment methods (SEPA/Bacs/Interac) complete Checkout with payment_status=unpaid
        // before funds settle — fulfilling here would ship unpaid goods / markSold a unique unit.
        java.lang.reflect.Field f = CheckoutService.class.getDeclaredField("stripeWebhookSecret");
        f.setAccessible(true);
        f.set(checkoutService, "whsec_test_secret");

        Session mockSession = mock(Session.class);
        when(mockSession.getId()).thenReturn("cs_live_unpaid");
        when(mockSession.getPaymentStatus()).thenReturn("unpaid");

        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        when(deserializer.getObject()).thenReturn(Optional.of(mockSession));

        Event mockEvent = mock(Event.class);
        when(mockEvent.getType()).thenReturn("checkout.session.completed");
        when(mockEvent.getDataObjectDeserializer()).thenReturn(deserializer);
        when(stripeGateway.constructEvent(any(), any(), any())).thenReturn(mockEvent);

        checkoutService.handleWebhook("{}", "sig_valid");

        // No order lookup, no PAID transition, no cart clear, no resale markSold.
        verify(orderRepository, never()).findByStripeSessionId(any());
        verify(orderRepository, never()).save(any());
        verify(cartItemRepository, never()).deleteByCartId(any());
        verify(resaleService, never()).markSold(any());
    }

    // ---- resale buy-now path ----

    @Test
    void initiateResaleCheckout_stubPath_createsResaleOrderAndMarksSold() {
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(resaleService.reserve(500L, "buyer@test.com")).thenReturn(
                new ResaleService.ReservedListing(500L, 100L, "Test Dress",
                        new BigDecimal("32.00"), "CAD", "M",
                        com.iyae.entity.enums.ResaleCondition.EXCELLENT));
        doAnswer(inv -> {
            ((java.util.function.Consumer<org.springframework.transaction.TransactionStatus>)
                    inv.getArgument(0)).accept(null);
            return null;
        }).when(txTemplate).executeWithoutResult(any());

        Map<String, String> result = checkoutService.initiateResaleCheckout("buyer@test.com", 500L);

        assertThat(result).containsKey("sessionId");
        assertThat(result.get("url")).contains("/checkout/success");
        verify(orderRepository).save(argThat(order ->
                order.getResaleListingId() != null
                        && order.getResaleListingId() == 500L
                        && order.getStatus() == OrderStatus.PAID
                        && order.getTotalAmount().compareTo(new BigDecimal("32.00")) == 0));
        verify(resaleService).markSold(500L);
    }

    @Test
    void handleWebhook_resaleOrder_marksListingSoldAndSkipsCartClear() throws Exception {
        java.lang.reflect.Field f = CheckoutService.class.getDeclaredField("stripeWebhookSecret");
        f.setAccessible(true);
        f.set(checkoutService, "whsec_test_secret");

        Session mockSession = mock(Session.class);
        when(mockSession.getId()).thenReturn("cs_live_resale");
        when(mockSession.getPaymentStatus()).thenReturn("paid");
        EventDataObjectDeserializer deserializer = mock(EventDataObjectDeserializer.class);
        when(deserializer.getObject()).thenReturn(Optional.of(mockSession));
        Event mockEvent = mock(Event.class);
        when(mockEvent.getType()).thenReturn("checkout.session.completed");
        when(mockEvent.getDataObjectDeserializer()).thenReturn(deserializer);
        when(stripeGateway.constructEvent(any(), any(), any())).thenReturn(mockEvent);

        Order resaleOrder = Order.builder()
                .id(77L)
                .user(testUser)
                .status(OrderStatus.PENDING)
                .stripeSessionId("cs_live_resale")
                .paymentStatus("PENDING")
                .resaleListingId(500L)
                .build();
        when(orderRepository.findByStripeSessionId("cs_live_resale")).thenReturn(Optional.of(resaleOrder));

        checkoutService.handleWebhook("{}", "sig_valid");

        verify(resaleService).markSold(500L);
        verify(cartItemRepository, never()).deleteByCartId(any());
    }

    // ---- Phase 8: fulfillment ----

    @Test
    void initiateCheckout_shipRequest_addsFeeAndSetsFields() {
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of(testCartItem));
        when(fulfillmentService.resolve(any())).thenReturn(new FulfillmentService.ResolvedFulfillment(
                FulfillmentMethod.SHIP, null, ShippingCarrier.UPS, new BigDecimal("12.99")));
        doAnswer(inv -> {
            ((java.util.function.Consumer<org.springframework.transaction.TransactionStatus>)
                    inv.getArgument(0)).accept(null);
            return null;
        }).when(txTemplate).executeWithoutResult(any());

        checkoutService.initiateCheckout("buyer@test.com",
                new CheckoutRequest(FulfillmentMethod.SHIP, null, ShippingCarrier.UPS));

        // testCartItem = 1 * 59.99; + 12.99 shipping = 72.98
        verify(orderRepository).save(argThat(order ->
                order.getFulfillmentMethod() == FulfillmentMethod.SHIP
                        && order.getShippingCarrier() == ShippingCarrier.UPS
                        && order.getShippingFee().compareTo(new BigDecimal("12.99")) == 0
                        && order.getPickupLocationId() == null
                        && order.getTotalAmount().compareTo(new BigDecimal("72.98")) == 0));
    }

    @Test
    void initiateCheckout_pickupRequest_zeroFeeAndSetsLocation() {
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of(testCartItem));
        when(fulfillmentService.resolve(any())).thenReturn(new FulfillmentService.ResolvedFulfillment(
                FulfillmentMethod.PICKUP, 1L, null, BigDecimal.ZERO));
        doAnswer(inv -> {
            ((java.util.function.Consumer<org.springframework.transaction.TransactionStatus>)
                    inv.getArgument(0)).accept(null);
            return null;
        }).when(txTemplate).executeWithoutResult(any());

        checkoutService.initiateCheckout("buyer@test.com",
                new CheckoutRequest(FulfillmentMethod.PICKUP, 1L, null));

        verify(orderRepository).save(argThat(order ->
                order.getFulfillmentMethod() == FulfillmentMethod.PICKUP
                        && order.getShippingCarrier() == null
                        && order.getShippingFee().compareTo(BigDecimal.ZERO) == 0
                        && order.getPickupLocationId() == 1L
                        && order.getTotalAmount().compareTo(new BigDecimal("59.99")) == 0));
    }

    @Test
    void initiateCheckout_invalidFulfillment_propagatesIllegalArgument() {
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(fulfillmentService.resolve(any()))
                .thenThrow(new IllegalArgumentException("A shipping carrier is required for shipped orders"));

        assertThatThrownBy(() -> checkoutService.initiateCheckout("buyer@test.com",
                new CheckoutRequest(FulfillmentMethod.SHIP, null, null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ---- B-1: payment is off, so the stub must be unreachable rather than silently free ----

    @Test
    void initiateCheckout_stubDisabled_refusesInsteadOfCreatingFreeOrder() {
        setStubCheckoutEnabled(false);
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));

        assertThatThrownBy(() -> checkoutService.initiateCheckout("buyer@test.com", null))
                .isInstanceOf(PaymentsDisabledException.class);

        verify(orderRepository, never()).save(any(Order.class));
        verify(analyticsService, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void initiateResaleCheckout_stubDisabled_refusesAndReleasesTheReservation() {
        setStubCheckoutEnabled(false);
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));

        assertThatThrownBy(() -> checkoutService.initiateResaleCheckout("buyer@test.com", 500L))
                .isInstanceOf(PaymentsDisabledException.class);

        // markSold is irreversible — it consumes a unique pre-loved unit. A checkout that can
        // never collect money must not touch availability at all, so the refusal lands before
        // the reservation rather than reserving and releasing.
        verify(resaleService, never()).reserve(anyLong(), any());
        verify(resaleService, never()).markSold(anyLong());
        verify(orderRepository, never()).save(any(Order.class));
    }

    @Test
    void initiateCheckout_stubDisabledButStripeConfigured_proceedsToStripe() throws Exception {
        setStubCheckoutEnabled(false);
        java.lang.reflect.Field f = CheckoutService.class.getDeclaredField("stripeSecretKey");
        f.setAccessible(true);
        f.set(checkoutService, "sk_test_123");

        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(testUser));
        when(cartRepository.findByUserId(1L)).thenReturn(Optional.of(testCart));
        when(cartItemRepository.findByCartId(10L)).thenReturn(List.of(testCartItem));
        Session mockSession = mock(Session.class);
        when(mockSession.getId()).thenReturn("cs_live_1");
        when(mockSession.getUrl()).thenReturn("https://checkout.stripe.com/c/pay/cs_live_1");
        when(stripeGateway.createSession(any(), eq("sk_test_123"))).thenReturn(mockSession);
        doAnswer(inv -> {
            ((java.util.function.Consumer<org.springframework.transaction.TransactionStatus>)
                    inv.getArgument(0)).accept(null);
            return null;
        }).when(txTemplate).executeWithoutResult(any());

        Map<String, String> result = checkoutService.initiateCheckout("buyer@test.com", null);

        assertThat(result.get("sessionId")).isEqualTo("cs_live_1");
    }
}
