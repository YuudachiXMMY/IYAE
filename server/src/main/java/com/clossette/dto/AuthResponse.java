package com.clossette.dto;

public record AuthResponse(
    String token,
    UserResponse user
) {}
