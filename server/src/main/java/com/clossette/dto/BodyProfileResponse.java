package com.clossette.dto;

import com.clossette.entity.BodyProfile;

public record BodyProfileResponse(
        Double heightCm,
        Double weightKg,
        Double chestCm,
        Double waistCm,
        Double hipsCm,
        Double shoulderWidthCm,
        Double inseamCm,
        String shoeSize,
        String topSize,
        String bottomSize,
        String dressSize,
        String jacketSize
) {
    public static BodyProfileResponse from(BodyProfile profile) {
        return new BodyProfileResponse(
                profile.getHeightCm(),
                profile.getWeightKg(),
                profile.getChestCm(),
                profile.getWaistCm(),
                profile.getHipsCm(),
                profile.getShoulderWidthCm(),
                profile.getInseamCm(),
                profile.getShoeSize(),
                profile.getTopSize(),
                profile.getBottomSize(),
                profile.getDressSize(),
                profile.getJacketSize()
        );
    }
}
