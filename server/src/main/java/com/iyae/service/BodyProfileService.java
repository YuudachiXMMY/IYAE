package com.iyae.service;

import com.iyae.dto.BodyProfileRequest;
import com.iyae.dto.BodyProfileResponse;
import com.iyae.entity.BodyProfile;
import com.iyae.entity.User;
import com.iyae.repository.BodyProfileRepository;
import com.iyae.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BodyProfileService {

    private final BodyProfileRepository bodyProfileRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public BodyProfileResponse getProfile(String email) {
        User user = resolveUser(email);
        BodyProfile profile = bodyProfileRepository.findByUserId(user.getId())
                .orElseThrow(() -> new IllegalArgumentException("Body profile not found for user: " + email));
        return BodyProfileResponse.from(profile);
    }

    @Transactional
    public BodyProfileResponse upsertProfile(String email, BodyProfileRequest request) {
        User user = resolveUser(email);

        BodyProfile profile = bodyProfileRepository.findByUserId(user.getId())
                .orElseGet(() -> BodyProfile.builder().user(user).build());

        if (request.heightCm() != null) {
            profile.setHeightCm(request.heightCm());
        }
        if (request.weightKg() != null) {
            profile.setWeightKg(request.weightKg());
        }
        if (request.chestCm() != null) {
            profile.setChestCm(request.chestCm());
        }
        if (request.waistCm() != null) {
            profile.setWaistCm(request.waistCm());
        }
        if (request.hipsCm() != null) {
            profile.setHipsCm(request.hipsCm());
        }
        if (request.shoulderWidthCm() != null) {
            profile.setShoulderWidthCm(request.shoulderWidthCm());
        }
        if (request.inseamCm() != null) {
            profile.setInseamCm(request.inseamCm());
        }
        if (request.shoeSize() != null) {
            profile.setShoeSize(request.shoeSize());
        }
        if (request.topSize() != null) {
            profile.setTopSize(request.topSize());
        }
        if (request.bottomSize() != null) {
            profile.setBottomSize(request.bottomSize());
        }
        if (request.dressSize() != null) {
            profile.setDressSize(request.dressSize());
        }
        if (request.jacketSize() != null) {
            profile.setJacketSize(request.jacketSize());
        }

        return BodyProfileResponse.from(bodyProfileRepository.save(profile));
    }

    private User resolveUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
    }
}
