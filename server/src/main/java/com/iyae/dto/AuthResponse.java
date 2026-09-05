package com.iyae.dto;

public record AuthResponse(
    String token,
    UserResponse user
) {}
