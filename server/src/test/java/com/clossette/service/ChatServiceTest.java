package com.clossette.service;

import com.clossette.ai.AIProvider;
import com.clossette.ai.AIProviderException;
import com.clossette.ai.AIProviderFactory;
import com.clossette.dto.ChatMessageResponse;
import com.clossette.entity.ChatMessage;
import com.clossette.entity.ChatSession;
import com.clossette.entity.User;
import com.clossette.entity.enums.MessageRole;
import com.clossette.entity.enums.SessionStatus;
import com.clossette.repository.ChatMessageRepository;
import com.clossette.repository.ChatSessionRepository;
import com.clossette.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChatServiceTest {

    @Mock AIProviderFactory aiProviderFactory;
    @Mock AIProvider aiProvider;
    @Mock ChatSessionRepository chatSessionRepository;
    @Mock ChatMessageRepository chatMessageRepository;
    @Mock UserRepository userRepository;
    @Mock OutfitService outfitService;

    @InjectMocks
    ChatService chatService;

    private User user;
    private ChatSession session;

    @BeforeEach
    void setUp() {
        // ObjectMapper is not injectable via @Mock for @InjectMocks with constructor injection
        // Use reflection to inject a real ObjectMapper
        org.springframework.test.util.ReflectionTestUtils.setField(chatService, "objectMapper", new ObjectMapper());

        user = User.builder().id(1L).email("test@example.com").build();
        session = ChatSession.builder().id(10L).user(user).status(SessionStatus.ACTIVE).build();

        when(userRepository.findByEmail("test@example.com")).thenReturn(Optional.of(user));
        when(chatSessionRepository.findByIdAndUser(10L, user)).thenReturn(Optional.of(session));
        when(chatMessageRepository.findBySessionOrderByCreatedAtAsc(session)).thenReturn(Collections.emptyList());
        when(aiProviderFactory.getProvider()).thenReturn(aiProvider);

        // Default: save returns a message with an id
        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(inv -> {
            ChatMessage msg = inv.getArgument(0);
            return msg;
        });
    }

    @Test
    void sendMessage_whenAiProviderThrows_returnsFallbackResponse() {
        when(aiProvider.sendMessage(anyString(), anyList()))
            .thenThrow(new AIProviderException("Connection timeout"));

        ChatMessageResponse response = chatService.sendMessage(10L, "test@example.com", "Hello");

        assertThat(response.content()).contains("trouble connecting");
        assertThat(response.role()).isEqualTo(MessageRole.ASSISTANT);
        assertThat(response.outfit()).isNull();
    }

    @Test
    void sendMessage_whenAiProviderThrows_sessionRemainsActive() {
        when(aiProvider.sendMessage(anyString(), anyList()))
            .thenThrow(new AIProviderException("Service unavailable"));

        chatService.sendMessage(10L, "test@example.com", "Hello");

        assertThat(session.getStatus()).isEqualTo(SessionStatus.ACTIVE);
        verify(chatSessionRepository, never()).save(any(ChatSession.class));
    }

    @Test
    void sendMessage_normalResponse_savesAssistantMessage() {
        String aiText = "Here are some outfit ideas for you!";
        when(aiProvider.sendMessage(anyString(), anyList())).thenReturn(aiText);

        ArgumentCaptor<ChatMessage> captor = ArgumentCaptor.forClass(ChatMessage.class);

        ChatMessageResponse response = chatService.sendMessage(10L, "test@example.com", "I need a dress");

        verify(chatMessageRepository, atLeastOnce()).save(captor.capture());
        ChatMessage assistantMsg = captor.getAllValues().stream()
            .filter(m -> m.getRole() == MessageRole.ASSISTANT)
            .findFirst()
            .orElseThrow();

        assertThat(assistantMsg.getContent()).isEqualTo(aiText);
        assertThat(response.content()).isEqualTo(aiText);
    }

    @Test
    void sendMessage_whenAiProviderThrows_fallbackMessagePersistedToRepository() {
        when(aiProvider.sendMessage(anyString(), anyList()))
            .thenThrow(new AIProviderException("Timeout"));

        chatService.sendMessage(10L, "test@example.com", "Hi");

        ArgumentCaptor<ChatMessage> captor = ArgumentCaptor.forClass(ChatMessage.class);
        // 2 saves: user message + fallback assistant message
        verify(chatMessageRepository, times(2)).save(captor.capture());

        ChatMessage saved = captor.getAllValues().get(1);
        assertThat(saved.getRole()).isEqualTo(MessageRole.ASSISTANT);
        assertThat(saved.getContent()).contains("trouble connecting");
    }

    @Test
    void sendMessage_withSuggestions_extractsSuggestionsList() {
        String aiText = "Here are some ideas!\n\n[SUGGESTIONS][\"Option A\",\"Option B\",\"Option C\"][/SUGGESTIONS]";
        when(aiProvider.sendMessage(anyString(), anyList())).thenReturn(aiText);

        ChatMessageResponse response = chatService.sendMessage(10L, "test@example.com", "What should I wear?");

        assertThat(response.suggestions()).isNotNull();
        assertThat(response.suggestions()).hasSize(3);
        assertThat(response.suggestions()).containsExactly("Option A", "Option B", "Option C");
    }

    @Test
    void sendMessage_withoutSuggestions_returnsFallbackSuggestions() {
        String aiText = "Great choice! Let me help you find the perfect outfit.";
        when(aiProvider.sendMessage(anyString(), anyList())).thenReturn(aiText);

        ChatMessageResponse response = chatService.sendMessage(10L, "test@example.com", "Help me pick an outfit");

        assertThat(response.suggestions()).isNotNull();
        assertThat(response.suggestions()).isNotEmpty();
        assertThat(response.suggestions()).containsExactly("Date night", "Casual weekend", "Work event");
    }

    @Test
    void sendMessage_withSuggestions_stripsMarkersFromContent() {
        String aiText = "Here are some ideas!\n\n[SUGGESTIONS][\"Option A\",\"Option B\"][/SUGGESTIONS]";
        when(aiProvider.sendMessage(anyString(), anyList())).thenReturn(aiText);

        ArgumentCaptor<ChatMessage> captor = ArgumentCaptor.forClass(ChatMessage.class);

        chatService.sendMessage(10L, "test@example.com", "What should I wear?");

        verify(chatMessageRepository, atLeastOnce()).save(captor.capture());
        ChatMessage assistantMsg = captor.getAllValues().stream()
            .filter(m -> m.getRole() == MessageRole.ASSISTANT)
            .findFirst()
            .orElseThrow();

        assertThat(assistantMsg.getContent()).doesNotContain("[SUGGESTIONS]");
        assertThat(assistantMsg.getContent()).doesNotContain("[/SUGGESTIONS]");
        assertThat(assistantMsg.getContent()).contains("Here are some ideas!");
    }

    @Test
    void sendMessage_withMalformedSuggestions_returnsFallbackSuggestions() {
        String aiText = "Text [SUGGESTIONS]not valid json[/SUGGESTIONS]";
        when(aiProvider.sendMessage(anyString(), anyList())).thenReturn(aiText);

        ChatMessageResponse response = chatService.sendMessage(10L, "test@example.com", "Hello");

        assertThat(response.suggestions()).isNotNull();
        assertThat(response.suggestions()).isNotEmpty();
        assertThat(response.suggestions()).containsExactly("Date night", "Casual weekend", "Work event");
    }

    @Test
    void extractSuggestions_moreThanThree_truncatesToThree() {
        String input = "[SUGGESTIONS][\"A\",\"B\",\"C\",\"D\",\"E\"][/SUGGESTIONS]";
        List<String> result = chatService.extractSuggestions(input);
        assertThat(result).hasSize(3);
        assertThat(result).containsExactly("A", "B", "C");
    }

    @Test
    void extractSuggestions_longSuggestion_truncatesTo100Chars() {
        String longText = "A".repeat(150);
        String input = "[SUGGESTIONS][\"" + longText + "\"][/SUGGESTIONS]";
        List<String> result = chatService.extractSuggestions(input);
        assertThat(result).hasSize(1);
        assertThat(result.get(0)).hasSize(100);
    }

    @Test
    void extractSuggestions_blanksAndWhitespace_filtered() {
        String input = "[SUGGESTIONS][\"  Valid  \",\"  \",\"\",\"Another\"][/SUGGESTIONS]";
        List<String> result = chatService.extractSuggestions(input);
        assertThat(result).containsExactly("Valid", "Another");
    }
}
