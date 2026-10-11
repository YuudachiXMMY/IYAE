package com.iyae.service;

import com.iyae.config.BrandProperties;
import com.iyae.entity.Cart;
import com.iyae.entity.DesignerProfile;
import com.iyae.entity.Product;
import com.iyae.entity.User;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.entity.enums.Role;
import com.iyae.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** #47: a deletion path must actually remove the personal data, and must be safe to retry. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AccountDeletionServiceTest {

    @Mock UserRepository userRepository;
    @Mock PostRepository postRepository;
    @Mock PostCommentRepository postCommentRepository;
    @Mock PostLikeRepository postLikeRepository;
    @Mock PostReportRepository postReportRepository;
    @Mock FollowRepository followRepository;
    @Mock ChatSessionRepository chatSessionRepository;
    @Mock ChatMessageRepository chatMessageRepository;
    @Mock SavedLookRepository savedLookRepository;
    @Mock SavedProductRepository savedProductRepository;
    @Mock ReviewRepository reviewRepository;
    @Mock ResaleListingRepository resaleListingRepository;
    @Mock OutfitRecommendationRepository outfitRecommendationRepository;
    @Mock AnalyticsEventRepository analyticsEventRepository;
    @Mock CohortAssignmentRepository cohortAssignmentRepository;
    @Mock PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock CartRepository cartRepository;
    @Mock CartItemRepository cartItemRepository;
    @Mock DesignerProfileRepository designerProfileRepository;
    @Mock ProductRepository productRepository;
    @Mock AvatarService avatarService;
    @Mock BrandProperties brandProperties;

    @InjectMocks AccountDeletionService service;

    private User buyer;

    @BeforeEach
    void setUp() {
        buyer = User.builder()
                .id(42L)
                .email("buyer@test.com")
                .passwordHash("$2a$10$original")
                .name("Test Buyer")
                .username("buyerhandle")
                .role(Role.BUYER)
                .emailVerified(true)
                .tokenVersion(3)
                .city("Toronto")
                .genderIdentity("Female")
                .favoriteColors("[\"sage\"]")
                .avatarGlbUrl("/assets/avatars/42/avatar.glb")
                .build();
        when(brandProperties.domain()).thenReturn("iyae.ca");
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(buyer));
    }

    @Test
    void deletesEveryCategoryOfPersonalContent() {
        service.deleteAccount("buyer@test.com");

        verify(avatarService).deleteAvatarData("buyer@test.com");
        verify(postLikeRepository).deleteByUser(buyer);
        verify(postCommentRepository).deleteByUser(buyer);
        verify(postReportRepository).deleteByReporter(buyer);
        verify(postRepository).deleteByUser(buyer);
        verify(chatMessageRepository).deleteBySessionUser(buyer);
        verify(chatSessionRepository).deleteByUser(buyer);
        verify(savedLookRepository).deleteByUserId(42L);
        verify(outfitRecommendationRepository).deleteByUser(buyer);
        verify(savedProductRepository).deleteByUserId(42L);
        verify(reviewRepository).deleteByUserId(42L);
        verify(resaleListingRepository).deleteBySellerId(42L);
        verify(analyticsEventRepository).deleteByUserId(42L);
        verify(cohortAssignmentRepository).deleteByUserId(42L);
        verify(passwordResetTokenRepository).deleteByUser(buyer);
    }

    @Test
    void removesFollowsInBothDirections() {
        // Deleting only the outgoing side would leave the departing user listed as a follower
        // in other people's follower counts and lists.
        service.deleteAccount("buyer@test.com");

        verify(followRepository).deleteByFollower(buyer);
        verify(followRepository).deleteByFollowing(buyer);
    }

    @Test
    void scrubsEveryIdentifyingFieldOnTheRowItKeeps() {
        service.deleteAccount("buyer@test.com");

        assertThat(buyer.getDeletedAt()).isNotNull();
        assertThat(buyer.getEmail()).doesNotContain("buyer@test.com").contains("deleted-42-");
        assertThat(buyer.getUsername()).isNull();
        assertThat(buyer.getName()).isEqualTo("Deleted account");
        assertThat(buyer.getPasswordHash()).doesNotContain("original");
        assertThat(buyer.getAvatarGlbUrl()).isNull();
        assertThat(buyer.getCity()).isNull();
        assertThat(buyer.getGenderIdentity()).isNull();
        assertThat(buyer.getFavoriteColors()).isNull();
        assertThat(buyer.getEmailVerified()).isFalse();
    }

    @Test
    void bumpsTokenVersionSoLiveSessionsDieImmediately() {
        // Without this a JWT already in someone's browser keeps authenticating the deleted
        // account for up to the 24h token lifetime.
        service.deleteAccount("buyer@test.com");

        assertThat(buyer.getTokenVersion()).isEqualTo(4);
    }

    @Test
    void keepsTheUserRowSoOrderHistorySurvives() {
        service.deleteAccount("buyer@test.com");

        // orders holds a non-null FK to users and an order is a financial record.
        verify(userRepository, never()).delete(any(User.class));
        verify(userRepository, never()).deleteById(anyLong());
        verify(userRepository).save(buyer);
    }

    @Test
    void isIdempotentForAnAlreadyDeletedAccount() {
        buyer.setDeletedAt(Instant.now());

        service.deleteAccount("buyer@test.com");

        verify(avatarService, never()).deleteAvatarData(anyString());
        verify(postRepository, never()).deleteByUser(any());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void isANoOpForAnUnknownAccount() {
        when(userRepository.findByEmail("ghost@test.com")).thenReturn(Optional.empty());

        service.deleteAccount("ghost@test.com");

        verify(postRepository, never()).deleteByUser(any());
    }

    @Test
    void emptiesTheCartBeforeDeletingIt() {
        Cart cart = Cart.builder().id(7L).user(buyer).build();
        when(cartRepository.findByUserId(42L)).thenReturn(Optional.of(cart));

        service.deleteAccount("buyer@test.com");

        verify(cartItemRepository).deleteByCartId(7L);
        verify(cartRepository).deleteByUserId(42L);
    }

    @Test
    void archivesADesignersProductsRatherThanDeletingThem() {
        // A product is a catalogue entry other people have reviewed, carted and bought.
        // Deleting it would cascade into other users' data.
        DesignerProfile profile = DesignerProfile.builder()
                .id(5L).user(buyer).displayName("Luna Kim").shopName("Luna Studio")
                .bio("Minimalist").city("Toronto").build();
        Product published = Product.builder().id(100L).status(ProductStatus.PUBLISHED).build();
        when(designerProfileRepository.findByUserId(42L)).thenReturn(Optional.of(profile));
        when(productRepository.findByDesignerProfileId(5L)).thenReturn(List.of(published));

        service.deleteAccount("buyer@test.com");

        assertThat(published.getStatus()).isEqualTo(ProductStatus.ARCHIVED);
        verify(productRepository, never()).delete(any(Product.class));

        ArgumentCaptor<DesignerProfile> saved = ArgumentCaptor.forClass(DesignerProfile.class);
        verify(designerProfileRepository).save(saved.capture());
        assertThat(saved.getValue().getDisplayName()).isEqualTo("Former designer");
        assertThat(saved.getValue().getBio()).isNull();
        assertThat(saved.getValue().getCity()).isNull();
    }

    @Test
    void theReplacementEmailCannotCollideWithARealAddress() {
        service.deleteAccount("buyer@test.com");

        // Unique and non-null column, so it has to be replaced rather than nulled — and it is
        // placed in a subdomain that cannot be a deliverable address.
        assertThat(buyer.getEmail()).endsWith("@deleted.iyae.ca");
    }
}
