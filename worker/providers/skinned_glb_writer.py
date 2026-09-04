"""Build and write skinned (rigged) GLB files using pygltflib."""
import logging
from pathlib import Path

import numpy as np
import pygltflib

from providers.canonical_skeleton import SLOT_BONE_SUBSETS

logger = logging.getLogger(__name__)

# pygltflib constants
_FLOAT = pygltflib.FLOAT          # 5126
_UNSIGNED_BYTE = pygltflib.UNSIGNED_BYTE   # 5121
_UNSIGNED_SHORT = pygltflib.UNSIGNED_SHORT  # 5123
_ARRAY_BUFFER = pygltflib.ARRAY_BUFFER     # 34962
_ELEMENT_ARRAY_BUFFER = pygltflib.ELEMENT_ARRAY_BUFFER  # 34963


def build_joint_hierarchy(
    joint_names: list[str],
    parent_indices: list[int],
) -> tuple[list[dict], list[int]]:
    """Build joint node info and identify root joints.

    Args:
        joint_names: Ordered list of joint names.
        parent_indices: Parent index per joint (-1 = root).

    Returns:
        Tuple of (node_info_list, root_indices) where each node_info is
        {'name': str, 'children': list[int]}.
    """
    nodes: list[dict] = [{"name": name, "children": []} for name in joint_names]
    roots: list[int] = []

    for idx, parent in enumerate(parent_indices):
        if parent == -1:
            roots.append(idx)
        else:
            nodes[parent]["children"].append(idx)

    return nodes, roots


def compute_inverse_bind_matrices(joint_positions: np.ndarray) -> np.ndarray:
    """Compute inverse bind matrices for each joint (pure translation).

    Args:
        joint_positions: (J, 3) float array of joint world positions.

    Returns:
        (J, 4, 4) float32 array of inverse bind matrices in glTF MAT4
        column-major storage layout, suitable for direct tobytes() serialization.
        Row 3 contains [-x, -y, -z, 1] (translation in column-major flat index 12/13/14).
    """
    j = len(joint_positions)
    ibms = np.zeros((j, 4, 4), dtype=np.float32)
    for i, (x, y, z) in enumerate(joint_positions):
        ibms[i] = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [-x, -y, -z, 1],
        ], dtype=np.float32)
    return ibms


def _pad4(data: bytes) -> bytes:
    """Pad bytes to next 4-byte boundary."""
    rem = len(data) % 4
    return data + b"\x00" * (4 - rem) if rem else data


def _build_buffer_view(
    byte_offset: int,
    byte_length: int,
    target: int | None,
) -> pygltflib.BufferView:
    return pygltflib.BufferView(
        buffer=0,
        byteOffset=byte_offset,
        byteLength=byte_length,
        target=target,
    )


