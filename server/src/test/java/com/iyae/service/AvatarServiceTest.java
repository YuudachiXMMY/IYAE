package com.iyae.service;

import com.iyae.entity.AvatarGenerationTask;
import com.iyae.entity.BodyProfile;
import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import com.iyae.entity.enums.TaskStatus;
import com.iyae.repository.AvatarGenerationTaskRepository;
import com.iyae.repository.BodyProfileRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AvatarServiceTest {

    @Mock AvatarGenerationTaskRepository avatarTaskRepository;
    @Mock BodyProfileRepository bodyProfileRepository;
    @Mock UserRepository userRepository;

    @Spy ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks AvatarService avatarService;

    private User testUser;
    private BodyProfile testProfile;

    @BeforeEach
    void setUp() {
        testUser = User.builder()
                .id(1L).email("buyer@example.com").name("Buyer").role(Role.BUYER).build();

        testProfile = BodyProfile.builder()
                .id(5L).user(testUser)
                .heightCm(170.0).weightKg(65.0)
                .chestCm(90.0).waistCm(70.0).hipsCm(95.0)
                .build();
    }

    private void stubCommonMocks() {
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(testUser));
        when(bodyProfileRepository.findByUserId(1L)).thenReturn(Optional.of(testProfile));
        when(avatarTaskRepository.findByUserIdOrderByCreatedAtDesc(1L))
                .thenReturn(Collections.emptyList());
        when(avatarTaskRepository.save(any(AvatarGenerationTask.class)))
                .thenAnswer(invocation -> {
                    AvatarGenerationTask task = invocation.getArgument(0);
                    task.setId(100L);
                    return task;
                });
    }

    private String captureGenderFromPayload() throws Exception {
        ArgumentCaptor<AvatarGenerationTask> captor =
                ArgumentCaptor.forClass(AvatarGenerationTask.class);
        verify(avatarTaskRepository).save(captor.capture());

        AvatarGenerationTask savedTask = captor.getValue();
        assertThat(savedTask.getInputPayload()).isNotNull();
        assertThat(savedTask.getStatus()).isEqualTo(TaskStatus.PENDING);

        JsonNode payload = objectMapper.readTree(savedTask.getInputPayload());
        return payload.get("gender").asText();
    }

    @Test
    void generateAvatar_nullGenderIdentity_payloadContainsNeutral() throws Exception {
        testUser.setGenderIdentity(null);
        stubCommonMocks();

        avatarService.generateAvatar("buyer@example.com");

        assertThat(captureGenderFromPayload()).isEqualTo("neutral");
    }

    @Test
    void generateAvatar_blankGenderIdentity_payloadContainsNeutral() throws Exception {
        testUser.setGenderIdentity("");
        stubCommonMocks();

        avatarService.generateAvatar("buyer@example.com");

        assertThat(captureGenderFromPayload()).isEqualTo("neutral");
    }

    @Test
    void generateAvatar_maleGenderIdentity_payloadContainsMale() throws Exception {
        testUser.setGenderIdentity("Male");
        stubCommonMocks();

        avatarService.generateAvatar("buyer@example.com");

        assertThat(captureGenderFromPayload()).isEqualTo("male");
    }

    @Test
    void generateAvatar_femaleGenderIdentity_payloadContainsFemale() throws Exception {
        testUser.setGenderIdentity("Female");
        stubCommonMocks();

        avatarService.generateAvatar("buyer@example.com");

        assertThat(captureGenderFromPayload()).isEqualTo("female");
    }

    @Test
    void generateAvatar_nonBinaryGenderIdentity_payloadContainsNeutral() throws Exception {
        testUser.setGenderIdentity("Non-binary");
        stubCommonMocks();

        avatarService.generateAvatar("buyer@example.com");

        assertThat(captureGenderFromPayload()).isEqualTo("neutral");
    }

    @Test
    void generateAvatar_prefersNotToSay_payloadContainsNeutral() throws Exception {
        testUser.setGenderIdentity("Prefer not to say");
        stubCommonMocks();

        avatarService.generateAvatar("buyer@example.com");

        assertThat(captureGenderFromPayload()).isEqualTo("neutral");
    }
}
