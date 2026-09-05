package com.iyae.service;

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

    static final String GUEST_EMAIL = "guest@iyae.internal";

    private final AvatarGenerationTaskRepository avatarTaskRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;

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

        String glbUrl = null;
        if ((task.getStatus() == TaskStatus.READY || task.getStatus() == TaskStatus.MATERIALIZED)
                && task.getOutputPayload() != null) {
            glbUrl = extractField(task.getOutputPayload(), "glb_url");
        }

        return new GuestAvatarStatusResponse(taskId, externalStatus, glbUrl, task.getErrorMessage());
    }

    private User getOrCreateGuestUser() {
        return userRepository.findByEmail(GUEST_EMAIL)
                .orElseGet(() -> {
                    log.info("Creating guest user for anonymous avatar generation");
                    return userRepository.save(User.builder()
                            .email(GUEST_EMAIL)
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
