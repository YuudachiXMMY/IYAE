package com.iyae.service;

import com.iyae.dto.FollowCountsResponse;
import com.iyae.dto.PagedResponse;
import com.iyae.dto.PublicUserSummary;
import com.iyae.entity.Follow;
import com.iyae.entity.User;
import com.iyae.util.Pagination;
import com.iyae.repository.FollowRepository;
import com.iyae.repository.UserRepository;
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
    public PagedResponse<PublicUserSummary> getFollowers(Long userId, int page, int size) {
        User user = findUserById(userId);
        Pageable pageable = PageRequest.of(Pagination.clampPage(page), Pagination.clampSize(size));
        // Redacted summary — never leak email/demographics across the follows graph.
        return PagedResponse.from(
            followRepository.findByFollowingOrderByCreatedAtDesc(user, pageable)
                .map(f -> PublicUserSummary.from(f.getFollower()))
        );
    }

    @Transactional(readOnly = true)
    public PagedResponse<PublicUserSummary> getFollowing(Long userId, int page, int size) {
        User user = findUserById(userId);
        Pageable pageable = PageRequest.of(Pagination.clampPage(page), Pagination.clampSize(size));
        return PagedResponse.from(
            followRepository.findByFollowerOrderByCreatedAtDesc(user, pageable)
                .map(f -> PublicUserSummary.from(f.getFollowing()))
        );
    }

    @Transactional(readOnly = true)
    public boolean isFollowing(String email, Long targetUserId) {
        User follower = findUser(email);
        User following = findUserById(targetUserId);
        return followRepository.existsByFollowerAndFollowing(follower, following);
    }

    /** Real follower/following counts (derived COUNT queries — never denormalized). */
    @Transactional(readOnly = true)
    public FollowCountsResponse getCounts(Long userId) {
        User user = findUserById(userId);
        long followers = followRepository.countByFollowing(user);
        long following = followRepository.countByFollower(user);
        return new FollowCountsResponse(followers, following);
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
