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
import com.iyae.repository.ProductSizeMeasurementRepository;
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

    /**
     * Defensive cap on size-chart entries parsed from the {@code size_chart} JSON blob. Designer
     * authoring now reaches Tier 1 through the normalized {@code product_size_measurements} rows
     * (bounded at write time by the product's declared sizes), so this cap only guards the
     * write-less JSON column against an oversized externally-seeded value.
     */
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
    private final ProductSizeMeasurementRepository productSizeMeasurementRepository;
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

        // Tier 1: measurement chart. The authored size_chart JSON blob wins when present; when it
        // is absent, fall back to the designer's normalized product_size_measurements rows (Seam B,
        // written by the studio ProductForm). This makes authored per-size measurements drive a
        // MEASUREMENT_CHART recommendation without a JSON write path or migration.
        List<SizeChartEntry> chart = parseSizeChart(product.getSizeChart());
        if (chart.isEmpty()) {
            chart = chartFromMeasurements(product.getId());
        }
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
        // Return the AVAILABLE-cased label (not the chart's casing) so the case-sensitive
        // frontend preselect (page.tsx: product.sizes.includes(size)) can match it.
        String bestSize = best.size();
        Optional<String> availMatch = availableSizes.stream()
                .filter(s -> s.equalsIgnoreCase(bestSize))
                .findFirst();
        if (availMatch.isEmpty()) {
            return null;
        }

        double confidence = Math.max(0.0, Math.min(1.0, 1.0 - bestRms / CONFIDENCE_REFERENCE_CM));
        confidence = Math.round(confidence * 100.0) / 100.0;
        return new SizeRecommendationResponse(
                availMatch.get(), SizeRecommendationBasis.MEASUREMENT_CHART.name(), confidence, availableSizes);
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
        // Order matters: check the most specific tokens first so a compound label like
        // "dress shoes" resolves to footwear, not dresses.
        if (cat.contains("shoe") || cat.contains("footwear") || cat.contains("boot")
                || cat.contains("sneaker")) {
            return profile.getShoeSize();
        }
        if (cat.contains("dress") || cat.contains("gown")) {
            return profile.getDressSize();
        }
        if (cat.contains("bottom") || cat.contains("pant") || cat.contains("trouser")
                || cat.contains("jean") || cat.contains("short") || cat.contains("skirt")
                || cat.contains("legging")) {
            return profile.getBottomSize();
        }
        if (cat.contains("outerwear") || cat.contains("jacket") || cat.contains("coat")
                || cat.contains("blazer") || cat.contains("hoodie")) {
            return profile.getJacketSize();
        }
        // "top" stays LAST among garment checks: it is a common substring, and labels
        // like "tank top"/"crop top" should only reach here after the more specific
        // categories above have been ruled out.
        if (cat.contains("top") || cat.contains("tee") || cat.contains("shirt")
                || cat.contains("blouse") || cat.contains("sweater") || cat.contains("knit")
                || cat.contains("activewear")) {
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
            // bounds the loop below. The designer authoring UI writes normalized
            // product_size_measurements rows (Seam B), consumed via chartFromMeasurements();
            // this size_chart JSON column has no client/DTO write path, so the cap here
            // stays a defensive bound on any externally-seeded blob rather than a
            // write-time check.
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

    /**
     * Derive Tier-1 chart entries from the product's normalized {@code product_size_measurements}
     * rows (Seam B). Used as a fallback when {@code products.size_chart} JSON is null/blank so the
     * shipped designer measurement UI drives a {@code MEASUREMENT_CHART} recommendation.
     *
     * <p>The match deliberately covers only the three shared dims (chest/waist/hips). Seam B's
     * {@code length_cm} is a garment length, NOT an inseam, so it is NOT mapped onto the chart's
     * {@code inseamCm} — mapping it would skew the RMS fit score. Rows with all-null comparable
     * dims are skipped (no comparable signal), mirroring the write-time all-null skip in
     * {@code ProductService.replaceMeasurements}.
     */
    private List<SizeChartEntry> chartFromMeasurements(Long productId) {
        List<ProductSizeMeasurement> rows = productSizeMeasurementRepository.findByProductId(productId);
        List<SizeChartEntry> entries = new ArrayList<>();
        for (ProductSizeMeasurement row : rows) {
            if (row.getSizeLabel() == null || row.getSizeLabel().isBlank()) {
                continue;
            }
            Map<String, Double> dims = new LinkedHashMap<>();
            if (row.getChestCm() != null) dims.put("chestCm", row.getChestCm());
            if (row.getWaistCm() != null) dims.put("waistCm", row.getWaistCm());
            if (row.getHipsCm() != null) dims.put("hipsCm", row.getHipsCm());
            if (dims.isEmpty()) {
                continue; // all-null comparable dims — no signal to match on
            }
            entries.add(new SizeChartEntry(row.getSizeLabel(), dims));
        }
        return entries;
    }

    private record SizeChartEntry(String size, Map<String, Double> dims) {}
}
