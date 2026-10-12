package com.iyae.service;

import com.iyae.config.BrandProperties;
import com.iyae.dto.AvatarResponse;
import com.iyae.dto.AvatarStatusResponse;
import com.iyae.entity.AvatarGenerationTask;
import com.iyae.entity.BodyProfile;
import com.iyae.entity.User;
import com.iyae.entity.enums.TaskStatus;
import com.iyae.repository.AvatarGenerationTaskRepository;
import com.iyae.repository.BodyProfileRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class AvatarService {

    private final AvatarGenerationTaskRepository avatarTaskRepository;
    private final BodyProfileRepository bodyProfileRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final BrandProperties brandProperties;

    @Value("${AVATAR_GENERATION_PROVIDER:mock}")
    private String avatarProvider;

    // The shared asset root the worker writes avatar GLBs under
    // ({assetRoot}/avatars/{userId}/avatar.glb). This subtree is NOT served as a static file by
    // nginx or by Spring's resource handlers — see AVATAR_MODEL_ROUTE.
    @Value("${worker.output-dir:/var/iyae/assets}")
    private String assetRoot;

    /**
     * The only route a generated body scan is reachable through. Authenticated, and it serves
     * the caller their own avatar — never one identified by a client-supplied id, so there is
     * nothing to enumerate.
     */
    public static final String AVATAR_MODEL_ROUTE = "/api/avatar/model";

    /** Prefix the worker puts on the public asset URLs it reports. */
    private static final String ASSET_URL_PREFIX = "/assets/";

    @Transactional
    public AvatarStatusResponse generateAvatar(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Validate BodyProfile completeness
        BodyProfile profile = bodyProfileRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalArgumentException(
                    "Body profile required. Please add your measurements first."));

        if (profile.getHeightCm() == null || profile.getWeightKg() == null) {
            throw new IllegalArgumentException(
                "Height and weight are required for avatar generation.");
        }
        if (profile.getChestCm() == null && profile.getWaistCm() == null
                && profile.getHipsCm() == null) {
            throw new IllegalArgumentException(
                "At least one body measurement (chest, waist, or hips) is required.");
        }

        // Supersede active tasks
        supersedeActiveTasks(user.getId());

        // Build input payload from measurements
        String inputPayload = buildInputPayload(profile, user);

        AvatarGenerationTask task = AvatarGenerationTask.builder()
                .user(user)
                .status(TaskStatus.PENDING)
                .provider(resolveProvider())
                .inputPayload(inputPayload)
                .attemptCount(0)
                .build();
        AvatarGenerationTask saved = avatarTaskRepository.save(task);

        log.info("Avatar generation task {} created for user {}", saved.getId(), user.getId());
        return new AvatarStatusResponse(saved.getStatus().name(), null, null, 0);
    }

    @Transactional(readOnly = true)
    public AvatarStatusResponse getStatus(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<AvatarGenerationTask> tasks =
                avatarTaskRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        if (tasks.isEmpty()) {
            return new AvatarStatusResponse("NONE", null, null, 0);
        }

        AvatarGenerationTask latest = tasks.get(0);

        // Map MATERIALIZED -> READY for external API
        String externalStatus = latest.getStatus() == TaskStatus.MATERIALIZED
                ? "READY" : latest.getStatus().name();

        String glbUrl = null;
        if ((latest.getStatus() == TaskStatus.READY
                || latest.getStatus() == TaskStatus.MATERIALIZED)
                && latest.getOutputPayload() != null
                && extractField(latest.getOutputPayload(), "glb_url") != null) {
            // Deliberately NOT the worker's own `glb_url`, which is the static path
            // /assets/avatars/{userId}/avatar.glb. That path was served unauthenticated with a
            // sequential integer in it, so anyone who could count could download every user's
            // 3D body scan. The client is handed the authenticated route instead; the static
            // path is no longer reachable from nginx or from Spring's resource handlers.
            glbUrl = AVATAR_MODEL_ROUTE;
        }

        return new AvatarStatusResponse(
                externalStatus,
                glbUrl,
                latest.getErrorMessage(),
                latest.getAttemptCount() != null ? latest.getAttemptCount() : 0
        );
    }

    /**
     * Opens the caller's own avatar GLB for streaming.
     *
     * <p>The file is located from {@code user.avatarGlbUrl}, which the scheduler materialised
     * from the worker's own output payload — rather than reconstructing the layout here. The
     * worker gives each generation its own directory ({@code avatars/{userId}/{taskId}/}),
     * because every unauthenticated visitor shares one internal guest account and a per-user
     * path meant guests overwrote each other's body meshes. Two places computing that layout
     * would be two places to get it wrong, so the server reads it instead.
     *
     * <p>The stored URL is server-generated, but it is still validated for containment before
     * being opened: it reaches the database through a JSON payload written by another process,
     * which is exactly the kind of input that should not be trusted to stay well-formed.
     *
     * @throws IllegalArgumentException when no avatar has been generated for this account
     */
    @Transactional(readOnly = true)
    public Resource openOwnAvatarModel(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        return openAvatarModelAt(user.getAvatarGlbUrl());
    }

    /**
     * Resolves a worker-written {@code /assets/...} avatar URL to a readable file.
     *
     * <p>Shared by the authenticated route and the guest route ({@code GuestAvatarService}), which
     * both have to apply the same containment check and must not each reimplement it. The
     * <em>authorisation</em> decision is the caller's: this method only answers "does this URL
     * name a real GLB inside the asset root".
     */
    Resource openAvatarModelAt(String url) {
        if (url == null || url.isBlank() || !url.startsWith(ASSET_URL_PREFIX)) {
            throw new IllegalArgumentException("Avatar not found");
        }
        String relative = url.substring(ASSET_URL_PREFIX.length());

        Path root = Paths.get(assetRoot).toAbsolutePath().normalize();
        Path file = root.resolve(relative).normalize();
        if (!file.startsWith(root) || !file.getFileName().toString().endsWith(".glb")) {
            log.error("Refusing to serve avatar from {} — it resolves to {}, outside {}",
                    url, file, root);
            throw new IllegalArgumentException("Avatar not found");
        }
        if (!Files.isRegularFile(file)) {
            throw new IllegalArgumentException("Avatar not found");
        }
        return new FileSystemResource(file);
    }

    @Transactional(readOnly = true)
    public AvatarResponse getAvatar(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String avatarUrl = user.getAvatarGlbUrl();
        String status = avatarUrl != null ? "READY" : "NONE";
        return new AvatarResponse(avatarUrl, status);
    }

    /**
     * One-tap privacy delete: purge the user's avatar URL, body profile, and avatar
     * generation task rows. The {@link User} itself is NOT deleted. Idempotent — a
     * missing body profile or empty task list is a no-op.
     *
     * <p>PENDING/RUNNING task rows are deleted too (not skipped): the worker's later
     * UPDATE on a now-missing row affects 0 rows, so a completed in-flight task cannot
     * resurrect {@code user.avatarGlbUrl} after the delete. The in-flight result is
     * intentionally discarded — logged for observability.
     */
    @Transactional
    public void deleteAvatarData(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        user.setAvatarGlbUrl(null);
        userRepository.save(user);

        bodyProfileRepository.findByUserId(user.getId())
                .ifPresent(bodyProfileRepository::delete);

        List<AvatarGenerationTask> tasks =
                avatarTaskRepository.findByUserIdOrderByCreatedAtDesc(user.getId());
        if (!tasks.isEmpty()) {
            long activeCount = tasks.stream()
                    .filter(t -> t.getStatus() == TaskStatus.PENDING
                            || t.getStatus() == TaskStatus.RUNNING)
                    .count();
            if (activeCount > 0) {
                log.info("Purging {} active avatar task(s) for user {} during data deletion",
                        activeCount, user.getId());
            }
            avatarTaskRepository.deleteAll(tasks);
        }

        // Purge the generated avatar GLB from disk. Without this a privacy delete only
        // nulls the DB pointer while the body scan stays publicly downloadable at
        // /assets/avatars/{userId}/avatar.glb.
        deleteAvatarFiles(user.getId());

        log.info("Deleted avatar data for user {}", user.getId());
    }

    /**
     * Best-effort recursive delete of {@code {assetRoot}/avatars/{userId}}. Failures are
     * logged at ERROR (a lingering body scan is a privacy issue that must be visible for
     * manual cleanup) but never thrown — the DB purge is already committed and must not be
     * rolled back by a filesystem error.
     */
    private void deleteAvatarFiles(Long userId) {
        Path dir = Paths.get(assetRoot, "avatars", String.valueOf(userId));
        if (!Files.exists(dir)) {
            return; // idempotent — nothing generated yet
        }
        try (var paths = Files.walk(dir)) {
            paths.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException e) {
                    log.error("Failed to delete avatar file {} for user {}: {}",
                            p, userId, e.getMessage());
                }
            });
        } catch (IOException e) {
            log.error("Failed to walk avatar dir {} for user {}: {}",
                    dir, userId, e.getMessage());
        }
    }

    @Transactional
    public void processReadyTasks() {
        List<AvatarGenerationTask> readyTasks =
                avatarTaskRepository.findByStatus(TaskStatus.READY);
        for (AvatarGenerationTask task : readyTasks) {
            try {
                materializeAvatar(task);
            } catch (Exception e) {
                log.error("Failed to materialize avatar for task {}: {}",
                        task.getId(), e.getMessage());
            }
        }
    }

    private void materializeAvatar(AvatarGenerationTask task) {
        if (task.getOutputPayload() == null) return;

        // Idempotency: only materialize latest READY task
        List<AvatarGenerationTask> userTasks =
                avatarTaskRepository.findByUserIdOrderByCreatedAtDesc(task.getUser().getId());
        AvatarGenerationTask latestReady = userTasks.stream()
                .filter(t -> t.getStatus() == TaskStatus.READY)
                .findFirst()
                .orElse(null);
        if (latestReady == null || !latestReady.getId().equals(task.getId())) {
            log.info("Skipping materialization for avatar task {} — not latest READY",
                    task.getId());
            return;
        }

        String glbUrl = extractField(task.getOutputPayload(), "glb_url");
        User user = task.getUser();

        // Guest user tasks: mark MATERIALIZED but skip writing to User.avatarGlbUrl
        boolean isGuest = Objects.equals(brandProperties.guestEmail(), user.getEmail());
        if (!isGuest) {
            user.setAvatarGlbUrl(glbUrl);
            userRepository.save(user);
        }

        task.setStatus(TaskStatus.MATERIALIZED);
        avatarTaskRepository.save(task);

        log.info("Avatar materialized for {} {}: {}",
                isGuest ? "guest task" : "user", user.getId(), glbUrl);
    }

    private void supersedeActiveTasks(Long userId) {
        List<AvatarGenerationTask> tasks =
                avatarTaskRepository.findByUserIdOrderByCreatedAtDesc(userId);
        for (AvatarGenerationTask t : tasks) {
            if (t.getStatus() == TaskStatus.PENDING || t.getStatus() == TaskStatus.RUNNING) {
                t.setStatus(TaskStatus.FAILED);
                t.setErrorMessage("Superseded by regeneration");
                avatarTaskRepository.save(t);
            }
        }
    }

    private String resolveProvider() {
        if ("smplx".equalsIgnoreCase(avatarProvider)) {
            return "smplx";
        }
        return "mock";
    }

    private String mapGenderIdentity(String genderIdentity) {
        if (genderIdentity == null || genderIdentity.isBlank()) {
            return "neutral";
        }
        String lower = genderIdentity.toLowerCase();
        if (lower.contains("female")) {
            return "female";
        }
        if (lower.contains("male")) {
            return "male";
        }
        return "neutral";
    }

    private String buildInputPayload(BodyProfile profile, User user) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("gender", mapGenderIdentity(user.getGenderIdentity()));
        if (profile.getHeightCm() != null) payload.put("heightCm", profile.getHeightCm());
        if (profile.getWeightKg() != null) payload.put("weightKg", profile.getWeightKg());
        if (profile.getChestCm() != null) payload.put("chestCm", profile.getChestCm());
        if (profile.getWaistCm() != null) payload.put("waistCm", profile.getWaistCm());
        if (profile.getHipsCm() != null) payload.put("hipsCm", profile.getHipsCm());
        if (profile.getShoulderWidthCm() != null) payload.put("shoulderWidthCm", profile.getShoulderWidthCm());
        if (profile.getInseamCm() != null) payload.put("inseamCm", profile.getInseamCm());
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            log.warn("Failed to serialize avatar input payload: {}", e.getMessage());
            return "{}";
        }
    }

    private String extractField(String json, String fieldName) {
        try {
            JsonNode node = objectMapper.readTree(json);
            JsonNode field = node.get(fieldName);
            return field != null && !field.isNull() ? field.asText() : null;
        } catch (Exception e) {
            log.warn("Failed to extract field '{}' from JSON payload", fieldName);
            return null;
        }
    }
}
