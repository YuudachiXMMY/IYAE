package com.iyae.controller;

import com.iyae.dto.*;
import com.iyae.entity.enums.PostStatus;
import com.iyae.entity.enums.ReportStatus;
import com.iyae.service.PostService;
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
import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PostController.class)
@Import(WebMvcSecurityConfig.class)
class PostControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    PostService postService;

    private PostResponse samplePost() {
        return new PostResponse(
                1L, 1L, "testuser",
                "Hello world", Collections.emptyList(),
                PostStatus.ACTIVE, 0L, 0L, false, Instant.now()
        );
    }

    private PagedResponse<PostResponse> pagedPosts() {
        return new PagedResponse<>(List.of(samplePost()), 0, 20, 1L, 1, true);
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void createPost_authenticated_returns201() throws Exception {
        when(postService.createPost(eq("test@example.com"), any())).thenReturn(samplePost());

        String body = objectMapper.writeValueAsString(new PostRequest("Hello world", null));

        mockMvc.perform(post("/api/posts")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.content").value("Hello world"));
    }

    @Test
    void createPost_unauthenticated_returns403() throws Exception {
        String body = objectMapper.writeValueAsString(new PostRequest("Hello world", null));

        mockMvc.perform(post("/api/posts")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getFeed_authenticated_returns200() throws Exception {
        when(postService.getFeed(eq("discover"), eq("test@example.com"), eq(0), eq(20)))
                .thenReturn(pagedPosts());

        mockMvc.perform(get("/api/posts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getFeed_withFeedParam_passesFeedType() throws Exception {
        when(postService.getFeed(eq("toronto"), eq("test@example.com"), eq(0), eq(20)))
                .thenReturn(pagedPosts());

        mockMvc.perform(get("/api/posts").param("feed", "toronto"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getFeed_withPaginationParams_returns200() throws Exception {
        when(postService.getFeed(eq("discover"), anyString(), eq(1), eq(10))).thenReturn(
                new PagedResponse<>(Collections.emptyList(), 1, 10, 0L, 0, true));

        mockMvc.perform(get("/api/posts").param("page", "1").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(1));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void getComments_authenticated_returns200() throws Exception {
        CommentResponse comment = new CommentResponse(10L, 1L, 1L, "testuser", null, "Nice", Instant.now());
        when(postService.getComments(eq(1L), eq(0), eq(20)))
                .thenReturn(new PagedResponse<>(List.of(comment), 0, 20, 1L, 1, true));

        mockMvc.perform(get("/api/posts/1/comments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].content").value("Nice"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void report_authenticated_returns201() throws Exception {
        PostReportResponse report = new PostReportResponse(
                5L, 1L, 1L, "testuser", "spam", ReportStatus.OPEN, Instant.now());
        when(postService.reportPost(eq(1L), eq("test@example.com"), eq("spam"))).thenReturn(report);

        String body = objectMapper.writeValueAsString(new PostReportRequest("spam"));

        mockMvc.perform(post("/api/posts/1/report")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("OPEN"));
    }

    @Test
    void report_unauthenticated_returns403() throws Exception {
        String body = objectMapper.writeValueAsString(new PostReportRequest("spam"));

        mockMvc.perform(post("/api/posts/1/report")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void toggleLike_authenticated_returns200() throws Exception {
        when(postService.toggleLike(eq(1L), eq("test@example.com"))).thenReturn(samplePost());

        mockMvc.perform(post("/api/posts/1/like")
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void addComment_authenticated_returns201() throws Exception {
        CommentResponse comment = new CommentResponse(
                10L, 1L, 1L, "testuser", null, "Nice post!", Instant.now());
        when(postService.addComment(eq(1L), eq("test@example.com"), any())).thenReturn(comment);

        String body = objectMapper.writeValueAsString(new CommentRequest("Nice post!", null));

        mockMvc.perform(post("/api/posts/1/comments")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.content").value("Nice post!"));
    }

    @Test
    @WithMockUser(username = "test@example.com")
    void deletePost_authenticated_returns204() throws Exception {
        doNothing().when(postService).softDelete(eq(1L), eq("test@example.com"));

        mockMvc.perform(delete("/api/posts/1")
                        .with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    void deletePost_unauthenticated_returns403() throws Exception {
        mockMvc.perform(delete("/api/posts/1")
                        .with(csrf()))
                .andExpect(status().isForbidden());
    }
}
