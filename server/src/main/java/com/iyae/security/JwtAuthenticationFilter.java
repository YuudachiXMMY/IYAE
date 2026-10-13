package com.iyae.security;

import com.iyae.entity.User;
import com.iyae.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;

    @Value("${app.auth.require-email-verification:true}")
    private boolean requireEmailVerification;

    /**
     * What an account may do before verifying its email. Without this the account is
     * authenticated-but-mute: it cannot even read its own profile, so the app has no way to tell
     * the user why nothing works or to offer them a resend.
     *
     * <p>Scoped to method AND path. A path-only allow-list was wrong because
     * {@code /api/auth/me} serves three verbs: GET reads the profile, PUT updates it, and
     * DELETE deletes the account. Allowing the path let an unverified account — one that has
     * proved nothing about owning the address it registered with — set a public username and so
     * squat or impersonate at {@code /api/auth/users/profile/{username}}, which has no
     * verification gate of its own.
     */
    private record AllowedRequest(String method, String path) {}

    private static final List<AllowedRequest> UNVERIFIED_ALLOWED = List.of(
            new AllowedRequest("GET", "/api/auth/me"),
            new AllowedRequest("POST", "/api/auth/resend-verification"));

    /**
     * Marks a request that presented a valid credential for an account whose email is not
     * verified. {@link RestAuthenticationEntryPoint} reads it and answers 403 instead of 401, so
     * the distinction this filter used to make by writing the response itself is preserved —
     * without the filter having to decide which endpoints are public.
     */
    public static final String UNVERIFIED_EMAIL_ATTRIBUTE =
            JwtAuthenticationFilter.class.getName() + ".unverifiedEmail";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7);
            if (jwtTokenProvider.validateToken(token)) {
                authenticate(token, request);
            }
        }
        chain.doFilter(request, response);
    }

    private void authenticate(String token, HttpServletRequest request) {
        String email = jwtTokenProvider.extractEmail(token);
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            // The row is gone: the credential is unusable, so leave the request anonymous and let
            // the entry point answer 401. The client clears the dead token and re-authenticates.
            return;
        }
        // The subject is an email address, which is NOT a stable identity: deleting an account
        // scrubs its row's address, freeing the original for someone else to register. A token
        // minted for the deleted account then resolved by email to the NEW account, and the
        // version check below compared the old token's `ver` against the new row's own version
        // — 0 against 0 — so it passed and authenticated the wrong person. Bind to the id.
        Long tokenUserId = jwtTokenProvider.extractUserId(token);
        if (tokenUserId == null || !tokenUserId.equals(user.getId())) {
            // Null means a token minted before the claim existed. Rejecting those invalidates
            // any session predating this deploy, which is the safe direction and, pre-launch,
            // affects nobody.
            return;
        }
        // Reject any token minted before a credential change (password reset bumps tokenVersion).
        if (jwtTokenProvider.extractTokenVersion(token) < user.getTokenVersion()) {
            return;
        }
        // Registration hands back a JWT immediately, but an unverified account must not gain
        // authenticated access until it verifies its email — the same gate login enforces. Config-
        // gated (app.auth.require-email-verification) so dev can disable it.
        if (requireEmailVerification && !Boolean.TRUE.equals(user.getEmailVerified())) {
            if (!isUnverifiedAllowed(request)) {
                // Mark the request and leave it anonymous; do NOT write a response here.
                //
                // Writing 403 from this filter ran before Spring Security's authorization rules
                // and therefore overrode every one of them, including `permitAll`. Because
                // registration hands back a JWT and the web client attaches it to every request,
                // a registered-but-unverified account got 403 from the public catalog, public
                // profiles, /api/health and /api/public/config — the last being exactly the
                // endpoint that tells the client whether verification is required at all. The
                // access policy belongs in SecurityConfig, which is now the only thing that
                // decides whether a given request needs an authenticated principal.
                //
                // The credential is still valid and the session must survive, so for a request
                // that DOES need authentication the entry point turns this attribute into 403
                // rather than 401 — a 401 would make the web client wipe the token of a user
                // whose only problem is an unread verification email.
                request.setAttribute(UNVERIFIED_EMAIL_ATTRIBUTE, Boolean.TRUE);
                return;
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
    }

    private boolean isUnverifiedAllowed(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();
        return UNVERIFIED_ALLOWED.stream()
                .anyMatch(allowed -> allowed.method().equals(method) && allowed.path().equals(path));
    }
}
