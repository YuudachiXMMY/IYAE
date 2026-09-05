package com.iyae.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
class FileStorageServiceTest {

    @InjectMocks
    FileStorageService fileStorageService;

    @Test
    void storeImage_emptyFile_throwsIllegalArgumentException() {
        MockMultipartFile empty = new MockMultipartFile("file", "photo.jpg", "image/jpeg", new byte[0]);

        assertThatThrownBy(() -> fileStorageService.storeImage(empty))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("empty");
    }

    @Test
    void storeImage_nullFile_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> fileStorageService.storeImage(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("empty");
    }

    @Test
    void storeImage_unsupportedContentType_throwsIllegalArgumentException() {
        MockMultipartFile gif = new MockMultipartFile("file", "anim.gif", "image/gif", new byte[]{1, 2, 3});

        assertThatThrownBy(() -> fileStorageService.storeImage(gif))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("JPEG, PNG, and WebP");
    }

    @Test
    void storeImage_fileTooLarge_throwsIllegalArgumentException() {
        byte[] oversized = new byte[11 * 1024 * 1024]; // 11 MB
        MockMultipartFile big = new MockMultipartFile("file", "big.jpg", "image/jpeg", oversized);

        assertThatThrownBy(() -> fileStorageService.storeImage(big))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("10 MB");
    }

    @Test
    void storeImage_allowedContentTypes_acceptsJpegPngWebp() {
        // Validates that accepted content types are not rejected before reaching IO
        String[] accepted = {"image/jpeg", "image/png", "image/webp"};
        for (String contentType : accepted) {
            byte[] content = new byte[]{1, 2, 3};
            MockMultipartFile file = new MockMultipartFile("file", "img." + contentType.split("/")[1],
                    contentType, content);
            // Should not throw IllegalArgumentException for unsupported type
            // (may throw IllegalStateException from IO, which is acceptable)
            try {
                fileStorageService.storeImage(file);
            } catch (IllegalStateException e) {
                // IO failure is expected in test environment — content type was accepted
            } catch (IllegalArgumentException e) {
                throw new AssertionError("Content type " + contentType + " should be accepted but was rejected: " + e.getMessage());
            }
        }
    }
}
