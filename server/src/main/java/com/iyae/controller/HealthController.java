package com.iyae.controller;

import com.iyae.service.HealthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Liveness and readiness probes.
 *
 * <p>Split deliberately. {@code /api/health} stays a cheap always-200 liveness answer;
 * {@code /api/health/ready} touches the database and can actually fail, and is what the
 * container healthcheck and the deploy script gate on. Previously a single hardcoded 200 served
 * both roles, so a server with an unreachable database reported healthy and the deploy script
 * declared success on a broken release.
 */
@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
public class HealthController {

    private final HealthService healthService;

    @GetMapping
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(healthService.getServerHealth());
    }

    @GetMapping("/ready")
    public ResponseEntity<Map<String, String>> ready() {
        boolean ready = healthService.isReady();
        Map<String, String> body = Map.of(
            "status", ready ? "READY" : "NOT_READY",
            "database", ready ? "UP" : "DOWN"
        );
        return ready
            ? ResponseEntity.ok(body)
            : ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }

    @GetMapping("/ai")
    public ResponseEntity<Map<String, String>> aiHealth() {
        return ResponseEntity.ok(healthService.getAiHealth());
    }
}
