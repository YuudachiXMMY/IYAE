package com.iyae.testsupport;

import com.iyae.config.RateLimitFilter;
import com.iyae.config.SecurityConfig;
import com.iyae.security.JwtAuthenticationFilter;
import com.iyae.security.JwtTokenProvider;
import com.iyae.security.UserDetailsServiceImpl;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.mockito.Mockito;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Shared test configuration that wires the real SecurityConfig with pass-through mock filters.
 * Filters forward every request so the controller and security rules execute normally.
 * @WithMockUser sets up the SecurityContext; JwtAuthenticationFilter is bypassed.
 */
@TestConfiguration
@Import(SecurityConfig.class)
public class WebMvcSecurityConfig {

    @MockBean
    public JwtTokenProvider jwtTokenProvider;

    @MockBean
    public UserDetailsServiceImpl userDetailsService;

    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter() throws Exception {
        JwtAuthenticationFilter filter = Mockito.mock(JwtAuthenticationFilter.class);
        Mockito.doAnswer(inv -> {
            FilterChain chain = inv.getArgument(2);
            chain.doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(filter).doFilter(
                Mockito.any(HttpServletRequest.class),
                Mockito.any(HttpServletResponse.class),
                Mockito.any(FilterChain.class));
        return filter;
    }

    @Bean
    public RateLimitFilter rateLimitFilter() throws Exception {
        RateLimitFilter filter = Mockito.mock(RateLimitFilter.class);
        Mockito.doAnswer(inv -> {
            FilterChain chain = inv.getArgument(2);
            chain.doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(filter).doFilter(
                Mockito.any(HttpServletRequest.class),
                Mockito.any(HttpServletResponse.class),
                Mockito.any(FilterChain.class));
        return filter;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        return new UrlBasedCorsConfigurationSource();
    }
}
