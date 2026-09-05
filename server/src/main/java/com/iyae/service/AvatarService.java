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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
                && latest.getOutputPayload() != null) {
            glbUrl = extractField(latest.getOutputPayload(), "glb_url");
        }

        return new AvatarStatusResponse(
                externalStatus,
                glbUrl,
                latest.getErrorMessage(),
                latest.getAttemptCount() != null ? latest.getAttemptCount() : 0
        );
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
            avatarTaskRepository.deleteAll(tasks);
        }

        log.info("Deleted avatar data for user {}", user.getId());
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
