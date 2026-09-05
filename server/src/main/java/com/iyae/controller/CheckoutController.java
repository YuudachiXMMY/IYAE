package com.iyae.controller;

import com.iyae.dto.ErrorResponse;
import com.iyae.repository.UserRepository;
import com.iyae.service.CheckoutService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/checkout")
@RequiredArgsConstructor
public class CheckoutController {

    private final UserRepository userRepository;
    private final CheckoutService checkoutService;

    @Value("${app.auth.require-email-verification:true}")
    private boolean requireEmailVerification;

    @PostMapping
    public ResponseEntity<?> checkout(Authentication authentication) {
        String email = authentication.getName();
        boolean verified = userRepository.findByEmail(email)
                .map(u -> Boolean.TRUE.equals(u.getEmailVerified()))
                .orElse(false);
        if (requireEmailVerification && !verified) {
            return ResponseEntity.status(403).body(
                    new ErrorResponse("Please verify your email before checkout", 403, Instant.now()));
        }
        Map<String, String> result = checkoutService.initiateCheckout(email);
        return ResponseEntity.ok(result);
    }
}
