package com.clossette.service;

import com.clossette.dto.UploadResponse;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final String UPLOAD_DIR = "/var/clossette/assets/uploads/products";
    private static final String URL_PREFIX = "/uploads/products/";
    private static final long MAX_SIZE_BYTES = 10L * 1024 * 1024; // 10 MB
    private static final Map<String, String> ALLOWED_TYPES = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp"
    );

    public UploadResponse storeImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File must not be empty");
        }

        String contentType = file.getContentType();
        String extension = ALLOWED_TYPES.get(contentType);
        if (extension == null) {
            throw new IllegalArgumentException("Only JPEG, PNG, and WebP images are accepted");
        }

        if (file.getSize() > MAX_SIZE_BYTES) {
            throw new IllegalArgumentException("File size exceeds the 10 MB limit");
        }

        String filename = UUID.randomUUID() + extension;
        Path uploadDir = Paths.get(UPLOAD_DIR);

        try {
            Files.createDirectories(uploadDir);

            Path tempFile = uploadDir.resolve(filename + ".tmp");
            try (InputStream inputStream = file.getInputStream()) {
                Files.copy(inputStream, tempFile, StandardCopyOption.REPLACE_EXISTING);
            }

            Path targetFile = uploadDir.resolve(filename);
            Files.move(tempFile, targetFile, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);

            String url = URL_PREFIX + filename;
            return new UploadResponse(url, file.getOriginalFilename(), file.getSize(), contentType);

        } catch (IOException e) {
            throw new IllegalStateException("Failed to store uploaded file", e);
        }
    }
}
