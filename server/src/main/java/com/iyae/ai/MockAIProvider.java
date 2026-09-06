package com.iyae.ai;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class MockAIProvider implements AIProvider {

    private static final String OUTFIT_RESPONSE =
        "Done — here's the look I'd actually put you in.\n\n" +
        "[GENERATE_OUTFIT]{\"event\":\"dinner date\",\"style\":\"elegant\",\"colorPalette\":[\"black\",\"gold\"],\"weather\":\"cold, light snow\",\"mood\":\"confident\"}[/GENERATE_OUTFIT]";

    private static final List<String> STEP_RESPONSES = List.of(
        "Hey, I'm your IYAE stylist. Tell me what you're dressing for and I'll pull together one look worth keeping." +
        "\n\n[SUGGESTIONS][\"Date night\",\"Help me figure it out\",\"Surprise me!\"][/SUGGESTIONS]",
        "Love it. Give me the vibe — are we going polished, easygoing, or somewhere in the middle?" +
        "\n\n[SUGGESTIONS][\"Formal and elegant\",\"Smart casual\",\"Skip ahead to styles\"][/SUGGESTIONS]",
        "Got it. My instinct is clean lines with one confident detail — does that sound like you, or should we go bolder?" +
        "\n\n[SUGGESTIONS][\"Classic elegance\",\"Bold and expressive\",\"Show me what's trending\"][/SUGGESTIONS]",
        "Good call. Any colors you reach for — or ones you'd rather skip? I'll build around it." +
        "\n\n[SUGGESTIONS][\"Warm earth tones\",\"Cool blues and greens\",\"You pick for me\"][/SUGGESTIONS]",
        "Noted. It's chilly out there today, so I'll plan for warmth without losing the shape. Anything else — budget or dress code?" +
        "\n\n[SUGGESTIONS][\"Under $200\",\"No constraints\",\"Let's build the outfit!\"][/SUGGESTIONS]",
        "I've got a clear picture now — elegant, weather-smart, and unmistakably you. Want me to put the full look together?" +
        "\n\n[SUGGESTIONS][\"Yes, sketch it out!\",\"Tweak a few things\",\"Generate my outfit now!\"][/SUGGESTIONS]",
        "Say the word and I'll finalize it — one decisive look, no second-guessing." +
        "\n\n[SUGGESTIONS][\"Yes, put it together!\",\"Swap the shoes\",\"Add an accessory\"][/SUGGESTIONS]"
    );

    @Override
    public String sendMessage(String systemPrompt, List<Map<String, String>> messages) {
        if (messages.size() >= 10) {
            return OUTFIT_RESPONSE;
        }
        int step = Math.min(messages.size() / 2, STEP_RESPONSES.size() - 1);
        return STEP_RESPONSES.get(step);
    }

    @Override
    public String healthCheck() {
        return "UP";
    }
}
