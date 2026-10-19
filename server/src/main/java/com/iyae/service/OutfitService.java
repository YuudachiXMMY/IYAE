package com.iyae.service;

import com.iyae.ai.AIProvider;
import com.iyae.ai.AIProviderFactory;
import com.iyae.dto.GenerateOutfitRequest;
import com.iyae.dto.ManualOutfitRequest;
import com.iyae.dto.OutfitResponse;
import com.iyae.dto.OutfitSlotResponse;
import com.iyae.entity.GarmentAsset;
import com.iyae.entity.OutfitRecommendation;
import com.iyae.entity.Product;
import com.iyae.entity.User;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.repository.GarmentAssetRepository;
import com.iyae.repository.OutfitRecommendationRepository;
import com.iyae.repository.ProductRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OutfitService {

    private static final String AI_SYSTEM_PROMPT =
        "Explain why these products work together for the occasion. " +
        "Include fit advice if body measurements are available.";

    // Slot name -> matching category keywords (case-insensitive contains)
    private static final Map<String, List<String>> SLOT_CATEGORIES = new LinkedHashMap<>();

    static {
        SLOT_CATEGORIES.put("top",       List.of("top", "outerwear", "dress"));
        SLOT_CATEGORIES.put("bottom",    List.of("bottom", "pant", "skirt"));
        SLOT_CATEGORIES.put("shoes",     List.of("shoe", "footwear"));
        SLOT_CATEGORIES.put("accessory", List.of("accessory", "bag", "jewelry"));
    }

    private final ProductRepository productRepository;
    private final OutfitRecommendationRepository outfitRecommendationRepository;
    private final UserRepository userRepository;
    private final GarmentAssetRepository garmentAssetRepository;
    private final AIProviderFactory aiProviderFactory;
    private final ObjectMapper objectMapper;

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    @Transactional
    public OutfitResponse generateOutfit(GenerateOutfitRequest request, String userEmail) {
        User user = findUserByEmail(userEmail);
        OutfitResponse response = buildOutfitResponse(request);
        persistRecommendation(user, request, response);
        return response;
    }

    /**
     * Used by ChatService when no authenticated user context is available for
     * inline outfit generation triggered by the AI chat flow.
     */
    public OutfitResponse generateOutfitAnonymous(GenerateOutfitRequest request) {
        return buildOutfitResponse(request);
    }

    /**
     * Persists an outfit recommendation for the given user.
     * Called by ChatService after parsing [GENERATE_OUTFIT] from an AI response.
     *
     * @return the persisted OutfitRecommendation entity
     * @throws Exception if serialization or database persistence fails
     */
    @Transactional
    public OutfitRecommendation persistOutfit(User user, GenerateOutfitRequest request, OutfitResponse outfitResponse) throws Exception {
        String requestData = objectMapper.writeValueAsString(request);
        String responseData = objectMapper.writeValueAsString(outfitResponse);
        OutfitRecommendation recommendation = OutfitRecommendation.builder()
            .user(user)
            .requestData(requestData)
            .responseData(responseData)
            .build();
        OutfitRecommendation saved = outfitRecommendationRepository.save(recommendation);
        log.debug("Persisted OutfitRecommendation id={} for user={} via chat", saved.getId(), user.getEmail());
        return saved;
    }

    @Transactional(readOnly = true)
    public List<OutfitResponse> listOutfits(String userEmail) {
        User user = findUserByEmail(userEmail);
        return outfitRecommendationRepository.findByUserOrderByCreatedAtDesc(user)
            .stream()
            .map(this::deserializeRecommendation)
            .filter(Objects::nonNull)
            .map(this::reEnrichWithCurrentAssets)
            .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public OutfitResponse getOutfit(Long id, String userEmail) {
        User user = findUserByEmail(userEmail);
        OutfitRecommendation rec = outfitRecommendationRepository.findByIdAndUser(id, user)
            .orElseThrow(() -> new IllegalArgumentException("Outfit not found or access denied"));
        OutfitResponse response = deserializeRecommendation(rec);
        if (response == null) {
            throw new IllegalStateException("Failed to deserialize outfit recommendation id=" + id);
        }
        return reEnrichWithCurrentAssets(response);
    }

    private OutfitResponse reEnrichWithCurrentAssets(OutfitResponse response) {
        List<OutfitSlotResponse> refreshed = enrichSlotsWithAssets(response.items());
        return new OutfitResponse(response.id(), refreshed, response.explanation(), response.createdAt());
    }

    // -------------------------------------------------------------------------
    // Core Algorithm
    // -------------------------------------------------------------------------

    private OutfitResponse buildOutfitResponse(GenerateOutfitRequest request) {
        List<Product> publishedProducts = productRepository.findAll()
            .stream()
            .filter(p -> ProductStatus.PUBLISHED.equals(p.getStatus()))
            .collect(Collectors.toList());

        Set<Long> seedIds = request.seedProductIds() != null
            ? new HashSet<>(request.seedProductIds())
            : Collections.emptySet();

        List<String> requestStyles = parseStyleTags(request.style());
        List<String> requestColors = request.colorPalette() != null
            ? request.colorPalette()
            : Collections.emptyList();

        List<OutfitSlotResponse> slots = new ArrayList<>();

        for (Map.Entry<String, List<String>> entry : SLOT_CATEGORIES.entrySet()) {
            String slotName = entry.getKey();
            List<String> keywords = entry.getValue();
            boolean isShoes = "shoes".equals(slotName);

            List<Product> candidates = publishedProducts.stream()
                .filter(p -> matchesSlotCategory(p.getCategory(), keywords))
                .collect(Collectors.toList());

            if (candidates.isEmpty()) {
                if (!isShoes) {
                    log.warn("No PUBLISHED products found for slot '{}', skipping", slotName);
                }
                continue;
            }

            List<String> finalRequestStyles = requestStyles;
            List<String> finalRequestColors = requestColors;
            Product best = candidates.stream()
                .max(Comparator.comparingDouble(p ->
                    scoreProduct(p, finalRequestStyles, finalRequestColors, seedIds)))
                .orElse(null);

            if (best == null) {
                continue;
            }

            double score = scoreProduct(best, requestStyles, requestColors, seedIds);
            List<String> media = parseJsonList(best.getMedia());

            slots.add(new OutfitSlotResponse(
                slotName,
                best.getId(),
                best.getName(),
                best.getPrice(),
                best.getCategory(),
                media,
                best.getGlbUrl(),
                isShoes,
                score,
                null, null, null  // glbAssetUrl, usdzUrl, riggedGlbUrl populated later in enrichment step
            ));
        }

        List<OutfitSlotResponse> enrichedSlots = enrichSlotsWithAssets(slots);

        String explanation = generateExplanation(request, enrichedSlots);

        return new OutfitResponse(null, enrichedSlots, explanation, Instant.now());
    }

    // -------------------------------------------------------------------------
    // Asset Enrichment
    // -------------------------------------------------------------------------

    private List<OutfitSlotResponse> enrichSlotsWithAssets(List<OutfitSlotResponse> slots) {
        List<Long> selectedProductIds = slots.stream()
            .map(OutfitSlotResponse::productId)
            .collect(Collectors.toList());
        Map<Long, GarmentAsset> assetByProductId = new HashMap<>();
        if (!selectedProductIds.isEmpty()) {
            garmentAssetRepository.findByProductIdIn(selectedProductIds).stream()
                .filter(a -> "READY".equalsIgnoreCase(a.getStatus())
                        || "ACTIVE".equalsIgnoreCase(a.getStatus()))
                .collect(Collectors.groupingBy(a -> a.getProduct().getId()))
                .forEach((pid, assets) -> {
                    assets.stream()
                        .max(Comparator.comparing(GarmentAsset::getCreatedAt))
                        .ifPresent(best -> assetByProductId.put(pid, best));
                });
        }
        return slots.stream()
            .map(s -> {
                GarmentAsset asset = assetByProductId.get(s.productId());
                return new OutfitSlotResponse(
                    s.slot(), s.productId(), s.productName(), s.productPrice(),
                    s.category(), s.media(), s.glbUrl(), s.sponsored(), s.score(),
                    asset != null ? asset.getGlbUrl() : null,
                    asset != null ? asset.getUsdzUrl() : null,
                    asset != null ? asset.getRiggedGlbUrl() : null
                );
            })
            .collect(Collectors.toList());
    }

    // -------------------------------------------------------------------------
    // Manual Outfit Creation
    // -------------------------------------------------------------------------

    private static final Set<String> VALID_SLOT_NAMES = Set.of("top", "bottom", "shoes", "accessory");

    private void validateManualRequest(ManualOutfitRequest request) {
        if (request.slots() == null || request.slots().isEmpty()) {
            throw new IllegalArgumentException("At least one slot must be filled");
        }
        for (String slot : request.slots().keySet()) {
            if (!VALID_SLOT_NAMES.contains(slot)) {
                throw new IllegalArgumentException("Invalid slot name: " + slot + ". Must be one of: top, bottom, shoes, accessory");
            }
        }
        long uniqueProductIds = request.slots().values().stream().distinct().count();
        if (uniqueProductIds != request.slots().values().size()) {
            throw new IllegalArgumentException("Same product cannot be used in multiple slots");
        }
    }

    @Transactional
    public OutfitResponse createManualOutfit(ManualOutfitRequest request, String userEmail) {
        User user = findUserByEmail(userEmail);
        validateManualRequest(request);

        List<Long> productIds = new ArrayList<>(request.slots().values());
        List<Product> products = productRepository.findByIdInAndStatus(productIds, ProductStatus.PUBLISHED);

        if (products.size() != productIds.size()) {
            throw new IllegalArgumentException("All selected products must exist and be PUBLISHED");
        }

        Map<Long, Product> productById = products.stream()
            .collect(Collectors.toMap(Product::getId, p -> p));

        List<OutfitSlotResponse> slots = request.slots().entrySet().stream()
            .map(entry -> {
                Product product = productById.get(entry.getValue());
                List<String> media = parseJsonList(product.getMedia());
                return new OutfitSlotResponse(
                    entry.getKey(),
                    product.getId(),
                    product.getName(),
                    product.getPrice(),
                    product.getCategory(),
                    media,
                    product.getGlbUrl(),
                    false,
                    0.0,
                    null, null, null
                );
            })
            .collect(Collectors.toList());

        List<OutfitSlotResponse> enrichedSlots = enrichSlotsWithAssets(slots);

        String explanation = buildManualExplanation(request);
        OutfitResponse response = new OutfitResponse(null, enrichedSlots, explanation, Instant.now());

        return persistRecommendationReturningResponse(user, request, response);
    }

    private String buildManualExplanation(ManualOutfitRequest request) {
        String occasion = request.occasion() != null && !request.occasion().isBlank()
            ? request.occasion() : "any occasion";
        return String.format("A hand-picked outfit curated for %s.", occasion);
    }

    private OutfitResponse persistRecommendationReturningResponse(User user, Object requestObj, OutfitResponse response) {
        try {
            String requestData = objectMapper.writeValueAsString(requestObj);
            String responseData = objectMapper.writeValueAsString(response);
            OutfitRecommendation recommendation = OutfitRecommendation.builder()
                .user(user)
                .requestData(requestData)
                .responseData(responseData)
                .build();
            OutfitRecommendation saved = outfitRecommendationRepository.save(recommendation);
            return new OutfitResponse(saved.getId(), response.items(), response.explanation(), saved.getCreatedAt());
        } catch (Exception e) {
            log.error("Failed to persist OutfitRecommendation for user={}", user.getEmail(), e);
            throw new RuntimeException("Failed to save outfit", e);
        }
    }

    // -------------------------------------------------------------------------
    // Scoring
    // -------------------------------------------------------------------------

    private double scoreProduct(Product product,
                                List<String> requestStyles,
                                List<String> requestColors,
                                Set<Long> seedIds) {
        if (seedIds.contains(product.getId())) {
            return Double.MAX_VALUE;
        }

        double score = 0.0;

        List<String> productStyles = parseJsonList(product.getStyleTags());
        for (String requestStyle : requestStyles) {
            for (String productStyle : productStyles) {
                if (productStyle.equalsIgnoreCase(requestStyle)) {
                    score += 3.0;
                }
            }
        }

        List<String> productColors = parseJsonList(product.getColorTags());
        for (String requestColor : requestColors) {
            for (String productColor : productColors) {
                if (productColor.equalsIgnoreCase(requestColor)) {
                    score += 1.0;
                }
            }
        }

        return score;
    }

    // -------------------------------------------------------------------------
    // AI Explanation
    // -------------------------------------------------------------------------

    private String generateExplanation(GenerateOutfitRequest request, List<OutfitSlotResponse> slots) {
        if (slots.isEmpty()) {
            return buildFallbackExplanation(request);
        }
        try {
            AIProvider provider = aiProviderFactory.getProvider();
            String userMessage = buildAiUserMessage(request, slots);
            List<Map<String, String>> messages = List.of(
                Map.of("role", "user", "content", userMessage)
            );
            String explanation = provider.sendMessage(AI_SYSTEM_PROMPT, messages);
            if (explanation == null || explanation.isBlank()) {
                return buildFallbackExplanation(request);
            }
            return explanation;
        } catch (Exception e) {
            log.warn("AI explanation failed, using fallback. Reason: {}", e.getMessage());
            return buildFallbackExplanation(request);
        }
    }

    private String buildAiUserMessage(GenerateOutfitRequest request, List<OutfitSlotResponse> slots) {
        StringBuilder sb = new StringBuilder();
        sb.append("Occasion: ").append(request.event()).append("\n");
        sb.append("Style: ").append(request.style()).append("\n");
        sb.append("Color palette: ").append(request.colorPalette()).append("\n");
        if (request.weather() != null && !request.weather().isBlank()) {
            sb.append("Weather: ").append(request.weather()).append("\n");
        }
        if (request.mood() != null && !request.mood().isBlank()) {
            sb.append("Mood: ").append(request.mood()).append("\n");
        }
        sb.append("\n");
        sb.append("Selected products:\n");
        for (OutfitSlotResponse slot : slots) {
            sb.append("- [").append(slot.slot()).append("] ")
              .append(slot.productName())
              .append(" (").append(slot.category()).append(")\n");
        }
        return sb.toString();
    }

    private String buildFallbackExplanation(GenerateOutfitRequest request) {
        String event = request.event() != null ? request.event() : "the occasion";
        String style = request.style() != null ? request.style() : "curated";
        StringBuilder sb = new StringBuilder(String.format(
            "A curated outfit selected for your %s. The %s pieces complement each other beautifully.",
            event, style
        ));
        if (request.mood() != null && !request.mood().isBlank()) {
            sb.append(String.format(" It leans into a %s mood.", request.mood()));
        }
        if (request.weather() != null && !request.weather().isBlank()) {
            sb.append(String.format(" Chosen with today's weather (%s) in mind.", request.weather()));
        }
        return sb.toString();
    }

    // -------------------------------------------------------------------------
    // Persistence
    // -------------------------------------------------------------------------

    private void persistRecommendation(User user, GenerateOutfitRequest request, OutfitResponse response) {
        try {
            String requestData = objectMapper.writeValueAsString(request);
            String responseData = objectMapper.writeValueAsString(response);
            OutfitRecommendation recommendation = OutfitRecommendation.builder()
                .user(user)
                .requestData(requestData)
                .responseData(responseData)
                .build();
            OutfitRecommendation saved = outfitRecommendationRepository.save(recommendation);
            log.debug("Persisted OutfitRecommendation id={} for user={}", saved.getId(), user.getEmail());
        } catch (Exception e) {
            log.error("Failed to persist OutfitRecommendation for user={}", user.getEmail(), e);
        }
    }

    private OutfitResponse deserializeRecommendation(OutfitRecommendation rec) {
        try {
            OutfitResponse base = objectMapper.readValue(rec.getResponseData(), OutfitResponse.class);
            return new OutfitResponse(rec.getId(), base.items(), base.explanation(), rec.getCreatedAt());
        } catch (Exception e) {
            log.warn("Failed to deserialize responseData for OutfitRecommendation id={}", rec.getId(), e);
            return null;
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private boolean matchesSlotCategory(String productCategory, List<String> keywords) {
        if (productCategory == null) return false;
        String lower = productCategory.toLowerCase(Locale.ROOT);
        return keywords.stream().anyMatch(lower::contains);
    }

    private List<String> parseStyleTags(String style) {
        if (style == null || style.isBlank()) return Collections.emptyList();
        return Arrays.stream(style.split("[,\\s]+"))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .collect(Collectors.toList());
    }

    private List<String> parseJsonList(String json) {
        if (json == null || json.isBlank()) return Collections.emptyList();
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (Exception e) {
            log.trace("Failed to parse JSON list: {}", json);
            return Collections.emptyList();
        }
    }

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
    }
}
