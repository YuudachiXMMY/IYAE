package com.iyae.controller;

import com.iyae.config.AnalyticsProperties;
import com.iyae.dto.DrapeDecisionResponse;
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

import java.time.Instant;
import java.time.format.DateTimeParseException;

@RestController
@RequiredArgsConstructor
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final UserRepository userRepository;
    private final AnalyticsProperties analyticsProperties;

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

    /**
     * Phase 4 前后对比(pre/post 部署)决策门。ADMIN-only(同 {@code /api/admin/**} URL 规则)。
     * cutoff 优先取查询参 {@code ?cutoff=<ISO-8601 instant>},否则取
     * {@code app.analytics.drape-deploy-cutoff};两者皆空 → 400。非法格式 → 400
     * (via {@code IllegalArgumentException} → {@code GlobalExceptionHandler}).
     */
    @GetMapping("/api/admin/kpis/drape-decision")
    public ResponseEntity<DrapeDecisionResponse> drapeDecision(
            @RequestParam(value = "cutoff", required = false) String cutoff) {
        String raw = (cutoff != null && !cutoff.isBlank())
                ? cutoff : analyticsProperties.drapeDeployCutoff();
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException(
                    "cutoff required: pass ?cutoff=<ISO-8601 instant> or set app.analytics.drape-deploy-cutoff");
        }
        Instant parsed;
        try {
            parsed = Instant.parse(raw.trim());
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException(
                    "Invalid cutoff (expect ISO-8601 instant, e.g. 2026-09-10T00:00:00Z): " + raw);
        }
        return ResponseEntity.ok(analyticsService.drapeDecision(parsed));
    }
}
