package com.iyae.controller;

import com.iyae.dto.GuestAvatarRequest;
import com.iyae.dto.GuestAvatarStatusResponse;
import com.iyae.service.GuestAvatarService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
}
