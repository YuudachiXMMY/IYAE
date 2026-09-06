package com.iyae.repository;

import com.iyae.entity.Follow;
import com.iyae.entity.Post;
import com.iyae.entity.User;
import com.iyae.entity.enums.PostStatus;
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

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises the Phase-6 feed queries against an embedded database so each predicate actually runs:
 * the {@code findFollowingFeed} JPQL join, the {@code city}/{@code topic} derived finders, and the
 * real follower/following COUNT queries. Every feed query MUST constrain {@code status = ACTIVE};
 * these tests kill any mutation that drops that constraint by persisting ARCHIVED / PENDING_DELETE
 * decoys that must never appear.
 *
 * <p>The slice scans only {@link PostRepository} and {@link FollowRepository} (mirroring
 * {@link ProductSpecificationsDataJpaTest}) to dodge the pre-existing broken
 * {@code PasswordResetTokenRepository.consumeToken} query that Hibernate 6.6 rejects at bootstrap.
 */
@DataJpaTest
@ActiveProfiles("test")
@EnableJpaRepositories(
        basePackageClasses = PostRepository.class,
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.REGEX,
                pattern = "com\\.iyae\\.repository\\.(?!PostRepository|FollowRepository).*"))
class PostFeedDataJpaTest {

    @Autowired
    TestEntityManager em;

    @Autowired
    PostRepository postRepository;

    @Autowired
    FollowRepository followRepository;

    private User persistUser(String email, String city) {
        return em.persist(User.builder()
                .email(email).passwordHash("x").name(email).role(Role.BUYER).city(city).build());
    }

    private Post persistPost(User user, String city, String topic, PostStatus status) {
        return em.persist(Post.builder()
                .user(user).content("hi").city(city).topic(topic).status(status).build());
    }

    @Test
    void findFollowingFeed_returnsOnlyFollowedAuthorsActivePosts() {
        User me = persistUser("me@ex.com", null);
        User followed = persistUser("followed@ex.com", null);
        User stranger = persistUser("stranger@ex.com", null);
        em.persist(Follow.builder().follower(me).following(followed).build());
        Post fromFollowed = persistPost(followed, null, null, PostStatus.ACTIVE);
        persistPost(stranger, null, null, PostStatus.ACTIVE);    // not followed → excluded
        persistPost(followed, null, null, PostStatus.ARCHIVED);  // moderated → excluded
        em.flush();
        em.clear();

        Page<Post> page = postRepository.findFollowingFeed(me, PostStatus.ACTIVE, Pageable.unpaged());

        assertThat(page).extracting(Post::getId).containsExactly(fromFollowed.getId());
    }

    @Test
    void findByStatusAndCity_excludesOtherCitiesAndModerated() {
        User u = persistUser("u@ex.com", "Toronto");
        Post toronto = persistPost(u, "Toronto", null, PostStatus.ACTIVE);
        persistPost(u, "Vancouver", null, PostStatus.ACTIVE);    // wrong city → excluded
        persistPost(u, "Toronto", null, PostStatus.ARCHIVED);    // moderated → excluded
        em.flush();
        em.clear();

        Page<Post> page = postRepository.findByStatusAndCityOrderByCreatedAtDesc(
                PostStatus.ACTIVE, "Toronto", Pageable.unpaged());

        assertThat(page).extracting(Post::getId).containsExactly(toronto.getId());
    }

    @Test
    void findByStatusAndTopic_filtersTopicAndStatus() {
        User u = persistUser("u2@ex.com", null);
        Post bodyConfidence = persistPost(u, null, "body-confidence", PostStatus.ACTIVE);
        persistPost(u, null, "haul", PostStatus.ACTIVE);                       // wrong topic → excluded
        persistPost(u, null, "body-confidence", PostStatus.PENDING_DELETE);    // moderated → excluded
        em.flush();
        em.clear();

        Page<Post> page = postRepository.findByStatusAndTopicOrderByCreatedAtDesc(
                PostStatus.ACTIVE, "body-confidence", Pageable.unpaged());

        assertThat(page).extracting(Post::getId).containsExactly(bodyConfidence.getId());
    }

    @Test
    void countByFollowingAndCountByFollower_returnRealCounts() {
        User target = persistUser("t@ex.com", null);
        User f1 = persistUser("f1@ex.com", null);
        User f2 = persistUser("f2@ex.com", null);
        em.persist(Follow.builder().follower(f1).following(target).build());   // target has 2 followers
        em.persist(Follow.builder().follower(f2).following(target).build());
        em.persist(Follow.builder().follower(target).following(f1).build());   // target follows 1
        em.flush();
        em.clear();

        assertThat(followRepository.countByFollowing(target)).isEqualTo(2);
        assertThat(followRepository.countByFollower(target)).isEqualTo(1);
    }
}
