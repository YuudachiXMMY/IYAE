package com.iyae.service;

import com.iyae.entity.BodyProfile;
import com.iyae.entity.ProductSizeMeasurement;
import com.iyae.repository.BodyProfileRepository;
import com.iyae.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

/**
 * Normalizes garment cm-measurements against a buyer's {@link BodyProfile} to produce a
 * consistent "your recommended size" — independent of each designer's arbitrary S/M/L labelling.
 *
 * <p>This is the cm-based normalization deliverable for Phase 5. SMPL-X betas-based refinement
 * (Phase 4) is a deliberately separate seam; do NOT couple this to avatar generation here.
 */
@Service
@RequiredArgsConstructor
public class SizeRecommendationService {

    // Penalize "too tight" (garment smaller than body) more heavily than "too loose".
    private static final double TIGHT_WEIGHT = 2.0;
    private static final double LOOSE_WEIGHT = 1.0;

    private final UserRepository userRepository;
    private final BodyProfileRepository bodyProfileRepository;

    /**
     * Recommend a size label for the given buyer email. Returns null when there is no email,
     * no {@link BodyProfile}, no measurements, or no comparable dimension.
     */
    @Transactional(readOnly = true)
    public String recommendForBuyer(List<ProductSizeMeasurement> measurements, String email) {
        if (measurements == null || measurements.isEmpty() || email == null || email.isBlank()) {
            return null;
        }
        BodyProfile body = userRepository.findByEmail(email)
                .flatMap(user -> bodyProfileRepository.findByUserId(user.getId()))
                .orElse(null);
        if (body == null) {
            return null;
        }
        return pickBestFit(measurements, body);
    }

    /**
     * Pure best-fit selection. Prefers a garment that is &ge; the body (fits, not too tight) with
     * the least ease; ties break to the smaller size. Returns null if no size has a comparable dim.
     */
    static String pickBestFit(List<ProductSizeMeasurement> measurements, BodyProfile body) {
        if (measurements == null || measurements.isEmpty() || body == null) {
            return null;
        }
        // Ascending by total declared measurement so score ties resolve to the smaller size.
        List<ProductSizeMeasurement> ordered = measurements.stream()
                .sorted(Comparator.comparingDouble(SizeRecommendationService::sizeMagnitude))
                .toList();

        ProductSizeMeasurement best = null;
        double bestScore = Double.MAX_VALUE;
        for (ProductSizeMeasurement m : ordered) {
            Double score = fitScore(m, body);
            if (score == null) {
                continue;
            }
            if (score < bestScore) {
                bestScore = score;
                best = m;
            }
        }
        return best != null ? best.getSizeLabel() : null;
    }

    private static Double fitScore(ProductSizeMeasurement m, BodyProfile body) {
        double total = 0.0;
        boolean comparable = false;
        Double chest = dimPenalty(m.getChestCm(), body.getChestCm());
        if (chest != null) { total += chest; comparable = true; }
        Double waist = dimPenalty(m.getWaistCm(), body.getWaistCm());
        if (waist != null) { total += waist; comparable = true; }
        Double hips = dimPenalty(m.getHipsCm(), body.getHipsCm());
        if (hips != null) { total += hips; comparable = true; }
        return comparable ? total : null;
    }

    private static Double dimPenalty(Double garment, Double bodyDim) {
        if (garment == null || bodyDim == null) {
            return null;
        }
        double diff = garment - bodyDim;
        return diff >= 0 ? diff * LOOSE_WEIGHT : (-diff) * TIGHT_WEIGHT;
    }

    private static double sizeMagnitude(ProductSizeMeasurement m) {
        double sum = 0.0;
        if (m.getChestCm() != null) sum += m.getChestCm();
        if (m.getWaistCm() != null) sum += m.getWaistCm();
        if (m.getHipsCm() != null) sum += m.getHipsCm();
        if (m.getLengthCm() != null) sum += m.getLengthCm();
        return sum;
    }
}
