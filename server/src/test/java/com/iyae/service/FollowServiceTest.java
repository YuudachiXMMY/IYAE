package com.iyae.service;

import com.iyae.dto.PagedResponse;
import com.iyae.dto.UserResponse;
import com.iyae.entity.Follow;
import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import com.iyae.repository.FollowRepository;
import com.iyae.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FollowServiceTest {

    @Mock FollowRepository followRepository;
    @Mock UserRepository userRepository;

    @InjectMocks FollowService followService;

    private User userA;
    private User userB;

    @BeforeEach
    void setUp() {
        userA = User.builder()
                .id(1L).email("a@test.com").name("Alice")
                .username("alice").role(Role.BUYER).build();

        userB = User.builder()
                .id(2L).email("b@test.com").name("Bob")
                .username("bob").role(Role.BUYER).build();
    }

    // ── follow ────────────────────────────────────────────────────────────────

    @Test
    void follow_success_savesFollowRecord() {
        when(userRepository.findByEmail("a@test.com")).thenReturn(Optional.of(userA));
        when(userRepository.findById(2L)).thenReturn(Optional.of(userB));
        when(followRepository.existsByFollowerAndFollowing(userA, userB)).thenReturn(false);

        followService.follow("a@test.com", 2L);

        verify(followRepository).save(any(Follow.class));
    }

    @Test
    void follow_self_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("a@test.com")).thenReturn(Optional.of(userA));
        when(userRepository.findById(1L)).thenReturn(Optional.of(userA));

        assertThatThrownBy(() -> followService.follow("a@test.com", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Cannot follow yourself");
    }

    @Test
    void follow_alreadyFollowing_isNoOp() {
        when(userRepository.findByEmail("a@test.com")).thenReturn(Optional.of(userA));
        when(userRepository.findById(2L)).thenReturn(Optional.of(userB));
        when(followRepository.existsByFollowerAndFollowing(userA, userB)).thenReturn(true);

        followService.follow("a@test.com", 2L);

        verify(followRepository, never()).save(any());
    }

    // ── unfollow ──────────────────────────────────────────────────────────────

    @Test
    void unfollow_existing_deletesFollowRecord() {
        Follow follow = Follow.builder().id(99L).follower(userA).following(userB).build();
        when(userRepository.findByEmail("a@test.com")).thenReturn(Optional.of(userA));
        when(userRepository.findById(2L)).thenReturn(Optional.of(userB));
        when(followRepository.findByFollowerAndFollowing(userA, userB)).thenReturn(Optional.of(follow));

        followService.unfollow("a@test.com", 2L);

        verify(followRepository).delete(follow);
    }

    @Test
    void unfollow_notFollowing_isNoOp() {
        when(userRepository.findByEmail("a@test.com")).thenReturn(Optional.of(userA));
        when(userRepository.findById(2L)).thenReturn(Optional.of(userB));
        when(followRepository.findByFollowerAndFollowing(userA, userB)).thenReturn(Optional.empty());

        followService.unfollow("a@test.com", 2L);

        verify(followRepository, never()).delete(any());
    }

    // ── getFollowers ──────────────────────────────────────────────────────────

    @Test
    void getFollowers_returnsPagedFollowers() {
        Follow follow = Follow.builder().id(1L).follower(userA).following(userB).build();
        when(userRepository.findById(2L)).thenReturn(Optional.of(userB));
        when(followRepository.findByFollowingOrderByCreatedAtDesc(eq(userB), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(follow)));

        PagedResponse<UserResponse> result = followService.getFollowers(2L, 0, 10);

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).id()).isEqualTo(1L);
    }

    // ── getFollowing ──────────────────────────────────────────────────────────

    @Test
    void getFollowing_returnsPagedFollowing() {
        Follow follow = Follow.builder().id(1L).follower(userA).following(userB).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(userA));
        when(followRepository.findByFollowerOrderByCreatedAtDesc(eq(userA), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(follow)));

        PagedResponse<UserResponse> result = followService.getFollowing(1L, 0, 10);

        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).id()).isEqualTo(2L);
    }
}
