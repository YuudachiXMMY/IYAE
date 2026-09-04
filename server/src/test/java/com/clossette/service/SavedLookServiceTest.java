package com.clossette.service;

import com.clossette.dto.SavedLookRequest;
import com.clossette.dto.SavedLookResponse;
import com.clossette.entity.OutfitRecommendation;
import com.clossette.entity.SavedLook;
import com.clossette.entity.User;
import com.clossette.entity.enums.Role;
import com.clossette.repository.OutfitRecommendationRepository;
import com.clossette.repository.SavedLookRepository;
import com.clossette.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SavedLookServiceTest {

    @Mock SavedLookRepository savedLookRepository;
    @Mock UserRepository userRepository;
    @Mock OutfitRecommendationRepository outfitRecommendationRepository;
    @Spy ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks SavedLookService savedLookService;

    private User testUser;
    private OutfitRecommendation recommendation;
    private SavedLook savedLook;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L).email("buyer@example.com").name("Buyer").role(Role.BUYER).build();

        recommendation = OutfitRecommendation.builder()
                .id(50L).user(testUser).requestData("{}").responseData("{}")
                .createdAt(Instant.now()).build();

        savedLook = SavedLook.builder()
                .id(200L).user(testUser).recommendation(recommendation)
                .note("My fav look").createdAt(Instant.now()).build();
    }

    @Test
    void getSavedLooks_returnsList() {
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(savedLookRepository.findByUserId(1L)).thenReturn(List.of(savedLook));

        List<SavedLookResponse> result = savedLookService.getSavedLooks("buyer@example.com");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).id()).isEqualTo(200L);
        assertThat(result.get(0).note()).isEqualTo("My fav look");
        assertThat(result.get(0).recommendationId()).isEqualTo(50L);
    }

    @Test
    void getSavedLooks_unknownUser_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> savedLookService.getSavedLooks("ghost@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    void saveLook_success_returnsResponse() {
        SavedLookRequest request = new SavedLookRequest(50L, "Great outfit!");

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(outfitRecommendationRepository.findByIdAndUser(50L, testUser))
                .thenReturn(Optional.of(recommendation));
        when(savedLookRepository.save(any(SavedLook.class))).thenReturn(savedLook);

        SavedLookResponse response = savedLookService.saveLook("buyer@example.com", request);

        assertThat(response.id()).isEqualTo(200L);
        assertThat(response.recommendationId()).isEqualTo(50L);
    }

    @Test
    void saveLook_nullRecommendationId_throwsIllegalArgumentException() {
        SavedLookRequest request = new SavedLookRequest(null, "note");

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));

        assertThatThrownBy(() -> savedLookService.saveLook("buyer@example.com", request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("recommendationId is required");
    }

    @Test
    void saveLook_recommendationBelongsToOtherUser_throwsAccessDeniedException() {
        SavedLookRequest request = new SavedLookRequest(50L, "note");

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(outfitRecommendationRepository.findByIdAndUser(50L, testUser))
                .thenReturn(Optional.empty());
        when(outfitRecommendationRepository.existsById(50L)).thenReturn(true);

        assertThatThrownBy(() -> savedLookService.saveLook("buyer@example.com", request))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Cannot save another user's recommendation");
    }

    @Test
    void saveLook_recommendationNotFound_throwsIllegalArgumentException() {
        SavedLookRequest request = new SavedLookRequest(999L, "note");

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(outfitRecommendationRepository.findByIdAndUser(999L, testUser))
                .thenReturn(Optional.empty());
        when(outfitRecommendationRepository.existsById(999L)).thenReturn(false);

        assertThatThrownBy(() -> savedLookService.saveLook("buyer@example.com", request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Recommendation not found");
    }

    @Test
    void updateNote_success_updatesAndReturns() {
        SavedLookRequest request = new SavedLookRequest(50L, "Updated note");
        SavedLook updatedLook = SavedLook.builder()
                .id(200L).user(testUser).recommendation(recommendation)
                .note("Updated note").createdAt(Instant.now()).build();

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(savedLookRepository.findByIdAndUserId(200L, 1L)).thenReturn(Optional.of(savedLook));
        when(savedLookRepository.save(savedLook)).thenReturn(updatedLook);

        SavedLookResponse response = savedLookService.updateNote("buyer@example.com", 200L, request);

        assertThat(response.note()).isEqualTo("Updated note");
        assertThat(savedLook.getNote()).isEqualTo("Updated note");
    }

    @Test
    void updateNote_notOwned_throwsIllegalArgumentException() {
        SavedLookRequest request = new SavedLookRequest(50L, "Hacked note");

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(savedLookRepository.findByIdAndUserId(200L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> savedLookService.updateNote("buyer@example.com", 200L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Saved look not found");
    }

    @Test
    void deleteLook_success_deletesEntity() {
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(savedLookRepository.findByIdAndUserId(200L, 1L)).thenReturn(Optional.of(savedLook));

        savedLookService.deleteLook("buyer@example.com", 200L);

        verify(savedLookRepository).delete(savedLook);
    }

    @Test
    void deleteLook_notOwned_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(savedLookRepository.findByIdAndUserId(999L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> savedLookService.deleteLook("buyer@example.com", 999L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Saved look not found");
    }
}
