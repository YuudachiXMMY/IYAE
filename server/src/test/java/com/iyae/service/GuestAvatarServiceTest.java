package com.iyae.service;

import com.iyae.config.BrandProperties;
import com.iyae.dto.GuestAvatarStatusResponse;
import com.iyae.entity.AvatarGenerationTask;
import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import com.iyae.entity.enums.TaskStatus;
import com.iyae.repository.AvatarGenerationTaskRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers the anonymous try-on flow after the {@code /assets} lockdown.
 *
 * <p>{@code GuestAvatarController} is deliberately unauthenticated, and {@code getTaskStatus} used
 * to hand the caller the worker's raw {@code /assets/avatars/{guestUserId}/{taskId}/avatar.glb}
 * path. That subtree is now excluded from every asset allow-list — it is personal data and the
 * reason the lockdown exists — so the guest flow was left pointing at a URL that 404s in
 * production and 403s in dev. There is now a public route beside the authenticated one, and
 * these cases pin both halves: what the status response hands back, and what the route will open.
 */
@ExtendWith(MockitoExtension.class)
class GuestAvatarServiceTest {

    @Mock AvatarGenerationTaskRepository avatarTaskRepository;
    @Mock UserRepository userRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock BrandProperties brandProperties;
    @Mock AvatarService avatarService;

    @Spy ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks GuestAvatarService service;

    private static final String GUEST_EMAIL = "guest@iyae.internal";
    private static final String WORKER_GLB_URL = "/assets/avatars/9/77/avatar.glb";

    private User guest;
    private User realUser;

    @BeforeEach
    void setUp() {
        guest = User.builder().id(9L).email(GUEST_EMAIL).name("Guest").role(Role.BUYER).build();
        realUser = User.builder().id(3L).email("buyer@example.com").name("Buyer").role(Role.BUYER).build();
        lenient().when(brandProperties.guestEmail()).thenReturn(GUEST_EMAIL);
        lenient().when(userRepository.findByEmail(GUEST_EMAIL)).thenReturn(Optional.of(guest));
    }

    private AvatarGenerationTask guestTask(TaskStatus status, String outputPayload) {
        return AvatarGenerationTask.builder()
                .id(77L).user(guest).status(status).outputPayload(outputPayload).build();
    }

    @Test
    @DisplayName("status hands back the API route, not the worker's static asset path")
    void statusReturnsTheApiRoute() {
        when(avatarTaskRepository.findById(77L))
                .thenReturn(Optional.of(guestTask(TaskStatus.READY,
                        "{\"glb_url\":\"" + WORKER_GLB_URL + "\"}")));

        GuestAvatarStatusResponse response = service.getTaskStatus(77L);

        assertThat(response.glbUrl()).isEqualTo("/api/public/avatar/model/77");
        // The raw path must not leak either: it is the thing that is no longer served, and it
        // also discloses the internal guest user id.
        assertThat(response.glbUrl()).doesNotContain("/assets/");
    }

    @Test
    @DisplayName("MATERIALIZED is reported as READY, with the route present")
    void statusMapsMaterializedToReady() {
        when(avatarTaskRepository.findById(77L))
                .thenReturn(Optional.of(guestTask(TaskStatus.MATERIALIZED,
                        "{\"glb_url\":\"" + WORKER_GLB_URL + "\"}")));

        GuestAvatarStatusResponse response = service.getTaskStatus(77L);

        assertThat(response.status()).isEqualTo("READY");
        assertThat(response.glbUrl()).isEqualTo("/api/public/avatar/model/77");
    }

    @Test
    @DisplayName("status offers no route while the task is still running")
    void statusHasNoRouteBeforeCompletion() {
        when(avatarTaskRepository.findById(77L))
                .thenReturn(Optional.of(guestTask(TaskStatus.RUNNING, null)));

        assertThat(service.getTaskStatus(77L).glbUrl()).isNull();
    }

    @Test
    @DisplayName("status offers no route when the worker reported READY without a glb_url")
    void statusHasNoRouteWhenPayloadLacksTheUrl() {
        // Advertising a route that would then fail to open is worse than reporting nothing.
        when(avatarTaskRepository.findById(77L))
                .thenReturn(Optional.of(guestTask(TaskStatus.READY, "{\"elapsed_ms\":120}")));

        assertThat(service.getTaskStatus(77L).glbUrl()).isNull();
    }

    @Test
    @DisplayName("the model route opens the file the worker named, through the shared containment check")
    void openTaskModelDelegatesWithTheWorkerUrl() {
        when(avatarTaskRepository.findById(77L))
                .thenReturn(Optional.of(guestTask(TaskStatus.READY,
                        "{\"glb_url\":\"" + WORKER_GLB_URL + "\"}")));
        Resource expected = new ByteArrayResource(new byte[] {'g', 'l', 'T', 'F'});
        when(avatarService.openAvatarModelAt(WORKER_GLB_URL)).thenReturn(expected);

        assertThat(service.openTaskModel(77L)).isSameAs(expected);
    }

    @Test
    @DisplayName("the model route refuses a task that is not the guest account's")
    void openTaskModelRefusesAnotherAccountsTask() {
        // Same authorisation the status endpoint already applies. Without it this public route
        // would read any registered user's body scan by task id — the exposure the lockdown
        // closed, reopened through a different door.
        AvatarGenerationTask someonesTask = AvatarGenerationTask.builder()
                .id(88L).user(realUser).status(TaskStatus.READY)
                .outputPayload("{\"glb_url\":\"/assets/avatars/3/88/avatar.glb\"}").build();
        when(avatarTaskRepository.findById(88L)).thenReturn(Optional.of(someonesTask));

        assertThatThrownBy(() -> service.openTaskModel(88L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Task not found");

        verify(avatarService, never()).openAvatarModelAt(anyString());
    }

    @Test
    @DisplayName("the model route refuses a task that has not completed")
    void openTaskModelRefusesIncompleteTask() {
        when(avatarTaskRepository.findById(77L))
                .thenReturn(Optional.of(guestTask(TaskStatus.PENDING, null)));

        assertThatThrownBy(() -> service.openTaskModel(77L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Avatar not found");

        verify(avatarService, never()).openAvatarModelAt(anyString());
    }

    @Test
    @DisplayName("the model route refuses an unknown task id")
    void openTaskModelRefusesUnknownTask() {
        when(avatarTaskRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.openTaskModel(404L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Task not found");
    }
}
