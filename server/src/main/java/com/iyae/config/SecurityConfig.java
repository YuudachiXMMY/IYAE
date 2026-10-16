package com.iyae.config;

import com.iyae.entity.enums.Role;
import com.iyae.security.JwtAuthenticationFilter;
import com.iyae.security.RestAuthenticationEntryPoint;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RateLimitFilter rateLimitFilter;
    private final CorsConfigurationSource corsConfigurationSource;
    private final RestAuthenticationEntryPoint restAuthenticationEntryPoint;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login",
                    "/api/auth/verify-email", "/api/auth/resend-verification",
                    "/api/auth/forgot-password", "/api/auth/reset-password").permitAll()
                .requestMatchers("/api/health/**").permitAll()
                // Must precede the public /api/products/** rule (Spring Security matches first-match)
                .requestMatchers(HttpMethod.GET, "/api/products/*/recommended-size").authenticated()
                .requestMatchers(HttpMethod.GET, "/api/products/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/promotions/featured").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/resale/listings", "/api/resale/listings/*").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/fulfillment/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/auth/users/profile/**").permitAll()
                // Only the non-personal asset subtrees are public. `/assets/**` used to be a
                // blanket permitAll, which combined with the resource handler in WebMvcConfig
                // made every user's 3D body scan downloadable at
                // /assets/avatars/{userId}/avatar.glb — no auth, sequential integer path.
                // Body scans are now served only by GET /api/avatar/model, authenticated and
                // resolved from the principal. The matchers below are paired with the resource
                // handlers in WebMvcConfig and the location blocks in nginx; all three have to
                // agree, which is why each one carries this note.
                // `products` and `rigged` are the two subtrees the worker actually writes
                // client-facing URLs for; omitting them denies every generated preview and every
                // rigged garment. `avatars` stays out, and so does the Blender provider's
                // `rigging-work` scratch area.
                .requestMatchers(HttpMethod.GET, "/assets/models/**", "/assets/poses/**",
                    "/assets/garments/**", "/assets/products/**", "/assets/rigged/**",
                    "/uploads/**").permitAll()
                .requestMatchers("/assets/**").denyAll()
                .requestMatchers(HttpMethod.POST, "/api/webhooks/stripe").permitAll()
                .requestMatchers("/api/public/**").permitAll()
                // DESIGNER *and* ADMIN — see Role.canManageCatalog() for why, and note that
                // DesignerUploadController reads the same predicate. Widening only one of the two
                // leaves the other silently rejecting ADMIN. Row-level ownership is still resolved
                // per request from the principal's own DesignerProfile, so this grants the surface,
                // not other designers' listings.
                .requestMatchers("/api/designer/**").hasAnyRole(Role.catalogManagerRoleNames())
                .requestMatchers("/api/promotions/**").hasAnyRole(Role.catalogManagerRoleNames())
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            // Without an explicit entry point Spring Security falls back to
            // Http403ForbiddenEntryPoint, so an anonymous request answers 403 — which the web
            // client does not recognise as a session failure, wedging every user at token expiry.
            .exceptionHandling(ex -> ex.authenticationEntryPoint(restAuthenticationEntryPoint))
            .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }
}
