"""Garment-to-avatar scale normalization for the rigging pipeline."""
from __future__ import annotations

import logging

import numpy as np

logger = logging.getLogger(__name__)

SLOT_HEIGHT_RATIOS: dict[str, float] = {
    "TOP": 0.45,
    "BOTTOM": 0.55,
    "DRESS": 0.85,
    "SHOES": 0.08,
}

SLOT_Y_CENTER_OFFSETS: dict[str, float] = {
    "TOP": 0.15,
    "BOTTOM": -0.15,
    "DRESS": 0.0,
    "SHOES": -0.46,
}


def compute_bbox(verts: np.ndarray) -> dict:
    """Compute bounding box information for a vertex array.

    Args:
        verts: (N, 3) vertex array.

    Returns:
        dict with keys: "min" (3,), "max" (3,), "center" (3,), "dimensions" (3,)
    """
    v_min = verts.min(axis=0)
    v_max = verts.max(axis=0)
    center = (v_min + v_max) / 2.0
    dimensions = v_max - v_min
    return {
        "min": v_min,
        "max": v_max,
        "center": center,
        "dimensions": dimensions,
    }


def normalize_garment_to_avatar(
    garment_verts: np.ndarray,
    avatar_verts: np.ndarray,
    slot_hint: str,
) -> tuple[np.ndarray, dict]:
    """Scale and center a garment mesh to fit a given avatar slot.

    Args:
        garment_verts: (N, 3) vertex array for the garment mesh.
        avatar_verts: (M, 3) vertex array for the avatar mesh.
        slot_hint: One of "TOP", "BOTTOM", "DRESS", "SHOES" (or unknown string).

    Returns:
        A tuple of (scaled_verts, scale_info) where scaled_verts is a new (N, 3)
        array and scale_info contains normalization metadata.
    """
    garment_bbox = compute_bbox(garment_verts)
    avatar_bbox = compute_bbox(avatar_verts)

    height_g = float(garment_bbox["dimensions"][1])
    height_a = float(avatar_bbox["dimensions"][1])

    slot_ratio = SLOT_HEIGHT_RATIOS.get(slot_hint, SLOT_HEIGHT_RATIOS["DRESS"])
    expected_height = height_a * slot_ratio
    scale_factor = expected_height / max(height_g, 1e-6)

    scaled_verts = garment_verts.copy()

    if 0.8 <= scale_factor <= 1.2:
        was_normalized = False
        logger.debug(
            "Garment scale_factor=%.4f within [0.8, 1.2]; skipping scale.", scale_factor
        )
    else:
        was_normalized = True
        scaled_verts *= scale_factor
        logger.debug(
            "Garment scaled by factor=%.4f for slot=%s.", scale_factor, slot_hint
        )

    # Center alignment
    avatar_center = avatar_bbox["center"]
    garment_center_after_scale = compute_bbox(scaled_verts)["center"]

    y_offset_ratio = SLOT_Y_CENTER_OFFSETS.get(slot_hint, 0.0)
    target_y = float(avatar_center[1]) + height_a * y_offset_ratio

    translation = np.array(
        [
            float(avatar_center[0]) - float(garment_center_after_scale[0]),
            target_y - float(garment_center_after_scale[1]),
            float(avatar_center[2]) - float(garment_center_after_scale[2]),
        ],
        dtype=np.float64,
    )
    scaled_verts += translation

    scale_info = {
        "original_bbox": {
            "min": garment_bbox["min"].tolist(),
            "max": garment_bbox["max"].tolist(),
        },
        "scale_factor": float(scale_factor),
        "translation": translation.tolist(),
        "was_normalized": was_normalized,
    }

    return scaled_verts, scale_info