def write_skinned_glb(
    output_path: str | Path,
    vertices: np.ndarray,
    normals: np.ndarray,
    indices: np.ndarray,
    joint_indices: np.ndarray,
    joint_weights: np.ndarray,
    joint_names: list[str],
    parent_indices: list[int],
    joint_positions: np.ndarray,
    slot_hint: str = "DRESS",
) -> None:
    """Write a skinned GLB file.

    Args:
        output_path: Destination .glb file path.
        vertices: (V, 3) float32 vertex positions.
        normals: (V, 3) float32 vertex normals.
        indices: (F, 3) uint32/int face indices.
        joint_indices: (V, 4) uint8 joint index per vertex (up to 4 influences).
        joint_weights: (V, 4) float32 blend weights per vertex.
        joint_names: Ordered joint name list.
        parent_indices: Parent index per joint (-1 = root).
        joint_positions: (J, 3) float32 joint world positions.
        slot_hint: Garment slot ('TOP', 'BOTTOM', 'DRESS'). Filters joint subset.
    """
    # --- 0. Input shape validation ---
    if vertices.ndim != 2 or vertices.shape[1] != 3:
        raise ValueError(f"vertices must be (V, 3), got {vertices.shape}")
    if normals.ndim != 2 or normals.shape[1] != 3:
        raise ValueError(f"normals must be (V, 3), got {normals.shape}")
    if indices.ndim != 2 or indices.shape[1] != 3:
        raise ValueError(f"indices must be (F, 3), got {indices.shape}")
    if joint_indices.shape != (len(vertices), 4):
        raise ValueError(f"joint_indices must be ({len(vertices)}, 4), got {joint_indices.shape}")
    if joint_weights.shape != (len(vertices), 4):
        raise ValueError(f"joint_weights must be ({len(vertices)}, 4), got {joint_weights.shape}")

    # --- 1. Filter joints by slot_hint ---
    subset = SLOT_BONE_SUBSETS.get(slot_hint)
    if subset is not None:
        new_names: list[str] = []
        new_parents: list[int] = []
        new_positions: list[np.ndarray] = []
        old_to_new: dict[int, int] = {}
        for old_idx, name in enumerate(joint_names):
            if name in subset:
                new_idx = len(new_names)
                old_to_new[old_idx] = new_idx
                new_names.append(name)
                new_parents.append(parent_indices[old_idx])
                new_positions.append(joint_positions[old_idx])
        # Remap parent indices to new numbering
        remapped_parents: list[int] = []
        for old_idx, name in enumerate(joint_names):
            if name not in subset:
                continue
            p = parent_indices[old_idx]
            remapped_parents.append(old_to_new[p] if p != -1 and p in old_to_new else -1)
        filtered_names = new_names
        filtered_parents = remapped_parents
        filtered_positions = np.array(new_positions, dtype=np.float32)
        # Remap vertex joint indices
        remapped_ji = np.zeros_like(joint_indices)
        for v in range(len(joint_indices)):
            for k in range(4):
                old = int(joint_indices[v, k])
                remapped_ji[v, k] = old_to_new.get(old, 0)
        filtered_ji = remapped_ji
        # Renormalize weights after slot filtering
        _row_sums = joint_weights.sum(axis=1, keepdims=True)
        _row_sums = np.where(_row_sums > 1e-8, _row_sums, 1.0)
        joint_weights = joint_weights / _row_sums
    else:
        filtered_names = joint_names
        filtered_parents = parent_indices
        filtered_positions = joint_positions
        filtered_ji = joint_indices

    j = len(filtered_names)

    # --- 2. Build joint hierarchy ---
    node_info, root_joint_indices = build_joint_hierarchy(filtered_names, filtered_parents)

    # --- 3. Compute inverse bind matrices ---
    ibms = compute_inverse_bind_matrices(filtered_positions)  # (J,4,4)

    # --- 4. Prepare binary blobs ---
    pos_data = vertices.astype(np.float32).tobytes()
    norm_data = normals.astype(np.float32).tobytes()
    ji_data = filtered_ji.astype(np.uint8).tobytes()
    jw_data = joint_weights.astype(np.float32).tobytes()
    max_index = int(indices.max()) if indices.size > 0 else 0
    if max_index > 65535:
        idx_data = indices.astype(np.uint32).flatten().tobytes()
        idx_component_type = pygltflib.UNSIGNED_INT  # 5125
    else:
        idx_data = indices.astype(np.uint16).flatten().tobytes()
        idx_component_type = _UNSIGNED_SHORT
    ibm_data = ibms.tobytes()

    blobs = [pos_data, norm_data, ji_data, jw_data, idx_data, ibm_data]
    targets = [
        _ARRAY_BUFFER,
        _ARRAY_BUFFER,
        _ARRAY_BUFFER,
        _ARRAY_BUFFER,
        _ELEMENT_ARRAY_BUFFER,
        None,
    ]

    # --- 5. Compute buffer views with 4-byte-aligned offsets ---
    buffer_views: list[pygltflib.BufferView] = []
    padded_blobs: list[bytes] = []
    offset = 0
    for blob, target in zip(blobs, targets):
        buffer_views.append(_build_buffer_view(offset, len(blob), target))
        padded = _pad4(blob)
        padded_blobs.append(padded)
        offset += len(padded)

    binary_blob = b"".join(padded_blobs)

    # --- 6. Build accessors ---
    num_verts = len(vertices)
    num_faces = len(indices)
    accessors = [
        pygltflib.Accessor(bufferView=0, componentType=_FLOAT,        count=num_verts, type="VEC3"),   # POSITION
        pygltflib.Accessor(bufferView=1, componentType=_FLOAT,        count=num_verts, type="VEC3"),   # NORMAL
        pygltflib.Accessor(bufferView=2, componentType=_UNSIGNED_BYTE, count=num_verts, type="VEC4"),  # JOINTS_0
        pygltflib.Accessor(bufferView=3, componentType=_FLOAT,        count=num_verts, type="VEC4"),   # WEIGHTS_0
        pygltflib.Accessor(bufferView=4, componentType=idx_component_type, count=num_faces * 3, type="SCALAR"),  # indices
        pygltflib.Accessor(bufferView=5, componentType=_FLOAT,        count=j, type="MAT4"),           # IBM
    ]

    # --- 7. Build joint nodes ---
    gltf_nodes: list[pygltflib.Node] = []
    for i, info in enumerate(node_info):
        parent_idx = filtered_parents[i]
        if parent_idx == -1:
            local_pos = filtered_positions[i].tolist()
        else:
            local_pos = (filtered_positions[i] - filtered_positions[parent_idx]).tolist()
        gltf_nodes.append(pygltflib.Node(
            name=info["name"],
            translation=local_pos,
            children=info["children"] if info["children"] else None,
        ))

    # Mesh node (appended after joint nodes)
    mesh_node_idx = j
    gltf_nodes.append(pygltflib.Node(name="mesh", mesh=0, skin=0))

    # --- 8. Build mesh primitive ---
    attrs = pygltflib.Attributes(POSITION=0, NORMAL=1, JOINTS_0=2, WEIGHTS_0=3)
    primitive = pygltflib.Primitive(attributes=attrs, indices=4, mode=pygltflib.TRIANGLES)
    mesh = pygltflib.Mesh(primitives=[primitive])

    # --- 9. Build skin ---
    skin = pygltflib.Skin(joints=list(range(j)), inverseBindMatrices=5)

    # --- 10. Scene ---
    scene_nodes = [mesh_node_idx] + root_joint_indices
    scene = pygltflib.Scene(nodes=scene_nodes)

    gltf = pygltflib.GLTF2(
        scene=0,
        scenes=[scene],
        nodes=gltf_nodes,
        meshes=[mesh],
        skins=[skin],
        accessors=accessors,
        bufferViews=buffer_views,
        buffers=[pygltflib.Buffer(byteLength=len(binary_blob))],
    )
    gltf.set_binary_blob(binary_blob)
    gltf.save(str(output_path))
    logger.debug("Wrote skinned GLB to %s (%d bytes)", output_path, len(binary_blob))
