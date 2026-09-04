"""Stub generator that creates placeholder GLB files for testing."""
import os
import struct
import json
import time
import logging

logger = logging.getLogger(__name__)


def create_minimal_glb() -> bytes:
    """Create a minimal valid GLB file with empty scene."""
    scene_json = json.dumps({
        "asset": {"version": "2.0", "generator": "clossette-stub"},
        "scene": 0,
        "scenes": [{"nodes": []}],
    }).encode("utf-8")
    # Pad JSON to 4-byte alignment
    padding = (4 - len(scene_json) % 4) % 4
    scene_json += b" " * padding

    # GLB header: magic(4) + version(4) + length(4)
    # Chunk 0 (JSON): length(4) + type(4) + data
    json_chunk_length = len(scene_json)
    total_length = 12 + 8 + json_chunk_length  # header + chunk header + data

    header = struct.pack("<4sII", b"glTF", 2, total_length)
    json_chunk_header = struct.pack("<II", json_chunk_length, 0x4E4F534A)  # "JSON"

    return header + json_chunk_header + scene_json


class StubGenerator:
    """Generates placeholder GLB/USDZ files for development."""

    def __init__(self, output_base_dir: str = "/var/clossette/assets"):
        self.output_base_dir = output_base_dir

    def generate(self, task_id: int, product_id: int, input_payload: dict | None) -> dict:
        """Generate stub 3D model files."""
        start_time = time.time()

        # Create output directory
        output_dir = os.path.join(
            self.output_base_dir, f"products/{product_id}/tasks/{task_id}"
        )
        os.makedirs(output_dir, exist_ok=True)

        # Generate GLB
        glb_path = os.path.join(output_dir, "preview.glb")
        glb_data = create_minimal_glb()
        with open(glb_path, "wb") as f:
            f.write(glb_data)

        # Generate USDZ (empty placeholder)
        usdz_path = os.path.join(output_dir, "preview.usdz")
        with open(usdz_path, "wb") as f:
            f.write(b"PLACEHOLDER_USDZ")  # Not a real USDZ, just non-empty

        elapsed_ms = int((time.time() - start_time) * 1000)

        return {
            "schemaVersion": 1,
            "provider_used": "STUB",
            "provider_request_id": None,
            "glb_path": f"products/{product_id}/tasks/{task_id}/preview.glb",
            "usdz_path": f"products/{product_id}/tasks/{task_id}/preview.usdz",
            "triangle_count": 0,
            "bbox": {"min": [0, 0, 0], "max": [0.5, 1.0, 0.5]},
            "sanity": {
                "glb_size_bytes": len(glb_data),
                "has_nan_vertices": False,
            },
            "elapsed_ms": elapsed_ms,
            "glb_url": f"/assets/products/{product_id}/tasks/{task_id}/preview.glb",
            "usdz_url": f"/assets/products/{product_id}/tasks/{task_id}/preview.usdz",
        }
