package com.iyae.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private record RateRule(String method, String pathPrefix, int maxRequests, long windowMs) {}

    private static final List<RateRule> RULES = List.of(
            new RateRule("POST", "/api/auth/login", 5, 60_000),
            new RateRule("POST", "/api/auth/register", 3, 60_000),
            new RateRule("POST", "/api/auth/forgot-password", 3, 60_000),
            new RateRule("POST", "/api/auth/resend-verification", 3, 60_000),
            new RateRule("PUT",  "/api/auth/me", 10, 60_000),
            new RateRule(null,   "/api/chat/", 10, 60_000),
            new RateRule(null,   "/api/checkout", 5, 60_000),
            new RateRule("POST", "/api/public/avatar/generate", 3, 60_000)
    );

    private record BucketKey(String ip, String methodKey, String pathPrefix) {}

    private record BucketEntry(long windowStart, int count) {}

    private final Map<BucketKey, BucketEntry> buckets = new ConcurrentHashMap<>();
    private volatile long lastCleanup = System.currentTimeMillis();
    private static final long CLEANUP_INTERVAL_MS = 300_000; // 5 minutes
    private static final long MAX_WINDOW_MS = 60_000; // longest rule window

    @Value("${app.rate-limit.trusted-proxies:}")
    private String trustedProxies;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        evictExpiredEntries();
        String path = request.getRequestURI();
        String ip = resolveClientIp(request);

        for (RateRule rule : RULES) {
            if ((rule.method() == null || rule.method().equals(request.getMethod()))
                    && path.startsWith(rule.pathPrefix())) {
                String methodKey = rule.method() == null ? "*" : rule.method();
                if (!tryConsume(new BucketKey(ip, methodKey, rule.pathPrefix()), rule)) {
                    response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                    response.setContentType("application/json");
                    response.getWriter().write("{\"message\":\"Too many requests. Please try again later.\"}");
                    return;
                }
                break;
            }
        }

        filterChain.doFilter(request, response);
    }

    private boolean tryConsume(BucketKey key, RateRule rule) {
        long now = System.currentTimeMillis();
        return buckets.compute(key, (k, entry) -> {
            if (entry == null || now - entry.windowStart() >= rule.windowMs()) {
                return new BucketEntry(now, 1);
            }
            return new BucketEntry(entry.windowStart(), entry.count() + 1);
        }).count() <= rule.maxRequests();
    }

    private void evictExpiredEntries() {
        long now = System.currentTimeMillis();
        if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
            return;
        }
        lastCleanup = now;
        buckets.entrySet().removeIf(e -> now - e.getValue().windowStart() > MAX_WINDOW_MS);
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (trustedProxies == null || trustedProxies.isBlank()) {
            return request.getRemoteAddr();
        }
        java.util.Set<String> trusted = java.util.Set.of(
                java.util.Arrays.stream(trustedProxies.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toArray(String[]::new));
        // Only parse X-Forwarded-For if the direct connection is from a trusted proxy
        String remoteAddr = request.getRemoteAddr();
        if (!trusted.contains(remoteAddr)) {
            return remoteAddr;
        }
        String xff = request.getHeader("X-Forwarded-For");
        if (xff == null || xff.isBlank()) {
            return remoteAddr;
        }
        String[] ips = xff.split(",");
        // Walk right-to-left, skip trusted proxies
        for (int i = ips.length - 1; i >= 0; i--) {
            String ip = ips[i].trim();
            if (!trusted.contains(ip)) {
                return ip;
            }
        }
        return remoteAddr;
    }
}
