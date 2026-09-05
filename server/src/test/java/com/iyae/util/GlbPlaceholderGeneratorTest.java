package com.iyae.util;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class GlbPlaceholderGeneratorTest {

    @Test
    void generateMinimalGlb_hasCorrectMagicHeader() {
        byte[] glb = GlbPlaceholderGenerator.generateMinimalGlb();

        assertThat(glb.length).isGreaterThan(12);
        assertThat(new String(glb, 0, 4)).isEqualTo("glTF");
    }

    @Test
    void generateMinimalGlb_hasVersion2() {
        byte[] glb = GlbPlaceholderGenerator.generateMinimalGlb();

        int version = ByteBuffer.wrap(glb, 4, 4).order(ByteOrder.LITTLE_ENDIAN).getInt();
        assertThat(version).isEqualTo(2);
    }

    @Test
    void generateMinimalGlb_totalLengthMatchesArraySize() {
        byte[] glb = GlbPlaceholderGenerator.generateMinimalGlb();

        int totalLength = ByteBuffer.wrap(glb, 8, 4).order(ByteOrder.LITTLE_ENDIAN).getInt();
        assertThat(totalLength).isEqualTo(glb.length);
    }

    @Test
    void writeGlbFile_createsFileWithCorrectContent(@TempDir Path tempDir) {
        Path output = tempDir.resolve("test.glb");

        boolean success = GlbPlaceholderGenerator.writeGlbFile(output);

        assertThat(success).isTrue();
        assertThat(output).exists();
        assertThat(output.toFile().length()).isEqualTo(GlbPlaceholderGenerator.generateMinimalGlb().length);
    }

    @Test
    void writeGlbFile_createsParentDirectories(@TempDir Path tempDir) {
        Path output = tempDir.resolve("nested/deep/dir/model.glb");

        boolean success = GlbPlaceholderGenerator.writeGlbFile(output);

        assertThat(success).isTrue();
        assertThat(output).exists();
        assertThat(Files.isDirectory(tempDir.resolve("nested/deep/dir"))).isTrue();
    }
}
