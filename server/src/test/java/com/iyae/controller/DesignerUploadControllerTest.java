package com.iyae.controller;

import com.iyae.dto.UploadResponse;
import com.iyae.entity.User;
import com.iyae.entity.enums.Role;
import com.iyae.repository.UserRepository;
import com.iyae.service.FileStorageService;
import com.iyae.testsupport.WebMvcSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DesignerUploadController.class)
@Import(WebMvcSecurityConfig.class)
class DesignerUploadControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    FileStorageService fileStorageService;

    @MockBean
    UserRepository userRepository;

    private User designerUser() {
        User user = new User();
        user.setId(1L);
        user.setEmail("designer@example.com");
        user.setRole(Role.DESIGNER);
        return user;
    }

    private User buyerUser() {
        User user = new User();
        user.setId(2L);
        user.setEmail("buyer@example.com");
        user.setRole(Role.BUYER);
        return user;
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void uploadImage_designerRole_returns200() throws Exception {
        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser()));
        when(fileStorageService.storeImage(any())).thenReturn(
                new UploadResponse("/uploads/img.jpg", "img.jpg", 1024L, "image/jpeg"));

        MockMultipartFile file = new MockMultipartFile(
                "file", "img.jpg", "image/jpeg", "fake-image-content".getBytes());

        mockMvc.perform(multipart("/api/designer/products/upload/image")
                        .file(file)
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("/uploads/img.jpg"));
    }

    private User adminUser() {
        User user = new User();
        user.setId(3L);
        user.setEmail("ops@iyae.ca");
        user.setRole(Role.ADMIN);
        return user;
    }

    @Test
    @WithMockUser(username = "ops@iyae.ca", roles = "ADMIN")
    void uploadImage_adminRole_returns200() throws Exception {
        // B-11. This controller carries its own role check on top of the SecurityConfig matcher.
        // While the matcher was hasRole("DESIGNER") that check was unreachable — the matcher
        // rejected BUYER first — so widening the matcher alone would have left this the one thing
        // rejecting ADMIN: the operator could create a product and then not upload its image.
        // Both now read Role.canManageCatalog().
        when(userRepository.findByEmail("ops@iyae.ca")).thenReturn(Optional.of(adminUser()));
        when(fileStorageService.storeImage(any())).thenReturn(
                new UploadResponse("/uploads/img.jpg", "img.jpg", 1024L, "image/jpeg"));

        MockMultipartFile file = new MockMultipartFile(
                "file", "img.jpg", "image/jpeg", "fake-image-content".getBytes());

        mockMvc.perform(multipart("/api/designer/products/upload/image")
                        .file(file)
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value("/uploads/img.jpg"));
    }

    @Test
    @WithMockUser(username = "buyer@example.com", roles = "BUYER")
    void uploadImage_buyerRole_returns403() throws Exception {
        when(userRepository.findByEmail("buyer@example.com")).thenReturn(Optional.of(buyerUser()));

        MockMultipartFile file = new MockMultipartFile(
                "file", "img.jpg", "image/jpeg", "fake-image-content".getBytes());

        mockMvc.perform(multipart("/api/designer/products/upload/image")
                        .file(file)
                        .with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    void uploadImage_unauthenticated_returns401() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "img.jpg", "image/jpeg", "fake-image-content".getBytes());

        mockMvc.perform(multipart("/api/designer/products/upload/image")
                        .file(file)
                        .with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void uploadImage_serviceThrowsIllegalArgument_returns400() throws Exception {
        when(userRepository.findByEmail("designer@example.com")).thenReturn(Optional.of(designerUser()));
        when(fileStorageService.storeImage(any()))
                .thenThrow(new IllegalArgumentException("Unsupported file type"));

        MockMultipartFile file = new MockMultipartFile(
                "file", "doc.pdf", "application/pdf", "fake-pdf-content".getBytes());

        mockMvc.perform(multipart("/api/designer/products/upload/image")
                        .file(file)
                        .with(csrf()))
                .andExpect(status().isBadRequest());
    }
}
