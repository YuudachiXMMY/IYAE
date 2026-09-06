package com.iyae.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitFilterTest {

    private RateLimitFilter createFilter(String trustedProxies) {
        RateLimitFilter filter = new RateLimitFilter();
        ReflectionTestUtils.setField(filter, "trustedProxies", trustedProxies);
        return filter;
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

    @Test
    void chatEndpoint_anyMethod_appliesLimit() throws Exception {
        RateLimitFilter filter = createFilter("");

        // Mix GET and POST requests — rule has null method so both should count toward the same bucket
        // Exhaust limit (10 requests total)
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest get = makeRequest("GET", "/api/chat/sessions", "10.0.0.6");
            invokeFilter(filter, get, new MockHttpServletResponse(), new MockFilterChain());

            MockHttpServletRequest post = makeRequest("POST", "/api/chat/sessions", "10.0.0.6");
            invokeFilter(filter, post, new MockHttpServletResponse(), new MockFilterChain());
        }

        // 11th request should be blocked regardless of method
        MockHttpServletRequest req = makeRequest("GET", "/api/chat/sessions", "10.0.0.6");
        MockHttpServletResponse res = new MockHttpServletResponse();
        invokeFilter(filter, req, res, new MockFilterChain());

        assertThat(res.getStatus()).isEqualTo(429);
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
}
