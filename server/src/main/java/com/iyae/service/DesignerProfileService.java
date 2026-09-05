package com.iyae.service;

import com.iyae.entity.DesignerProfile;
import com.iyae.entity.User;
import com.iyae.repository.DesignerProfileRepository;
import com.iyae.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DesignerProfileService {

    private final DesignerProfileRepository designerProfileRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public DesignerProfile getProfile(String email) {
        User user = requireUser(email);
        return designerProfileRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Designer profile not found for user: " + email));
    }

    @Transactional(readOnly = true)
    public DesignerProfile getProfileById(Long profileId) {
        return designerProfileRepository.findById(profileId)
                .orElseThrow(() -> new IllegalArgumentException("Designer profile not found: " + profileId));
    }

    @Transactional
    public DesignerProfile updateProfile(String email, String displayName, String shopName, String bio) {
        User user = requireUser(email);
        DesignerProfile profile = designerProfileRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Designer profile not found for user: " + email));

        if (displayName != null) {
            profile.setDisplayName(displayName);
        }
        if (shopName != null) {
            profile.setShopName(shopName);
        }
        if (bio != null) {
            profile.setBio(bio);
        }

        return designerProfileRepository.save(profile);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private User requireUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
    }
}
