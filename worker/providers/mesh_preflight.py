"""Topology preflight checks for garment meshes before rigging."""
import logging
from collections import Counter

import numpy as np
import trimesh

logger = logging.getLogger(__name__)

_NON_MANIFOLD_THRESHOLD = 100
_DEGENERATE_AREA_THRESHOLD = 1e-10
_DEGENERATE_FACE_THRESHOLD = 50


def _count_non_manifold_edges(faces: np.ndarray) -> int:
    """Count edges shared by more than 2 faces."""
    edge_counts: Counter = Counter()
    for face in faces:
        for i in range(3):
            a, b = int(face[i]), int(face[(i + 1) % 3])
            edge = (min(a, b), max(a, b))
            edge_counts[edge] += 1
    return sum(1 for c in edge_counts.values() if c > 2)


def _count_degenerate_faces(mesh: trimesh.Trimesh) -> int:
    """Count faces with near-zero area."""
    return int(np.sum(mesh.area_faces < _DEGENERATE_AREA_THRESHOLD))


def _find_loose_vertices(vertices: np.ndarray, faces: np.ndarray) -> int:
    """Count vertices not referenced by any face."""
    referenced = set(faces.flatten().tolist())
    return sum(1 for i in range(len(vertices)) if i not in referenced)


def preflight_mesh(vertices: np.ndarray, faces: np.ndarray) -> list[str]:
    """Run topology preflight checks on a mesh.

    Args:
        vertices: (N, 3) float array of vertex positions
        faces: (F, 3) int array of face indices

    Returns:
        List of error messages. Empty list means mesh passed all checks.
    """
    errors: list[str] = []

    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)

    non_manifold = _count_non_manifold_edges(faces)
    if non_manifold > _NON_MANIFOLD_THRESHOLD:
        errors.append(f"Too many non-manifold edges: {non_manifold}")

    degenerate = _count_degenerate_faces(mesh)
    if degenerate > _DEGENERATE_FACE_THRESHOLD:
        errors.append(f"Too many degenerate faces: {degenerate}")

    loose = _find_loose_vertices(vertices, faces)
    if loose > 0:
        logger.warning("Mesh has %d loose vertices (not referenced by any face)", loose)

    return errors


def check_scale_ratio(
    garment_verts: np.ndarray,
    avatar_verts: np.ndarray,
    max_ratio: float = 50.0,
) -> list[str]:
    """Check if garment and avatar meshes are at compatible scales.

    Returns a list of warning strings (empty if scales are compatible).
    This is a soft check — warnings only, does not block the pipeline.

    Args:
        garment_verts: (G, 3) garment vertex positions.
        avatar_verts:  (V, 3) avatar vertex positions.
        max_ratio:     Maximum acceptable height ratio before warning.

    Returns:
        List of warning strings (empty if OK).
    """
    warnings: list[str] = []

    garment_height = float(garment_verts[:, 1].max() - garment_verts[:, 1].min())
    avatar_height = float(avatar_verts[:, 1].max() - avatar_verts[:, 1].min())

    if avatar_height < 1e-6:
        warnings.append("avatar mesh has near-zero height")
        return warnings

    ratio = garment_height / avatar_height

    if ratio > max_ratio:
        warnings.append(
            f"garment is {ratio:.1f}x taller than avatar "
            f"(garment_h={garment_height:.3f}m, avatar_h={avatar_height:.3f}m, "
            f"threshold={max_ratio:.0f}x)"
        )
    elif ratio < 1.0 / max_ratio:
        warnings.append(
            f"garment is {1.0/ratio:.1f}x smaller than avatar "
            f"(garment_h={garment_height:.3f}m, avatar_h={avatar_height:.3f}m, "
            f"threshold=1/{max_ratio:.0f}x)"
        )

    return warnings
