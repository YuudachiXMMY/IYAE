package com.iyae.service;

import com.iyae.dto.SizeRecommendationResponse;
import com.iyae.entity.BodyProfile;
import com.iyae.entity.Product;
import com.iyae.entity.ProductSizeMeasurement;
import com.iyae.entity.User;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.entity.enums.SizeRecommendationBasis;
import com.iyae.repository.BodyProfileRepository;
import com.iyae.repository.DesignerProfileRepository;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * "Recommended size" logic, exposing two complementary entry points that were developed on
 * separate seams and unified here:
 *
 * <ul>
 *   <li><b>{@link #recommend(Long, String)} — chart/self-reported (public endpoint):</b> a
 *       two-tier recommendation returning a rich {@link SizeRecommendationResponse}.
 *       <ol>
 *         <li><b>Tier 1 — MEASUREMENT_CHART:</b> when the product has a measurement size chart
 *             and the user has measurements, pick the chart entry with the smallest RMS deviation
 *             over the dimensions present on both sides.</li>
 *         <li><b>Tier 2 — SELF_REPORTED:</b> otherwise map the product category to the user's
 *             self-reported size and return it when it is one of the product's available sizes.</li>
 *       </ol>
 *       When neither tier yields a size, returns {@code NONE}.</li>
 *   <li><b>{@link #recommendForBuyer(List, String)} — cm-measurement normalization
 *       (Marketplace):</b> normalizes garment cm-measurements ({@link ProductSizeMeasurement})
 *       against a buyer's {@link BodyProfile} to produce a consistent size label — independent of
 *       each designer's arbitrary S/M/L labelling. This is the cm-based normalization deliverable
 *       for Phase 5. SMPL-X betas-based refinement (Phase 4) is a deliberately separate seam; do
 *       NOT couple this to avatar generation here.</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SizeRecommendationService {

    /** Measurement dimensions considered for chart matching (all values in centimetres). */
    private static final List<String> CHART_DIMS =
            List.of("chestCm", "waistCm", "hipsCm", "inseamCm");

    /** Defensive cap on parsed size-chart entries (no designer authoring UI exists yet). */
    private static final int MAX_CHART_ENTRIES = 50;

    /** Reference per-dimension deviation (cm) used to normalize chart confidence. */
    private static final double CONFIDENCE_REFERENCE_CM = 15.0;

    /** Fixed confidence for self-reported recommendations (no measurement verification). */
    private static final double SELF_REPORTED_CONFIDENCE = 0.5;

    // Penalize "too tight" (garment smaller than body) more heavily than "too loose".
    private static final double TIGHT_WEIGHT = 2.0;
    private static final double LOOSE_WEIGHT = 1.0;

    private final ProductRepository productRepository;
    private final DesignerProfileRepository designerProfileRepository;
    private final BodyProfileRepository bodyProfileRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public SizeRecommendationResponse recommend(Long productId, String email) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));

        // Visibility gate (mirrors ProductService.getProductById): PUBLISHED products are
        // public; non-PUBLISHED products are visible only to the owning designer. A non-owner
        // — including a buyer with no designer profile — gets the same "Product not found" as a
        // truly missing product, so the error cannot distinguish an existing DRAFT/ARCHIVED one.
        if (product.getStatus() != ProductStatus.PUBLISHED) {
            User caller = userRepository.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("Product not found: " + productId));
            boolean owner = designerProfileRepository.findByUserId(caller.getId())
                    .map(dp -> dp.getId().equals(product.getDesignerProfile().getId()))
                    .orElse(false);
            if (!owner) {
                throw new IllegalArgumentException("Product not found: " + productId);
            }
        }

        List<String> availableSizes = parseStringArray(product.getSizes());

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        BodyProfile profile = bodyProfileRepository.findByUserId(user.getId()).orElse(null);
        if (profile == null) {
            return new SizeRecommendationResponse(
                    null, SizeRecommendationBasis.NONE.name(), 0.0, availableSizes);
        }

        // Tier 1: measurement chart
        List<SizeChartEntry> chart = parseSizeChart(product.getSizeChart());
        if (!chart.isEmpty()) {
            SizeRecommendationResponse chartRec = recommendFromChart(chart, profile, availableSizes);
            if (chartRec != null) {
                return chartRec;
            }
        }

        // Tier 2: self-reported size for the product category
        String selfReported = selfReportedSizeForCategory(product.getCategory(), profile);
        if (selfReported != null && !selfReported.isBlank()) {
            Optional<String> match = availableSizes.stream()
                    .filter(s -> s.equalsIgnoreCase(selfReported))
                    .findFirst();
            if (match.isPresent()) {
                return new SizeRecommendationResponse(
                        match.get(), SizeRecommendationBasis.SELF_REPORTED.name(),
                        SELF_REPORTED_CONFIDENCE, availableSizes);
            }
        }

        return new SizeRecommendationResponse(
                null, SizeRecommendationBasis.NONE.name(), 0.0, availableSizes);
    }

    /**
     * Recommend a size label for the given buyer email from the product's cm-measurements.
     * Returns null when there is no email, no {@link BodyProfile}, no measurements, or no
     * comparable dimension.
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

    private SizeRecommendationResponse recommendFromChart(
            List<SizeChartEntry> chart, BodyProfile profile, List<String> availableSizes) {
        Map<String, Double> userDims = userMeasurements(profile);
        if (userDims.isEmpty()) {
            return null; // no measurements to compare — fall through to self-reported
        }

        SizeChartEntry best = null;
        double bestRms = Double.MAX_VALUE;
        for (SizeChartEntry entry : chart) {
            double sumSq = 0.0;
            int n = 0;
            for (Map.Entry<String, Double> dim : userDims.entrySet()) {
                Double chartVal = entry.dims().get(dim.getKey());
                if (chartVal != null) {
                    double diff = dim.getValue() - chartVal;
                    sumSq += diff * diff;
                    n++;
                }
            }
            if (n == 0) {
                continue; // entry shares no comparable dimension
            }
            // Select on RMS (root-mean-square deviation per comparable dimension) so the
            // chosen entry and the reported confidence use the SAME metric — an entry that
            // matches on fewer dimensions no longer beats a better all-dimension match.
            // Strict '<' keeps the FIRST entry on ties (chart order wins).
            double rms = Math.sqrt(sumSq / n);
            if (rms < bestRms) {
                bestRms = rms;
                best = entry;
            }
        }

        if (best == null) {
            return null; // no comparable chart entry — fall through to self-reported
        }

        // Only recommend a chart size the product actually offers (mirrors the Tier-2
        // case-insensitive availability check); otherwise fall through to self-reported/NONE.
        String bestSize = best.size();
        boolean bestIsAvailable = availableSizes.stream()
                .anyMatch(s -> s.equalsIgnoreCase(bestSize));
        if (!bestIsAvailable) {
            return null;
        }

        double confidence = Math.max(0.0, Math.min(1.0, 1.0 - bestRms / CONFIDENCE_REFERENCE_CM));
        confidence = Math.round(confidence * 100.0) / 100.0;
        return new SizeRecommendationResponse(
                best.size(), SizeRecommendationBasis.MEASUREMENT_CHART.name(), confidence, availableSizes);
    }

    private Map<String, Double> userMeasurements(BodyProfile profile) {
        Map<String, Double> dims = new LinkedHashMap<>();
        if (profile.getChestCm() != null) dims.put("chestCm", profile.getChestCm());
        if (profile.getWaistCm() != null) dims.put("waistCm", profile.getWaistCm());
        if (profile.getHipsCm() != null) dims.put("hipsCm", profile.getHipsCm());
        if (profile.getInseamCm() != null) dims.put("inseamCm", profile.getInseamCm());
        return dims;
    }

    private String selfReportedSizeForCategory(String category, BodyProfile profile) {
        String cat = category == null ? "" : category.toLowerCase();
        if (cat.contains("dress")) {
            return profile.getDressSize();
        }
        if (cat.contains("shoe")) {
            return profile.getShoeSize();
        }
        if (cat.contains("bottom") || cat.contains("pant")) {
            return profile.getBottomSize();
        }
        if (cat.contains("outerwear") || cat.contains("jacket")) {
            return profile.getJacketSize();
        }
        if (cat.contains("top")) {
            return profile.getTopSize();
        }
        // Unrecognized categories (accessory/bag/jewelry, etc.) have no meaningful
        // self-reported size — return null so the caller emits a NONE recommendation
        // rather than a misleading top-size suggestion (L1).
        return null;
    }

    private List<String> parseStringArray(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            JsonNode root = objectMapper.readTree(json);
            if (!root.isArray()) {
                return List.of();
            }
            List<String> values = new ArrayList<>();
            for (JsonNode node : root) {
                if (node != null && !node.isNull()) {
                    String s = node.asText();
                    if (!s.isBlank()) {
                        values.add(s);
                    }
                }
            }
            return values;
        } catch (Exception e) {
            log.warn("Failed to parse string-array JSON: {}", e.getMessage());
            return List.of();
        }
    }

    private List<SizeChartEntry> parseSizeChart(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            // NOTE (M4): readTree fully materializes the JSON before MAX_CHART_ENTRIES
            // bounds the loop below. Not attacker-reachable today (no write path/DTO
            // field for size_chart). TODO(size-chart-authoring): enforce array length
            // and total size at write time when authoring lands.
            JsonNode root = objectMapper.readTree(json);
            if (!root.isArray()) {
                return List.of();
            }
            List<SizeChartEntry> entries = new ArrayList<>();
            for (JsonNode node : root) {
                if (entries.size() >= MAX_CHART_ENTRIES) {
                    log.warn("size_chart has more than {} entries; ignoring the remainder",
                            MAX_CHART_ENTRIES);
                    break;
                }
                JsonNode sizeNode = node.get("size");
                if (sizeNode == null || sizeNode.isNull()) {
                    continue;
                }
                Map<String, Double> dims = new LinkedHashMap<>();
                for (String key : CHART_DIMS) {
                    JsonNode value = node.get(key);
                    if (value != null && value.isNumber()) {
                        dims.put(key, value.asDouble());
                    }
                }
                entries.add(new SizeChartEntry(sizeNode.asText(), dims));
            }
            return entries;
        } catch (Exception e) {
            log.warn("Failed to parse size chart JSON: {}", e.getMessage());
            return List.of();
        }
    }

    private record SizeChartEntry(String size, Map<String, Double> dims) {}
}
