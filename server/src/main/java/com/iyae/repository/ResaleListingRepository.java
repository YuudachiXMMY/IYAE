package com.iyae.repository;

import com.iyae.entity.ResaleListing;
import com.iyae.entity.enums.ResaleStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ResaleListingRepository
        extends JpaRepository<ResaleListing, Long>, JpaSpecificationExecutor<ResaleListing> {

    List<ResaleListing> findBySellerIdOrderByCreatedAtDesc(Long sellerId);

    List<ResaleListing> findBySellerIdAndStatusIn(Long sellerId, Collection<ResaleStatus> statuses);

    List<ResaleListing> findByStatusAndReservedAtBefore(ResaleStatus status, Instant cutoff);

    /**
     * The listing for one owned unit, if any. Backs the duplicate-listing guard in
     * {@code ResaleService.createListing}: the triple is what identifies a physical item the
     * seller owns, and a unique index on it (V23) makes the guard race-proof.
     */
    Optional<ResaleListing> findByOriginalOrderIdAndProductIdAndSizeLabel(
            Long originalOrderId, Long productId, String sizeLabel);

    /**
     * Whether a resale order is still awaiting payment for this listing. The stale-reservation
     * sweep consults it so it cannot release a listing out from under a checkout that is still
     * able to complete.
     */
    @Query("SELECT COUNT(o) > 0 FROM Order o WHERE o.resaleListingId = :listingId "
           + "AND o.status = com.iyae.entity.enums.OrderStatus.PENDING")
    boolean hasPendingOrder(@Param("listingId") Long listingId);

    /**
     * Atomically claim a LISTED listing for a checkout (mirrors PasswordResetToken.consumeToken).
     * Returns 1 when the caller won the claim, 0 when the listing was already RESERVED/SOLD/REMOVED.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE ResaleListing l SET l.status = :reserved, l.reservedAt = :now " +
           "WHERE l.id = :id AND l.status = :listed")
    int reserve(@Param("id") Long id, @Param("reserved") ResaleStatus reserved,
                @Param("listed") ResaleStatus listed, @Param("now") Instant now);

    /** RESERVED -> SOLD on payment. Idempotent: 0 rows if already SOLD/released. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE ResaleListing l SET l.status = :sold WHERE l.id = :id AND l.status = :reserved")
    int markSold(@Param("id") Long id, @Param("sold") ResaleStatus sold,
                 @Param("reserved") ResaleStatus reserved);

    /** RESERVED -> LISTED (abandoned checkout / stale sweep). Idempotent. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE ResaleListing l SET l.status = :listed, l.reservedAt = null " +
           "WHERE l.id = :id AND l.status = :reserved")
    int release(@Param("id") Long id, @Param("listed") ResaleStatus listed,
                @Param("reserved") ResaleStatus reserved);

}
