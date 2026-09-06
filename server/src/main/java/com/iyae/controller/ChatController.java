package com.iyae.controller;

import com.iyae.dto.ChatMessageRequest;
import com.iyae.dto.ChatMessageResponse;
import com.iyae.dto.ChatSessionResponse;
import com.iyae.dto.WeatherResponse;
import com.iyae.service.ChatService;
import com.iyae.service.WeatherService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final WeatherService weatherService;

    @GetMapping("/weather")
    public ResponseEntity<WeatherResponse> getWeather() {
        WeatherResponse response = weatherService.getCurrentToronto()
            .map(w -> new WeatherResponse(w.temperatureC(), w.feelsLikeC(), w.condition(), true))
            .orElse(new WeatherResponse(null, null, null, false));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/sessions")
    public ResponseEntity<ChatSessionResponse> createSession(Authentication authentication) {
        ChatSessionResponse response = chatService.createSession(authentication.getName());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<ChatSessionResponse>> listSessions(Authentication authentication) {
        List<ChatSessionResponse> sessions = chatService.listSessions(authentication.getName());
        return ResponseEntity.ok(sessions);
    }

    @PostMapping("/sessions/{id}/messages")
    public ResponseEntity<ChatMessageResponse> sendMessage(
        @PathVariable Long id,
        @Valid @RequestBody ChatMessageRequest request,
        Authentication authentication
    ) {
        ChatMessageResponse response = chatService.sendMessage(id, authentication.getName(), request.content());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/sessions/{id}/messages")
    public ResponseEntity<List<ChatMessageResponse>> getMessages(
        @PathVariable Long id,
        Authentication authentication
    ) {
        List<ChatMessageResponse> messages = chatService.getMessages(id, authentication.getName());
        return ResponseEntity.ok(messages);
    }
}
