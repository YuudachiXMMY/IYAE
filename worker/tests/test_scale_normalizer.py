"""Tests for worker/providers/scale_normalizer.py"""
from __future__ import annotations

import numpy as np
import pytest

from providers.scale_normalizer import (
    SLOT_HEIGHT_RATIOS,
    SLOT_Y_CENTER_OFFSETS,
    compute_bbox,
    normalize_garment_to_avatar,
)


class TestComputeBbox:
    def test_returns_correct_min_max(self):
        verts = np.array([[0, 0, 0], [1, 2, 3]], dtype=np.float64)
        bbox = compute_bbox(verts)
        np.testing.assert_array_almost_equal(bbox["min"], [0, 0, 0])
        np.testing.assert_array_almost_equal(bbox["max"], [1, 2, 3])

    def test_returns_correct_center(self):
        verts = np.array([[0, 0, 0], [1, 2, 3]], dtype=np.float64)
        bbox = compute_bbox(verts)
        np.testing.assert_array_almost_equal(bbox["center"], [0.5, 1.0, 1.5])

    def test_returns_correct_dimensions(self):
        verts = np.array([[0, 0, 0], [1, 2, 3]], dtype=np.float64)
        bbox = compute_bbox(verts)
        np.testing.assert_array_almost_equal(bbox["dimensions"], [1, 2, 3])

    def test_single_vertex(self):
        verts = np.array([[5, 3, 1]], dtype=np.float64)
        bbox = compute_bbox(verts)
        np.testing.assert_array_almost_equal(bbox["dimensions"], [0, 0, 0])
        np.testing.assert_array_almost_equal(bbox["min"], [5, 3, 1])
        np.testing.assert_array_almost_equal(bbox["max"], [5, 3, 1])


