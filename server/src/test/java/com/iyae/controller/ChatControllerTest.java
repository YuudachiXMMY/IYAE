package com.iyae.controller;

import com.iyae.dto.ChatMessageRequest;
import com.iyae.dto.ChatMessageResponse;
import com.iyae.dto.ChatSessionResponse;
import com.iyae.entity.enums.MessageRole;
import com.iyae.entity.enums.SessionStatus;
import com.iyae.repository.UserRepository;
import com.iyae.service.ChatService;
import com.iyae.testsupport.WebMvcSecurityConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ChatController.class)
@Import(WebMvcSecurityConfig.class)
class ChatControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    ChatService chatService;

    @MockBean
    UserRepository userRepository;

    private ChatSessionResponse sampleSession() {
        return new ChatSessionResponse(1L, SessionStatus.ACTIVE, Instant.now());
    }

    private ChatMessageResponse sampleMessage(String content) {
        return new ChatMessageResponse(
                10L, MessageRole.ASSISTANT, content, null, null, List.of("What style?"), Instant.now());
    }

    @Test
    @WithMockUser(username = "user@example.com")
    void createSession_authenticated_returns201() throws Exception {
        when(chatService.createSession("user@example.com")).thenReturn(sampleSession());

        mockMvc.perform(post("/api/chat/sessions")
                        .with(csrf()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    void createSession_unauthenticated_returns403() throws Exception {
        mockMvc.perform(post("/api/chat/sessions")
                        .with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "user@example.com")
    void listSessions_authenticated_returns200() throws Exception {
        when(chatService.listSessions("user@example.com")).thenReturn(List.of(sampleSession()));

        mockMvc.perform(get("/api/chat/sessions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    @WithMockUser(username = "user@example.com")
    void sendMessage_authenticated_returns201() throws Exception {
        when(chatService.sendMessage(eq(1L), eq("user@example.com"), eq("Hello stylist")))
                .thenReturn(sampleMessage("Here are some suggestions!"));

        String body = objectMapper.writeValueAsString(new ChatMessageRequest("Hello stylist"));

        mockMvc.perform(post("/api/chat/sessions/1/messages")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value("Here are some suggestions!"))
                .andExpect(jsonPath("$.role").value("ASSISTANT"));
    }

    @Test
    @WithMockUser(username = "user@example.com")
    void getMessages_authenticated_returns200() throws Exception {
        when(chatService.getMessages(eq(1L), eq("user@example.com")))
                .thenReturn(List.of(sampleMessage("Welcome!")));

        mockMvc.perform(get("/api/chat/sessions/1/messages"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].content").value("Welcome!"))
                .andExpect(jsonPath("$.length()").value(1));
    }
}
