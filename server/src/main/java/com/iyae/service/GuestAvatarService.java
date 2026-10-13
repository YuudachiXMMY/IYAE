package com.iyae.service;

import com.iyae.config.BrandProperties;
import com.iyae.dto.GuestAvatarRequest;
import com.iyae.dto.GuestAvatarStatusResponse;
import com.iyae.entity.AvatarGenerationTask;
import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import com.iyae.entity.enums.TaskStatus;
import com.iyae.repository.AvatarGenerationTaskRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class GuestAvatarService {

    private final AvatarGenerationTaskRepository avatarTaskRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;
    private final BrandProperties brandProperties;
    private final AvatarService avatarService;

    @Value("${AVATAR_GENERATION_PROVIDER:mock}")
    private String avatarProvider;

    @Transactional
    public GuestAvatarStatusResponse generateForGuest(GuestAvatarRequest request) {
        User guest = getOrCreateGuestUser();

        String gender = mapBodyType(request.bodyType());
        String inputPayload = buildInputPayload(gender, request);

        AvatarGenerationTask task = AvatarGenerationTask.builder()
                .user(guest)
                .status(TaskStatus.PENDING)
                .provider(resolveProvider())
                .inputPayload(inputPayload)
                .attemptCount(0)
                .build();
        AvatarGenerationTask saved = avatarTaskRepository.save(task);

        log.info("Guest avatar task {} created", saved.getId());
        return new GuestAvatarStatusResponse(saved.getId(), saved.getStatus().name(), null, null);
    }

    @Transactional(readOnly = true)
    public GuestAvatarStatusResponse getTaskStatus(Long taskId) {
        AvatarGenerationTask task = avatarTaskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found"));

        User guest = getOrCreateGuestUser();
        if (!task.getUser().getId().equals(guest.getId())) {
            throw new IllegalArgumentException("Task not found");
        }

        String externalStatus = task.getStatus() == TaskStatus.MATERIALIZED
                ? "READY" : task.getStatus().name();

        // Hand back the API route, not the worker's raw /assets/avatars/... path. That path is no
        // longer served as a static file by nginx or Spring (the avatars subtree is personal data
        // and is excluded from every asset allow-list), so returning it left the anonymous try-on
        // flow pointing at a URL that now 404s in production and 403s in dev.
        String glbUrl = null;
        if ((task.getStatus() == TaskStatus.READY || task.getStatus() == TaskStatus.MATERIALIZED)
                && task.getOutputPayload() != null
                && extractField(task.getOutputPayload(), "glb_url") != null) {
            glbUrl = "/api/public/avatar/model/" + taskId;
        }

        return new GuestAvatarStatusResponse(taskId, externalStatus, glbUrl, task.getErrorMessage());
    }

    /**
     * Opens a guest avatar GLB for streaming.
     *
     * <p>Authorisation is the same one {@link #getTaskStatus} already applies: the task must belong
     * to the internal guest account. The task id is therefore exactly as guessable as it is for
     * {@code GET /api/public/avatar/status/{taskId}}, which has always been keyed this way — this
     * route does not widen that surface. It is not the authenticated route's guarantee, which is
     * why real accounts go through {@code GET /api/avatar/model} and resolve from the principal;
     * a guest mesh is built from measurements typed in by an anonymous visitor with no account.
     */
    @Transactional(readOnly = true)
    public Resource openTaskModel(Long taskId) {
        AvatarGenerationTask task = avatarTaskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found"));

        User guest = getOrCreateGuestUser();
        if (!task.getUser().getId().equals(guest.getId())) {
            throw new IllegalArgumentException("Task not found");
        }
        if (task.getStatus() != TaskStatus.READY && task.getStatus() != TaskStatus.MATERIALIZED) {
            throw new IllegalArgumentException("Avatar not found");
        }
        return avatarService.openAvatarModelAt(extractField(task.getOutputPayload(), "glb_url"));
    }

    private User getOrCreateGuestUser() {
        return userRepository.findByEmail(brandProperties.guestEmail())
                .orElseGet(() -> {
                    log.info("Creating guest user for anonymous avatar generation");
                    return userRepository.save(User.builder()
                            .email(brandProperties.guestEmail())
                            .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                            .name("Guest")
                            .role(Role.BUYER)
                            .emailVerified(false)
                            .build());
                });
    }

    private String resolveProvider() {
        return "smplx".equalsIgnoreCase(avatarProvider) ? "smplx" : "mock";
    }

    private static String mapBodyType(String bodyType) {
        if ("female".equalsIgnoreCase(bodyType)) return "female";
        if ("male".equalsIgnoreCase(bodyType)) return "male";
        return "neutral";
    }

    static double estimateWaistCm(double heightCm, double weightKg, String bodyType) {
        double bmi = weightKg / Math.pow(heightCm / 100.0, 2);
        double base = "female".equalsIgnoreCase(bodyType) ? 0.34
                : "male".equalsIgnoreCase(bodyType) ? 0.39 : 0.36;
        return Math.round(heightCm * base + (bmi - 22) * 1.2);
    }

    private String buildInputPayload(String gender, GuestAvatarRequest request) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("gender", gender);
        payload.put("heightCm", request.heightCm());
        payload.put("weightKg", request.weightKg());

        double waistCm = request.waistCm() != null
                ? request.waistCm()
                : estimateWaistCm(request.heightCm(), request.weightKg(), request.bodyType());
        payload.put("waistCm", waistCm);

        if (request.chestCm() != null) payload.put("chestCm", request.chestCm());
        if (request.hipsCm() != null) payload.put("hipsCm", request.hipsCm());
        if (request.shoulderWidthCm() != null) payload.put("shoulderWidthCm", request.shoulderWidthCm());
        if (request.inseamCm() != null) payload.put("inseamCm", request.inseamCm());

        try {
            return objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            log.warn("Failed to serialize guest avatar input payload: {}", e.getMessage());
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
