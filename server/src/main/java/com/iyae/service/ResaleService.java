package com.iyae.service;

import com.iyae.dto.CreateResaleListingRequest;
import com.iyae.dto.PagedResponse;
import com.iyae.dto.ResaleEligibleItemResponse;
import com.iyae.dto.ResaleListingResponse;
import com.iyae.dto.UpdateResaleListingRequest;
import com.iyae.entity.Order;
import com.iyae.entity.Product;
import com.iyae.entity.ResaleListing;
import com.iyae.entity.User;
import com.iyae.entity.enums.OrderStatus;
import com.iyae.entity.enums.ResaleCondition;
import com.iyae.entity.enums.ResaleStatus;
import com.iyae.repository.OrderRepository;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.ResaleListingRepository;
import com.iyae.repository.ResaleListingSpecifications;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Peer-to-peer resale (Phase 7 lightweight v1): a buyer re-lists an item they already purchased,
 * and other shoppers buy it via {@link CheckoutService#initiateResaleCheckout}. This service owns
 * listing lifecycle + eligibility + the reserve/mark-sold/release state machine; the money path
 * lives in {@link CheckoutService} (one-way dependency — this service must NOT depend on it).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResaleService {

    private static final int MAX_PAGE_SIZE = 100;

    /**
     * How long a Stripe Checkout session for a resale listing stays payable. Stripe's minimum is
     * 30 minutes, and {@link #RESERVATION_TTL} must stay strictly greater — see
     * {@link #releaseStaleReservations()}. {@code CheckoutService} applies this to the session.
     */
    public static final Duration CHECKOUT_SESSION_TTL = Duration.ofMinutes(30);

    /**
     * How long a reservation is held. Must exceed {@link #CHECKOUT_SESSION_TTL} so a session can
     * never outlive the reservation that protects the unit it is buying; the margin absorbs
     * clock skew between us and Stripe and the sweep's own scheduling interval.
     */
    private static final Duration RESERVATION_TTL = Duration.ofMinutes(45);
    private static final List<ResaleStatus> ACTIVE_STATUSES =
            List.of(ResaleStatus.DRAFT, ResaleStatus.LISTED, ResaleStatus.RESERVED, ResaleStatus.SOLD);

    private final ResaleListingRepository resaleRepo;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final ObjectMapper objectMapper;

    // -------------------------------------------------------------------------
    // Eligibility — items the caller owns (from paid orders) and hasn't listed yet
    // -------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<ResaleEligibleItemResponse> listEligibleItems(String email) {
        User user = requireUser(email);

        // Distinct (productId|size) the user owns, newest-order-first (first order wins for provenance).
        LinkedHashMap<String, OwnedRef> owned = new LinkedHashMap<>();
        for (Order order : orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId())) {
            if (order.getStatus() == OrderStatus.PENDING) {
                continue; // not yet owned
            }
            for (SnapshotItem item : parseSnapshot(order.getItemsSnapshot())) {
                String size = safeSize(item.selectedSize());
                owned.putIfAbsent(item.productId() + "|" + size,
                        new OwnedRef(item.productId(), size, order.getId()));
            }
        }
        if (owned.isEmpty()) {
            return List.of();
        }

        // Exclude pairs the seller already has an active listing for.
        Set<String> activeKeys = resaleRepo.findBySellerIdAndStatusIn(user.getId(), ACTIVE_STATUSES).stream()
                .map(l -> l.getProduct().getId() + "|" + l.getSizeLabel())
                .collect(Collectors.toSet());

        // Batch-load products for media + existence (a deleted product can't be resold).
        List<Long> productIds = owned.values().stream().map(OwnedRef::productId).distinct().toList();
        Map<Long, Product> products = productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(Product::getId, p -> p));

        List<ResaleEligibleItemResponse> result = new ArrayList<>();
        for (Map.Entry<String, OwnedRef> entry : owned.entrySet()) {
            if (activeKeys.contains(entry.getKey())) {
                continue;
            }
            OwnedRef ref = entry.getValue();
            Product product = products.get(ref.productId());
            if (product == null) {
                continue;
            }
            result.add(new ResaleEligibleItemResponse(
                    ref.productId(), product.getName(), ref.size(),
                    parseJsonList(product.getMedia()), ref.orderId()));
        }
        return result;
    }

    // -------------------------------------------------------------------------
    // Listing lifecycle
    // -------------------------------------------------------------------------

    @Transactional
    public ResaleListingResponse createListing(String email, CreateResaleListingRequest req) {
        User user = requireUser(email);
        String size = safeSize(req.sizeLabel());
        Long orderId = findOwningOrderId(user, req.productId(), size)
                .orElseThrow(() -> new IllegalArgumentException("You can only resell items you've purchased"));
        Product product = productRepository.findById(req.productId())
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + req.productId()));

        // One physical unit, one listing. The eligibility *read* (listEligibleItems) filtered
        // out units with an active listing, but nothing enforced it on the write — so a seller
        // posting straight to the API could create any number of listings for the single item
        // they own, and each one could be reserved and sold. The guard lives here and is backed
        // by a unique index on (original_order_id, product_id, size_label), so two concurrent
        // requests cannot both pass it.
        ResaleListing existing = resaleRepo
                .findByOriginalOrderIdAndProductIdAndSizeLabel(orderId, req.productId(), size)
                .orElse(null);
        if (existing != null) {
            switch (existing.getStatus()) {
                case SOLD -> throw new IllegalArgumentException("You've already sold this item");
                case DRAFT, LISTED, RESERVED ->
                        throw new IllegalArgumentException("This item is already listed");
                case REMOVED -> {
                    // Re-listing a previously withdrawn item reuses the row rather than
                    // inserting a second one for the same unit.
                    existing.setStatus(ResaleStatus.LISTED);
                    existing.setCondition(req.condition());
                    existing.setAskingPrice(req.askingPrice());
                    existing.setSellerNote(req.sellerNote());
                    existing.setMedia(toJsonString(req.media()));
                    existing.setReservedAt(null);
                    return ResaleListingResponse.from(resaleRepo.save(existing));
                }
            }
        }

        ResaleListing listing = ResaleListing.builder()
                .seller(user)
                .product(product)
                .originalOrderId(orderId)
                .sizeLabel(size)
                .condition(req.condition())
                .askingPrice(req.askingPrice())
                .currency("CAD")
                .sellerNote(req.sellerNote())
                .media(toJsonString(req.media()))
                .status(ResaleStatus.LISTED)
                .build();
        return ResaleListingResponse.from(resaleRepo.save(listing));
    }

    @Transactional(readOnly = true)
    public List<ResaleListingResponse> getMyListings(String email) {
        User user = requireUser(email);
        return resaleRepo.findBySellerIdOrderByCreatedAtDesc(user.getId()).stream()
                .map(ResaleListingResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ResaleListingResponse getListing(Long id) {
        ResaleListing listing = resaleRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Resale listing not found: " + id));
        return ResaleListingResponse.from(listing);
    }

    @Transactional(readOnly = true)
    public PagedResponse<ResaleListingResponse> browse(int page, int size, String q, String category) {
        int clampedSize = Math.min(size, MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(page, clampedSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<ResaleListing> result = resaleRepo.findAll(
                ResaleListingSpecifications.browse(ResaleStatus.LISTED, q, category), pageable);
        return PagedResponse.from(result.map(ResaleListingResponse::from));
    }

    @Transactional
    public ResaleListingResponse updateListing(String email, Long id, UpdateResaleListingRequest req) {
        User user = requireUser(email);
        ResaleListing listing = requireOwnedListing(id, user);
        if (listing.getStatus() == ResaleStatus.SOLD || listing.getStatus() == ResaleStatus.RESERVED) {
            throw new IllegalArgumentException("This listing can no longer be edited");
        }
        if (req.askingPrice() != null) {
            listing.setAskingPrice(req.askingPrice());
        }
        if (req.condition() != null) {
            listing.setCondition(req.condition());
        }
        if (req.sellerNote() != null) {
            listing.setSellerNote(req.sellerNote());
        }
        if (req.media() != null) {
            listing.setMedia(toJsonString(req.media()));
        }
        if (req.status() != null) {
            if (req.status() != ResaleStatus.LISTED && req.status() != ResaleStatus.REMOVED) {
                throw new IllegalArgumentException("Status can only be set to LISTED or REMOVED");
            }
            listing.setStatus(req.status());
        }
        return ResaleListingResponse.from(resaleRepo.save(listing));
    }

    @Transactional
    public void removeListing(String email, Long id) {
        User user = requireUser(email);
        ResaleListing listing = requireOwnedListing(id, user);
        listing.setStatus(ResaleStatus.REMOVED); // soft-remove: keep row for provenance + order FK
        resaleRepo.save(listing);
    }

    // -------------------------------------------------------------------------
    // Reserve / sell / release — the single-unit safety state machine
    // -------------------------------------------------------------------------

    /**
     * Atomically reserve a LISTED listing for the buyer's checkout, returning the immutable pricing
     * data the checkout needs. Throws if the caller owns the listing or it is no longer available.
     */
    @Transactional
    public ReservedListing reserve(Long listingId, String buyerEmail) {
        User buyer = requireUser(buyerEmail);
        ResaleListing listing = resaleRepo.findById(listingId)
                .orElseThrow(() -> new IllegalArgumentException("Resale listing not found: " + listingId));
        if (listing.getSeller().getId().equals(buyer.getId())) {
            throw new IllegalArgumentException("You can't buy your own listing");
        }
        // Capture fields WHILE the entity is managed (lazy product init inside this tx); the
        // @Modifying reserve() below clears the persistence context.
        ReservedListing snapshot = new ReservedListing(
                listing.getId(),
                listing.getProduct().getId(),
                listing.getProduct().getName(),
                listing.getAskingPrice(),
                listing.getCurrency(),
                listing.getSizeLabel(),
                listing.getCondition());
        int updated = resaleRepo.reserve(listingId, ResaleStatus.RESERVED, ResaleStatus.LISTED, Instant.now());
        if (updated == 0) {
            throw new IllegalArgumentException("This item is no longer available");
        }
        return snapshot;
    }

    /**
     * RESERVED -> SOLD on payment.
     *
     * @return true when this call made the sale; false when the listing was not RESERVED, which
     *         after a successful payment means the buyer has been charged for a unit they cannot
     *         receive. The caller is responsible for surfacing that — it is not a no-op, and it
     *         used to be logged at INFO and otherwise ignored.
     */
    @Transactional
    public boolean markSold(Long listingId) {
        int updated = resaleRepo.markSold(listingId, ResaleStatus.SOLD, ResaleStatus.RESERVED);
        if (updated == 0) {
            // Idempotency (a re-delivered webhook for an already-SOLD listing) looks identical
            // here, so the caller — which knows whether this is a first-time fulfilment —
            // decides how loud to be.
            log.warn("markSold: resale listing {} was not RESERVED (already sold, or the "
                    + "reservation was lost)", listingId);
            return false;
        }
        return true;
    }

    /** RESERVED -> LISTED when a checkout is abandoned/fails. Idempotent. */
    @Transactional
    public void release(Long listingId) {
        resaleRepo.release(listingId, ResaleStatus.LISTED, ResaleStatus.RESERVED);
    }

    /**
     * Scheduled sweep: return listings stuck in RESERVED past the TTL back to LISTED.
     *
     * <p>Two guards, because this sweep is what made a double-sale possible. A Stripe Checkout
     * session stayed payable after the sweep had already put the listing back on sale, so a
     * second buyer could reserve and pay for the same unique item while the first buyer's
     * payment was still settling — two charges, one garment, and nothing in the system noticing.
     *
     * <ol>
     *   <li>{@link #CHECKOUT_SESSION_TTL} is shorter than {@link #RESERVATION_TTL}, so a session
     *       that can still be paid always sits inside a live reservation. The expiry is set on
     *       the Stripe session itself in {@code CheckoutService}.
     *   <li>Belt and braces: a listing with a PENDING order against it is skipped regardless of
     *       age, and logged — it means an order has outlived its session expiry and needs a
     *       human, not an automatic re-listing.
     * </ol>
     */
    @Transactional
    public void releaseStaleReservations() {
        Instant cutoff = Instant.now().minus(RESERVATION_TTL);
        List<ResaleListing> stale = resaleRepo.findByStatusAndReservedAtBefore(ResaleStatus.RESERVED, cutoff);
        int released = 0;
        for (ResaleListing listing : stale) {
            if (resaleRepo.hasPendingOrder(listing.getId())) {
                log.warn("Not releasing resale listing {}: an order is still PENDING against it. "
                        + "Its checkout session should already have expired — investigate before "
                        + "this unit is re-listed.", listing.getId());
                continue;
            }
            released += resaleRepo.release(listing.getId(), ResaleStatus.LISTED, ResaleStatus.RESERVED);
        }
        if (released > 0) {
            log.info("Released {} stale resale reservation(s)", released);
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** Immutable pricing data handed to {@link CheckoutService} so it never touches a lazy entity. */
    public record ReservedListing(Long listingId, Long productId, String productName, BigDecimal askingPrice,
                                  String currency, String sizeLabel, ResaleCondition condition) {}

    private record SnapshotItem(long productId, String productName, int quantity, String unitPrice,
                                String selectedSize) {}

    private record OwnedRef(Long productId, String size, Long orderId) {}

    private Optional<Long> findOwningOrderId(User user, Long productId, String size) {
        if (productId == null) {
            return Optional.empty();
        }
        for (Order order : orderRepository.findByUserIdOrderByCreatedAtDesc(user.getId())) {
            if (order.getStatus() == OrderStatus.PENDING) {
                continue;
            }
            for (SnapshotItem item : parseSnapshot(order.getItemsSnapshot())) {
                if (productId.equals(item.productId()) && size.equals(safeSize(item.selectedSize()))) {
                    return Optional.of(order.getId());
                }
            }
        }
        return Optional.empty();
    }

    private ResaleListing requireOwnedListing(Long id, User user) {
        ResaleListing listing = resaleRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Resale listing not found: " + id));
        if (!listing.getSeller().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Resale listing not found: " + id); // info-leak-safe
        }
        return listing;
    }

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
    }

    private static String safeSize(String size) {
        return (size == null || size.isBlank()) ? "ONE_SIZE" : size.trim();
    }

    private List<SnapshotItem> parseSnapshot(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<SnapshotItem>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<String> parseJsonList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            return List.of();
        }
    }

    private String toJsonString(List<String> list) {
        if (list == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(list);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Failed to serialize list to JSON", e);
        }
    }
}
