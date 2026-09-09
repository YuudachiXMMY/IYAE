package com.iyae.service;

import com.iyae.ai.AIProvider;
import com.iyae.ai.AIProviderFactory;
import com.iyae.dto.ChatMessageResponse;
import com.iyae.dto.ChatSessionResponse;
import com.iyae.dto.GenerateOutfitRequest;
import com.iyae.dto.OutfitResponse;
import com.iyae.entity.ChatMessage;
import com.iyae.entity.ChatSession;
import com.iyae.entity.OutfitRecommendation;
import com.iyae.entity.User;
import com.iyae.entity.enums.MessageRole;
import com.iyae.entity.enums.SessionStatus;
import com.iyae.repository.ChatMessageRepository;
import com.iyae.repository.ChatSessionRepository;
import com.iyae.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private static final String SYSTEM_PROMPT = """
        You are IYAE's AI Fashion Stylist. You talk like a sharp, warm friend with great taste —
        not a chatbot, not a hype machine. Your job is to cut decision fatigue, not add to it.

        VOICE:
        - Warm, human, and opinionated. Have a point of view; recommend, don't survey.
        - Concise: 2-3 sentences per turn, max. No filler, no marketing hype, no fabricated claims.
        - Honest and grounded. Anchor picks in real Toronto pieces and real bodies. If something
          won't work, say so kindly. AI-skeptics should trust you because you're specific, not salesy.
        - Few and decisive: offer one clear direction, not a menu of ten. Get more decisive as you learn more.

        WHAT TO GATHER (naturally, in ~2-4 turns — don't interrogate):
        occasion, vibe/mood, any strong style or color leanings, and practical constraints.
        If live weather context is provided below, weave it in — layer up when it's cold, keep it
        breathable when hot, plan for rain/snow. Never ask the user for the weather; you already know it.

        GENERATING THE OUTFIT:
        When the user is happy with the direction (or clearly wants to see a look), generate it with:
        [GENERATE_OUTFIT]{"event":"...","style":"...","colorPalette":["..."],"weather":"...","mood":"..."}[/GENERATE_OUTFIT]
        - "weather": a short phrase for today's conditions (e.g. "cold, light snow") or omit if unknown.
        - "mood": the vibe you're dressing for (e.g. "confident", "cozy") or omit if unclear.

        SUGGESTIONS — CRITICAL, ALWAYS INCLUDE:
        After EVERY response (except after [GENERATE_OUTFIT]), you MUST include exactly 2-3 quick-reply suggestions.
        Format: [SUGGESTIONS]["option 1","option 2","option 3"][/SUGGESTIONS]

        Suggestion quality rules:
        - Each suggestion must directly advance the conversation toward a decisive outfit.
        - Mix types: one specific answer, one exploratory option, one that skips ahead.
          Example: ["A cocktail party", "Help me figure out the occasion", "Surprise me with something trendy"]
        - Tailor suggestions to what the user has already shared — reference their stated preferences.
        - Get more concrete and decisive as the conversation progresses.
          Early: ["Casual weekend", "Date night", "Work event"]
          Later: ["Yes, generate my outfit!", "Swap the shoes for boots", "Add a statement accessory"]
        - Keep each suggestion under 40 characters for clean UI display.
        - Never repeat a suggestion the user has already seen or selected.
        - Do NOT include suggestions after generating an outfit with [GENERATE_OUTFIT].
        """;

    private static final Pattern OUTFIT_PATTERN = Pattern.compile(
        "\\[GENERATE_OUTFIT\\](.*?)\\[/GENERATE_OUTFIT\\]",
        Pattern.DOTALL
    );

    private static final Pattern SUGGESTIONS_PATTERN = Pattern.compile(
        "\\[SUGGESTIONS\\](.*?)\\[/SUGGESTIONS\\]",
        Pattern.DOTALL
    );

    private final AIProviderFactory aiProviderFactory;
    private final ChatSessionRepository chatSessionRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final OutfitService outfitService;
    private final WeatherService weatherService;

    @org.springframework.beans.factory.annotation.Value("${app.auth.require-email-verification:true}")
    private boolean requireEmailVerification;

    @Transactional
    public ChatSessionResponse createSession(String email) {
        User user = findUserByEmail(email);
        ChatSession session = ChatSession.builder()
            .user(user)
            .status(SessionStatus.ACTIVE)
            .build();
        ChatSession saved = chatSessionRepository.save(session);
        return ChatSessionResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<ChatSessionResponse> listSessions(String email) {
        User user = findUserByEmail(email);
        return chatSessionRepository.findByUserOrderByCreatedAtDesc(user)
            .stream()
            .map(ChatSessionResponse::from)
            .toList();
    }

    // Deliberately NOT @Transactional: this method makes a blocking AI provider HTTP call
    // (worst case ~20s). Holding one transaction/DB connection across that call exhausts the
    // connection pool under concurrency and pins row locks. Instead each repository write runs in
    // its own short transaction (Spring Data JPA default), and the AI call happens with no
    // connection held. Only basic fields / FK-by-id are read on the loaded entities, so
    // open-in-view=false is safe here; the outfit persistence path manages its own transaction.
    public ChatMessageResponse sendMessage(Long sessionId, String email, String content) {
        User user = findUserByEmail(email);

        if (requireEmailVerification && !Boolean.TRUE.equals(user.getEmailVerified())) {
            ChatSession session = chatSessionRepository.findByIdAndUser(sessionId, user)
                .orElseThrow(() -> new IllegalArgumentException("Session not found or access denied"));
            String verifyPrompt = "Please verify your email address before using the AI stylist. Check your inbox for the verification link.";
            ChatMessage promptMessage = ChatMessage.builder()
                .session(session)
                .role(MessageRole.ASSISTANT)
                .content(verifyPrompt)
                .build();
            chatMessageRepository.save(promptMessage);
            return ChatMessageResponse.from(promptMessage, null);
        }

        ChatSession session = chatSessionRepository.findByIdAndUser(sessionId, user)
            .orElseThrow(() -> new IllegalArgumentException("Session not found or access denied"));

        // Step 1: Save USER message
        ChatMessage userMessage = ChatMessage.builder()
            .session(session)
            .role(MessageRole.USER)
            .content(content)
            .build();
        chatMessageRepository.save(userMessage);

        // Step 3: Build history for AI (all messages including the one just saved)
        List<ChatMessage> history = chatMessageRepository.findBySessionOrderByCreatedAtAsc(session);
        List<Map<String, String>> aiMessages = buildAiMessages(history);

        // Step 4: Call AI provider (append live weather context to the prompt, Optional-guarded so
        // a weather outage never breaks a turn — the constant SYSTEM_PROMPT is never mutated)
        AIProvider aiProvider = aiProviderFactory.getProvider();
        String effectivePrompt = SYSTEM_PROMPT + weatherService.getCurrentToronto()
            .map(w -> "\n\nCONTEXT — " + weatherService.toPromptContext(w))
            .orElse("");
        String aiResponse;
        try {
            aiResponse = aiProvider.sendMessage(effectivePrompt, aiMessages);
        } catch (com.iyae.ai.AIProviderException e) {
            log.warn("AI provider unavailable for session {}: {}", sessionId, e.getMessage(), e);
            String fallback = "I'm having trouble connecting right now. Please try again in a moment.";
            ChatMessage fallbackMessage = ChatMessage.builder()
                .session(session)
                .role(MessageRole.ASSISTANT)
                .content(fallback)
                .build();
            chatMessageRepository.save(fallbackMessage);
            return ChatMessageResponse.from(fallbackMessage, null);
        }

        // Step 5: Extract suggestions and strip [SUGGESTIONS] markers from the response
        List<String> suggestions = extractSuggestions(aiResponse);
        String cleanedResponse = stripSuggestionMarkers(aiResponse);

        // Step 5b: Fallback suggestions when AI omits [SUGGESTIONS] tags
        GenerateOutfitRequest parsedOutfitRequest = extractGenerateOutfitRequest(cleanedResponse);
        if (suggestions.isEmpty() && parsedOutfitRequest == null) {
            suggestions = generateFallbackSuggestions(history.size());
        }

        // Step 6: Check for [GENERATE_OUTFIT] marker and parse if present
        OutfitResponse outfitResponse = parsedOutfitRequest != null
            ? outfitService.generateOutfitAnonymous(parsedOutfitRequest)
            : null;

        // Step 6b: Persist the outfit recommendation and get the saved entity
        OutfitRecommendation savedOutfit = null;
        if (outfitResponse != null) {
            try {
                savedOutfit = outfitService.persistOutfit(user, parsedOutfitRequest, outfitResponse);
            } catch (Exception e) {
                log.error("Failed to persist outfit recommendation", e);
            }
        }

        // Step 7: Save ASSISTANT message (with outfit FK if applicable)
        // Store cleanedResponse (no [SUGGESTIONS] markers) but keep [GENERATE_OUTFIT] markers
        // as the frontend ChatMessageBubble handles [GENERATE_OUTFIT] stripping.
        ChatMessage assistantMessage = ChatMessage.builder()
            .session(session)
            .role(MessageRole.ASSISTANT)
            .content(cleanedResponse)
            .outfitRecommendation(savedOutfit)
            .build();
        chatMessageRepository.save(assistantMessage);

        // Step 8: Mark session COMPLETED only if outfit was successfully persisted
        if (savedOutfit != null) {
            session.setStatus(SessionStatus.COMPLETED);
            chatSessionRepository.save(session);
        }

        // Step 9: Return response
        return ChatMessageResponse.from(assistantMessage, outfitResponse, suggestions);
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getMessages(Long sessionId, String email) {
        User user = findUserByEmail(email);
        ChatSession session = chatSessionRepository.findByIdAndUser(sessionId, user)
            .orElseThrow(() -> new IllegalArgumentException("Session not found or access denied"));

        return chatMessageRepository.findBySessionOrderByCreatedAtAsc(session)
            .stream()
            .map(ChatMessageResponse::from)
            .toList();
    }

    private User findUserByEmail(String email) {
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private List<Map<String, String>> buildAiMessages(List<ChatMessage> history) {
        List<Map<String, String>> aiMessages = new ArrayList<>();
        for (ChatMessage msg : history) {
            Map<String, String> entry = new HashMap<>();
            entry.put("role", msg.getRole().name().toLowerCase());
            entry.put("content", msg.getContent());
            aiMessages.add(entry);
        }
        return aiMessages;
    }

    private GenerateOutfitRequest extractGenerateOutfitRequest(String aiResponse) {
        Matcher matcher = OUTFIT_PATTERN.matcher(aiResponse);
        if (!matcher.find()) {
            return null;
        }
        String jsonPayload = matcher.group(1).trim();
        try {
            Map<String, Object> parsed = objectMapper.readValue(
                jsonPayload,
                new TypeReference<Map<String, Object>>() {}
            );
            String event = (String) parsed.get("event");
            String style = (String) parsed.get("style");
            @SuppressWarnings("unchecked")
            List<String> colorPalette = (List<String>) parsed.get("colorPalette");
            String weather = (String) parsed.get("weather");
            String mood = (String) parsed.get("mood");
            return new GenerateOutfitRequest(event, style, colorPalette, weather, mood, null);
        } catch (Exception e) {
            log.warn("Failed to parse [GENERATE_OUTFIT] JSON payload (length={}): {}", jsonPayload.length(), e.getClass().getSimpleName());
            return null;
        }
    }

    List<String> extractSuggestions(String aiResponse) {
        Matcher matcher = SUGGESTIONS_PATTERN.matcher(aiResponse);
        if (!matcher.find()) {
            return List.of();
        }
        String jsonArray = matcher.group(1).trim();
        try {
            List<String> raw = objectMapper.readValue(jsonArray, new TypeReference<List<String>>() {});
            return raw.stream()
                .filter(s -> s != null && !s.isBlank())
                .map(String::trim)
                .map(s -> s.length() > 100 ? s.substring(0, 100) : s)
                .limit(3)
                .toList();
        } catch (Exception e) {
            log.warn("Failed to parse [SUGGESTIONS] JSON array (length={}): {}", jsonArray.length(), e.getClass().getSimpleName());
            return List.of();
        }
    }

    List<String> generateFallbackSuggestions(int messageCount) {
        int step = messageCount / 2;
        return switch (step) {
            case 0 -> List.of("Date night", "Casual weekend", "Work event");
            case 1 -> List.of("Formal and elegant", "Smart casual", "Something trendy");
            case 2 -> List.of("Classic style", "Modern minimalist", "Bold and edgy");
            case 3 -> List.of("Warm earth tones", "Cool blues", "Neutral palette");
            case 4 -> List.of("Under $200", "No budget limit", "Let's build the outfit!");
            default -> List.of("Yes, generate my outfit!", "Tweak a few things", "Tell me more");
        };
    }

    String stripSuggestionMarkers(String text) {
        return SUGGESTIONS_PATTERN.matcher(text).replaceAll("").trim();
    }
}
