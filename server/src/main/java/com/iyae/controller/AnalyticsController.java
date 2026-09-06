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
     * Cohort-sliced KPI summary. Gated to elevated roles in {@code SecurityConfig}
     * (interim: DESIGNER; move to ADMIN once the Phase-5 role lands).
     */
    @GetMapping("/api/admin/kpis")
    public ResponseEntity<KpiSummaryResponse> kpis() {
        return ResponseEntity.status(HttpStatus.OK).body(analyticsService.kpisByCohort());
    }
}
