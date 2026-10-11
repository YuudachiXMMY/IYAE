"""Pure-Python skinning weight transfer for garment rigging.

Phase 1 – Surface projection   : nearest-surface match via igl BVH
Phase 2 – Laplacian inpainting : biharmonic solve for unmatched verts
Phase 3 – Prune & normalise    : top-4 influences, slot-aware bone masking
"""
from __future__ import annotations

import logging
from typing import Tuple

import numpy as np
import scipy.sparse
import scipy.sparse.linalg

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Phase 1 — Surface projection
# ---------------------------------------------------------------------------

def find_closest_surface_matches(
    garment_verts: np.ndarray,
    garment_normals: np.ndarray,
    avatar_verts: np.ndarray,
    avatar_faces: np.ndarray,
    avatar_normals: np.ndarray,
    avatar_weights: np.ndarray,
    distance_threshold: float = 0.02,
    angle_threshold: float = 75.0,
) -> Tuple[np.ndarray, np.ndarray]:
    """Project garment vertices onto the avatar surface and transfer weights via igl BVH."""
    import igl

    avatar_verts_f = np.asarray(avatar_verts, dtype=np.float64)
    avatar_faces_i = np.asarray(avatar_faces, dtype=np.int32)
    garment_verts_f = np.asarray(garment_verts, dtype=np.float64)

    sq_dist, closest_face, closest_pt = igl.point_mesh_squared_distance(
        garment_verts_f, avatar_verts_f, avatar_faces_i
    )
    distances = np.sqrt(np.maximum(sq_dist, 0.0))

    num_joints = avatar_weights.shape[1]
    g = len(garment_verts)
    weights_out = np.zeros((g, num_joints), dtype=np.float64)
    matched = np.zeros(g, dtype=bool)

    cos_threshold = np.cos(np.radians(angle_threshold))

    for i in range(g):
        if distances[i] > distance_threshold:
            continue
        fi = closest_face[i]
        tri = avatar_faces_i[fi]
        p = closest_pt[i].reshape(1, 3)
        bary = igl.barycentric_coordinates(
            p,
            avatar_verts_f[tri[0]].reshape(1, 3),
            avatar_verts_f[tri[1]].reshape(1, 3),
            avatar_verts_f[tri[2]].reshape(1, 3),
        )[0]
        bary = np.clip(bary, 0.0, 1.0)
        bary_sum = bary.sum()
        if bary_sum > 1e-8:
            bary = bary / bary_sum

        interp_n = (
            bary[0] * avatar_normals[tri[0]]
            + bary[1] * avatar_normals[tri[1]]
            + bary[2] * avatar_normals[tri[2]]
        )
        interp_n_len = np.linalg.norm(interp_n)
        if interp_n_len > 1e-8:
            interp_n = interp_n / interp_n_len

        gn = garment_normals[i]
        gn_len = np.linalg.norm(gn)
        if gn_len > 1e-8:
            gn = gn / gn_len

        dot = float(np.clip(np.dot(gn, interp_n), -1.0, 1.0))
        if dot >= cos_threshold:
            matched[i] = True
            weights_out[i] = (
                bary[0] * avatar_weights[tri[0]]
                + bary[1] * avatar_weights[tri[1]]
                + bary[2] * avatar_weights[tri[2]]
            )

    return matched, weights_out


# ---------------------------------------------------------------------------
# Phase 2 — Laplacian inpainting
# ---------------------------------------------------------------------------

