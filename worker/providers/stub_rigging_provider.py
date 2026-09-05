"""Stub rigging provider for development and testing.

Generates a minimal valid skinned GLB (box mesh + canonical skeleton) at the
rigged output path.  Returns a valid schemaVersion=2 payload so the rest of the
pipeline — including ``validate_rigged_glb()`` — can proceed normally.
"""
from __future__ import annotations

import json
import logging
import os
import struct
import time

from providers.canonical_skeleton import (
    SMPLX_JOINT_NAMES,
    SMPLX_PARENT_INDICES,
)

logger = logging.getLogger(__name__)

# Body joints only (indices 0-21): covers TOP (14), BOTTOM (9), DRESS (5 core).
_BODY_JOINT_NAMES = SMPLX_JOINT_NAMES[:22]
_BODY_PARENT_INDICES = SMPLX_PARENT_INDICES[:22]
_NUM_BODY_JOINTS = len(_BODY_JOINT_NAMES)


def _create_stub_skinned_glb() -> bytes:
    """Create a minimal valid skinned GLB with a box mesh and canonical skeleton.

    The GLB contains:
    - 8-vertex box mesh (0.4m × 1.7m × 0.25m)
    - 22 body joints from the SMPL-X skeleton (covers all slot_hints)
    - JOINTS_0 / WEIGHTS_0 attributes (all vertices bound to pelvis)
    - Skin with inverseBindMatrices (identity)

    Returns:
        Raw GLB bytes ready to write to disk.
    """
    j = _NUM_BODY_JOINTS  # 22
    v = 8   # vertices
    f_count = 36  # index count (12 triangles × 3)

    # --- Vertex positions (box: 0.4m wide, 1.7m tall, 0.25m deep) ---
    positions = [
        -0.2, 0.0, -0.125,   0.2, 0.0, -0.125,
         0.2, 1.7, -0.125,  -0.2, 1.7, -0.125,
        -0.2, 0.0,  0.125,   0.2, 0.0,  0.125,
         0.2, 1.7,  0.125,  -0.2, 1.7,  0.125,
    ]
    triangles = [
        4, 5, 6,  4, 6, 7,   # front
        1, 0, 3,  1, 3, 2,   # back
        0, 4, 7,  0, 7, 3,   # left
        5, 1, 2,  5, 2, 6,   # right
        7, 6, 2,  7, 2, 3,   # top
        0, 1, 5,  0, 5, 4,   # bottom
    ]
    # All verts bound to joint 0 (pelvis) with weight 1.0
    joints0 = [0, 0, 0, 0] * v
    weights0 = [1.0, 0.0, 0.0, 0.0] * v
    # Identity inverse-bind matrices (flat list of 16 floats per joint)
    ibm_flat: list[float] = []
    for _ in range(j):
        ibm_flat.extend([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])

    # --- Pack binary blobs ---
    pos_bytes = struct.pack(f"<{len(positions)}f", *positions)  # 96
    ji_bytes = struct.pack(f"<{len(joints0)}B", *joints0)       # 32
    jw_bytes = struct.pack(f"<{len(weights0)}f", *weights0)     # 128
    idx_bytes = struct.pack(f"<{f_count}H", *triangles)         # 72
    ibm_bytes = struct.pack(f"<{len(ibm_flat)}f", *ibm_flat)   # 1408

    bin_data = pos_bytes + ji_bytes + jw_bytes + idx_bytes + ibm_bytes

    # --- Joint node hierarchy ---
    children_map: dict[int, list[int]] = {i: [] for i in range(j)}
    roots: list[int] = []
    for i, p in enumerate(_BODY_PARENT_INDICES):
        if p == -1:
            roots.append(i)
        else:
            children_map[p].append(i)

    nodes: list[dict] = []
    for i in range(j):
        node: dict = {"name": _BODY_JOINT_NAMES[i]}
        if children_map[i]:
            node["children"] = children_map[i]
        nodes.append(node)

    # Mesh node (appended after joint nodes)
    mesh_node_idx = j
    nodes.append({"name": "mesh", "mesh": 0, "skin": 0})

    # --- Buffer view offsets ---
    off_pos = 0
    off_ji = off_pos + len(pos_bytes)
    off_jw = off_ji + len(ji_bytes)
    off_idx = off_jw + len(jw_bytes)
    off_ibm = off_idx + len(idx_bytes)

    scene_json = json.dumps(
        {
            "asset": {"version": "2.0", "generator": "iyae-stub-rigging"},
            "scene": 0,
            "scenes": [{"nodes": [mesh_node_idx] + roots}],
            "nodes": nodes,
            "buffers": [{"byteLength": len(bin_data)}],
            "bufferViews": [
                {"buffer": 0, "byteOffset": off_pos, "byteLength": len(pos_bytes), "target": 34962},
                {"buffer": 0, "byteOffset": off_ji, "byteLength": len(ji_bytes), "target": 34962},
                {"buffer": 0, "byteOffset": off_jw, "byteLength": len(jw_bytes), "target": 34962},
                {"buffer": 0, "byteOffset": off_idx, "byteLength": len(idx_bytes), "target": 34963},
                {"buffer": 0, "byteOffset": off_ibm, "byteLength": len(ibm_bytes)},
            ],
            "accessors": [
                {"bufferView": 0, "componentType": 5126, "count": v, "type": "VEC3",
                 "min": [-0.2, 0.0, -0.125], "max": [0.2, 1.7, 0.125]},
                {"bufferView": 1, "componentType": 5121, "count": v, "type": "VEC4"},
                {"bufferView": 2, "componentType": 5126, "count": v, "type": "VEC4"},
                {"bufferView": 3, "componentType": 5123, "count": f_count, "type": "SCALAR"},
                {"bufferView": 4, "componentType": 5126, "count": j, "type": "MAT4"},
            ],
            "meshes": [{
                "name": "stub_garment",
                "primitives": [{
                    "attributes": {"POSITION": 0, "JOINTS_0": 1, "WEIGHTS_0": 2},
                    "indices": 3,
                    "mode": 4,
                }],
            }],
            "skins": [{"joints": list(range(j)), "inverseBindMatrices": 4}],
        },
    ).encode("utf-8")

    # Pad JSON chunk to 4-byte alignment
    padding = (4 - len(scene_json) % 4) % 4
    scene_json += b" " * padding

    json_chunk_length = len(scene_json)
    bin_chunk_length = len(bin_data)
    total_length = 12 + 8 + json_chunk_length + 8 + bin_chunk_length

    header = struct.pack("<4sII", b"glTF", 2, total_length)
    json_chunk_header = struct.pack("<II", json_chunk_length, 0x4E4F534A)
    bin_chunk_header = struct.pack("<II", bin_chunk_length, 0x004E4942)

    return header + json_chunk_header + scene_json + bin_chunk_header + bin_data


