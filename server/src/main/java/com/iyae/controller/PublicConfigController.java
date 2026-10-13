package com.iyae.controller;

import com.iyae.dto.PublicConfigResponse;
import com.iyae.service.CheckoutService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Unauthenticated runtime configuration for the web client. Lives under {@code /api/public/**},
 * which {@code SecurityConfig} already permits, and exposes only booleans the UI needs to avoid
 * advertising features the server will refuse.
 */
@RestController
@RequestMapping("/api/public/config")
@RequiredArgsConstructor
public class PublicConfigController {

    private final CheckoutService checkoutService;

    @Value("${app.auth.require-email-verification:true}")
    private boolean requireEmailVerification;

    @GetMapping
    public PublicConfigResponse get() {
        return new PublicConfigResponse(checkoutService.isCheckoutEnabled(), requireEmailVerification);
    }
}
