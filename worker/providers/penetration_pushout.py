"""Geometric garment push-out for the rigging pipeline (drape-realism Phase 3 / A1).

After weight transfer and before writing the skinned GLB, push any garment vertex
that sits inside the avatar body -- or within a fabric-thickness shell -- back out
along the body's outward surface normal, so the rigged garment wraps *outside* the
body instead of clipping through it.

Reuses the same igl BVH query used by weight_transfer.py (no new dependency). The
signed-distance sign is derived from the avatar face-normal dot at the closest point
(robust, version-stable -- igl.signed_distance is deliberately avoided because its
sign_type/return signature is version-sensitive).
"""
from __future__ import annotations

import logging

import numpy as np

logger = logging.getLogger(__name__)


def resolve_penetration(
    garment_verts: np.ndarray,
    avatar_verts: np.ndarray,
    avatar_faces: np.ndarray,
    fabric_thickness: float = 0.006,
    max_push: float = 0.05,
) -> tuple[np.ndarray, dict]:
    """Push penetrating garment vertices outside the avatar surface.

    A garment vertex "penetrates" when its signed distance to the avatar surface is
    below ``fabric_thickness`` (i.e. it is inside the body, or sitting closer than the
    fabric shell). Such a vertex is moved to ``closest_point + fabric_thickness * n``
    where ``n`` is the outward face normal at the closest point. The push magnitude is
    clamped to ``max_push`` so a pathological far closest-point match can never balloon
    the garment.

    Vertex count and order are preserved (edit-in-place on a copy) so that the
    index-aligned POSITION/NORMAL/TEXCOORD_0/JOINTS_0/WEIGHTS_0 accessors stay valid.

    Args:
        garment_verts:    (G, 3) garment vertex positions (bind pose, post weight-transfer).
        avatar_verts:     (V, 3) avatar vertex positions.
        avatar_faces:     (F, 3) avatar triangle indices.
        fabric_thickness: Shell offset (metres) to keep the garment outside the body.
        max_push:         Maximum distance (metres) any single vertex may be moved.

    Returns:
        (new_verts, stats) where new_verts is a new (G, 3) float64 array and stats is a
        dict: ``penetrating_before``, ``penetrating_after``, ``vertices_pushed``,
        ``max_depth_before_m``, ``fabric_thickness_m``, ``was_applied``. When igl is
        unavailable or the input is empty, new_verts is an unchanged copy and
        ``was_applied`` is False (graceful no-op).
    """
    new_verts = np.array(garment_verts, dtype=np.float64, copy=True)
    stats: dict = {
        "penetrating_before": 0,
        "penetrating_after": 0,
        "vertices_pushed": 0,
        "max_depth_before_m": 0.0,
        "fabric_thickness_m": float(fabric_thickness),
        "was_applied": False,
    }

    if len(new_verts) == 0 or len(avatar_faces) == 0:
        return new_verts, stats

    try:
        import igl
    except ImportError:
        logger.warning("igl not available; skipping penetration push-out")
        return new_verts, stats

    avatar_verts_f = np.asarray(avatar_verts, dtype=np.float64)
    avatar_faces_i = np.asarray(avatar_faces, dtype=np.int32)
    garment_verts_f = new_verts  # already float64

    # Per-face outward normals of the avatar (unit; degenerate faces -> ~0, flagged).
    tris = avatar_verts_f[avatar_faces_i]                                # (F, 3, 3)
    face_n = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])  # (F, 3)
    face_n_len = np.linalg.norm(face_n, axis=1, keepdims=True)           # (F, 1)
    valid_face = face_n_len[:, 0] > 1e-12
    face_n = face_n / np.where(face_n_len > 1e-12, face_n_len, 1.0)

    def _signed_and_face(query: np.ndarray):
        """Return (signed_distance, closest_face_index, closest_point) for each query vert."""
        sq_dist, closest_face, closest_pt = igl.point_mesh_squared_distance(
            query, avatar_verts_f, avatar_faces_i
        )
        cf = np.asarray(closest_face).astype(np.int64).ravel()
        cp = np.asarray(closest_pt, dtype=np.float64).reshape(-1, 3)
        n = face_n[cf]                                                   # (G, 3)
        signed = np.einsum("ij,ij->i", query - cp, n)                   # (G,)
        return signed, cf, cp, valid_face[cf]

    signed, closest_face, closest_pt, n_valid = _signed_and_face(garment_verts_f)
    n_i = face_n[closest_face]                                          # (G, 3)

    # Penetrating = inside the body or within the fabric shell, on a valid face.
    penetrating = (signed < fabric_thickness) & n_valid
    stats["penetrating_before"] = int(penetrating.sum())
    if stats["penetrating_before"] > 0:
        depth = np.maximum(fabric_thickness - signed[penetrating], 0.0)
        stats["max_depth_before_m"] = float(depth.max())

    if stats["penetrating_before"] == 0:
        stats["was_applied"] = True
        return new_verts, stats

    # Target = closest surface point + fabric_thickness along the outward normal.
    target = closest_pt + n_i * fabric_thickness                        # (G, 3)
    delta = target - garment_verts_f                                    # (G, 3)
    delta_len = np.linalg.norm(delta, axis=1, keepdims=True)            # (G, 1)
    clamp_scale = np.where(delta_len > max_push, max_push / np.maximum(delta_len, 1e-12), 1.0)
    delta = delta * clamp_scale

    new_verts[penetrating] = garment_verts_f[penetrating] + delta[penetrating]
    stats["vertices_pushed"] = int(penetrating.sum())
    stats["was_applied"] = True

    # Measure residual penetration on the pushed vertices (second BVH query).
    signed_after, _, _, valid_after = _signed_and_face(new_verts)
    stats["penetrating_after"] = int(((signed_after < fabric_thickness) & valid_after).sum())

    return new_verts, stats
