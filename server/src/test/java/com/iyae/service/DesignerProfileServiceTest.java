package com.iyae.service;

import com.iyae.entity.DesignerProfile;
import com.iyae.repository.DesignerProfileRepository;
import com.iyae.repository.UserRepository;
import com.iyae.testsupport.TestUsers;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DesignerProfileServiceTest {

    @Mock
    DesignerProfileRepository designerProfileRepository;

    @Mock
    UserRepository userRepository;

    @InjectMocks
    DesignerProfileService designerProfileService;

    @Test
    void getProfile_existingProfile_returnsProfile() {
        var designer = TestUsers.aDesigner();
        DesignerProfile profile = buildProfile(10L, designer.getId());

        when(userRepository.findByEmail(designer.getEmail())).thenReturn(Optional.of(designer));
        when(designerProfileRepository.findByUserId(designer.getId())).thenReturn(Optional.of(profile));

        DesignerProfile result = designerProfileService.getProfile(designer.getEmail());

        assertThat(result.getId()).isEqualTo(10L);
    }

    @Test
    void getProfile_noProfile_throwsIllegalArgumentException() {
        var designer = TestUsers.aDesigner();
        when(userRepository.findByEmail(designer.getEmail())).thenReturn(Optional.of(designer));
        when(designerProfileRepository.findByUserId(designer.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> designerProfileService.getProfile(designer.getEmail()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Designer profile not found");
    }

    @Test
    void getProfileById_existing_returnsProfile() {
        DesignerProfile profile = buildProfile(10L, 2L);
        when(designerProfileRepository.findById(10L)).thenReturn(Optional.of(profile));

        DesignerProfile result = designerProfileService.getProfileById(10L);

        assertThat(result.getId()).isEqualTo(10L);
    }

    @Test
    void updateProfile_changesFields_savesAndReturns() {
        var designer = TestUsers.aDesigner();
        DesignerProfile profile = buildProfile(10L, designer.getId());

        when(userRepository.findByEmail(designer.getEmail())).thenReturn(Optional.of(designer));
        when(designerProfileRepository.findByUserId(designer.getId())).thenReturn(Optional.of(profile));
        when(designerProfileRepository.save(profile)).thenReturn(profile);

        DesignerProfile result = designerProfileService.updateProfile(
                designer.getEmail(), "New Name", "new-shop", "New bio");

        assertThat(result.getDisplayName()).isEqualTo("New Name");
        assertThat(result.getShopName()).isEqualTo("new-shop");
        assertThat(result.getBio()).isEqualTo("New bio");
        verify(designerProfileRepository).save(profile);
    }

    @Test
    void updateProfile_nullFields_doesNotOverwriteExistingValues() {
        var designer = TestUsers.aDesigner();
        DesignerProfile profile = buildProfile(10L, designer.getId());
        profile.setDisplayName("Original");
        profile.setShopName("original-shop");

        when(userRepository.findByEmail(designer.getEmail())).thenReturn(Optional.of(designer));
        when(designerProfileRepository.findByUserId(designer.getId())).thenReturn(Optional.of(profile));
        when(designerProfileRepository.save(profile)).thenReturn(profile);

        designerProfileService.updateProfile(designer.getEmail(), null, null, null);

        assertThat(profile.getDisplayName()).isEqualTo("Original");
        assertThat(profile.getShopName()).isEqualTo("original-shop");
    }

    // -------------------------------------------------------------------------

    private DesignerProfile buildProfile(Long profileId, Long userId) {
        return DesignerProfile.builder()
                .id(profileId)
                .user(TestUsers.aDesigner())
                .displayName("Test Studio")
                .shopName("test-studio")
                .bio("A test bio")
                .build();
    }
}
