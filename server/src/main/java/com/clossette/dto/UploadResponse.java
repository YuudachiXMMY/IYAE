package com.clossette.dto;

public record UploadResponse(
        String url,
        String originalFilename,
        long size,
        String contentType
) {}
