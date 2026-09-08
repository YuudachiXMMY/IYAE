package com.iyae.repository;

import com.iyae.entity.DesignerProfile;
import com.iyae.entity.Product;
import com.iyae.entity.User;
import com.iyae.entity.enums.ProductStatus;
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

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises the real {@link ProductSpecifications#catalog} predicate against an embedded database so
 * that each filter branch — status, category (case-insensitive), q (name OR description), and the
 * {@code localOnly} designer-profile join — actually executes. A mock-based test cannot cover the
 * {@code root.join("designerProfile")} / {@code cb.isTrue(isLocal)} branch (M3).
 *
 * <p>The slice scans only {@link ProductRepository} (all other repositories are excluded) so no
 * unrelated repository query is validated, keeping this test focused on the catalog predicate. (The
 * {@code PasswordResetTokenRepository.consumeToken} query that once blocked a full-repo slice has
 * since been fixed and is covered by {@link PasswordResetTokenRepositoryDataJpaTest}.)
 */
@DataJpaTest
@ActiveProfiles("test")
@EnableJpaRepositories(
        basePackageClasses = ProductRepository.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.REGEX,
                pattern = "com\\.iyae\\.repository\\.(?!ProductRepository).*"))
class ProductSpecificationsDataJpaTest {

    @Autowired
    TestEntityManager em;

    @Autowired
    ProductRepository productRepository; // extends JpaSpecificationExecutor<Product>

    private Product persistProduct(String name, String category, String description,
                                   boolean local, ProductStatus status) {
        User u = em.persist(User.builder()
                .email(name + "@ex.com").passwordHash("x").name(name).role(Role.DESIGNER).build());
        DesignerProfile p = em.persist(DesignerProfile.builder()
                .user(u).displayName(name).shopName(name).isLocal(local).build());
        return em.persist(Product.builder()
                .designerProfile(p).name(name).description(description).price(new BigDecimal("10.00"))
                .currency("CAD").category(category).status(status).build());
    }

    @Test
    void catalog_localOnly_returnsOnlyLocalDesignerProducts() {
        persistProduct("LocalTop", "Tops", "d", true, ProductStatus.PUBLISHED);
        persistProduct("RemoteTop", "Tops", "d", false, ProductStatus.PUBLISHED);
        em.flush();
        em.clear();

        Page<Product> page = productRepository.findAll(
                ProductSpecifications.catalog(ProductStatus.PUBLISHED, null, null, true), Pageable.unpaged());

        // mutation-kill for cb.isTrue(designer.get("isLocal")): dropping the join returns both rows.
        assertThat(page).extracting(Product::getName).containsExactly("LocalTop");
    }

    @Test
    void catalog_localOnlyFalse_returnsLocalAndRemote() {
        persistProduct("LocalTop", "Tops", "d", true, ProductStatus.PUBLISHED);
        persistProduct("RemoteTop", "Tops", "d", false, ProductStatus.PUBLISHED);
        em.flush();
        em.clear();

        Page<Product> page = productRepository.findAll(
                ProductSpecifications.catalog(ProductStatus.PUBLISHED, null, null, false), Pageable.unpaged());

        assertThat(page).extracting(Product::getName)
                .containsExactlyInAnyOrder("LocalTop", "RemoteTop");
    }

    @Test
    void catalog_statusFilter_excludesNonPublished() {
        persistProduct("PubTop", "Tops", "d", false, ProductStatus.PUBLISHED);
        persistProduct("DraftTop", "Tops", "d", false, ProductStatus.DRAFT);
        em.flush();
        em.clear();

        Page<Product> page = productRepository.findAll(
                ProductSpecifications.catalog(ProductStatus.PUBLISHED, null, null, false), Pageable.unpaged());

        assertThat(page).extracting(Product::getName).containsExactly("PubTop");
    }

    @Test
    void catalog_categoryFilter_matchesCaseInsensitive() {
        persistProduct("TopA", "Tops", "d", false, ProductStatus.PUBLISHED);
        persistProduct("BottomA", "Bottoms", "d", false, ProductStatus.PUBLISHED);
        em.flush();
        em.clear();

        // lower-case "tops" must match the persisted "Tops".
        Page<Product> page = productRepository.findAll(
                ProductSpecifications.catalog(ProductStatus.PUBLISHED, "tops", null, false), Pageable.unpaged());

        assertThat(page).extracting(Product::getName).containsExactly("TopA");
    }

    @Test
    void catalog_qFilter_matchesNameOrDescription() {
        persistProduct("Aurora", "Tops", "handwoven linen", false, ProductStatus.PUBLISHED);
        persistProduct("Zephyr", "Tops", "plain cotton", false, ProductStatus.PUBLISHED);
        em.flush();
        em.clear();

        // q matches description only (name "aurora" has no "linen") — kills dropping the description branch.
        Page<Product> byDescription = productRepository.findAll(
                ProductSpecifications.catalog(ProductStatus.PUBLISHED, null, "linen", false), Pageable.unpaged());
        assertThat(byDescription).extracting(Product::getName).containsExactly("Aurora");

        // q matches name only (description "plain cotton" has no "zephyr") — kills dropping the name branch.
        Page<Product> byName = productRepository.findAll(
                ProductSpecifications.catalog(ProductStatus.PUBLISHED, null, "zephyr", false), Pageable.unpaged());
        assertThat(byName).extracting(Product::getName).containsExactly("Zephyr");
    }
}
