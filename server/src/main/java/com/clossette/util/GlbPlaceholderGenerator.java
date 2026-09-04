package com.clossette.util;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Generates minimal valid GLB (glTF 2.0 binary) files for seed data.
 * Mirrors the logic in worker/providers/stub_generator.py.
 */
public final class GlbPlaceholderGenerator {

    private static final int GLB_HEADER_SIZE = 12;
    private static final int CHUNK_HEADER_SIZE = 8;
    private static final int GLB_VERSION = 2;
    private static final int JSON_CHUNK_TYPE = 0x4E4F534A; // "JSON" as little-endian uint32

    private GlbPlaceholderGenerator() {}

    /**
     * Returns a category-specific color hex string embedded in the GLB extras,
     * making it easier to visually distinguish categories in the 3D viewer.
     */
    static String colorForCategory(String category) {
        if (category == null) return "808080";
        return switch (category) {
            case "Tops"        -> "4A90D9"; // blue
            case "Bottoms"     -> "2ECC71"; // green
            case "Dresses"     -> "E91E8C"; // pink
            case "Outerwear"   -> "8B4513"; // brown
            case "Shoes"       -> "FF6B35"; // orange
            case "Accessories" -> "9B59B6"; // purple
            case "Bags"        -> "F39C12"; // amber
            case "Jewelry"     -> "FFD700"; // gold
            default            -> "808080"; // grey fallback
        };
    }

    /**
     * Generate a minimal valid GLB file with an empty scene, tagged with category metadata.
     * The category and color are stored in asset.extras for viewer inspection.
     */
    public static byte[] generateMinimalGlb(String category) {
        String color = colorForCategory(category);
        String safeCategory = (category != null) ? category.replace("\"", "") : "unknown";
        String json = "{\"asset\":{\"version\":\"2.0\",\"generator\":\"clossette-seed\","
                + "\"extras\":{\"category\":\"" + safeCategory + "\",\"color\":\"#" + color + "\"}},"
                + "\"scene\":0,\"scenes\":[{\"nodes\":[]}]}";
        byte[] sceneJson = json.getBytes(StandardCharsets.UTF_8);

        // Pad JSON to 4-byte alignment (GLB spec requires it, pad with spaces)
        int padding = (4 - sceneJson.length % 4) % 4;
        byte[] paddedJson = new byte[sceneJson.length + padding];
        System.arraycopy(sceneJson, 0, paddedJson, 0, sceneJson.length);
        for (int i = sceneJson.length; i < paddedJson.length; i++) {
            paddedJson[i] = ' ';
        }

        int totalLength = GLB_HEADER_SIZE + CHUNK_HEADER_SIZE + paddedJson.length;

        ByteBuffer buffer = ByteBuffer.allocate(totalLength).order(ByteOrder.LITTLE_ENDIAN);

        // GLB header: magic(4) + version(4) + length(4)
        buffer.put("glTF".getBytes(StandardCharsets.US_ASCII));
        buffer.putInt(GLB_VERSION);
        buffer.putInt(totalLength);

        // JSON chunk: chunkLength(4) + chunkType(4) + data
        buffer.putInt(paddedJson.length);
        buffer.putInt(JSON_CHUNK_TYPE);
        buffer.put(paddedJson);

        return buffer.array();
    }

    /**
     * Generate a minimal valid GLB file with an empty scene (no category metadata).
     */
    public static byte[] generateMinimalGlb() {
        return generateMinimalGlb(null);
    }

    /**
     * Write a category-tagged placeholder GLB file to the given path,
     * creating parent directories if needed.
     * Returns false if the write fails (non-fatal for seeding).
     */
    public static boolean writeGlbFile(Path outputPath, String category) {
        try {
            Files.createDirectories(outputPath.getParent());
            Files.write(outputPath, generateMinimalGlb(category));
            return true;
        } catch (IOException e) {
            System.err.println("Warning: could not write placeholder GLB to " + outputPath + ": " + e.getMessage());
            return false;
        }
    }

    /**
     * Write a placeholder GLB file to the given path, creating parent directories if needed.
     * Returns false if the write fails (non-fatal for seeding).
     */
    public static boolean writeGlbFile(Path outputPath) {
        return writeGlbFile(outputPath, null);
    }
}
