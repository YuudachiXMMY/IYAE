"""Tests for providers/penetration_pushout.py (drape-realism Phase 3 / A1).

Two tiers:
1. Fake-igl tier (always runs): a stub ``igl`` module is injected via sys.modules so the
   push-out math + stats are verified deterministically even when the real igl (a
   Dockerfile.rigging-only dep) is absent. The fake projects query points onto the z=0
   plane; the real module still computes face normals from the supplied avatar mesh.
2. Real-igl tier (skip-guarded on ``_igl_available``): a real unit cube proves the real
   igl BVH path wires up. Skips cleanly in base CI (no igl).
"""
from __future__ import annotations

import importlib
import sys
import types

import numpy as np
import pytest

from providers.penetration_pushout import resolve_penetration

_igl_available = importlib.util.find_spec("igl") is not None


# ---------------------------------------------------------------------------
# Fake igl: project query points onto the z=0 plane (closest_pt = (x, y, 0)).
# ---------------------------------------------------------------------------

def _fake_igl_module():
    mod = types.ModuleType("igl")

    def point_mesh_squared_distance(P, V, F):
        P = np.asarray(P, dtype=np.float64).reshape(-1, 3)
        cp = P.copy()
        cp[:, 2] = 0.0
        sqd = P[:, 2] ** 2
        idx = np.zeros(len(P), dtype=np.int64)
        return sqd, idx, cp

    mod.point_mesh_squared_distance = point_mesh_squared_distance
    return mod


# A real avatar triangle in the z=0 plane whose cross product gives the +z unit normal.
_PLANE_VERTS = np.array([[-10.0, -10.0, 0.0], [10.0, -10.0, 0.0], [0.0, 10.0, 0.0]])
_PLANE_FACES = np.array([[0, 1, 2]], dtype=np.int32)


@pytest.fixture
def fake_igl(monkeypatch):
    monkeypatch.setitem(sys.modules, "igl", _fake_igl_module())
    yield


# ---------------------------------------------------------------------------
# Fake-igl tier — deterministic push math (runs everywhere)
# ---------------------------------------------------------------------------

class TestPushMathWithFakeIgl:
    def test_interior_vertex_pushed_outside(self, fake_igl):
        # 2 cm below the plane (inside, since outward normal is +z).
        g = np.array([[0.0, 0.0, -0.02]])
        out, stats = resolve_penetration(g, _PLANE_VERTS, _PLANE_FACES, fabric_thickness=0.006)
        assert stats["was_applied"] is True
        assert stats["penetrating_before"] == 1
        assert stats["vertices_pushed"] == 1
        assert stats["penetrating_after"] == 0
        # Pushed to exactly fabric_thickness above the plane.
        assert out[0, 2] == pytest.approx(0.006, abs=1e-6)

    def test_exterior_vertex_untouched(self, fake_igl):
        g = np.array([[0.0, 0.0, 0.5]])  # 0.5 m outside — well beyond the shell
        out, stats = resolve_penetration(g, _PLANE_VERTS, _PLANE_FACES, fabric_thickness=0.006)
        assert stats["penetrating_before"] == 0
        assert stats["vertices_pushed"] == 0
        assert np.allclose(out, g)

    def test_max_push_clamp(self, fake_igl):
        # 1 m deep inside → target is ~1.006 m away → must clamp to max_push.
        g = np.array([[0.0, 0.0, -1.0]])
        max_push = 0.05
        out, stats = resolve_penetration(
            g, _PLANE_VERTS, _PLANE_FACES, fabric_thickness=0.006, max_push=max_push
        )
        moved = float(np.linalg.norm(out[0] - g[0]))
        assert moved <= max_push + 1e-6
        assert moved == pytest.approx(max_push, abs=1e-6)
        # Still deep inside after a clamped push → counted as residual penetration.
        assert stats["penetrating_after"] == 1
        assert stats["max_depth_before_m"] == pytest.approx(1.006, abs=1e-6)

    def test_mixed_batch_only_penetrating_moved(self, fake_igl):
        g = np.array([
            [0.0, 0.0, -0.01],  # inside → push
            [1.0, 0.0, 0.30],   # outside → keep
            [-1.0, 0.0, -0.02],  # inside → push
        ])
        out, stats = resolve_penetration(g, _PLANE_VERTS, _PLANE_FACES, fabric_thickness=0.006)
        assert stats["penetrating_before"] == 2
        assert stats["vertices_pushed"] == 2
        assert np.allclose(out[1], g[1])          # exterior untouched
        assert out[0, 2] == pytest.approx(0.006, abs=1e-6)
        assert out[2, 2] == pytest.approx(0.006, abs=1e-6)

    def test_input_not_mutated(self, fake_igl):
        g = np.array([[0.0, 0.0, -0.02]])
        g_before = g.copy()
        resolve_penetration(g, _PLANE_VERTS, _PLANE_FACES)
        assert np.allclose(g, g_before)  # input array untouched (edits go to a copy)


