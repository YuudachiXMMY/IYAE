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

    /**
     * Asset subtrees that contain no personal data and may be served as static files.
     *
     * <p>This is an allow-list, so it has to name every subtree a worker provider writes a
     * client-facing URL for, or that asset 404s everywhere:
     * <ul>
     *   <li>{@code products} — {@code glb_url}/{@code usdz_url} from the three model generators,
     *       returned verbatim by {@code GenerationService.getStatus()} and rendered by
     *       {@code <model-viewer>}; no API route serves these.</li>
     *   <li>{@code rigged} — {@code rigged_glb_url} from the three rigging providers, stored on
     *       {@code GarmentAsset} and rendered directly by the try-on viewer.</li>
     *   <li>{@code models}, {@code poses}, {@code garments} — static seed assets.</li>
     * </ul>
     *
     * <p>{@code avatars} is deliberately absent and must stay absent: body scans are served only
     * by {@code GET /api/avatar/model}. The Blender rigging provider's job/result JSON (absolute
     * container paths plus the avatar URL, hence the owning user id) is written under
     * {@code rigging-work}, which is likewise absent.
     *
     * <p>{@code SecurityConfigAssetExposureTest} asserts this array against the
     * {@link SecurityConfig} matchers and both nginx configs, so a subtree added to one layer and
     * forgotten in another fails the build instead of 404ing in production.
     */
    static final String[] PUBLIC_ASSET_SUBTREES = {"models", "poses", "garments", "products", "rigged"};

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
