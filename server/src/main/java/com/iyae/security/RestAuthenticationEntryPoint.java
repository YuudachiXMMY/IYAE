package com.iyae.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iyae.dto.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Instant;

/**
 * Answers 401 for unauthenticated requests.
 *
 * <p>Without this, Spring Security falls back to {@code Http403ForbiddenEntryPoint} and an
 * anonymous request gets 403. The web client only treats 401 as a session failure, so at the 24h
 * token expiry — and after a password reset bumps {@code token_version} — every signed-in user
 * started getting 403s from every call with the dead token still in {@code localStorage} and no
 * redirect to {@code /login}. They were wedged until they cleared site data by hand.
 *
 * <p>403 remains the right answer for an <em>authenticated</em> caller with insufficient role;
 * that path goes through the access-denied handler, not here.
 *
 * <p>One request that reaches here is <em>not</em> a dead session: a valid credential for an
 * account that has not verified its email. {@link JwtAuthenticationFilter} deliberately leaves
 * such a request anonymous — so that Spring Security's own {@code permitAll} rules still apply
 * to public endpoints — and marks it with
 * {@link JwtAuthenticationFilter#UNVERIFIED_EMAIL_ATTRIBUTE}. For those we answer 403, because
 * the token is usable and the client must not discard it; only the verification step is missing.
 */
@Component
@RequiredArgsConstructor
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        boolean unverifiedEmail = Boolean.TRUE.equals(
                request.getAttribute(JwtAuthenticationFilter.UNVERIFIED_EMAIL_ATTRIBUTE));
        HttpStatus status = unverifiedEmail ? HttpStatus.FORBIDDEN : HttpStatus.UNAUTHORIZED;
        String message = unverifiedEmail ? "Email not verified" : "Authentication required";

        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(),
                new ErrorResponse(message, status.value(), Instant.now()));
    }
}
