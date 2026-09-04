package com.clossette.service;

import com.clossette.dto.OutfitResponse;
import com.clossette.dto.OutfitSlotResponse;
import com.clossette.dto.SavedLookRequest;
import com.clossette.dto.SavedLookResponse;
import com.clossette.entity.OutfitRecommendation;
import com.clossette.entity.SavedLook;
import com.clossette.entity.User;
import com.clossette.repository.OutfitRecommendationRepository;
import com.clossette.repository.SavedLookRepository;
import com.clossette.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class SavedLookService {

    private final SavedLookRepository savedLookRepository;
    private final UserRepository userRepository;
    private final OutfitRecommendationRepository outfitRecommendationRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<SavedLookResponse> getSavedLooks(String email) {
        User user = resolveUser(email);
        return savedLookRepository.findByUserId(user.getId())
                .stream()
                .map(look -> SavedLookResponse.from(look, extractItemNames(look)))
                .toList();
    }

    @Transactional
    public SavedLookResponse saveLook(String email, SavedLookRequest request) {
        User user = resolveUser(email);

        if (request.recommendationId() == null) {
            throw new IllegalArgumentException("recommendationId is required");
        }

        OutfitRecommendation recommendation = outfitRecommendationRepository
                .findByIdAndUser(request.recommendationId(), user)
                .orElseThrow(() -> {
                    boolean exists = outfitRecommendationRepository.existsById(request.recommendationId());
                    if (exists) {
                        throw new AccessDeniedException("Cannot save another user's recommendation");
                    }
                    throw new IllegalArgumentException("Recommendation not found: " + request.recommendationId());
                });

        SavedLook savedLook = SavedLook.builder()
                .user(user)
                .recommendation(recommendation)
                .note(request.note())
                .build();

        SavedLook persisted = savedLookRepository.save(savedLook);
        return SavedLookResponse.from(persisted, extractItemNames(persisted));
    }

    @Transactional
    public SavedLookResponse updateNote(String email, Long id, SavedLookRequest request) {
        User user = resolveUser(email);
        SavedLook savedLook = savedLookRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Saved look not found: " + id));

        savedLook.setNote(request.note());
        SavedLook updated = savedLookRepository.save(savedLook);
        return SavedLookResponse.from(updated, extractItemNames(updated));
    }

    @Transactional
    public void deleteLook(String email, Long id) {
        User user = resolveUser(email);
        SavedLook savedLook = savedLookRepository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Saved look not found: " + id));
        savedLookRepository.delete(savedLook);
    }

    private List<String> extractItemNames(SavedLook savedLook) {
        try {
            String responseData = savedLook.getRecommendation().getResponseData();
            if (responseData == null) return List.of();
            OutfitResponse outfit = objectMapper.readValue(responseData, OutfitResponse.class);
            if (outfit.items() == null) return List.of();
            return outfit.items().stream()
                    .map(OutfitSlotResponse::productName)
                    .filter(Objects::nonNull)
                    .toList();
        } catch (Exception e) {
            log.warn("Failed to extract items from recommendation for SavedLook id={}", savedLook.getId(), e);
            return List.of();
        }
    }

    private User resolveUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
    }
}
