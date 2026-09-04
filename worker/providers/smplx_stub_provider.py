"""Stub SMPL-X avatar provider for development and testing."""
import json
import logging
import os
import struct
import time

logger = logging.getLogger(__name__)


def create_avatar_glb() -> bytes:
    """Create a minimal valid GLB file representing a humanoid avatar stub.

    Generates a simple box mesh (8 vertices, 12 triangles) with skin-toned PBR
    material and a 3-joint skeleton (pelvis, spine1, head). The box is sized to
    approximate a human silhouette (0.4m wide, 1.7m tall, 0.25m deep) so
    Three.js can render it as a SkinnedMesh without errors.

    glTF requires mesh primitives to have an ``attributes.POSITION`` accessor
    backed by a binary buffer — a mesh without vertex data is spec-invalid and
    will crash Three.js's GLTFLoader. The JOINTS_0/WEIGHTS_0 attributes and
    ``skins`` definition cause Three.js to create a SkinnedMesh with a boneMap
    containing at least "pelvis".
    """
    # -- Binary vertex + index data ------------------------------------------
    # 8 box vertices: width 0.4m, height 1.7m, depth 0.25m
    positions = [
        -0.2,  0.0, -0.125,   # 0: back-bottom-left
         0.2,  0.0, -0.125,   # 1: back-bottom-right
         0.2,  1.7, -0.125,   # 2: back-top-right
        -0.2,  1.7, -0.125,   # 3: back-top-left
        -0.2,  0.0,  0.125,   # 4: front-bottom-left
         0.2,  0.0,  0.125,   # 5: front-bottom-right
         0.2,  1.7,  0.125,   # 6: front-top-right
        -0.2,  1.7,  0.125,   # 7: front-top-left
    ]
    # 12 triangles (6 faces x 2)
    indices = [
        4, 5, 6,  4, 6, 7,    # front
        1, 0, 3,  1, 3, 2,    # back
        0, 4, 7,  0, 7, 3,    # left
        5, 1, 2,  5, 2, 6,    # right
        7, 6, 2,  7, 2, 3,    # top
        0, 1, 5,  0, 5, 4,    # bottom
    ]

    pos_bytes = struct.pack(f"<{len(positions)}f", *positions)   # 96 bytes
    idx_bytes = struct.pack(f"<{len(indices)}H", *indices)       # 72 bytes

    # -- Skinning data --------------------------------------------------------
    # JOINTS_0: 8 vertices x 4 joint indices (UNSIGNED_BYTE), all bound to pelvis (index 0)
    joints_data = [0, 0, 0, 0] * 8  # 32 bytes
    joints_bytes = struct.pack(f"<{len(joints_data)}B", *joints_data)  # 32 bytes

    # WEIGHTS_0: 8 vertices x 4 weights (FLOAT), 100% pelvis
    weights_data = [1.0, 0.0, 0.0, 0.0] * 8  # 32 floats
    weights_bytes = struct.pack(f"<{len(weights_data)}f", *weights_data)  # 128 bytes

    # Inverse Bind Matrices: 3 joints x 4x4 float matrix
    # Each IBM is the inverse of the joint's world translation.
    # identity with translation column negated: col[3] = [-tx, -ty, -tz, 1]
    def _ibm(tx: float, ty: float, tz: float) -> list:
        # column-major 4x4 identity matrix with translation inverted
        return [
            1.0, 0.0, 0.0, 0.0,
            0.0, 1.0, 0.0, 0.0,
            0.0, 0.0, 1.0, 0.0,
            -tx, -ty, -tz, 1.0,
        ]

    ibm_floats = (
        _ibm(0.0, 0.85, 0.0)   # pelvis
        + _ibm(0.0, 1.1,  0.0)  # spine1
        + _ibm(0.0, 1.6,  0.0)  # head
    )
    ibm_bytes = struct.pack(f"<{len(ibm_floats)}f", *ibm_floats)  # 192 bytes

    # -- Buffer layout --------------------------------------------------------
    pos_offset    = 0
    idx_offset    = pos_offset + len(pos_bytes)        # 96
    joints_offset = idx_offset + len(idx_bytes)        # 168
    weights_offset = joints_offset + len(joints_bytes) # 200
    ibm_offset    = weights_offset + len(weights_bytes) # 328

    bin_data = pos_bytes + idx_bytes + joints_bytes + weights_bytes + ibm_bytes

    # -- Accessor indices (for clarity) ---------------------------------------
    ACC_POSITION = 0
    ACC_INDICES  = 1
    ACC_JOINTS   = 2
    ACC_WEIGHTS  = 3
    ACC_IBM      = 4

    scene_json = json.dumps(
        {
            "asset": {"version": "2.0", "generator": "clossette-smplx-stub"},
            "scene": 0,
            # scene includes mesh node (0) and root joint pelvis (1)
            "scenes": [{"nodes": [0, 1]}],
            "nodes": [
                # node 0: mesh node (references skin 0)
                {"name": "avatar_root", "mesh": 0, "skin": 0},
                # node 1: pelvis (root joint, children: spine1) — local = world for root
                {"name": "pelvis", "translation": [0.0, 0.85, 0.0], "children": [2]},
                # node 2: spine1 (children: head) — local: world 1.1 - parent 0.85 = 0.25
                {"name": "spine1", "translation": [0.0, 0.25, 0.0], "children": [3]},
                # node 3: head (leaf) — local: world 1.6 - parent 1.1 = 0.5
                {"name": "head", "translation": [0.0, 0.5, 0.0]},
            ],
            "skins": [
                {
                    "joints": [1, 2, 3],
                    "inverseBindMatrices": ACC_IBM,
                }
            ],
            "buffers": [{"byteLength": len(bin_data)}],
            "bufferViews": [
                # BV 0: POSITION (ARRAY_BUFFER)
                {"buffer": 0, "byteOffset": pos_offset, "byteLength": len(pos_bytes), "target": 34962},
                # BV 1: indices (ELEMENT_ARRAY_BUFFER)
                {"buffer": 0, "byteOffset": idx_offset, "byteLength": len(idx_bytes), "target": 34963},
                # BV 2: JOINTS_0 (ARRAY_BUFFER)
                {"buffer": 0, "byteOffset": joints_offset, "byteLength": len(joints_bytes), "target": 34962},
                # BV 3: WEIGHTS_0 (ARRAY_BUFFER)
                {"buffer": 0, "byteOffset": weights_offset, "byteLength": len(weights_bytes), "target": 34962},
                # BV 4: inverseBindMatrices (no target — not a GPU buffer view)
                {"buffer": 0, "byteOffset": ibm_offset, "byteLength": len(ibm_bytes)},
            ],
            "accessors": [
                # 0: POSITION
                {
                    "bufferView": 0,
                    "componentType": 5126,  # FLOAT
                    "count": 8,
                    "type": "VEC3",
                    "min": [-0.2, 0.0, -0.125],
                    "max": [0.2, 1.7, 0.125],
                },
                # 1: indices
                {
                    "bufferView": 1,
                    "componentType": 5123,  # UNSIGNED_SHORT
                    "count": len(indices),
                    "type": "SCALAR",
                },
                # 2: JOINTS_0
                {
                    "bufferView": 2,
                    "componentType": 5121,  # UNSIGNED_BYTE
                    "count": 8,
                    "type": "VEC4",
                },
                # 3: WEIGHTS_0
                {
                    "bufferView": 3,
                    "componentType": 5126,  # FLOAT
                    "count": 8,
                    "type": "VEC4",
                },
                # 4: inverseBindMatrices
                {
                    "bufferView": 4,
                    "componentType": 5126,  # FLOAT
                    "count": 3,
                    "type": "MAT4",
                },
            ],
            "meshes": [
                {
                    "name": "avatar_body",
                    "primitives": [
                        {
                            "attributes": {
                                "POSITION": ACC_POSITION,
                                "JOINTS_0": ACC_JOINTS,
                                "WEIGHTS_0": ACC_WEIGHTS,
                            },
                            "indices": ACC_INDICES,
                            "mode": 4,
                            "material": 0,
                        }
                    ],
                }
            ],
            "materials": [
                {
                    "name": "skin_material",
                    "pbrMetallicRoughness": {
                        "baseColorFactor": [0.87, 0.72, 0.60, 1.0],
                        "metallicFactor": 0.0,
                        "roughnessFactor": 0.8,
                    },
                }
            ],
        }
    ).encode("utf-8")

    # Pad JSON chunk to 4-byte alignment
    padding = (4 - len(scene_json) % 4) % 4
    scene_json += b" " * padding

    json_chunk_length = len(scene_json)
    bin_chunk_length = len(bin_data)
    # header(12) + JSON chunk header(8) + JSON data + BIN chunk header(8) + BIN data
    total_length = 12 + 8 + json_chunk_length + 8 + bin_chunk_length

    header = struct.pack("<4sII", b"glTF", 2, total_length)
    json_chunk_header = struct.pack("<II", json_chunk_length, 0x4E4F534A)  # "JSON"
    bin_chunk_header = struct.pack("<II", bin_chunk_length, 0x004E4942)    # "BIN\0"

    return header + json_chunk_header + scene_json + bin_chunk_header + bin_data


