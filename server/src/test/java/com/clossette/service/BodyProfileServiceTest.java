package com.clossette.service;

import com.clossette.dto.BodyProfileRequest;
import com.clossette.dto.BodyProfileResponse;
import com.clossette.entity.BodyProfile;
import com.clossette.entity.User;
import com.clossette.entity.enums.Role;
import com.clossette.repository.BodyProfileRepository;
import com.clossette.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BodyProfileServiceTest {

    @Mock BodyProfileRepository bodyProfileRepository;
    @Mock UserRepository userRepository;

    @InjectMocks BodyProfileService bodyProfileService;

    private User testUser;
    private BodyProfile existingProfile;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L).email("buyer@example.com").name("Buyer").role(Role.BUYER).build();

        existingProfile = BodyProfile.builder()
                .id(5L).user(testUser)
                .heightCm(168.0).weightKg(58.0)
                .chestCm(88.0).waistCm(66.0).hipsCm(92.0)
                .build();
    }

    @Test
    void getProfile_exists_returnsResponse() {
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(existingProfile));

        BodyProfileResponse response = bodyProfileService.getProfile("buyer@example.com");

        assertThat(response.heightCm()).isEqualTo(168.0);
        assertThat(response.waistCm()).isEqualTo(66.0);
    }

    @Test
    void getProfile_notFound_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> bodyProfileService.getProfile("buyer@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Body profile not found");
    }

    @Test
    void getProfile_unknownUser_throwsIllegalArgumentException() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> bodyProfileService.getProfile("ghost@example.com"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }

    @Test
    void upsertProfile_newProfile_createsAndReturns() {
        BodyProfileRequest request = new BodyProfileRequest(
                170.0, 60.0, 90.0, 68.0, 94.0, null, null, null, null, null, null, null);

        BodyProfile saved = BodyProfile.builder()
                .id(6L).user(testUser).heightCm(170.0).weightKg(60.0)
                .chestCm(90.0).waistCm(68.0).hipsCm(94.0).build();

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.empty());
        when(bodyProfileRepository.save(any(BodyProfile.class))).thenReturn(saved);

        BodyProfileResponse response = bodyProfileService.upsertProfile("buyer@example.com", request);

        assertThat(response.heightCm()).isEqualTo(170.0);
        assertThat(response.chestCm()).isEqualTo(90.0);
        verify(bodyProfileRepository).save(any(BodyProfile.class));
    }

    @Test
    void upsertProfile_existingProfile_updatesFields() {
        BodyProfileRequest request = new BodyProfileRequest(
                172.0, null, null, 70.0, null, null, null, "38", null, null, null, null);

        BodyProfile updated = BodyProfile.builder()
                .id(5L).user(testUser).heightCm(172.0).weightKg(58.0)
                .chestCm(88.0).waistCm(70.0).hipsCm(92.0).shoeSize("38").build();

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(existingProfile));
        when(bodyProfileRepository.save(any(BodyProfile.class))).thenReturn(updated);

        BodyProfileResponse response = bodyProfileService.upsertProfile("buyer@example.com", request);

        assertThat(response.heightCm()).isEqualTo(172.0);
        assertThat(response.waistCm()).isEqualTo(70.0);
        assertThat(response.shoeSize()).isEqualTo("38");
        // unchanged fields preserved on entity (tested by the mock returning updated)
        verify(bodyProfileRepository).save(existingProfile);
    }

    @Test
    void upsertProfile_nullFieldsNotOverwritten() {
        // All fields in request are null — profile values should be unchanged
        BodyProfileRequest request = new BodyProfileRequest(
                null, null, null, null, null, null, null, null, null, null, null, null);

        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(existingProfile));
        when(bodyProfileRepository.save(existingProfile)).thenReturn(existingProfile);

        bodyProfileService.upsertProfile("buyer@example.com", request);

        // existing values on the entity must not have been changed
        assertThat(existingProfile.getHeightCm()).isEqualTo(168.0);
        assertThat(existingProfile.getWaistCm()).isEqualTo(66.0);
    }
}
