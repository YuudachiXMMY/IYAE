package com.iyae.controller;

import com.iyae.dto.AvatarResponse;
import com.iyae.dto.AvatarStatusResponse;
import com.iyae.service.AvatarService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
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

    /**
     * Streams the caller's own generated body scan.
     *
     * <p>This is the only way a body scan is reachable. It used to be a static file at
     * {@code /assets/avatars/{userId}/avatar.glb}, served by nginx and by Spring's resource
     * handler with no authentication and a sequential integer in the path — so every user's 3D
     * body mesh, derived from their measurements, was downloadable by anyone who could count.
     *
     * <p>There is no id parameter by design: the file is resolved from the authenticated
     * principal, so there is nothing to enumerate and no ownership check to get wrong.
     */
    @GetMapping("/model")
    public ResponseEntity<Resource> model(Authentication auth) {
        Resource glb = avatarService.openOwnAvatarModel(auth.getName());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("model/gltf-binary"))
                // Personal data: never store it in a shared or intermediary cache.
                .cacheControl(CacheControl.noStore().cachePrivate())
                .body(glb);
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteAvatarData(Authentication auth) {
        avatarService.deleteAvatarData(auth.getName());
        return ResponseEntity.noContent().build();
    }
}
