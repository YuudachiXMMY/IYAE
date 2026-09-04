"""Tests for generate_pose_glbs.py pose GLB generation."""

from __future__ import annotations

import math
import sys
from pathlib import Path

import pytest

# ---------------------------------------------------------------------------
# Path setup: add worker root and scripts to sys.path so we can import
# generate_pose_glbs (which lives under worker/scripts/).
# ---------------------------------------------------------------------------
_WORKER_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_WORKER_ROOT))
sys.path.insert(0, str(_WORKER_ROOT / "scripts"))

try:
    import pygltflib  # noqa: F401

    _HAS_PYGLTFLIB = True
except ImportError:
    _HAS_PYGLTFLIB = False

pytestmark = pytest.mark.skipif(
    not _HAS_PYGLTFLIB,
    reason="pygltflib not installed",
)

from generate_pose_glbs import (  # noqa: E402
    POSES,
    PoseDef,
    _build_pose_glb,
    axis_angle_to_quaternion,
    compose_quaternions,
)


# ---------------------------------------------------------------------------
# Quaternion helpers
# ---------------------------------------------------------------------------


class TestAxisAngleToQuaternion:
    def test_identity(self) -> None:
        """Zero rotation produces identity quaternion (0,0,0,1)."""
        x, y, z, w = axis_angle_to_quaternion(0.0, 0.0, 0.0)
        assert x == pytest.approx(0.0, abs=1e-9)
        assert y == pytest.approx(0.0, abs=1e-9)
        assert z == pytest.approx(0.0, abs=1e-9)
        assert w == pytest.approx(1.0, abs=1e-9)

    def test_90deg_z(self) -> None:
        """90-degree rotation around Z axis: w should be cos(pi/4)."""
        half_pi = math.pi / 2.0
        x, y, z, w = axis_angle_to_quaternion(0.0, 0.0, half_pi)
        assert w == pytest.approx(math.cos(math.pi / 4.0), abs=1e-7)
        assert x == pytest.approx(0.0, abs=1e-9)
        assert y == pytest.approx(0.0, abs=1e-9)
        assert z == pytest.approx(math.sin(math.pi / 4.0), abs=1e-7)


class TestComposeQuaternions:
    def test_identity_composition(self) -> None:
        """Composing identity with any quaternion returns that quaternion."""
        identity = (0.0, 0.0, 0.0, 1.0)
        q = (0.1, 0.2, 0.3, 0.9)
        result = compose_quaternions(identity, q)
        for i in range(4):
            assert result[i] == pytest.approx(q[i], abs=1e-9)


# ---------------------------------------------------------------------------
# POSES data
# ---------------------------------------------------------------------------


class TestPosesData:
    def test_poses_count(self) -> None:
        """POSES list should have 6 entries (5 original + 1 breathing-idle)."""
        assert len(POSES) == 6

    def test_single_frame_poses_have_no_frames(self) -> None:
        """First 5 poses are single-frame and should have frames=None."""
        for pose in POSES[:5]:
            assert pose.frames is None, f"{pose.name} should have frames=None"

    def test_breathing_idle_has_frames(self) -> None:
        """The breathing-idle pose should have frames (not None) with 3 frames."""
        breathing = POSES[5]
        assert breathing.name == "breathing-idle"
        assert breathing.frames is not None
        assert len(breathing.frames) == 3

    def test_breathing_idle_fps(self) -> None:
        """The breathing-idle pose should have fps=15.0."""
        breathing = POSES[5]
        assert breathing.fps == 15.0


# ---------------------------------------------------------------------------
# GLB building
# ---------------------------------------------------------------------------


class TestBuildPoseGlb:
    def test_build_single_frame_glb(self) -> None:
        """Single-frame GLB starts with glTF magic header."""
        glb_bytes = _build_pose_glb(POSES[0])
        assert isinstance(glb_bytes, bytes)
        assert glb_bytes[:4] == b"glTF"

    def test_build_multiframe_glb(self) -> None:
        """Multi-frame GLB starts with glTF magic header."""
        glb_bytes = _build_pose_glb(POSES[5])
        assert isinstance(glb_bytes, bytes)
        assert glb_bytes[:4] == b"glTF"

    def test_multiframe_glb_larger_than_single(self) -> None:
        """Multi-frame GLB should be larger than single-frame GLB."""
        single = _build_pose_glb(POSES[0])
        multi = _build_pose_glb(POSES[5])
        assert len(multi) > len(single)
