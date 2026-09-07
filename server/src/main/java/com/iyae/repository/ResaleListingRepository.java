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

public interface ResaleListingRepository
        extends JpaRepository<ResaleListing, Long>, JpaSpecificationExecutor<ResaleListing> {

    List<ResaleListing> findBySellerIdOrderByCreatedAtDesc(Long sellerId);

    List<ResaleListing> findBySellerIdAndStatusIn(Long sellerId, Collection<ResaleStatus> statuses);

    List<ResaleListing> findByStatusAndReservedAtBefore(ResaleStatus status, Instant cutoff);

    /**
     * Atomically claim a LISTED listing for a checkout (mirrors PasswordResetToken.consumeToken).
     * Returns 1 when the caller won the claim, 0 when the listing was already RESERVED/SOLD/REMOVED.
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE ResaleListing l SET l.status = :reserved, l.reservedAt = :now " +
           "WHERE l.id = :id AND l.status = :listed")
    int reserve(@Param("id") Long id, @Param("reserved") ResaleStatus reserved,
                @Param("listed") ResaleStatus listed, @Param("now") Instant now);

    /** RESERVED -> SOLD on payment. Idempotent: 0 rows if already SOLD/released. */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE ResaleListing l SET l.status = :sold WHERE l.id = :id AND l.status = :reserved")
    int markSold(@Param("id") Long id, @Param("sold") ResaleStatus sold,
                 @Param("reserved") ResaleStatus reserved);

    /** RESERVED -> LISTED (abandoned checkout / stale sweep). Idempotent. */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE ResaleListing l SET l.status = :listed, l.reservedAt = null " +
           "WHERE l.id = :id AND l.status = :reserved")
    int release(@Param("id") Long id, @Param("listed") ResaleStatus listed,
                @Param("reserved") ResaleStatus reserved);
}
