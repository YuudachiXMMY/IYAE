package com.iyae.service;

import com.iyae.config.BrandProperties;
import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import com.iyae.repository.AvatarGenerationTaskRepository;
import com.iyae.repository.BodyProfileRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.Resource;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * Covers {@code AvatarService.openOwnAvatarModel}, the route the "body scans are no longer
 * publicly enumerable" fix rests on.
 *
 * <p>Locking the {@code /assets/avatars/**} subtree down only moves the exposure if the
 * replacement route is itself sound, and nothing tested it: neither {@code AvatarControllerTest}
 * nor {@code AvatarServiceTest} mentioned {@code openOwnAvatarModel}, so the ownership scoping
 * and the containment guard — the two things standing between a caller and an arbitrary file
 * under the asset root — could both have regressed silently.
 */
@ExtendWith(MockitoExtension.class)
class AvatarModelAccessTest {

    @Mock AvatarGenerationTaskRepository avatarTaskRepository;
    @Mock BodyProfileRepository bodyProfileRepository;
    @Mock UserRepository userRepository;
    @Mock BrandProperties brandProperties;

    @Spy ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks AvatarService avatarService;

    @TempDir Path assetRoot;

    private User owner;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(avatarService, "assetRoot", assetRoot.toString());
        owner = User.builder().id(7L).email("owner@example.com").name("Owner").role(Role.BUYER).build();
    }

    /** Writes a file at {@code assetRoot/<relative>} and returns the URL form the worker emits. */
    private String writeAsset(String relative) throws IOException {
        Path file = assetRoot.resolve(relative);
        Files.createDirectories(file.getParent());
        Files.writeString(file, "glTF-ish bytes");
        return "/assets/" + relative;
    }

    @Test
    @DisplayName("streams the caller's own avatar, resolved from the stored URL")
    void streamsOwnAvatar() throws IOException {
        // The path carries a task segment because every unauthenticated visitor shares one
        // internal guest account; a per-user path had them overwriting each other.
        owner.setAvatarGlbUrl(writeAsset("avatars/7/41/avatar.glb"));
        when(userRepository.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));

        Resource glb = avatarService.openOwnAvatarModel("owner@example.com");

        assertThat(glb.exists()).isTrue();
        assertThat(glb.getFile().toPath()).isEqualTo(assetRoot.resolve("avatars/7/41/avatar.glb"));
    }

    @Test
    @DisplayName("resolves from the principal, so one account cannot name another's file")
    void resolvesFromThePrincipalOnly() throws IOException {
        // There is no id parameter to tamper with — that is the fix. Another user's file exists
        // on disk, and the caller with no avatar of their own still gets nothing.
        writeAsset("avatars/99/1/avatar.glb");
        owner.setAvatarGlbUrl(null);
        when(userRepository.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));

        assertThatThrownBy(() -> avatarService.openOwnAvatarModel("owner@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Avatar not found");
    }

    @Test
    @DisplayName("refuses a stored URL that escapes the asset root")
    void refusesTraversalOutsideTheAssetRoot() throws IOException {
        // The URL is server-generated, but it reaches the database through a JSON payload another
        // process wrote, so it is not trusted to stay well-formed.
        Path outside = assetRoot.getParent().resolve("escaped.glb");
        Files.writeString(outside, "should never be served");
        owner.setAvatarGlbUrl("/assets/../" + outside.getFileName());
        when(userRepository.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));

        assertThatThrownBy(() -> avatarService.openOwnAvatarModel("owner@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Avatar not found");
    }

    @Test
    @DisplayName("refuses a stored URL that is not a .glb")
    void refusesNonGlbExtension() throws IOException {
        // Keeps the route from becoming a general file reader for anything the worker drops in
        // the tree — the Blender provider's job.json being the obvious example.
        owner.setAvatarGlbUrl(writeAsset("avatars/7/41/job.json"));
        when(userRepository.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));

        assertThatThrownBy(() -> avatarService.openOwnAvatarModel("owner@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Avatar not found");
    }

    @Test
    @DisplayName("refuses a URL outside the /assets/ namespace entirely")
    void refusesUrlOutsideTheAssetNamespace() {
        owner.setAvatarGlbUrl("https://example.com/not-ours/avatar.glb");
        when(userRepository.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));

        assertThatThrownBy(() -> avatarService.openOwnAvatarModel("owner@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Avatar not found");
    }

    @Test
    @DisplayName("refuses when the stored URL names a file that is not on disk")
    void refusesMissingFile() {
        owner.setAvatarGlbUrl("/assets/avatars/7/41/avatar.glb");
        when(userRepository.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));

        assertThatThrownBy(() -> avatarService.openOwnAvatarModel("owner@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Avatar not found");
    }

    @Test
    @DisplayName("a blank stored URL is treated as no avatar, not as the asset root")
    void refusesBlankUrl() {
        owner.setAvatarGlbUrl("   ");
        when(userRepository.findByEmail("owner@example.com")).thenReturn(Optional.of(owner));

        assertThatThrownBy(() -> avatarService.openOwnAvatarModel("owner@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Avatar not found");
    }
}
