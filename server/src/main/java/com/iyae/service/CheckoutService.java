package com.iyae.service;

import com.iyae.entity.Cart;
import com.iyae.entity.CartItem;
import com.iyae.entity.Order;
import com.iyae.entity.User;
import com.iyae.entity.enums.EventType;
import com.iyae.entity.enums.OrderStatus;
import com.iyae.repository.CartItemRepository;
import com.iyae.repository.CartRepository;
import com.iyae.repository.OrderRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CheckoutService {

    private final UserRepository userRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final OrderRepository orderRepository;
    private final TransactionTemplate txTemplate;
    private final StripeCheckoutGateway stripeGateway;
    private final ObjectMapper objectMapper;
    private final AnalyticsService analyticsService;
    private final ResaleService resaleService;

    @Value("${STRIPE_SECRET_KEY:}")
    private String stripeSecretKey;

    @Value("${STRIPE_WEBHOOK_SECRET:}")
    private String stripeWebhookSecret;

    @Value("${app.frontend.base-url:http://localhost:3000}")
    private String frontendBaseUrl;

    @PostConstruct
    void initStripe() {
        if (stripeSecretKey != null && !stripeSecretKey.isBlank()) {
            log.info("Stripe secret key configured");
        }
    }

    private record ItemSnapshot(long productId, String productName, int quantity, String unitPrice, String selectedSize) {}

    public Map<String, String> initiateCheckout(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));

        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            return stubCheckout(user);
        }

        Cart cart = cartRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Cart not found"));
        List<CartItem> items = cartItemRepository.findByCartId(cart.getId());
        if (items.isEmpty()) {
            throw new IllegalArgumentException("Cart is empty");
        }

        try {
            List<SessionCreateParams.LineItem> lineItems = items.stream()
                    .map(item -> SessionCreateParams.LineItem.builder()
                            .setQuantity((long) item.getQuantity())
                            .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                    .setCurrency("cad")
                                    .setUnitAmount(item.getProduct().getPrice()
                                            .multiply(BigDecimal.valueOf(100))
                                            .setScale(0, RoundingMode.HALF_UP)
                                            .longValue())
                                    .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                            .setName(item.getProduct().getName() +
                                                (item.getSelectedSize() != null && !"ONE_SIZE".equals(item.getSelectedSize())
                                                    ? " (" + item.getSelectedSize() + ")" : ""))
                                            .build())
                                    .build())
                            .build())
                    .toList();

            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(frontendBaseUrl + "/checkout/success?session_id={CHECKOUT_SESSION_ID}")
                    .setCancelUrl(frontendBaseUrl + "/cart")
                    .addAllLineItem(lineItems)
                    .putMetadata("userId", String.valueOf(user.getId()))
                    .build();

            Session session = stripeGateway.createSession(params, stripeSecretKey);

            BigDecimal total = items.stream()
                    .map(i -> i.getProduct().getPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            String snapshot = buildItemsSnapshot(items);
            Order order = Order.builder()
                    .user(user)
                    .status(OrderStatus.PENDING)
                    .totalAmount(total)
                    .stripeSessionId(session.getId())
                    .paymentStatus("PENDING")
                    .itemsSnapshot(snapshot)
                    .build();
            txTemplate.executeWithoutResult(status -> orderRepository.save(order));

            analyticsService.record(user.getId(), EventType.CHECKOUT_INITIATED, null,
                    order.getId(), firstSizeBracket(items), null);

            return Map.of("sessionId", session.getId(), "url", session.getUrl());

        } catch (StripeException ex) {
            log.error("Stripe session creation failed for user {}", email, ex);
            throw new RuntimeException("Stripe checkout failed. Please try again.", ex);
        } catch (Exception ex) {
            log.error("Checkout failed for user {}", email, ex);
            throw new RuntimeException("Checkout failed. Please try again.", ex);
        }
    }

    @Transactional
    public void handleWebhook(String payload, String signature) {
        if (stripeWebhookSecret == null || stripeWebhookSecret.isBlank()) {
            throw new IllegalArgumentException("Webhook secret not configured");
        }

        Event event;
        try {
            event = stripeGateway.constructEvent(payload, signature, stripeWebhookSecret);
        } catch (SignatureVerificationException ex) {
            throw new IllegalArgumentException("Invalid Stripe webhook signature");
        }

        if ("checkout.session.completed".equals(event.getType())) {
            Session session = (Session) event.getDataObjectDeserializer()
                    .getObject()
                    .orElseThrow(() -> new IllegalArgumentException("Missing session data in webhook event"));

            orderRepository.findByStripeSessionId(session.getId()).ifPresent(order -> {
                if (order.getStatus() == OrderStatus.PAID) {
                    log.info("Order {} already PAID, skipping duplicate webhook", order.getId());
                    return;
                }
                order.setStatus(OrderStatus.PAID);
                order.setPaymentStatus("PAID");
                if (session.getPaymentIntent() != null) {
                    order.setStripePaymentIntent(session.getPaymentIntent());
                }
                orderRepository.save(order);
                log.info("Order {} marked PAID via Stripe session {}", order.getId(), session.getId());

                analyticsService.record(order.getUser().getId(), EventType.ORDER_PAID, null,
                        order.getId(), null, null);

                if (order.getResaleListingId() != null) {
                    // Resale order: mark the pre-loved listing SOLD; there is no cart to clear.
                    resaleService.markSold(order.getResaleListingId());
                } else {
                    cartRepository.findByUserId(order.getUser().getId()).ifPresent(cart -> {
                        cartItemRepository.deleteByCartId(cart.getId());
                        log.info("Cart cleared for user {} after successful payment", order.getUser().getId());
                    });
                }
            });
        }
    }

    /**
     * Buy-now checkout for a single pre-loved resale listing (Phase 7). Reuses the Stripe gateway +
     * Order + webhook, but never touches the shared cart. Reserves the listing first so a unique
     * unit can't be double-sold; releases the reservation if session creation fails.
     */
    public Map<String, String> initiateResaleCheckout(String email, Long listingId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
        ResaleService.ReservedListing snap = resaleService.reserve(listingId, email);
        try {
            String snapshot = buildResaleSnapshot(snap);
            if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
                return stubResaleCheckout(user, snap, snapshot);
            }
            String label = snap.productName() + " (pre-loved, " + snap.condition() + ")";
            SessionCreateParams.LineItem lineItem = SessionCreateParams.LineItem.builder()
                    .setQuantity(1L)
                    .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                            .setCurrency("cad")
                            .setUnitAmount(snap.askingPrice()
                                    .multiply(BigDecimal.valueOf(100))
                                    .setScale(0, RoundingMode.HALF_UP)
                                    .longValue())
                            .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                    .setName(label)
                                    .build())
                            .build())
                    .build();
            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(frontendBaseUrl + "/checkout/success?session_id={CHECKOUT_SESSION_ID}")
                    .setCancelUrl(frontendBaseUrl + "/resale/" + listingId)
                    .addAllLineItem(List.of(lineItem))
                    .putMetadata("userId", String.valueOf(user.getId()))
                    .build();
            Session session = stripeGateway.createSession(params, stripeSecretKey);
            Order order = Order.builder()
                    .user(user)
                    .status(OrderStatus.PENDING)
                    .totalAmount(snap.askingPrice())
                    .stripeSessionId(session.getId())
                    .paymentStatus("PENDING")
                    .itemsSnapshot(snapshot)
                    .resaleListingId(listingId)
                    .build();
            txTemplate.executeWithoutResult(status -> orderRepository.save(order));
            analyticsService.record(user.getId(), EventType.CHECKOUT_INITIATED, snap.productId(),
                    order.getId(), snap.sizeLabel(), "resale");
            return Map.of("sessionId", session.getId(), "url", session.getUrl());
        } catch (StripeException ex) {
            resaleService.release(listingId);
            log.error("Stripe resale session creation failed for listing {}", listingId, ex);
            throw new RuntimeException("Stripe checkout failed. Please try again.", ex);
        } catch (RuntimeException ex) {
            resaleService.release(listingId);
            throw ex;
        }
    }

    private Map<String, String> stubResaleCheckout(User user, ResaleService.ReservedListing snap, String snapshot) {
        String sessionId = "cs_test_" + UUID.randomUUID();
        Order order = Order.builder()
                .user(user)
                .status(OrderStatus.PAID)
                .totalAmount(snap.askingPrice())
                .stripeSessionId(sessionId)
                .paymentStatus("STUB")
                .itemsSnapshot(snapshot)
                .resaleListingId(snap.listingId())
                .build();
        txTemplate.executeWithoutResult(status -> orderRepository.save(order));
        resaleService.markSold(snap.listingId());
        log.info("STRIPE_SECRET_KEY not configured — created stub resale order {} for listing {}",
                order.getId(), snap.listingId());
        // Stub resale orders are immediately PAID — emit both funnel events for dev/analytics parity.
        analyticsService.record(user.getId(), EventType.CHECKOUT_INITIATED, snap.productId(),
                order.getId(), snap.sizeLabel(), "resale");
        analyticsService.record(user.getId(), EventType.ORDER_PAID, snap.productId(),
                order.getId(), snap.sizeLabel(), "resale");
        return Map.of("sessionId", sessionId, "url", "/checkout/success?session_id=" + sessionId);
    }

    private String buildResaleSnapshot(ResaleService.ReservedListing snap) {
        List<ItemSnapshot> snapshots = List.of(new ItemSnapshot(
                snap.productId(), snap.productName(), 1, snap.askingPrice().toPlainString(), snap.sizeLabel()));
        try {
            return objectMapper.writeValueAsString(snapshots);
        } catch (JsonProcessingException ex) {
            log.warn("Failed to serialize resale snapshot", ex);
            return "[]";
        }
    }

    private Map<String, String> stubCheckout(User user) {
        String sessionId = "cs_test_" + UUID.randomUUID();
        Cart cart = cartRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Cart not found"));
        List<CartItem> items = cartItemRepository.findByCartId(cart.getId());
        if (items.isEmpty()) {
            throw new IllegalArgumentException("Cart is empty");
        }
        BigDecimal total = items.stream()
                .map(i -> i.getProduct().getPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        String snapshot = buildItemsSnapshot(items);
        Order order = Order.builder()
                .user(user)
                .status(OrderStatus.PAID)
                .totalAmount(total)
                .stripeSessionId(sessionId)
                .paymentStatus("STUB")
                .itemsSnapshot(snapshot)
                .build();
        txTemplate.executeWithoutResult(status -> orderRepository.save(order));
        log.info("STRIPE_SECRET_KEY not configured — created stub order {} for user {}", order.getId(), user.getEmail());
        // Stub orders are immediately PAID — emit both funnel events for dev/analytics parity.
        String sizeBracket = firstSizeBracket(items);
        analyticsService.record(user.getId(), EventType.CHECKOUT_INITIATED, null, order.getId(), sizeBracket, null);
        analyticsService.record(user.getId(), EventType.ORDER_PAID, null, order.getId(), sizeBracket, null);
        return Map.of("sessionId", sessionId, "url", "/checkout/success?session_id=" + sessionId);
    }

    /** Representative size bracket for size-bracketing KPIs: the first item's selected size. */
    private String firstSizeBracket(List<CartItem> items) {
        return items.isEmpty() ? null : items.get(0).getSelectedSize();
    }

    private String buildItemsSnapshot(List<CartItem> items) {
        List<ItemSnapshot> snapshots = items.stream()
                .map(item -> new ItemSnapshot(
                        item.getProduct().getId(),
                        item.getProduct().getName(),
                        item.getQuantity(),
                        item.getProduct().getPrice().toPlainString(),
                        item.getSelectedSize()))
                .toList();
        try {
            return objectMapper.writeValueAsString(snapshots);
        } catch (JsonProcessingException ex) {
            log.warn("Failed to serialize items snapshot", ex);
            return "[]";
        }
    }
}
