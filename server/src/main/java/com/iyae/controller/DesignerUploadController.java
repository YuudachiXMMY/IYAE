package com.iyae.controller;

import com.iyae.dto.UploadResponse;
import com.iyae.entity.User;
import com.iyae.repository.UserRepository;
import com.iyae.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/designer/products")
@RequiredArgsConstructor
public class DesignerUploadController {

    private final FileStorageService fileStorageService;
    private final UserRepository userRepository;

    @PostMapping("/upload/image")
    public ResponseEntity<UploadResponse> uploadImage(
            @RequestParam("file") MultipartFile file,
            Authentication authentication
    ) {
        String email = authentication.getName();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + email));
        // Reads the same predicate as SecurityConfig's /api/designer/** matcher rather than
        // repeating its role list. Kept as defence in depth, but this used to be a narrower
        // literal than the matcher: unreachable while the matcher was stricter, and the one
        // thing rejecting ADMIN the moment it widened. See Role.canManageCatalog().
        if (!user.getRole().canManageCatalog()) {
            throw new AccessDeniedException("Only designers can upload images");
        }
        UploadResponse response = fileStorageService.storeImage(file);
        return ResponseEntity.ok(response);
    }
}
