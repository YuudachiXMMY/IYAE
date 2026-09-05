package com.iyae.ai;

import java.util.List;
import java.util.Map;

public interface AIProvider {
    String sendMessage(String systemPrompt, List<Map<String, String>> messages);

    default String healthCheck() {
        return "UNKNOWN";
    }
}
