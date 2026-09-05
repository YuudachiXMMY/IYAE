package com.iyae.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record PostRequest(
    @NotBlank String content,
    List<String> mediaUrls
) {}
