package com.iyae.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Static file serving for the shared asset volume.
 *
 * <p>Registered per-subtree rather than as one {@code /assets/**} handler. The blanket handler
 * was one of the paths that made every user's generated body scan
 * ({@code {assetRoot}/avatars/{userId}/avatar.glb}) downloadable without authentication at a
 * guessable URL. Body scans are served only by {@code GET /api/avatar/model}, which resolves the
 * file from the authenticated principal.
 *
 * <p>This list must stay in step with the public matchers in {@link SecurityConfig} and the
 * {@code location} blocks in {@code nginx/conf.d/default.conf} (and
 * {@code nginx/templates/tls.conf}). A subtree added here and nowhere else is unreachable in
 * production; a subtree added to nginx and not here is unreachable in local dev.
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    /** Asset subtrees that contain no personal data and may be served as static files. */
    private static final String[] PUBLIC_ASSET_SUBTREES = {"models", "poses", "garments"};

    @Value("${worker.output-dir:/var/iyae/assets}")
    private String assetRoot;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = assetRoot.startsWith("file:") ? assetRoot : "file:" + assetRoot;
        if (!location.endsWith("/")) {
            location += "/";
        }

        for (String subtree : PUBLIC_ASSET_SUBTREES) {
            registry.addResourceHandler("/assets/" + subtree + "/**")
                    .addResourceLocations(location + subtree + "/");
        }

        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(location + "uploads/");
    }
}
