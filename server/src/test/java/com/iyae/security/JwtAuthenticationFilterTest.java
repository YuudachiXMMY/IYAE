package com.iyae.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import com.iyae.repository.UserRepository;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * B-15. Covers how the filter declines, which is the half of the defect that the entry point
 * alone does not fix: it used to decline with a bare {@code return} for four different reasons,
 * and every one of them then landed on the same generic status.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class JwtAuthenticationFilterTest {

    @Mock JwtTokenProvider jwtTokenProvider;
    @Mock UserRepository userRepository;
    @Mock FilterChain chain;

    private JwtAuthenticationFilter filter;
    private MockHttpServletResponse response;

    @BeforeEach
    void setUp() {
        // Mirror the Boot-configured mapper: ErrorResponse carries an Instant, which a bare
        // ObjectMapper cannot serialise.
        ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        filter = new JwtAuthenticationFilter(jwtTokenProvider, userRepository, objectMapper);
        ReflectionTestUtils.setField(filter, "requireEmailVerification", true);
        response = new MockHttpServletResponse();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private MockHttpServletRequest requestFor(String uri) {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", uri);
        request.setRequestURI(uri);
        request.addHeader("Authorization", "Bearer token123");
        return request;
    }

    private User user(String email, boolean verified) {
        return User.builder()
                .id(1L)
                .email(email)
                .passwordHash("$2a$10$hash")
                .role(Role.BUYER)
                .emailVerified(verified)
                .tokenVersion(0)
                .build();
    }

    @Test
    void validVerifiedToken_authenticatesAndContinues() throws Exception {
        when(jwtTokenProvider.validateToken("token123")).thenReturn(true);
        when(jwtTokenProvider.extractEmail("token123")).thenReturn("buyer@test.com");
        when(jwtTokenProvider.extractTokenVersion("token123")).thenReturn(0);
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(user("buyer@test.com", true)));

        filter.doFilter(requestFor("/api/cart"), response, chain);

        verify(chain).doFilter(any(), any());
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void unverifiedEmail_answers403AndStopsTheChain() throws Exception {
        // Not a silent decline: the credential is valid, so letting this fall through to the 401
        // entry point would make the web client delete a usable session over an unread email.
        when(jwtTokenProvider.validateToken("token123")).thenReturn(true);
        when(jwtTokenProvider.extractEmail("token123")).thenReturn("new@test.com");
        when(jwtTokenProvider.extractTokenVersion("token123")).thenReturn(0);
        when(userRepository.findByEmail("new@test.com")).thenReturn(Optional.of(user("new@test.com", false)));

        filter.doFilter(requestFor("/api/cart"), response, chain);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("Email not verified");
        verify(chain, never()).doFilter(any(), any());
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void unverifiedEmail_canStillReadOwnProfile() throws Exception {
        // Otherwise the account is authenticated-but-mute and the dashboard cannot explain itself.
        when(jwtTokenProvider.validateToken("token123")).thenReturn(true);
        when(jwtTokenProvider.extractEmail("token123")).thenReturn("new@test.com");
        when(jwtTokenProvider.extractTokenVersion("token123")).thenReturn(0);
        when(userRepository.findByEmail("new@test.com")).thenReturn(Optional.of(user("new@test.com", false)));

        filter.doFilter(requestFor("/api/auth/me"), response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        verify(chain).doFilter(any(), any());
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
    }

    @Test
    void staleTokenVersion_leavesRequestAnonymousForThe401EntryPoint() throws Exception {
        // A password reset bumped token_version. The credential is dead, so the client should
        // discard it — which is what 401 (not 403) tells it to do.
        when(jwtTokenProvider.validateToken("token123")).thenReturn(true);
        when(jwtTokenProvider.extractEmail("token123")).thenReturn("buyer@test.com");
        when(jwtTokenProvider.extractTokenVersion("token123")).thenReturn(0);
        User bumped = user("buyer@test.com", true);
        bumped.setTokenVersion(1);
        when(userRepository.findByEmail("buyer@test.com")).thenReturn(Optional.of(bumped));

        filter.doFilter(requestFor("/api/cart"), response, chain);

        verify(chain).doFilter(any(), any());
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        assertThat(response.getStatus()).isEqualTo(200); // entry point runs later in the chain
    }

    @Test
    void deletedUser_leavesRequestAnonymous() throws Exception {
        when(jwtTokenProvider.validateToken("token123")).thenReturn(true);
        when(jwtTokenProvider.extractEmail("token123")).thenReturn("gone@test.com");
        when(userRepository.findByEmail("gone@test.com")).thenReturn(Optional.empty());

        filter.doFilter(requestFor("/api/cart"), response, chain);

        verify(chain).doFilter(any(), any());
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void verificationGateOff_authenticatesUnverifiedUser() throws Exception {
        ReflectionTestUtils.setField(filter, "requireEmailVerification", false);
        when(jwtTokenProvider.validateToken("token123")).thenReturn(true);
        when(jwtTokenProvider.extractEmail("token123")).thenReturn("new@test.com");
        when(jwtTokenProvider.extractTokenVersion("token123")).thenReturn(0);
        when(userRepository.findByEmail("new@test.com")).thenReturn(Optional.of(user("new@test.com", false)));

        filter.doFilter(requestFor("/api/cart"), response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        verify(chain).doFilter(any(), any());
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
    }
}
