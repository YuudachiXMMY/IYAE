package com.iyae.repository;

import com.iyae.entity.DesignerProfile;
import com.iyae.entity.Product;
import com.iyae.entity.ResaleListing;
import com.iyae.entity.User;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.entity.enums.ResaleCondition;
import com.iyae.entity.enums.ResaleStatus;
import com.iyae.entity.enums.Role;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises the {@link ResaleListingSpecifications#browse} predicate and the atomic
 * {@link ResaleListingRepository#reserve}/{@link ResaleListingRepository#markSold} updates against an
 * embedded database. The single-repository slice ({@code excludeFilters}) keeps this test focused on
 * {@code ResaleListingRepository}; unrelated repositories are irrelevant to the predicates under test.
 * (The {@code PasswordResetTokenRepository.consumeToken} query that once blocked a full-repo slice has
 * since been fixed and is covered by {@link PasswordResetTokenRepositoryDataJpaTest}.)
 */
@DataJpaTest
@ActiveProfiles("test")
@EnableJpaRepositories(
        basePackageClasses = ResaleListingRepository.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.REGEX,
                pattern = "com\\.iyae\\.repository\\.(?!ResaleListingRepository).*"))
class ResaleListingRepositoryDataJpaTest {

    @Autowired
    TestEntityManager em;

    @Autowired
    ResaleListingRepository repo;

    /**
     * Provenance ids for the fixtures below. original_order_id is NOT NULL as of V25, and each
     * listing here stands for a distinct physical unit, so each gets its own value rather than
     * sharing one — sharing it would make them duplicates under uk_resale_owned_unit.
     */
    private long orderSeq = 0;

    private ResaleListing persistListing(String name, String category, ResaleStatus status) {
        User seller = em.persist(User.builder()
                .email(name + "-seller@ex.com").passwordHash("x").name(name).role(Role.BUYER).build());
        User designerUser = em.persist(User.builder()
                .email(name + "-designer@ex.com").passwordHash("x").name(name + "D").role(Role.DESIGNER).build());
        DesignerProfile dp = em.persist(DesignerProfile.builder()
                .user(designerUser).displayName(name).shopName(name).isLocal(false).build());
        Product product = em.persist(Product.builder()
                .designerProfile(dp).name(name).description("d").price(new BigDecimal("10.00"))
                .currency("CAD").category(category).status(ProductStatus.PUBLISHED).build());
        return em.persist(ResaleListing.builder()
                .seller(seller).product(product).originalOrderId(++orderSeq)
                .sizeLabel("M").condition(ResaleCondition.GOOD)
                .askingPrice(new BigDecimal("5.00")).currency("CAD").status(status).build());
    }

    @Test
    void browse_returnsOnlyListed() {
        persistListing("A", "Tops", ResaleStatus.LISTED);
        persistListing("B", "Tops", ResaleStatus.SOLD);
        persistListing("C", "Tops", ResaleStatus.REMOVED);
        em.flush();
        em.clear();

        Page<ResaleListing> page = repo.findAll(
                ResaleListingSpecifications.browse(ResaleStatus.LISTED, null, null), Pageable.unpaged());

        assertThat(page).extracting(ResaleListing::getStatus).containsExactly(ResaleStatus.LISTED);
    }

    @Test
    void browse_qMatchesProductName() {
        persistListing("Aurora", "Tops", ResaleStatus.LISTED);
        persistListing("Zephyr", "Tops", ResaleStatus.LISTED);
        em.flush();
        em.clear();

        // q matches only "Aurora" — kills dropping the product-join name predicate.
        Page<ResaleListing> page = repo.findAll(
                ResaleListingSpecifications.browse(ResaleStatus.LISTED, "aurora", null), Pageable.unpaged());

        assertThat(page).hasSize(1);
        assertThat(page.getContent().get(0).getProduct().getName()).isEqualTo("Aurora");
    }

    @Test
    void reserve_isAtomic_secondClaimGetsZeroRows() {
        ResaleListing listing = persistListing("D", "Tops", ResaleStatus.LISTED);
        em.flush();
        em.clear();

        int first = repo.reserve(listing.getId(), ResaleStatus.RESERVED, ResaleStatus.LISTED, Instant.now());
        int second = repo.reserve(listing.getId(), ResaleStatus.RESERVED, ResaleStatus.LISTED, Instant.now());

        assertThat(first).isEqualTo(1);
        assertThat(second).isEqualTo(0);
    }

    @Test
    void markSold_onlyTransitionsFromReserved() {
        ResaleListing listing = persistListing("E", "Tops", ResaleStatus.LISTED);
        em.flush();
        em.clear();

        // LISTED -> markSold is a no-op (guarded on RESERVED)
        assertThat(repo.markSold(listing.getId(), ResaleStatus.SOLD, ResaleStatus.RESERVED)).isEqualTo(0);
        // reserve then sell succeeds
        repo.reserve(listing.getId(), ResaleStatus.RESERVED, ResaleStatus.LISTED, Instant.now());
        assertThat(repo.markSold(listing.getId(), ResaleStatus.SOLD, ResaleStatus.RESERVED)).isEqualTo(1);
    }
}
