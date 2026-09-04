package com.clossette.service;

import com.clossette.dto.PagedResponse;
import com.clossette.dto.UserResponse;
import com.clossette.entity.Follow;
import com.clossette.entity.User;
import com.clossette.repository.FollowRepository;
import com.clossette.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class FollowService {

    private final FollowRepository followRepository;
    private final UserRepository userRepository;

    @Transactional
    public void follow(String email, Long targetUserId) {
        User follower = findUser(email);
        User following = findUserById(targetUserId);
        if (follower.getId().equals(following.getId())) {
            throw new IllegalArgumentException("Cannot follow yourself");
        }
        if (followRepository.existsByFollowerAndFollowing(follower, following)) {
            return;
        }
        followRepository.save(Follow.builder().follower(follower).following(following).build());
        log.debug("User {} followed user {}", follower.getId(), targetUserId);
    }

    @Transactional
    public void unfollow(String email, Long targetUserId) {
        User follower = findUser(email);
        User following = findUserById(targetUserId);
        followRepository.findByFollowerAndFollowing(follower, following)
            .ifPresent(followRepository::delete);
        log.debug("User {} unfollowed user {}", follower.getId(), targetUserId);
    }

    @Transactional(readOnly = true)
    public PagedResponse<UserResponse> getFollowers(Long userId, int page, int size) {
        User user = findUserById(userId);
        Pageable pageable = PageRequest.of(page, size);
        return PagedResponse.from(
            followRepository.findByFollowingOrderByCreatedAtDesc(user, pageable)
                .map(f -> UserResponse.from(f.getFollower()))
        );
    }

    @Transactional(readOnly = true)
    public PagedResponse<UserResponse> getFollowing(Long userId, int page, int size) {
        User user = findUserById(userId);
        Pageable pageable = PageRequest.of(page, size);
        return PagedResponse.from(
            followRepository.findByFollowerOrderByCreatedAtDesc(user, pageable)
                .map(f -> UserResponse.from(f.getFollowing()))
        );
    }

    @Transactional(readOnly = true)
    public boolean isFollowing(String email, Long targetUserId) {
        User follower = findUser(email);
        User following = findUserById(targetUserId);
        return followRepository.existsByFollowerAndFollowing(follower, following);
    }

    private User findUser(String email) {
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private User findUserById(Long id) {
        return userRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }
}
