package com.iyae.dto;

public record UploadResponse(
        String url,
        String originalFilename,
        long size,
        String contentType
) {}