def inpaint_weights(
    garment_verts: np.ndarray,
    garment_faces: np.ndarray,
    matched: np.ndarray,
    initial_weights: np.ndarray,
) -> np.ndarray:
    """Fill unmatched garment vertices via biharmonic inpainting.

    Uses robust_laplacian.mesh_laplacian to build L and M, then solves the
    biharmonic system Q x = 0 subject to matched vertices as constraints.

    Falls back to point_cloud_laplacian if mesh_laplacian fails (disconnected
    components / degenerate geometry).

    Args:
        garment_verts:   (G, 3) vertex positions.
        garment_faces:   (G_F, 3) triangle indices.
        matched:         (G,) bool mask — constrained vertices.
        initial_weights: (G, J) weight matrix (zeros for unmatched rows).

    Returns:
        (G, J) weight matrix with all rows filled.
    """
    import robust_laplacian

    verts = np.asarray(garment_verts, dtype=np.float64)
    faces = np.asarray(garment_faces, dtype=np.int32)
    n = len(verts)
    num_joints = initial_weights.shape[1]

    try:
        L, M = robust_laplacian.mesh_laplacian(verts, faces)
    except Exception:
        logger.warning("mesh_laplacian failed, falling back to point_cloud_laplacian")
        L, M = robust_laplacian.point_cloud_laplacian(verts)

    # Build biharmonic energy Q = L^T M^{-1} L
    m_diag = M.diagonal()
    m_diag_safe = np.where(m_diag > 1e-12, m_diag, 1e-12)
    M_inv = scipy.sparse.diags(1.0 / m_diag_safe)
    Q = L.T @ M_inv @ L

    fixed_indices = np.where(matched)[0]
    free_indices = np.where(~matched)[0]

    if len(free_indices) == 0:
        return initial_weights.copy()

    result = initial_weights.copy()

    if len(fixed_indices) == 0:
        # No constraints at all — return zeros
        return result

    Q_ff = Q[free_indices][:, free_indices]
    Q_fc = Q[free_indices][:, fixed_indices]
    rhs = -Q_fc @ initial_weights[fixed_indices]

    try:
        x_free = scipy.sparse.linalg.spsolve(Q_ff.tocsc(), rhs)
    except Exception:
        logger.warning("spsolve failed, using least-squares fallback")
        x_free, _ = scipy.sparse.linalg.lsqr(Q_ff, rhs)[:2]

    result[free_indices] = np.clip(x_free, 0.0, 1.0)
    return result


# ---------------------------------------------------------------------------
# Phase 3 — Prune & normalise
# ---------------------------------------------------------------------------

def prune_and_normalize_weights(
    weights: np.ndarray,
    slot_hint: str,
    max_influences: int = 4,
    min_weight: float = 0.01,
) -> np.ndarray:
    """Apply bone-subset masking, keep top-K influences, and normalise rows.

    Args:
        weights:         (G, J) raw weight matrix.
        slot_hint:       Garment slot key (e.g. "TOP", "BOTTOM", "DRESS").
        max_influences:  Maximum non-zero influences per vertex.
        min_weight:      Weights below this threshold are zeroed.

    Returns:
        (G, J) pruned and row-normalised weight matrix (immutable — new array).
    """
    from providers.canonical_skeleton import SLOT_BONE_SUBSETS, SMPLX_JOINT_NAMES

    w = weights.copy()
    num_joints = w.shape[1]

    subset = SLOT_BONE_SUBSETS.get(slot_hint)
    if subset is not None:
        keep_indices = {SMPLX_JOINT_NAMES.index(name) for name in subset if name in SMPLX_JOINT_NAMES}
        mask = np.zeros(num_joints, dtype=bool)
        for idx in keep_indices:
            mask[idx] = True
        w[:, ~mask] = 0.0

    # Top-K per vertex
    if max_influences < num_joints:
        top_k_threshold = np.partition(w, -max_influences, axis=1)[:, -max_influences:].min(axis=1, keepdims=True)
        w = np.where(w >= top_k_threshold, w, 0.0)

    # Min-weight threshold
    w = np.where(w >= min_weight, w, 0.0)

    # Row-normalise
    row_sums = w.sum(axis=1, keepdims=True)
    row_sums = np.where(row_sums > 1e-8, row_sums, 1.0)
    w = w / row_sums

    return w


#: Above this proportion of vertices falling back to the pelvis, the transfer has not really
#: worked and the rigging task should fail rather than emit a garment that deforms as a lump.
#: Deliberately low: a handful of stray vertices is tolerable, a twentieth of the mesh is not.
MAX_DEGENERATE_VERTEX_FRACTION = 0.05


def count_degenerate_vertices(weights: np.ndarray) -> int:
    """How many vertices have no usable skinning weight at all.

    The caller uses this to decide whether a transfer is good enough to ship; see
    :func:`dense_weights_to_top4`, which silently bound these to the pelvis.
    """
    if weights.size == 0:
        return 0
    return int(np.count_nonzero(weights.sum(axis=1) < 1e-8))


