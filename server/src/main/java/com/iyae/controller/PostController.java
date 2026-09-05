package com.iyae.controller;

import com.iyae.dto.CommentRequest;
import com.iyae.dto.CommentResponse;
import com.iyae.dto.PagedResponse;
import com.iyae.dto.PostRequest;
import com.iyae.dto.PostResponse;
import com.iyae.service.PostService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;

    @PostMapping
    public ResponseEntity<PostResponse> createPost(
            @Valid @RequestBody PostRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(postService.createPost(authentication.getName(), request));
    }

    @GetMapping
    public ResponseEntity<PagedResponse<PostResponse>> getFeed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        return ResponseEntity.ok(postService.getFeed(email, page, size));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<PagedResponse<PostResponse>> getByUser(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication
    ) {
        String email = authentication != null ? authentication.getName() : null;
        return ResponseEntity.ok(postService.getByUser(userId, email, page, size));
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<PostResponse> like(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(postService.toggleLike(id, authentication.getName()));
    }

    @DeleteMapping("/{id}/like")
    public ResponseEntity<PostResponse> unlike(
            @PathVariable Long id,
            Authentication authentication
    ) {
        return ResponseEntity.ok(postService.toggleLike(id, authentication.getName()));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<CommentResponse> addComment(
            @PathVariable Long id,
            @Valid @RequestBody CommentRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(postService.addComment(id, authentication.getName(), request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePost(
            @PathVariable Long id,
            Authentication authentication
    ) {
        postService.softDelete(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
