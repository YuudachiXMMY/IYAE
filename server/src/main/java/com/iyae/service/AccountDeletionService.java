package com.iyae.service;

import com.iyae.config.BrandProperties;
import com.iyae.entity.DesignerProfile;
import com.iyae.entity.Product;
import com.iyae.entity.User;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.repository.AnalyticsEventRepository;
import com.iyae.repository.CartItemRepository;
import com.iyae.repository.CartRepository;
import com.iyae.repository.ChatMessageRepository;
import com.iyae.repository.ChatSessionRepository;
import com.iyae.repository.CohortAssignmentRepository;
import com.iyae.repository.DesignerProfileRepository;
import com.iyae.repository.FollowRepository;
import com.iyae.repository.OutfitRecommendationRepository;
import com.iyae.repository.PasswordResetTokenRepository;
import com.iyae.repository.PostCommentRepository;
import com.iyae.repository.PostLikeRepository;
import com.iyae.repository.PostReportRepository;
import com.iyae.repository.PostRepository;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.ResaleListingRepository;
import com.iyae.repository.ReviewRepository;
import com.iyae.repository.SavedLookRepository;
import com.iyae.repository.SavedProductRepository;
import com.iyae.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Deletes an account and the personal data attached to it.
 *
 * <p>Before this existed the product had no deletion path at all: {@code DELETE /api/avatar}
 * removed the avatar and the measurements, and left the chat transcripts, the community posts,
 * the orders and the analytics rows in place indefinitely — on a product whose core data is body
 * measurements and 3D body meshes.
 *
 * <h2>Why this tombstones rather than deletes the user row</h2>
 *
 * {@code orders} holds a non-null foreign key to {@code users}, and an order is a financial
 * record that has to outlive the customer relationship. Hard-deleting the row would mean either
 * destroying order history or making the FK nullable and losing the ability to answer "whose
 * order was this" for a dispute. So the row stays and every identifying field on it is
 * overwritten; what is purely personal content is deleted outright.
 *
 * <h2>Why the designer's products are archived rather than deleted</h2>
 *
 * A product is a catalogue entry other people have reviewed, carted and bought. Deleting it
 * would cascade into other users' data. It is archived (hidden from the catalogue) and the
 * designer's identity on the profile is scrubbed.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AccountDeletionService {

    private final UserRepository userRepository;
    private final PostRepository postRepository;
    private final PostCommentRepository postCommentRepository;
    private final PostLikeRepository postLikeRepository;
    private final PostReportRepository postReportRepository;
    private final FollowRepository followRepository;
    private final ChatSessionRepository chatSessionRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final SavedLookRepository savedLookRepository;
    private final SavedProductRepository savedProductRepository;
    private final ReviewRepository reviewRepository;
    private final ResaleListingRepository resaleListingRepository;
    private final OutfitRecommendationRepository outfitRecommendationRepository;
    private final AnalyticsEventRepository analyticsEventRepository;
    private final CohortAssignmentRepository cohortAssignmentRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final CartRepository cartRepository;
    private final CartItemRepository cartItemRepository;
    private final DesignerProfileRepository designerProfileRepository;
    private final ProductRepository productRepository;
    private final AvatarService avatarService;
    private final BrandProperties brandProperties;

    /**
     * Deletes the caller's account. Idempotent: a second call on an already-tombstoned account
     * is a no-op rather than an error, because the client cannot distinguish "deleted" from
     * "retry after a dropped response".
     */
    @Transactional
    public void deleteAccount(String email) {
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null || user.getDeletedAt() != null) {
            log.info("Account deletion requested for an account that no longer exists — no-op");
            return;
        }
        Long userId = user.getId();

        // Avatar GLB on disk + body profile + avatar tasks. Done first and through the existing
        // service so the on-disk purge stays in one place.
        avatarService.deleteAvatarData(email);

        // Ordering matters: children before parents.
        // Likes, comments and reports reference posts; delete them before the posts themselves.
        postLikeRepository.deleteByUser(user);
        postCommentRepository.deleteByUser(user);
        postReportRepository.deleteByReporter(user);
        postRepository.deleteByUser(user);

        // Both directions — the people they followed and the people who followed them.
        followRepository.deleteByFollower(user);
        followRepository.deleteByFollowing(user);

        chatMessageRepository.deleteBySessionUser(user);
        chatSessionRepository.deleteByUser(user);

        // Saved looks reference outfit recommendations, so they go first.
        savedLookRepository.deleteByUserId(userId);
        outfitRecommendationRepository.deleteByUser(user);

        savedProductRepository.deleteByUserId(userId);
        reviewRepository.deleteByUserId(userId);
        resaleListingRepository.deleteBySellerId(userId);

        cartRepository.findByUserId(userId).ifPresent(cart -> {
            cartItemRepository.deleteByCartId(cart.getId());
            cartRepository.deleteByUserId(userId);
        });

        analyticsEventRepository.deleteByUserId(userId);
        cohortAssignmentRepository.deleteByUserId(userId);
        passwordResetTokenRepository.deleteByUser(user);

        scrubDesignerIdentity(userId);
        tombstone(user);

        log.info("Deleted account {} (tombstoned as user {})", redact(email), userId);
    }

    /**
     * Hides the designer's catalogue and removes their identity from it, without deleting
     * products other users have interacted with.
     */
    private void scrubDesignerIdentity(Long userId) {
        DesignerProfile profile = designerProfileRepository.findByUserId(userId).orElse(null);
        if (profile == null) {
            return;
        }
        List<Product> products = productRepository.findByDesignerProfileId(profile.getId());
        for (Product product : products) {
            product.setStatus(ProductStatus.ARCHIVED);
        }
        productRepository.saveAll(products);

        profile.setDisplayName("Former designer");
        profile.setShopName("Former designer");
        profile.setBio(null);
        profile.setCity(null);
        designerProfileRepository.save(profile);
        log.info("Archived {} product(s) and scrubbed the designer profile for user {}",
                products.size(), userId);
    }

    /**
     * Overwrites every identifying field and marks the row deleted.
     *
     * <p>The email is replaced rather than nulled because the column is unique and non-null, and
     * it is replaced with a value in the brand's own domain so it cannot collide with a real
     * address. {@code tokenVersion} is bumped, which invalidates every JWT this account ever
     * issued — otherwise a token in someone's browser would keep working for up to 24h after
     * the deletion.
     */
    private void tombstone(User user) {
        user.setEmail("deleted-" + user.getId() + "-" + UUID.randomUUID() + "@deleted."
                + brandProperties.domain());
        user.setUsername(null);
        user.setName("Deleted account");
        // A random hash, not a blank one: a blank or predictable value would make the row
        // loggable-into if the deleted_at filter were ever missed somewhere.
        user.setPasswordHash("{deleted}" + UUID.randomUUID());
        user.setVerificationToken(null);
        user.setVerificationTokenExpiresAt(null);
        user.setAvatarGlbUrl(null);
        user.setAvatarMode(null);
        user.setAvatarPreset(null);
        // The style/fit/budget profile is as personal as the measurements — it is a record of
        // the user's body and their taste, and none of it is needed to keep an order valid.
        user.setAgeRange(null);
        user.setGenderIdentity(null);
        user.setStyleAesthetics(null);
        user.setFitPreferences(null);
        user.setFavoriteColors(null);
        user.setAvoidedColors(null);
        user.setBudgetRange(null);
        user.setFavoriteBrands(null);
        user.setSustainableFashionInterest(null);
        user.setPricePreference(null);
        user.setOutfitGoals(null);
        user.setCity(null);
        user.setProfileVisibility("PRIVATE");
        user.setEmailVerified(false);
        user.setTokenVersion(user.getTokenVersion() + 1);
        user.setDeletedAt(Instant.now());
        userRepository.save(user);
    }

    /** Keeps the audit log useful without writing the departing user's address into it. */
    private static String redact(String email) {
        int at = email.indexOf('@');
        return at <= 1 ? "***" : email.charAt(0) + "***" + email.substring(at);
    }
}