def dense_weights_to_top4(
    weights: np.ndarray,
    max_influences: int = 4,
) -> Tuple[np.ndarray, np.ndarray]:
    """Convert dense (G, J) weight matrix to glTF-compatible top-4 format.

    Args:
        weights:         (G, J) weight matrix (row-normalised expected).
        max_influences:  Number of top influences to keep (default 4).

    Returns:
        joint_indices: (G, 4) uint8 array of joint indices per vertex.
        joint_weights: (G, 4) float32 array of blend weights per vertex.
    """
    g, j = weights.shape
    k = min(max_influences, j)

    # Find top-K indices per row
    top_k_indices = np.argsort(weights, axis=1)[:, -k:][:, ::-1]  # descending

    # Gather corresponding weights
    top_k_weights = np.take_along_axis(weights, top_k_indices, axis=1)

    # Pad to exactly 4 columns if k < 4
    if k < 4:
        pad_width = 4 - k
        top_k_indices = np.pad(top_k_indices, ((0, 0), (0, pad_width)), constant_values=0)
        top_k_weights = np.pad(top_k_weights, ((0, 0), (0, pad_width)), constant_values=0.0)

    # Fallback: vertices with zero total weight get pelvis (index 0) at weight 1.0.
    #
    # This is a last resort, not a neutral default: a vertex bound rigidly to the pelvis does
    # not follow the limb it belongs to, so a garment with many of them deforms as one lump at
    # the hips. It used to happen with no error, no log and nothing in the validator to catch
    # it, which made a numerically-degenerate transfer indistinguishable from a good one.
    # Reported here; the caller decides whether the proportion is acceptable (see
    # count_degenerate_vertices and PythonRiggingProvider).
    row_sums = top_k_weights.sum(axis=1)
    zero_rows = row_sums < 1e-8
    degenerate = int(np.count_nonzero(zero_rows))
    if degenerate:
        logger.warning(
            "%d of %d garment vertices (%.1f%%) had no usable skinning weight and were bound "
            "rigidly to the pelvis — they will not follow the body part they sit on",
            degenerate, g, 100.0 * degenerate / max(g, 1),
        )
        top_k_indices[zero_rows] = 0
        top_k_weights[zero_rows] = 0.0
        top_k_weights[zero_rows, 0] = 1.0
        row_sums[zero_rows] = 1.0

    # Row-normalise
    top_k_weights = top_k_weights / row_sums[:, np.newaxis]

    return top_k_indices.astype(np.uint8), top_k_weights.astype(np.float32)


# ---------------------------------------------------------------------------
# Pipeline entry point
# ---------------------------------------------------------------------------

def transfer_weights(
    garment_verts: np.ndarray,
    garment_faces: np.ndarray,
    garment_normals: np.ndarray,
    avatar_verts: np.ndarray,
    avatar_faces: np.ndarray,
    avatar_normals: np.ndarray,
    avatar_weights: np.ndarray,
    slot_hint: str = "DRESS",
) -> np.ndarray:
    """Run Phase 1 → 2 → 3 weight transfer pipeline.

    Args:
        garment_verts:   (G, 3) garment positions.
        garment_faces:   (G_F, 3) garment triangle indices.
        garment_normals: (G, 3) garment vertex normals.
        avatar_verts:    (V, 3) avatar positions.
        avatar_faces:    (F, 3) avatar triangle indices.
        avatar_normals:  (V, 3) avatar vertex normals.
        avatar_weights:  (V, 55) SMPL-X LBS weights.
        slot_hint:       Garment category for bone-subset pruning.

    Returns:
        (G, 55) pruned + normalised skin weight matrix.
    """
    matched, raw_weights = find_closest_surface_matches(
        garment_verts,
        garment_normals,
        avatar_verts,
        avatar_faces,
        avatar_normals,
        avatar_weights,
    )
    logger.info(
        "Phase 1: %d/%d garment verts matched (%.1f%%)",
        matched.sum(),
        len(garment_verts),
        100.0 * matched.sum() / max(len(garment_verts), 1),
    )

    filled_weights = inpaint_weights(garment_verts, garment_faces, matched, raw_weights)
    logger.info("Phase 2: biharmonic inpainting complete")

    final_weights = prune_and_normalize_weights(filled_weights, slot_hint)
    logger.info("Phase 3: prune & normalise complete")

    return final_weights
