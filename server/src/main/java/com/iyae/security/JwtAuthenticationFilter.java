package com.iyae.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.iyae.dto.ErrorResponse;
import com.iyae.entity.User;
import com.iyae.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Value("${app.auth.require-email-verification:true}")
    private boolean requireEmailVerification;

    /**
     * Paths an account may reach before verifying its email. Without these the account is
     * authenticated-but-mute: it cannot even read its own profile, so the app has no way to tell
     * the user why nothing works or to offer them a resend.
     */
    private static final List<String> UNVERIFIED_ALLOWED_PATHS = List.of(
            "/api/auth/me",
            "/api/auth/resend-verification");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtTokenProvider.validateToken(token)) {
                if (!authenticate(token, request, response)) {
                    // A response has already been written (403 unverified). Stopping the chain
                    // here keeps that status rather than letting the request fall through to the
                    // 401 entry point, which would make the client discard a usable session.
                    return;
                }
            }
        }
        chain.doFilter(request, response);
    }

    /** @return false when this filter has already written the response and the chain must stop. */
    private boolean authenticate(String token, HttpServletRequest request, HttpServletResponse response)
            throws IOException {
        String email = jwtTokenProvider.extractEmail(token);
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            // The row is gone: the credential is unusable, so leave the request anonymous and let
            // the entry point answer 401. The client clears the dead token and re-authenticates.
            return true;
        }
        // Reject any token minted before a credential change (password reset bumps tokenVersion).
        if (jwtTokenProvider.extractTokenVersion(token) < user.getTokenVersion()) {
            return true;
        }
        // Registration hands back a JWT immediately, but an unverified account must not gain
        // authenticated access until it verifies its email — the same gate login enforces. Config-
        // gated (app.auth.require-email-verification) so dev can disable it.
        if (requireEmailVerification && !Boolean.TRUE.equals(user.getEmailVerified())) {
            if (!isUnverifiedAllowed(request)) {
                // 403, not a silent decline: the credential is valid and the session must survive.
                // A 401 here would make the web client wipe the token of a user whose only problem
                // is an unread verification email.
                response.setStatus(HttpStatus.FORBIDDEN.value());
                response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                objectMapper.writeValue(response.getOutputStream(), new ErrorResponse(
                        "Email not verified", HttpStatus.FORBIDDEN.value(), Instant.now()));
                return false;
            }
        }
        UserDetails principal = new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPasswordHash(),
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                principal, null, principal.getAuthorities());
        auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(auth);
        return true;
    }

    private boolean isUnverifiedAllowed(HttpServletRequest request) {
        String path = request.getRequestURI();
        return UNVERIFIED_ALLOWED_PATHS.stream().anyMatch(path::equals);
    }
}
