package com.iyae.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    // pathSuffix is nullable: when set, the rule matches only when the URI also ends with
    // it (used to isolate /api/products/*/recommended-size without catching catalog/detail).
    private record RateRule(String method, String pathPrefix, String pathSuffix,
                            int maxRequests, long windowMs) {}

    private static final List<RateRule> RULES = List.of(
            new RateRule("POST", "/api/auth/login", null, 5, 60_000),
            new RateRule("POST", "/api/auth/register", null, 3, 60_000),
            new RateRule("POST", "/api/auth/forgot-password", null, 3, 60_000),
            new RateRule("POST", "/api/auth/resend-verification", null, 3, 60_000),
            new RateRule("PUT",  "/api/auth/me", null, 10, 60_000),
            // POST-scoped: only the expensive AI endpoints (POST /sessions,
            // POST /sessions/{id}/messages) count against this bucket. GET /api/chat/weather
            // (polled by the useWeather hook) and other chat GETs must not share it, or a
            // few weather polls would 429 a user's legitimate messages.
            new RateRule("POST", "/api/chat/", null, 10, 60_000),
            new RateRule(null,   "/api/checkout", null, 5, 60_000),
            new RateRule("POST", "/api/public/avatar/generate", null, 3, 60_000),
            new RateRule("DELETE", "/api/avatar", null, 10, 60_000),
            new RateRule("GET", "/api/products/", "/recommended-size", 30, 60_000),

            // ---- User-generated content ----
            // The product ships UGC plus a report queue with nothing throttling either. The
            // allow-list covered neither posts nor comments nor reports, so a script could fill
            // the feed, bury the moderation queue it is reported through, and grow the database
            // unboundedly — on an instance where, until the ADMIN bootstrap landed, nobody could
            // action any of it. POST-scoped so reading the feed is never throttled.
            new RateRule("POST", "/api/posts", null, 10, 60_000),
            new RateRule("POST", "/api/events", null, 60, 60_000),
            new RateRule("POST", "/api/follows/", null, 30, 60_000),

            // ---- Paid / compute-heavy job creation ----
            // Each of these starts work that costs money (a third-party 3D generation credit) or
            // minutes of CPU. Unthrottled, one account could run the generation bill up or
            // saturate the worker queue so no other designer's product is ever processed.
            new RateRule("POST", "/api/avatar/generate", null, 5, 60_000),
            new RateRule("POST", "/api/designer/products/upload/image", null, 20, 60_000),
            new RateRule("POST", "/api/designer/products/", "/regenerate", 5, 60_000),
            new RateRule("POST", "/api/designer/products/", "/rigging", 5, 60_000)
    );

    private record BucketKey(String ip, String methodKey, String pathPrefix) {}

    private record BucketEntry(long windowStart, int count) {}

    private final Map<BucketKey, BucketEntry> buckets = new ConcurrentHashMap<>();
    private volatile long lastCleanup = System.currentTimeMillis();
    private static final long CLEANUP_INTERVAL_MS = 300_000; // 5 minutes
    private static final long MAX_WINDOW_MS = 60_000; // longest rule window

    private final RateLimitProperties properties;

    public RateLimitFilter(RateLimitProperties properties) {
        this.properties = properties;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!properties.enabled()) {
            filterChain.doFilter(request, response);
            return;
        }
        evictExpiredEntries();
        String path = request.getRequestURI();
        String ip = resolveClientIp(request);

        for (RateRule rule : RULES) {
            if ((rule.method() == null || rule.method().equals(request.getMethod()))
                    && path.startsWith(rule.pathPrefix())
                    && (rule.pathSuffix() == null || path.endsWith(rule.pathSuffix()))) {
                String methodKey = rule.method() == null ? "*" : rule.method();
                String pathKey = rule.pathSuffix() == null
                        ? rule.pathPrefix()
                        : rule.pathPrefix() + rule.pathSuffix();
                if (!tryConsume(new BucketKey(ip, methodKey, pathKey), rule)) {
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
        List<String> trusted = properties.trustedProxies();
        if (trusted.isEmpty()) {
            return request.getRemoteAddr();
        }
        // Only parse X-Forwarded-For if the direct connection is from a trusted proxy
        String remoteAddr = request.getRemoteAddr();
        if (!isTrusted(remoteAddr, trusted)) {
            return remoteAddr;
        }
        String xff = request.getHeader("X-Forwarded-For");
        if (xff == null || xff.isBlank()) {
            return remoteAddr;
        }
        String[] ips = xff.split(",");
        // Walk right-to-left, skip trusted proxies to find the first untrusted (real client) hop
        for (int i = ips.length - 1; i >= 0; i--) {
            String ip = ips[i].trim();
            if (!isTrusted(ip, trusted)) {
                return ip;
            }
        }
        return remoteAddr;
    }

    /** True if {@code ip} exactly equals, or falls within a CIDR range of, any trusted entry. */
    private static boolean isTrusted(String ip, List<String> trusted) {
        for (String entry : trusted) {
            if (entry.contains("/")) {
                if (cidrContains(entry, ip)) {
                    return true;
                }
            } else if (entry.equals(ip)) {
                return true;
            }
        }
        return false;
    }

    /**
     * IPv4/IPv6 CIDR membership test. Falls back to {@code false} (no false trust) on any
     * parse error or address-family mismatch (e.g. IPv4 CIDR vs IPv6 address).
     */
    private static boolean cidrContains(String cidr, String ip) {
        try {
            int slash = cidr.indexOf('/');
            String base = cidr.substring(0, slash);
            int prefix = Integer.parseInt(cidr.substring(slash + 1).trim());
            byte[] baseBytes = InetAddress.getByName(base).getAddress();
            byte[] ipBytes = InetAddress.getByName(ip).getAddress();
            if (baseBytes.length != ipBytes.length) {
                return false; // different address families (IPv4 vs IPv6)
            }
            int totalBits = baseBytes.length * 8;
            if (prefix < 0 || prefix > totalBits) {
                return false;
            }
            int fullBytes = prefix / 8;
            for (int i = 0; i < fullBytes; i++) {
                if (baseBytes[i] != ipBytes[i]) {
                    return false;
                }
            }
            int remainingBits = prefix % 8;
            if (remainingBits > 0) {
                int mask = 0xFF << (8 - remainingBits);
                if ((baseBytes[fullBytes] & mask) != (ipBytes[fullBytes] & mask)) {
                    return false;
                }
            }
            return true;
        } catch (UnknownHostException | NumberFormatException | IndexOutOfBoundsException e) {
            return false;
        }
    }
}