class StubRiggingProvider:
    """Returns a stub skinned GLB without real weight transfer.

    Generates a minimal valid skinned GLB (box mesh + 22-joint skeleton) so the
    output passes ``validate_rigged_glb()``.  Useful during local development
    when Blender and heavy rigging dependencies are not installed.
    """

    def __init__(self, output_dir: str = "/var/iyae/assets") -> None:
        self.output_dir = output_dir

    def generate(
        self,
        task_id: int,
        garment_asset_id: int,
        input_payload: dict | None,
    ) -> dict:
        """Generate a stub skinned GLB and return a schemaVersion=2 payload.

        Args:
            task_id: The rigging task ID (for tracing/logging).
            garment_asset_id: ID of the garment asset being rigged.
            input_payload: Dict with at least ``source_glb_url``.

        Returns:
            Output payload dict (schemaVersion=2).

        Raises:
            ValueError: If ``source_glb_url`` is missing from input_payload.
            FileNotFoundError: If the resolved source GLB path does not exist.
        """
        start_time = time.time()

        if not input_payload or "source_glb_url" not in input_payload:
            raise ValueError("input_payload must contain 'source_glb_url'")

        source_path = self._resolve_path(input_payload["source_glb_url"])
        if not os.path.isfile(source_path):
            raise FileNotFoundError(
                f"Source GLB not found at '{source_path}' "
                f"(from source_glb_url='{input_payload['source_glb_url']}')"
            )

        work_dir = os.path.join(self.output_dir, "rigged", str(garment_asset_id))
        os.makedirs(work_dir, exist_ok=True)
        output_path = os.path.join(work_dir, "garment-rigged.glb")

        glb_data = _create_stub_skinned_glb()
        with open(output_path, "wb") as f:
            f.write(glb_data)
        glb_size = len(glb_data)

        logger.info(
            "StubRiggingProvider: wrote skinned GLB to %s (%d bytes) "
            "for garment_asset_id=%d task_id=%d",
            output_path,
            glb_size,
            garment_asset_id,
            task_id,
        )

        elapsed_ms = int((time.time() - start_time) * 1000)

        return {
            "schemaVersion": 2,
            "provider_used": "STUB_RIGGING",
            "garment_asset_id": garment_asset_id,
            "rigged_glb_path": f"rigged/{garment_asset_id}/garment-rigged.glb",
            "rigged_glb_url": f"/assets/rigged/{garment_asset_id}/garment-rigged.glb",
            "slot_hint": input_payload.get("slot_hint"),
            "triangle_count": 12,
            "bbox": {"min": [-0.2, 0.0, -0.125], "max": [0.2, 1.7, 0.125]},
            "skin": {
                "has_skin": True,
                "joint_count": _NUM_BODY_JOINTS,
            },
            "rigging": {
                "method": "STUB",
                "pose": "A_POSE",
            },
            "elapsed_ms": elapsed_ms,
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resolve_path(self, url_or_path: str) -> str:
        """Resolve a /assets/-relative URL to an absolute filesystem path."""
        if not url_or_path:
            return url_or_path
        if url_or_path.startswith(("http://", "https://")):
            return url_or_path
        if url_or_path.startswith("/assets/"):
            relative = url_or_path[len("/assets/"):]
            return os.path.join(self.output_dir, relative)
        return url_or_path