# ---------------------------------------------------------------------------
# Guard cases — no igl needed (empty / degenerate short-circuit before import)
# ---------------------------------------------------------------------------

class TestGuards:
    def test_empty_garment_is_noop(self):
        g = np.empty((0, 3))
        out, stats = resolve_penetration(g, _PLANE_VERTS, _PLANE_FACES)
        assert out.shape == (0, 3)
        assert stats["was_applied"] is False
        assert stats["vertices_pushed"] == 0

    def test_no_avatar_faces_is_noop(self):
        g = np.array([[0.0, 0.0, -0.02]])
        out, stats = resolve_penetration(g, _PLANE_VERTS, np.empty((0, 3), dtype=np.int32))
        assert stats["was_applied"] is False
        assert np.allclose(out, g)

    def test_degenerate_avatar_face_no_nan(self, fake_igl):
        # A zero-area triangle → its face normal is invalid; the vertex must be left
        # unpushed (no NaN/divide-by-zero), not silently corrupted.
        degen_v = np.array([[0.0, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]])
        degen_f = np.array([[0, 1, 2]], dtype=np.int32)
        g = np.array([[0.0, 0.0, -0.02]])
        out, stats = resolve_penetration(g, degen_v, degen_f, fabric_thickness=0.006)
        assert np.all(np.isfinite(out))
        assert stats["penetrating_before"] == 0   # invalid face → not counted
        assert stats["vertices_pushed"] == 0

    def test_stats_keys_present(self, fake_igl):
        g = np.array([[0.0, 0.0, -0.02]])
        _out, stats = resolve_penetration(g, _PLANE_VERTS, _PLANE_FACES)
        for key in (
            "penetrating_before", "penetrating_after", "vertices_pushed",
            "max_depth_before_m", "fabric_thickness_m", "was_applied",
        ):
            assert key in stats, f"missing stats key: {key}"
        assert stats["fabric_thickness_m"] == pytest.approx(0.006)


# ---------------------------------------------------------------------------
# Real-igl tier — proves the real BVH path (skips when igl absent)
# ---------------------------------------------------------------------------

def _make_cube():
    verts = np.array(
        [
            [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
            [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
        ],
        dtype=np.float64,
    )
    faces = np.array(
        [
            [0, 1, 2], [0, 2, 3], [4, 5, 6], [4, 6, 7],
            [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6],
            [0, 3, 7], [0, 7, 4], [1, 2, 6], [1, 6, 5],
        ],
        dtype=np.int32,
    )
    return verts, faces


@pytest.mark.skipif(not _igl_available, reason="igl not installed (Dockerfile.rigging only)")
class TestWithRealIgl:
    def test_shallow_interior_vertex_pushed_out(self):
        cube_v, cube_f = _make_cube()
        g = np.array([[0.5, 0.5, 0.98]])  # 2 cm below the top face (z=1), inside
        out, stats = resolve_penetration(g, cube_v, cube_f, fabric_thickness=0.006)
        assert stats["vertices_pushed"] >= 1
        assert stats["penetrating_after"] == 0
        assert np.all(np.isfinite(out))

    def test_exterior_vertex_untouched(self):
        cube_v, cube_f = _make_cube()
        g = np.array([[0.5, 0.5, 1.6]])  # 0.6 m above the cube
        out, stats = resolve_penetration(g, cube_v, cube_f, fabric_thickness=0.006)
        assert stats["vertices_pushed"] == 0
        assert np.allclose(out, g)
