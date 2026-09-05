package com.iyae.controller;

import com.iyae.dto.PagedResponse;
import com.iyae.dto.UserResponse;
import com.iyae.service.FollowService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/follows")
@RequiredArgsConstructor
public class FollowController {

    private final FollowService followService;

    @PostMapping("/{userId}")
    public ResponseEntity<Void> follow(
            @PathVariable Long userId,
            Authentication authentication
    ) {
        followService.follow(authentication.getName(), userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> unfollow(
            @PathVariable Long userId,
            Authentication authentication
    ) {
        followService.unfollow(authentication.getName(), userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{userId}/followers")
    public ResponseEntity<PagedResponse<UserResponse>> getFollowers(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(followService.getFollowers(userId, page, size));
    }

    @GetMapping("/{userId}/following")
    public ResponseEntity<PagedResponse<UserResponse>> getFollowing(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(followService.getFollowing(userId, page, size));
    }
}
