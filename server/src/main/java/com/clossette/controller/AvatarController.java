package com.clossette.controller;

import com.clossette.dto.AvatarResponse;
import com.clossette.dto.AvatarStatusResponse;
import com.clossette.service.AvatarService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/avatar")
@RequiredArgsConstructor
public class AvatarController {

    private final AvatarService avatarService;

    @PostMapping("/generate")
    public ResponseEntity<AvatarStatusResponse> generate(Authentication auth) {
        AvatarStatusResponse response = avatarService.generateAvatar(auth.getName());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/status")
    public ResponseEntity<AvatarStatusResponse> status(Authentication auth) {
        AvatarStatusResponse response = avatarService.getStatus(auth.getName());
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<AvatarResponse> getAvatar(Authentication auth) {
        AvatarResponse response = avatarService.getAvatar(auth.getName());
        return ResponseEntity.ok(response);
    }
}
