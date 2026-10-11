package com.iyae.service;

import com.iyae.dto.CheckoutRequest;
import com.iyae.entity.Cart;
import com.iyae.entity.CartItem;
import com.iyae.entity.Order;
import com.iyae.entity.User;
import com.iyae.entity.enums.EventType;
import com.iyae.entity.enums.OrderStatus;
import com.iyae.exception.PaymentsDisabledException;
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
import java.time.Instant;
import java.util.ArrayList;
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
    private final FulfillmentService fulfillmentService;

    @Value("${STRIPE_SECRET_KEY:}")
    private String stripeSecretKey;

    @Value("${STRIPE_WEBHOOK_SECRET:}")
    private String stripeWebhookSecret;

    @Value("${app.frontend.base-url:http://localhost:3000}")
    private String frontendBaseUrl;

    /**
     * Whether the free-order dev stub may be used when no Stripe key is configured. Defaults to
     * {@code false} — only {@code dev} and {@code test} turn it on. Production must never reach it:
     * a blank key there means payment is off, and "off" has to be a refusal, not a free order.
     */
    @Value("${app.payments.stub-checkout-enabled:false}")
    private boolean stubCheckoutEnabled;

    @PostConstruct
    void initStripe() {
        if (stripeSecretKey != null && !stripeSecretKey.isBlank()) {
            log.info("Stripe secret key configured — payment collection is LIVE");
        } else if (stubCheckoutEnabled) {
            log.warn("STRIPE_SECRET_KEY is blank and the checkout stub is ENABLED — "
                    + "orders will be written PAID without payment. Never run this configuration in production.");
        } else {
            log.warn("STRIPE_SECRET_KEY is blank — checkout is DISABLED and will answer 503. "
                    + "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET together to enable payment.");
        }
    }

    /** True when a buyer can actually pay. Drives the web client's entry-point visibility. */
    public boolean isCheckoutEnabled() {
        return (stripeSecretKey != null && !stripeSecretKey.isBlank()) || stubCheckoutEnabled;
    }

    private void requireStubAllowed(String context) {
        if (!stubCheckoutEnabled) {
            log.warn("Refused {} — payment collection is not configured", context);
            throw new PaymentsDisabledException(
                    "Checkout is currently unavailable: this store is not accepting payments yet.");
        }
    }

    private record ItemSnapshot(long productId, String productName, int quantity, String unitPrice, String selectedSize) {}

    public Map<String, String> initiateCheckout(String email, CheckoutRequest req) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));

        FulfillmentService.ResolvedFulfillment fulfillment = fulfillmentService.resolve(req);

        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            requireStubAllowed("checkout for user " + user.getId());
            return stubCheckout(user, fulfillment);
        }

        Cart cart = cartRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Cart not found"));
        List<CartItem> items = cartItemRepository.findByCartId(cart.getId());
        if (items.isEmpty()) {
            throw new IllegalArgumentException("Cart is empty");
        }

        try {
            List<SessionCreateParams.LineItem> lineItems = new ArrayList<>(items.stream()
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
                    .toList());

            if (fulfillment.fee().compareTo(BigDecimal.ZERO) > 0) {
                lineItems.add(SessionCreateParams.LineItem.builder()
                        .setQuantity(1L)
                        .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                .setCurrency("cad")
                                .setUnitAmount(fulfillment.fee()
                                        .multiply(BigDecimal.valueOf(100))
                                        .setScale(0, RoundingMode.HALF_UP)
                                        .longValue())
                                .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                        .setName("Shipping — " + fulfillment.carrier().getDisplayName())
                                        .build())
                                .build())
                        .build());
            }

            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(frontendBaseUrl + "/checkout/success?session_id={CHECKOUT_SESSION_ID}")
                    .setCancelUrl(frontendBaseUrl + "/cart")
                    .addAllLineItem(lineItems)
                    .putMetadata("userId", String.valueOf(user.getId()))
                    .build();

            Session session = stripeGateway.createSession(params, stripeSecretKey);

            BigDecimal itemsTotal = items.stream()
                    .map(i -> i.getProduct().getPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal total = itemsTotal.add(fulfillment.fee());

            String snapshot = buildItemsSnapshot(items);
            Order order = Order.builder()
                    .user(user)
                    .status(OrderStatus.PENDING)
                    .totalAmount(total)
                    .stripeSessionId(session.getId())
                    .paymentStatus("PENDING")
                    .itemsSnapshot(snapshot)
                    .fulfillmentMethod(fulfillment.method())
                    .pickupLocationId(fulfillment.pickupLocationId())
                    .shippingCarrier(fulfillment.carrier())
                    .shippingFee(fulfillment.fee())
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

        // checkout.session.completed fires when the buyer finishes Checkout, but for asynchronous
        // payment methods (SEPA, Bacs, Interac, some BNPL) the money has NOT settled yet — the
        // session arrives with payment_status=unpaid and a later async_payment_succeeded event
        // confirms funds. Fulfilling on 'completed' alone ships unpaid goods and irreversibly marks
        // unique resale units SOLD, so we only fulfill once Stripe reports the session paid.
        String type = event.getType();
        if ("checkout.session.completed".equals(type)
                || "checkout.session.async_payment_succeeded".equals(type)) {
            Session session = (Session) event.getDataObjectDeserializer()
                    .getObject()
                    .orElseThrow(() -> new IllegalArgumentException("Missing session data in webhook event"));

            if (!isSessionPaid(session)) {
                log.info("Stripe session {} not yet paid (payment_status={}, event={}); deferring fulfillment",
                        session.getId(), session.getPaymentStatus(), type);
                return;
            }
            fulfillPaidSession(session);
        }
    }

    /** True only when Stripe confirms the money has settled (or none was required). */
    private boolean isSessionPaid(Session session) {
        String paymentStatus = session.getPaymentStatus();
        return "paid".equals(paymentStatus) || "no_payment_required".equals(paymentStatus);
    }

    /**
     * Transition a confirmed-paid session's order to PAID and run one-time fulfillment. The
     * PENDING→PAID guard plus the {@code @Version} optimistic lock on Order make this idempotent
     * under Stripe's at-least-once, possibly-concurrent webhook delivery: a duplicate that races
     * the winner fails to commit and Stripe's retry then sees the order already PAID and skips.
     */
    private void fulfillPaidSession(Session session) {
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
                //
                // The PAID transition above must be flushed before this runs — markSold's
                // @Modifying query clears the persistence context, and without
                // flushAutomatically it used to discard the unflushed Order change, so a paid
                // resale order silently stayed PENDING. The flush is configured on the query.
                if (!resaleService.markSold(order.getResaleListingId())) {
                    // The buyer has paid and the unit is not theirs. We have reached the
                    // webhook, so this is not an idempotent replay of our own success — the
                    // reservation was lost. Mark the order so it is findable and shout: it
                    // needs a refund, which nothing here can issue.
                    order.setPaymentStatus("PAID_UNFULFILLABLE");
                    orderRepository.save(order);
                    log.error("REFUND REQUIRED: order {} (user {}, session {}) paid for resale "
                            + "listing {}, which was no longer reserved for them. The buyer has "
                            + "been charged for an item they cannot receive.",
                            order.getId(), order.getUser().getId(), session.getId(),
                            order.getResaleListingId());
                }
            } else {
                cartRepository.findByUserId(order.getUser().getId()).ifPresent(cart -> {
                    cartItemRepository.deleteByCartId(cart.getId());
                    log.info("Cart cleared for user {} after successful payment", order.getUser().getId());
                });
            }
        });
    }

    /**
     * Buy-now checkout for a single pre-loved resale listing (Phase 7). Reuses the Stripe gateway +
     * Order + webhook, but never touches the shared cart. Reserves the listing first so a unique
     * unit can't be double-sold; releases the reservation if session creation fails.
     */
    public Map<String, String> initiateResaleCheckout(String email, Long listingId) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            // Refuse before reserving: markSold is irreversible, so a checkout that can never
            // collect money must not touch the unique unit's availability at all.
            requireStubAllowed("resale checkout for listing " + listingId);
        }
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
                    // The session must expire before the reservation does, or it stays payable
                    // after the sweep has put this unique unit back on sale — which is how a
                    // second buyer could be charged for the same garment. See
                    // ResaleService.CHECKOUT_SESSION_TTL / RESERVATION_TTL.
                    .setExpiresAt(Instant.now().plus(ResaleService.CHECKOUT_SESSION_TTL).getEpochSecond())
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

    private Map<String, String> stubCheckout(User user, FulfillmentService.ResolvedFulfillment fulfillment) {
        String sessionId = "cs_test_" + UUID.randomUUID();
        Cart cart = cartRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Cart not found"));
        List<CartItem> items = cartItemRepository.findByCartId(cart.getId());
        if (items.isEmpty()) {
            throw new IllegalArgumentException("Cart is empty");
        }
        BigDecimal itemsTotal = items.stream()
                .map(i -> i.getProduct().getPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal total = itemsTotal.add(fulfillment.fee());
        String snapshot = buildItemsSnapshot(items);
        Order order = Order.builder()
                .user(user)
                .status(OrderStatus.PAID)
                .totalAmount(total)
                .stripeSessionId(sessionId)
                .paymentStatus("STUB")
                .itemsSnapshot(snapshot)
                .fulfillmentMethod(fulfillment.method())
                .pickupLocationId(fulfillment.pickupLocationId())
                .shippingCarrier(fulfillment.carrier())
                .shippingFee(fulfillment.fee())
                .build();
        txTemplate.executeWithoutResult(status -> orderRepository.save(order));
        log.info("STRIPE_SECRET_KEY not configured — created stub order {} for user {}", order.getId(), user.getEmail());
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
