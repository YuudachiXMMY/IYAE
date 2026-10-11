package com.iyae.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitFilterTest {

    private RateLimitFilter createFilter(String trustedProxies) {
        List<String> proxies = (trustedProxies == null || trustedProxies.isBlank())
                ? List.of()
                : Arrays.stream(trustedProxies.split(",")).map(String::trim)
                        .filter(s -> !s.isEmpty()).toList();
        return new RateLimitFilter(new RateLimitProperties(proxies, true));
    }

    private MockHttpServletRequest makeRequest(String method, String uri, String remoteAddr) {
        MockHttpServletRequest req = new MockHttpServletRequest(method, uri);
        req.setRemoteAddr(remoteAddr);
        return req;
    }

    private void invokeFilter(RateLimitFilter filter, MockHttpServletRequest req,
                               MockHttpServletResponse res, FilterChain chain) throws Exception {
        filter.doFilter(req, res, chain);
    }

    @Test
    void nonMatchingPath_passesThrough() throws Exception {
        RateLimitFilter filter = createFilter("");
        MockHttpServletRequest req = makeRequest("GET", "/api/products", "192.168.0.1");
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        invokeFilter(filter, req, res, chain);

        assertThat(res.getStatus()).isNotEqualTo(429);
        assertThat(chain.getRequest()).isNotNull();
    }

    // L1: recommended-size endpoint is rate-limited (30/60s).
    @Test
    void recommendedSizeEndpoint_blocksAfterLimit() throws Exception {
        RateLimitFilter filter = createFilter("");
        for (int i = 0; i < 30; i++) {
            MockHttpServletRequest req =
                    makeRequest("GET", "/api/products/1/recommended-size", "10.1.0.1");
            invokeFilter(filter, req, new MockHttpServletResponse(), new MockFilterChain());
        }
        MockHttpServletRequest req =
                makeRequest("GET", "/api/products/1/recommended-size", "10.1.0.1");
        MockHttpServletResponse res = new MockHttpServletResponse();
        invokeFilter(filter, req, res, new MockFilterChain());
        assertThat(res.getStatus()).isEqualTo(429);
    }

    // L1: plain catalog/detail GETs must NOT be throttled by the recommended-size rule.
    @Test
    void productCatalogGet_notThrottledByRecommendedSizeRule() throws Exception {
        RateLimitFilter filter = createFilter("");
        for (int i = 0; i < 40; i++) {
            MockHttpServletRequest req = makeRequest("GET", "/api/products/1", "10.1.0.2");
            MockHttpServletResponse res = new MockHttpServletResponse();
            invokeFilter(filter, req, res, new MockFilterChain());
            assertThat(res.getStatus()).isNotEqualTo(429);
        }
    }

    // L1: DELETE /api/avatar is rate-limited (10/60s).
    @Test
    void deleteAvatarEndpoint_blocksAfterLimit() throws Exception {
        RateLimitFilter filter = createFilter("");
        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest req = makeRequest("DELETE", "/api/avatar", "10.1.0.3");
            invokeFilter(filter, req, new MockHttpServletResponse(), new MockFilterChain());
        }
        MockHttpServletRequest req = makeRequest("DELETE", "/api/avatar", "10.1.0.3");
        MockHttpServletResponse res = new MockHttpServletResponse();
        invokeFilter(filter, req, res, new MockFilterChain());
        assertThat(res.getStatus()).isEqualTo(429);
    }

    @Test
    void loginEndpoint_allowsUpToLimit() throws Exception {
        RateLimitFilter filter = createFilter("");

        for (int i = 1; i <= 5; i++) {
            MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "10.0.0.1");
            MockHttpServletResponse res = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();

            invokeFilter(filter, req, res, chain);

            assertThat(res.getStatus())
                    .as("Request %d should not be rate limited", i)
                    .isNotEqualTo(429);
        }
    }

    @Test
    void loginEndpoint_blocksAfterLimit() throws Exception {
        RateLimitFilter filter = createFilter("");

        // Exhaust limit (5 requests)
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "10.0.0.2");
            invokeFilter(filter, req, new MockHttpServletResponse(), new MockFilterChain());
        }

        // 6th request should be blocked
        MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "10.0.0.2");
        MockHttpServletResponse res = new MockHttpServletResponse();
        invokeFilter(filter, req, res, new MockFilterChain());

        assertThat(res.getStatus()).isEqualTo(429);
    }

    @Test
    void registerEndpoint_blocksAfterLimit() throws Exception {
        RateLimitFilter filter = createFilter("");

        // Exhaust limit (3 requests)
        for (int i = 0; i < 3; i++) {
            MockHttpServletRequest req = makeRequest("POST", "/api/auth/register", "10.0.0.3");
            invokeFilter(filter, req, new MockHttpServletResponse(), new MockFilterChain());
        }

        // 4th request should be blocked
        MockHttpServletRequest req = makeRequest("POST", "/api/auth/register", "10.0.0.3");
        MockHttpServletResponse res = new MockHttpServletResponse();
        invokeFilter(filter, req, res, new MockFilterChain());

        assertThat(res.getStatus()).isEqualTo(429);
    }

    @Test
    void differentIps_isolatedCounters() throws Exception {
        RateLimitFilter filter = createFilter("");

        // Exhaust limit for IP1 (5 requests)
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "192.168.1.1");
            invokeFilter(filter, req, new MockHttpServletResponse(), new MockFilterChain());
        }

        // IP1 6th should be blocked
        MockHttpServletRequest req1 = makeRequest("POST", "/api/auth/login", "192.168.1.1");
        MockHttpServletResponse res1 = new MockHttpServletResponse();
        invokeFilter(filter, req1, res1, new MockFilterChain());
        assertThat(res1.getStatus()).isEqualTo(429);

        // IP2 first request should pass through
        MockHttpServletRequest req2 = makeRequest("POST", "/api/auth/login", "192.168.1.2");
        MockHttpServletResponse res2 = new MockHttpServletResponse();
        MockFilterChain chain2 = new MockFilterChain();
        invokeFilter(filter, req2, res2, chain2);
        assertThat(res2.getStatus()).isNotEqualTo(429);
        assertThat(chain2.getRequest()).isNotNull();
    }

    @Test
    void responseBody_containsCorrectJson() throws Exception {
        RateLimitFilter filter = createFilter("");

        // Exhaust limit
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "10.0.0.4");
            invokeFilter(filter, req, new MockHttpServletResponse(), new MockFilterChain());
        }

        MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "10.0.0.4");
        MockHttpServletResponse res = new MockHttpServletResponse();
        invokeFilter(filter, req, res, new MockFilterChain());

        assertThat(res.getStatus()).isEqualTo(429);
        assertThat(res.getContentAsString())
                .isEqualTo("{\"message\":\"Too many requests. Please try again later.\"}");
    }

    @Test
    void responseContentType_isApplicationJson() throws Exception {
        RateLimitFilter filter = createFilter("");

        // Exhaust limit
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "10.0.0.5");
            invokeFilter(filter, req, new MockHttpServletResponse(), new MockFilterChain());
        }

        MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "10.0.0.5");
        MockHttpServletResponse res = new MockHttpServletResponse();
        invokeFilter(filter, req, res, new MockFilterChain());

        assertThat(res.getStatus()).isEqualTo(429);
        assertThat(res.getContentType()).isEqualTo("application/json");
    }

    // M1: only POSTs to /api/chat/ (the expensive AI endpoints) count against the bucket.
    @Test
    void chatPost_blocksAfterLimit() throws Exception {
        RateLimitFilter filter = createFilter("");

        // Exhaust limit (10 POSTs)
        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest post = makeRequest("POST", "/api/chat/sessions/1/messages", "10.0.0.6");
            invokeFilter(filter, post, new MockHttpServletResponse(), new MockFilterChain());
        }

        // 11th POST is blocked
        MockHttpServletRequest req = makeRequest("POST", "/api/chat/sessions/1/messages", "10.0.0.6");
        MockHttpServletResponse res = new MockHttpServletResponse();
        invokeFilter(filter, req, res, new MockFilterChain());

        assertThat(res.getStatus()).isEqualTo(429);
    }

    // M1: GET /api/chat/weather (polled by the useWeather hook) must NOT share the AI-message
    // bucket — otherwise a few weather polls would 429 a user's legitimate chat messages.
    @Test
    void chatWeatherGet_notThrottledByChatPostRule() throws Exception {
        RateLimitFilter filter = createFilter("");
        for (int i = 0; i < 20; i++) {
            MockHttpServletRequest req = makeRequest("GET", "/api/chat/weather", "10.0.0.7");
            MockHttpServletResponse res = new MockHttpServletResponse();
            invokeFilter(filter, req, res, new MockFilterChain());
            assertThat(res.getStatus()).as("weather GET %d must not be limited", i).isNotEqualTo(429);
        }
    }

    @Test
    void xForwardedFor_trustedProxy_parsesClientIp() throws Exception {
        RateLimitFilter filter = createFilter("10.0.0.1");

        // Exhaust limit for real client IP 203.0.113.50 (requests come through trusted proxy)
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "10.0.0.1");
            req.addHeader("X-Forwarded-For", "203.0.113.50");
            invokeFilter(filter, req, new MockHttpServletResponse(), new MockFilterChain());
        }

        // 6th should be blocked — extracted IP 203.0.113.50 is at limit
        MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "10.0.0.1");
        req.addHeader("X-Forwarded-For", "203.0.113.50");
        MockHttpServletResponse res = new MockHttpServletResponse();
        invokeFilter(filter, req, res, new MockFilterChain());

        assertThat(res.getStatus()).isEqualTo(429);
    }

    @Test
    void xForwardedFor_untrustedProxy_usesRemoteAddr() throws Exception {
        // trustedProxies is empty — XFF header must be ignored; rate limiting tracks remoteAddr
        RateLimitFilter filter = createFilter("");

        // Exhaust limit for remoteAddr 10.0.0.9
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "10.0.0.9");
            req.addHeader("X-Forwarded-For", "203.0.113.99");
            invokeFilter(filter, req, new MockHttpServletResponse(), new MockFilterChain());
        }

        // 6th from same remoteAddr — blocked (XFF ignored, counter tracks remoteAddr)
        MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "10.0.0.9");
        req.addHeader("X-Forwarded-For", "203.0.113.99");
        MockHttpServletResponse res = new MockHttpServletResponse();
        invokeFilter(filter, req, res, new MockFilterChain());
        assertThat(res.getStatus()).isEqualTo(429);

        // Different remoteAddr with same XFF IP — fresh filter instance, should pass through
        RateLimitFilter filter2 = createFilter("");
        MockHttpServletRequest reqNew = makeRequest("POST", "/api/auth/login", "10.0.0.10");
        reqNew.addHeader("X-Forwarded-For", "203.0.113.99");
        MockHttpServletResponse resNew = new MockHttpServletResponse();
        MockFilterChain chainNew = new MockFilterChain();
        invokeFilter(filter2, reqNew, resNew, chainNew);
        assertThat(resNew.getStatus()).isNotEqualTo(429);
        assertThat(chainNew.getRequest()).isNotNull();
    }

    @Test
    void xForwardedFor_trustedCidr_parsesClientIp() throws Exception {
        // Proxy 172.20.0.5 falls within the trusted CIDR 172.16.0.0/12
        RateLimitFilter filter = createFilter("172.16.0.0/12");

        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "172.20.0.5");
            req.addHeader("X-Forwarded-For", "203.0.113.50");
            invokeFilter(filter, req, new MockHttpServletResponse(), new MockFilterChain());
        }

        // 6th from the same real client (via the CIDR-trusted proxy) is blocked
        MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "172.20.0.5");
        req.addHeader("X-Forwarded-For", "203.0.113.50");
        MockHttpServletResponse res = new MockHttpServletResponse();
        invokeFilter(filter, req, res, new MockFilterChain());
        assertThat(res.getStatus()).isEqualTo(429);
    }

    @Test
    void xForwardedFor_proxyOutsideCidr_usesRemoteAddr() throws Exception {
        // remoteAddr 10.9.9.9 is NOT within 172.16.0.0/12, so XFF is ignored
        RateLimitFilter filter = createFilter("172.16.0.0/12");

        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "10.9.9.9");
            req.addHeader("X-Forwarded-For", "203.0.113.77");
            invokeFilter(filter, req, new MockHttpServletResponse(), new MockFilterChain());
        }

        // 6th from same remoteAddr blocked (bucket keyed on remoteAddr, XFF ignored)
        MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "10.9.9.9");
        req.addHeader("X-Forwarded-For", "203.0.113.77");
        MockHttpServletResponse res = new MockHttpServletResponse();
        invokeFilter(filter, req, res, new MockFilterChain());
        assertThat(res.getStatus()).isEqualTo(429);
    }

    @Test
    void malformedCidrEntry_doesNotCrash_fallsBackToRemoteAddr() throws Exception {
        // A malformed CIDR must not throw; the proxy is simply not trusted, so XFF is ignored
        RateLimitFilter filter = createFilter("not-a-cidr/99");
        MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "10.0.0.1");
        req.addHeader("X-Forwarded-For", "203.0.113.1");
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        invokeFilter(filter, req, res, chain);

        assertThat(res.getStatus()).isNotEqualTo(429);
        assertThat(chain.getRequest()).isNotNull();
    }

    @Test
    void disabled_passesAllThrough() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(new RateLimitProperties(List.of(), false));

        // Well beyond the login limit of 5 — none should be blocked when disabled
        for (int i = 0; i < 10; i++) {
            MockHttpServletRequest req = makeRequest("POST", "/api/auth/login", "10.0.0.99");
            MockHttpServletResponse res = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();
            invokeFilter(filter, req, res, chain);
            assertThat(res.getStatus()).isNotEqualTo(429);
            assertThat(chain.getRequest()).isNotNull();
        }
    }

    // ---- UGC and paid-job-creation throttles ----

    @Test
    void postingToTheCommunity_blocksAfterLimit() throws Exception {
        // The product ships user-generated content plus the report queue it is reported
        // through, and the allow-list throttled neither — a script could fill the feed and
        // bury the queue, on an instance where nobody could action any of it.
        RateLimitFilter filter = newFilter();
        for (int i = 0; i < 10; i++) {
            assertNotBlocked(filter, "POST", "/api/posts", "10.1.0.1");
        }
        assertBlocked(filter, "POST", "/api/posts", "10.1.0.1");
    }

    @Test
    void readingTheCommunityFeed_isNeverThrottled() throws Exception {
        // POST-scoped on purpose: a user scrolling the feed must not spend their own posting
        // budget (the same mistake the chat rule had before it was POST-scoped).
        RateLimitFilter filter = newFilter();
        for (int i = 0; i < 50; i++) {
            assertNotBlocked(filter, "GET", "/api/posts", "10.1.0.2");
        }
    }

    @Test
    void reportingAPost_sharesThePostingBudget() throws Exception {
        // /api/posts/{id}/report sits under the /api/posts prefix, so the same throttle covers
        // it — which is what stops the moderation queue being flooded.
        RateLimitFilter filter = newFilter();
        for (int i = 0; i < 10; i++) {
            assertNotBlocked(filter, "POST", "/api/posts/5/report", "10.1.0.3");
        }
        assertBlocked(filter, "POST", "/api/posts/5/report", "10.1.0.3");
    }

    @Test
    void avatarGeneration_blocksAfterLimit() throws Exception {
        // Compute-heavy: each call queues minutes of SMPL-X work.
        RateLimitFilter filter = newFilter();
        for (int i = 0; i < 5; i++) {
            assertNotBlocked(filter, "POST", "/api/avatar/generate", "10.1.0.4");
        }
        assertBlocked(filter, "POST", "/api/avatar/generate", "10.1.0.4");
    }

    @Test
    void designerImageUpload_blocksAfterLimit() throws Exception {
        // Unthrottled, this was a disk-fill DoS against the shared assets volume — the same
        // volume that holds every generated model and, until the backup command landed, the
        // only copy of the uploads.
        RateLimitFilter filter = newFilter();
        for (int i = 0; i < 20; i++) {
            assertNotBlocked(filter, "POST", "/api/designer/products/upload/image", "10.1.0.5");
        }
        assertBlocked(filter, "POST", "/api/designer/products/upload/image", "10.1.0.5");
    }

    @Test
    void modelRegeneration_blocksAfterLimit() throws Exception {
        // Each regenerate spends a third-party 3D generation credit — real money.
        RateLimitFilter filter = newFilter();
        for (int i = 0; i < 5; i++) {
            assertNotBlocked(filter, "POST", "/api/designer/products/9/regenerate", "10.1.0.6");
        }
        assertBlocked(filter, "POST", "/api/designer/products/9/regenerate", "10.1.0.6");
    }

    private RateLimitFilter newFilter() {
        return new RateLimitFilter(new RateLimitProperties(List.of(), true));
    }

    private void assertNotBlocked(RateLimitFilter filter, String method, String path, String ip)
            throws Exception {
        MockHttpServletRequest req = makeRequest(method, path, ip);
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        invokeFilter(filter, req, res, chain);
        assertThat(res.getStatus()).isNotEqualTo(429);
        assertThat(chain.getRequest()).isNotNull();
    }

    private void assertBlocked(RateLimitFilter filter, String method, String path, String ip)
            throws Exception {
        MockHttpServletRequest req = makeRequest(method, path, ip);
        MockHttpServletResponse res = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        invokeFilter(filter, req, res, chain);
        assertThat(res.getStatus()).isEqualTo(429);
        assertThat(chain.getRequest()).isNull();
    }
}
