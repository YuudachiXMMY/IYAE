package com.clossette.controller;

import com.clossette.dto.UploadResponse;
import com.clossette.entity.User;
import com.clossette.entity.enums.Role;
import com.clossette.repository.UserRepository;
import com.clossette.service.FileStorageService;
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
        if (user.getRole() != Role.DESIGNER) {
            throw new AccessDeniedException("Only designers can upload images");
        }
        UploadResponse response = fileStorageService.storeImage(file);
        return ResponseEntity.ok(response);
    }
}
