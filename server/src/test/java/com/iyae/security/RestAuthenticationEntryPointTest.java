package com.iyae.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.InsufficientAuthenticationException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The entry point now carries the 401-vs-403 distinction that {@link JwtAuthenticationFilter}
 * used to make by writing the response itself. The filter could not keep doing that: it runs
 * before {@code authorizeHttpRequests}, so its 403 overrode every {@code permitAll} rule.
 */
class RestAuthenticationEntryPointTest {

    private RestAuthenticationEntryPoint entryPoint;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        // Mirror the Boot-configured mapper: ErrorResponse carries an Instant, which a bare
        // ObjectMapper cannot serialise.
        entryPoint = new RestAuthenticationEntryPoint(
                new ObjectMapper().registerModule(new JavaTimeModule()));
        response = new MockHttpServletResponse();
    }

    @Test
    void anonymousRequestGets401() throws Exception {
        // B-15: the web client only treats 401 as session death. Spring's
        // Http403ForbiddenEntryPoint fallback wedged every user at the 24h token expiry.
        entryPoint.commence(new MockHttpServletRequest("GET", "/api/cart"), response,
                new InsufficientAuthenticationException("anonymous"));

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("Authentication required");
    }

    @Test
    void unverifiedEmailGets403SoTheUsableTokenSurvives() throws Exception {
        // The credential is valid; only the verification step is missing. A 401 would make the
        // web client delete a working session over an unread email.
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/cart");
        request.setAttribute(JwtAuthenticationFilter.UNVERIFIED_EMAIL_ATTRIBUTE, Boolean.TRUE);

        entryPoint.commence(request, response, new InsufficientAuthenticationException("unverified"));

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("Email not verified");
    }

    @Test
    void aNonBooleanAttributeIsNotMistakenForTheUnverifiedMarker() throws Exception {
        // Guards the Boolean.TRUE.equals check: a truthy-looking value of another type must not
        // silently downgrade a dead session to 403, which would stop the client clearing it.
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/cart");
        request.setAttribute(JwtAuthenticationFilter.UNVERIFIED_EMAIL_ATTRIBUTE, "true");

        entryPoint.commence(request, response, new InsufficientAuthenticationException("anonymous"));

        assertThat(response.getStatus()).isEqualTo(401);
    }
}
