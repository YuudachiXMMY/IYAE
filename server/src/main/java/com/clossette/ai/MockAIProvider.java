package com.clossette.ai;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class MockAIProvider implements AIProvider {

    private static final String OUTFIT_RESPONSE =
        "I've put together the perfect outfit for you!\n\n" +
        "[GENERATE_OUTFIT]{\"event\":\"dinner date\",\"style\":\"elegant\",\"colorPalette\":[\"black\",\"gold\"]}[/GENERATE_OUTFIT]";

    private static final List<String> STEP_RESPONSES = List.of(
        "Welcome to Clossette! I'm your personal AI stylist. What's the occasion you're dressing for?" +
        "\n\n[SUGGESTIONS][\"Date night\",\"Help me figure it out\",\"Surprise me!\"][/SUGGESTIONS]",
        "That sounds like a wonderful event! Tell me more about the vibe — is it formal, casual, or somewhere in between?" +
        "\n\n[SUGGESTIONS][\"Formal and elegant\",\"Smart casual\",\"Skip ahead to styles\"][/SUGGESTIONS]",
        "Great context! Now let's talk style. Do you lean toward classic elegance, modern minimalism, or something bold and expressive?" +
        "\n\n[SUGGESTIONS][\"Classic elegance\",\"Bold and expressive\",\"Show me what's trending\"][/SUGGESTIONS]",
        "Love that! Colors can really make an outfit. Do you have any favorite colors, or shades you'd like to avoid?" +
        "\n\n[SUGGESTIONS][\"Warm earth tones\",\"Cool blues and greens\",\"You pick for me\"][/SUGGESTIONS]",
        "Perfect. Any practical considerations — budget range, weather, or dress code requirements I should keep in mind?" +
        "\n\n[SUGGESTIONS][\"Under $200\",\"No constraints\",\"Let's build the outfit!\"][/SUGGESTIONS]",
        "I'm getting a clear picture of your ideal look. I'm thinking something chic yet comfortable — shall I sketch out an outfit direction for you?" +
        "\n\n[SUGGESTIONS][\"Yes, sketch it out!\",\"Tweak a few things\",\"Generate my outfit now!\"][/SUGGESTIONS]",
        "Based on everything you've shared, I have the perfect outfit in mind. Ready for me to put it all together?" +
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
