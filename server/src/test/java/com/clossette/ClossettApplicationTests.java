package com.clossette;

import com.clossette.config.DataSeeder;
import com.clossette.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.jdbc.DataSourceTransactionManagerAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.NONE,
    properties = "app.jwt.secret=test-secret-key-for-unit-testing-minimum-32-chars"
)
@EnableAutoConfiguration(exclude = {
    DataSourceAutoConfiguration.class,
    DataSourceTransactionManagerAutoConfiguration.class,
    HibernateJpaAutoConfiguration.class,
    FlywayAutoConfiguration.class
})
@ActiveProfiles("test")
class ClossettApplicationTests {

    @MockBean
    UserRepository userRepository;

    @MockBean
    ProductRepository productRepository;

    @MockBean
    CartRepository cartRepository;

    @MockBean
    CartItemRepository cartItemRepository;

    @MockBean
    OutfitRecommendationRepository outfitRecommendationRepository;

    @MockBean
    SavedLookRepository savedLookRepository;

    @MockBean
    ChatSessionRepository chatSessionRepository;

    @MockBean
    ChatMessageRepository chatMessageRepository;

    @MockBean
    OrderRepository orderRepository;

    @MockBean
    ReviewRepository reviewRepository;

    @MockBean
    DesignerProfileRepository designerProfileRepository;

    @MockBean
    ModelGenerationTaskRepository modelGenerationTaskRepository;

    @MockBean
    GarmentAssetRepository garmentAssetRepository;

    @MockBean
    BodyProfileRepository bodyProfileRepository;

    @MockBean
    PromotionRepository promotionRepository;

    @MockBean
    PasswordResetTokenRepository passwordResetTokenRepository;

    @MockBean
    AvatarGenerationTaskRepository avatarGenerationTaskRepository;

    @MockBean
    RiggingTaskRepository riggingTaskRepository;

    @MockBean
    PostRepository postRepository;

    @MockBean
    PostLikeRepository postLikeRepository;

    @MockBean
    PostCommentRepository postCommentRepository;

    @MockBean
    FollowRepository followRepository;

    @MockBean
    DataSeeder dataSeeder;

    @MockBean
    org.springframework.transaction.support.TransactionTemplate transactionTemplate;

    @MockBean
    com.clossette.service.StripeCheckoutGateway stripeCheckoutGateway;

    @Test
    void contextLoads() {
        // Verifies that the Spring application context starts without errors
    }
}
