package com.iyae.controller;

import com.iyae.dto.KpiSummaryResponse;
import com.iyae.dto.TrackEventRequest;
import com.iyae.entity.enums.EventType;
import com.iyae.repository.UserRepository;
import com.iyae.service.AnalyticsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final UserRepository userRepository;

    /** Best-effort client event ingestion. Returns 202 whether or not the row lands. */
    @PostMapping("/api/events")
    public ResponseEntity<Void> track(Authentication authentication,
                                      @Valid @RequestBody TrackEventRequest request) {
        EventType type;
        try {
            type = EventType.valueOf(request.type().trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unknown event type: " + request.type());
        }
        Long userId = userRepository.findByEmail(authentication.getName())
                .map(u -> u.getId())
                .orElse(null);
        analyticsService.record(userId, type, request.productId(), null,
                request.sizeBracket(), request.metadata());
        return ResponseEntity.accepted().build();
    }

    /**
     * Cohort-sliced KPI summary. ADMIN-only: the {@code /api/admin/**} rule in
     * {@code SecurityConfig} maps this path to {@code hasRole("ADMIN")}, so a
     * DESIGNER or BUYER token is rejected with 403. No method-level
     * {@code @PreAuthorize} is added — the URL rule is authoritative and
     * double-gating would risk a 500-vs-403 mismatch.
     */
    @GetMapping("/api/admin/kpis")
    public ResponseEntity<KpiSummaryResponse> kpis() {
        return ResponseEntity.status(HttpStatus.OK).body(analyticsService.kpisByCohort());
    }
}