class SmplxStubProvider:
    """Generates placeholder avatar GLB files for development and testing."""

    def __init__(self, output_base_dir: str = "/var/clossette/assets"):
        self.output_base_dir = output_base_dir

    def generate(self, task_id: int, user_id: int, input_payload: dict | None) -> dict:
        """Generate a stub humanoid avatar GLB file.

        Args:
            task_id: The generation task ID (used for logging/tracing).
            user_id: The user ID; determines the output directory.
            input_payload: Body measurements dict (ignored by stub).

        Returns:
            Output payload dict conforming to avatar schema v1.
        """
        start_time = time.time()
        gender = (input_payload or {}).get("gender", "neutral")

        output_dir = os.path.join(self.output_base_dir, f"avatars/{user_id}")
        os.makedirs(output_dir, exist_ok=True)

        glb_path = os.path.join(output_dir, "avatar.glb")
        glb_data = create_avatar_glb()
        with open(glb_path, "wb") as f:
            f.write(glb_data)

        elapsed_ms = int((time.time() - start_time) * 1000)

        return {
            "schemaVersion": 1,
            "provider_used": "SMPLX_STUB",
            "provider_request_id": None,
            "glb_path": f"avatars/{user_id}/avatar.glb",
            "triangle_count": 12,
            "bbox": {"min": [-0.3, 0, -0.15], "max": [0.3, 1.7, 0.15]},
            "sanity": {
                "glb_size_bytes": len(glb_data),
                "has_nan_vertices": False,
            },
            "elapsed_ms": elapsed_ms,
            "glb_url": f"/assets/avatars/{user_id}/avatar.glb",
            "gender": gender,
        }