class TestNormalizeGarmentToAvatar:
    def _make_avatar_verts(self) -> np.ndarray:
        """Helper: create a simple avatar-like bbox ~1.7m tall centered roughly at Y=0.85."""
        return np.array([[-0.3, 0, -0.15], [0.3, 1.7, 0.15]], dtype=np.float64)

    def _make_garment_verts(self, height: float, center_y: float = 0.0) -> np.ndarray:
        """Helper: create a simple garment box with a given height."""
        half = height / 2.0
        return np.array(
            [
                [-0.2, center_y - half, -0.1],
                [0.2, center_y + half, 0.1],
            ],
            dtype=np.float64,
        )

    def test_already_correct_scale_skips(self):
        """Garment height ~0.765m for TOP slot (0.45 * 1.7); scale_factor ≈ 1.0 -> was_normalized=False."""
        avatar_verts = self._make_avatar_verts()
        # 0.45 * 1.7 = 0.765
        garment_verts = self._make_garment_verts(height=0.765)
        _, info = normalize_garment_to_avatar(garment_verts, avatar_verts, "TOP")
        assert info["was_normalized"] is False
        assert 0.8 <= info["scale_factor"] <= 1.2

    def test_garment_too_large_scales_down(self):
        """Garment 10x too large -> scale_factor < 0.8 -> was_normalized=True; output height matches expected."""
        avatar_verts = self._make_avatar_verts()
        expected_height = 1.7 * SLOT_HEIGHT_RATIOS["TOP"]
        garment_verts = self._make_garment_verts(height=expected_height * 10)
        out_verts, info = normalize_garment_to_avatar(garment_verts, avatar_verts, "TOP")
        assert info["was_normalized"] is True
        assert info["scale_factor"] < 0.8
        out_bbox = compute_bbox(out_verts)
        assert abs(out_bbox["dimensions"][1] - expected_height) < 0.01

    def test_garment_too_small_scales_up(self):
        """Garment 0.1x too small -> scale_factor > 1.2 -> was_normalized=True."""
        avatar_verts = self._make_avatar_verts()
        expected_height = 1.7 * SLOT_HEIGHT_RATIOS["TOP"]
        garment_verts = self._make_garment_verts(height=expected_height * 0.1)
        _, info = normalize_garment_to_avatar(garment_verts, avatar_verts, "TOP")
        assert info["was_normalized"] is True
        assert info["scale_factor"] > 1.2

    def test_slot_top_uses_top_ratio(self):
        """Verify scale uses 0.45 ratio for TOP slot."""
        avatar_verts = self._make_avatar_verts()
        avatar_height = 1.7
        # garment height far from target so scale_factor will be 0.45
        garment_verts = self._make_garment_verts(height=1.0)
        _, info = normalize_garment_to_avatar(garment_verts, avatar_verts, "TOP")
        expected_scale = (avatar_height * 0.45) / 1.0
        assert abs(info["scale_factor"] - expected_scale) < 1e-6

    def test_slot_bottom_uses_bottom_ratio(self):
        """Verify scale uses 0.55 ratio for BOTTOM slot."""
        avatar_verts = self._make_avatar_verts()
        avatar_height = 1.7
        garment_verts = self._make_garment_verts(height=1.0)
        _, info = normalize_garment_to_avatar(garment_verts, avatar_verts, "BOTTOM")
        expected_scale = (avatar_height * 0.55) / 1.0
        assert abs(info["scale_factor"] - expected_scale) < 1e-6

    def test_slot_dress_uses_dress_ratio(self):
        """Verify scale uses 0.85 ratio for DRESS slot."""
        avatar_verts = self._make_avatar_verts()
        avatar_height = 1.7
        garment_verts = self._make_garment_verts(height=1.0)
        _, info = normalize_garment_to_avatar(garment_verts, avatar_verts, "DRESS")
        expected_scale = (avatar_height * 0.85) / 1.0
        assert abs(info["scale_factor"] - expected_scale) < 1e-6

    def test_y_centering_matches_slot_position(self):
        """After normalization, garment center_y should be near avatar target."""
        avatar_verts = self._make_avatar_verts()
        avatar_bbox = compute_bbox(avatar_verts)
        avatar_center_y = float(avatar_bbox["center"][1])
        avatar_height = float(avatar_bbox["dimensions"][1])

        garment_verts = self._make_garment_verts(height=1.0)
        out_verts, _ = normalize_garment_to_avatar(garment_verts, avatar_verts, "TOP")

        out_bbox = compute_bbox(out_verts)
        target_y = avatar_center_y + avatar_height * SLOT_Y_CENTER_OFFSETS["TOP"]
        assert abs(float(out_bbox["center"][1]) - target_y) < 1e-6

    def test_xz_centering_matches_avatar_center(self):
        """Garment center_x and center_z should match avatar center after normalization."""
        avatar_verts = self._make_avatar_verts()
        avatar_bbox = compute_bbox(avatar_verts)

        garment_verts = self._make_garment_verts(height=1.0)
        out_verts, _ = normalize_garment_to_avatar(garment_verts, avatar_verts, "DRESS")

        out_bbox = compute_bbox(out_verts)
        assert abs(float(out_bbox["center"][0]) - float(avatar_bbox["center"][0])) < 1e-6
        assert abs(float(out_bbox["center"][2]) - float(avatar_bbox["center"][2])) < 1e-6

    def test_immutability(self):
        """Original garment_verts array must not be modified."""
        avatar_verts = self._make_avatar_verts()
        garment_verts = self._make_garment_verts(height=5.0)
        original_copy = garment_verts.copy()
        normalize_garment_to_avatar(garment_verts, avatar_verts, "TOP")
        np.testing.assert_array_equal(garment_verts, original_copy)

    def test_zero_height_garment_no_crash(self):
        """Garment with all vertices at same Y -> no division by zero; uses 1e-6 floor."""
        avatar_verts = self._make_avatar_verts()
        garment_verts = np.array(
            [[-0.1, 0.5, -0.1], [0.1, 0.5, 0.1]], dtype=np.float64
        )
        out_verts, info = normalize_garment_to_avatar(garment_verts, avatar_verts, "DRESS")
        # scale_factor should be very large (not NaN or inf crash)
        assert np.isfinite(info["scale_factor"])
        assert info["scale_factor"] > 1.2
        assert info["was_normalized"] is True

    def test_unknown_slot_defaults_to_dress(self):
        """slot_hint='UNKNOWN' -> uses DRESS ratio 0.85."""
        avatar_verts = self._make_avatar_verts()
        avatar_height = 1.7
        garment_verts = self._make_garment_verts(height=1.0)
        _, info_unknown = normalize_garment_to_avatar(garment_verts, avatar_verts, "UNKNOWN")
        _, info_dress = normalize_garment_to_avatar(garment_verts, avatar_verts, "DRESS")
        assert abs(info_unknown["scale_factor"] - info_dress["scale_factor"]) < 1e-6
