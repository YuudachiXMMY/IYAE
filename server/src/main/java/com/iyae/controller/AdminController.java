package com.iyae.controller;

import com.iyae.dto.AdminPostResponse;
import com.iyae.dto.PagedResponse;
import com.iyae.dto.PostReportResponse;
import com.iyae.dto.ProductResponse;
import com.iyae.dto.ProductStatusUpdateRequest;
import com.iyae.dto.PromotionResponse;
import com.iyae.dto.PromotionSlotUpdateRequest;
import com.iyae.entity.enums.PostStatus;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.entity.enums.ReportStatus;
import com.iyae.service.AdminModerationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin moderation API. Access is gated to {@code ROLE_ADMIN} by URL rule in
 * {@code SecurityConfig} ({@code /api/admin/**}); no {@code @PreAuthorize} here.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminModerationService adminModerationService;

    // ---- Catalog moderation ----

    @GetMapping("/products")
    public ResponseEntity<List<ProductResponse>> listProducts(
            @RequestParam(required = false) ProductStatus status) {
        return ResponseEntity.ok(adminModerationService.listAllProducts(status));
    }

    @PutMapping("/products/{id}/status")
    public ResponseEntity<ProductResponse> setProductStatus(
            @PathVariable Long id,
            @Valid @RequestBody ProductStatusUpdateRequest request) {
        return ResponseEntity.ok(adminModerationService.setProductStatus(id, request.status()));
    }

    // ---- Community moderation ----

    @GetMapping("/posts")
    public ResponseEntity<List<AdminPostResponse>> listPosts(
            @RequestParam(required = false) PostStatus status) {
        return ResponseEntity.ok(adminModerationService.listPostsForModeration(status));
    }

    @PutMapping("/posts/{id}/archive")
    public ResponseEntity<AdminPostResponse> archivePost(@PathVariable Long id) {
        return ResponseEntity.ok(adminModerationService.archivePost(id));
    }

    @PutMapping("/posts/{id}/remove")
    public ResponseEntity<AdminPostResponse> removePost(@PathVariable Long id) {
        return ResponseEntity.ok(adminModerationService.removePost(id));
    }

    // ---- User report queue ----

    @GetMapping("/reports")
    public ResponseEntity<PagedResponse<PostReportResponse>> listReports(
            @RequestParam(required = false) ReportStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(adminModerationService.listReports(status, page, size));
    }

    @PutMapping("/reports/{id}/resolve")
    public ResponseEntity<PostReportResponse> resolveReport(
            @PathVariable Long id,
            @RequestParam(defaultValue = "RESOLVED") ReportStatus status,
            @RequestParam(defaultValue = "false") boolean removePost) {
        return ResponseEntity.ok(adminModerationService.resolveReport(id, status, removePost));
    }

    @PutMapping("/comments/{id}/remove")
    public ResponseEntity<Void> removeComment(@PathVariable Long id) {
        adminModerationService.removeComment(id);
        return ResponseEntity.noContent().build();
    }

    // ---- Promotion moderation ----

    @GetMapping("/promotions")
    public ResponseEntity<List<PromotionResponse>> listPromotions() {
        return ResponseEntity.ok(adminModerationService.listPromotions());
    }

    @PutMapping("/promotions/{id}/slot")
    public ResponseEntity<PromotionResponse> setPromotionSlot(
            @PathVariable Long id,
            @Valid @RequestBody PromotionSlotUpdateRequest request) {
        return ResponseEntity.ok(adminModerationService.setPromotionSlot(id, request.slotType()));
    }
}
