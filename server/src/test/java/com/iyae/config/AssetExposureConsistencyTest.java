package com.iyae.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pins the {@code /assets/} allow-list across all four layers that have to agree.
 *
 * <p>Locking that subtree down (so body scans stopped being publicly enumerable) replaced a
 * blanket {@code /assets/**} with a three-name allow-list — {@code models}, {@code poses},
 * {@code garments} — in nginx, in {@link WebMvcConfig} and in {@link SecurityConfig}. The list
 * was written from assumed names rather than from what the worker writes, and it was wrong in
 * both directions: {@code garments} has no producer anywhere in the repository, while
 * {@code products} (every generated preview, from all three model generators) and
 * {@code rigged} (every rigged garment, from all three rigging providers) were omitted. Those
 * URLs reach the browser verbatim — {@code GenerationService.getStatus} and
 * {@code GarmentAsset.riggedGlbUrl} hand them straight to {@code <model-viewer>}, and no API
 * route re-serves them — so every 3D preview and every try-on asset answered 404 in production
 * and 403 in dev.
 *
 * <p>Four hand-maintained copies of one list is what made that possible, so this test compares
 * them instead of re-asserting any single one. It reads the real files rather than a fixture:
 * the defect lived in the disagreement, which a fixture would reproduce rather than catch.
 */
class AssetExposureConsistencyTest {

    /** Gradle runs tests with the working directory at {@code server/}. */
    private static final Path REPO_ROOT = Paths.get("..").toAbsolutePath().normalize();
    private static final Path NGINX_DEV = REPO_ROOT.resolve("nginx/conf.d/default.conf");
    private static final Path NGINX_TLS = REPO_ROOT.resolve("nginx/templates/tls.conf");
    private static final Path SECURITY_CONFIG =
            REPO_ROOT.resolve("server/src/main/java/com/iyae/config/SecurityConfig.java");

    /** `location /assets/<name>/ {` — the alias blocks, not the terminal `location /assets/`. */
    private static final Pattern NGINX_ASSET_LOCATION =
            Pattern.compile("location\\s+/assets/([a-z-]+)/\\s*\\{");

    /** `"/assets/<name>/**"` as it appears in the permitAll matcher list. */
    private static final Pattern SECURITY_ASSET_MATCHER =
            Pattern.compile("\"/assets/([a-z-]+)/\\*\\*\"");

    private static Set<String> nginxSubtrees(Path conf) throws IOException {
        Matcher m = NGINX_ASSET_LOCATION.matcher(Files.readString(conf));
        Set<String> found = new LinkedHashSet<>();
        while (m.find()) {
            found.add(m.group(1));
        }
        return found;
    }

    private static Set<String> securityConfigSubtrees() throws IOException {
        Matcher m = SECURITY_ASSET_MATCHER.matcher(Files.readString(SECURITY_CONFIG));
        Set<String> found = new LinkedHashSet<>();
        while (m.find()) {
            found.add(m.group(1));
        }
        return found;
    }

    private static Set<String> resourceHandlerSubtrees() {
        return Arrays.stream(WebMvcConfig.PUBLIC_ASSET_SUBTREES)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    @Test
    @DisplayName("the dev nginx config exposes exactly the subtrees WebMvcConfig serves")
    void devNginxMatchesResourceHandlers() throws IOException {
        assertThat(nginxSubtrees(NGINX_DEV))
                .as("a subtree in nginx but not in WebMvcConfig is unreachable in local dev; "
                        + "one in WebMvcConfig but not in nginx is unreachable in production")
                .containsExactlyInAnyOrderElementsOf(resourceHandlerSubtrees());
    }

    @Test
    @DisplayName("the TLS nginx template exposes exactly the same subtrees as the dev config")
    void tlsNginxMatchesDevNginx() throws IOException {
        // ssl-init swaps this template in, so a subtree present in only one of the two
        // disappears the moment TLS is enabled — i.e. on the first real deploy.
        assertThat(nginxSubtrees(NGINX_TLS))
                .containsExactlyInAnyOrderElementsOf(nginxSubtrees(NGINX_DEV));
    }

    @Test
    @DisplayName("SecurityConfig permits exactly the subtrees WebMvcConfig serves")
    void securityMatchersMatchResourceHandlers() throws IOException {
        // Without this the handler would serve a file the filter chain denies, which is the
        // shape the avatars subtree had before the lockdown — reachable three different ways.
        assertThat(securityConfigSubtrees())
                .containsExactlyInAnyOrderElementsOf(resourceHandlerSubtrees());
    }

    @Test
    @DisplayName("the two subtrees the worker writes client-facing URLs for are exposed")
    void theSubtreesTheWorkerWritesAreExposed() {
        // Named explicitly, not derived, so that deleting them from every layer at once still
        // fails. These are the URL prefixes emitted by stub/tripo/meshy_generator.py
        // (glb_url, usdz_url) and python/blender/stub_rigging_provider.py (rigged_glb_url).
        assertThat(resourceHandlerSubtrees()).contains("products", "rigged");
    }

    @Test
    @DisplayName("the avatars subtree is exposed by no layer")
    void avatarsAreNeverStaticallyServed() throws IOException {
        // The whole reason the allow-list exists. Body scans are served only by
        // GET /api/avatar/model, which resolves the file from the authenticated principal,
        // and GET /api/public/avatar/model/{taskId} for the guest account.
        assertThat(resourceHandlerSubtrees()).doesNotContain("avatars");
        assertThat(nginxSubtrees(NGINX_DEV)).doesNotContain("avatars");
        assertThat(nginxSubtrees(NGINX_TLS)).doesNotContain("avatars");
        assertThat(securityConfigSubtrees()).doesNotContain("avatars");
    }

    @Test
    @DisplayName("the Blender provider's scratch subtree is exposed by no layer")
    void riggingWorkIsNeverStaticallyServed() throws IOException {
        // BlenderRiggingProvider writes job.json/result.json under `rigging-work`, carrying
        // absolute container paths and the avatar GLB URL — hence the owning user's id. The
        // rigged GLB beside it is public; these are not, which is why they are not siblings.
        assertThat(resourceHandlerSubtrees()).doesNotContain("rigging-work");
        assertThat(nginxSubtrees(NGINX_DEV)).doesNotContain("rigging-work");
        assertThat(nginxSubtrees(NGINX_TLS)).doesNotContain("rigging-work");
        assertThat(securityConfigSubtrees()).doesNotContain("rigging-work");
    }

    @Test
    @DisplayName("nginx still terminates the rest of /assets/ with a 404")
    void nginxDeniesEverythingElseUnderAssets() throws IOException {
        // The allow-list only means anything if what it does not name is refused. Without the
        // terminal block, prefix matching would fall through to `location /`.
        for (Path conf : new Path[] {NGINX_DEV, NGINX_TLS}) {
            String text = Files.readString(conf).replaceAll("\\s+", " ");
            assertThat(text)
                    .as("%s must end the /assets/ prefix with a refusal", conf.getFileName())
                    .contains("location /assets/ { return 404; }");
        }
    }
}
