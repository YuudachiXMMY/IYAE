package com.iyae.controller;

import com.iyae.dto.GuestAvatarRequest;
import com.iyae.dto.GuestAvatarStatusResponse;
import com.iyae.service.GuestAvatarService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/public/avatar")
@RequiredArgsConstructor
public class GuestAvatarController {

    private final GuestAvatarService guestAvatarService;

    @PostMapping("/generate")
    public ResponseEntity<GuestAvatarStatusResponse> generate(
            @Valid @RequestBody GuestAvatarRequest request
    ) {
        return ResponseEntity.ok(guestAvatarService.generateForGuest(request));
    }

    @GetMapping("/status/{taskId}")
    public ResponseEntity<GuestAvatarStatusResponse> status(@PathVariable Long taskId) {
        return ResponseEntity.ok(guestAvatarService.getTaskStatus(taskId));
    }

    /**
     * Streams a guest avatar GLB. The counterpart of {@code GET /api/avatar/model} for visitors
     * with no account: the {@code /assets/avatars/**} subtree is no longer served statically, so
     * without this route the anonymous try-on flow had nothing to fetch.
     */
    @GetMapping("/model/{taskId}")
    public ResponseEntity<Resource> model(@PathVariable Long taskId) {
        Resource glb = guestAvatarService.openTaskModel(taskId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("model/gltf-binary"))
                // Body-shaped data, even if anonymous: keep it out of shared caches.
                .cacheControl(CacheControl.noStore().cachePrivate())
                .body(glb);
    }
}
