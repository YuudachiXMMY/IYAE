"""Tests for validator module."""
import math
import os
import struct
import tempfile
from unittest.mock import MagicMock, patch
import pytest
from validator import (
    validate_glb,
    validate_usdz,
    validate_metadata,
    validate_triangle_count,
    validate_bounding_box,
    validate_no_nan,
    validate_rigged_glb,
    validate_skin_metadata,
    validate_required_bones,
    GLB_MAGIC,
)


class TestValidateGlb:
    def test_missing_file(self):
        result = validate_glb("/nonexistent/file.glb")
        assert not result["valid"]
        assert "does not exist" in result["errors"][0]

    def test_empty_file(self):
        with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as f:
            f.write(b"")
            path = f.name
        try:
            result = validate_glb(path)
            assert not result["valid"]
            assert "empty" in result["errors"][0]
        finally:
            os.unlink(path)

    def test_invalid_magic(self):
        with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as f:
            f.write(b"NOT_GLB_DATA_HERE")
            path = f.name
        try:
            result = validate_glb(path)
            assert not result["valid"]
            assert "Invalid magic" in result["errors"][0]
        finally:
            os.unlink(path)

    def test_valid_glb(self):
        with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as f:
            # Write minimal valid GLB header
            f.write(GLB_MAGIC)
            f.write(struct.pack("<I", 2))   # version
            f.write(struct.pack("<I", 12))  # total length (header only)
            path = f.name
        try:
            result = validate_glb(path)
            assert result["valid"]
        finally:
            os.unlink(path)


class TestValidateUsdz:
    def test_missing_file(self):
        result = validate_usdz("/nonexistent/file.usdz")
        assert not result["valid"]

    def test_valid_usdz(self):
        with tempfile.NamedTemporaryFile(suffix=".usdz", delete=False) as f:
            f.write(b"some content")
            path = f.name
        try:
            result = validate_usdz(path)
            assert result["valid"]
        finally:
            os.unlink(path)


class TestValidateTriangleCount:
    def test_within_limit_passes(self):
        errors = validate_triangle_count({"triangle_count": 100_000})
        assert errors == []

    def test_at_limit_passes(self):
        errors = validate_triangle_count({"triangle_count": 500_000})
        assert errors == []

    def test_exceeds_limit_fails(self):
        errors = validate_triangle_count({"triangle_count": 500_001})
        assert len(errors) == 1
        assert "exceeds limit" in errors[0]

    def test_missing_field_passes(self):
        errors = validate_triangle_count({})
        assert errors == []

    def test_zero_passes(self):
        errors = validate_triangle_count({"triangle_count": 0})
        assert errors == []


class TestValidateBoundingBox:
    def _bbox(self, min_coords, max_coords):
        return {"bbox": {"min": min_coords, "max": max_coords}}

    def test_valid_bbox_passes(self):
        errors = validate_bounding_box(self._bbox([0.0, 0.0, 0.0], [0.5, 1.0, 0.5]))
        assert errors == []

    def test_missing_bbox_passes(self):
        errors = validate_bounding_box({})
        assert errors == []

    def test_dimension_too_small_fails(self):
        errors = validate_bounding_box(self._bbox([0.0, 0.0, 0.0], [0.001, 1.0, 0.5]))
        assert any("below minimum" in e for e in errors)

    def test_dimension_too_large_fails(self):
        errors = validate_bounding_box(self._bbox([0.0, 0.0, 0.0], [1.0, 15.0, 1.0]))
        assert any("above maximum" in e for e in errors)

    def test_missing_min_max_keys_fails(self):
        errors = validate_bounding_box({"bbox": {"min": [0, 0, 0]}})
        assert any("'min' and 'max'" in e for e in errors)

    def test_wrong_component_count_fails(self):
        errors = validate_bounding_box({"bbox": {"min": [0, 0], "max": [1, 1]}})
        assert any("3 components" in e for e in errors)


class TestValidateNoNan:
    def test_clean_metadata_passes(self):
        metadata = {
            "sanity": {"has_nan_vertices": False},
            "bbox": {"min": [0.0, 0.0, 0.0], "max": [0.5, 1.0, 0.5]},
        }
        errors = validate_no_nan(metadata)
        assert errors == []

    def test_has_nan_vertices_flag_fails(self):
        errors = validate_no_nan({"sanity": {"has_nan_vertices": True}})
        assert any("NaN vertices" in e for e in errors)

    def test_nan_in_bbox_min_fails(self):
        errors = validate_no_nan({"bbox": {"min": [float("nan"), 0.0, 0.0], "max": [1.0, 1.0, 1.0]}})
        assert any("NaN or Inf" in e for e in errors)

    def test_inf_in_bbox_max_fails(self):
        errors = validate_no_nan({"bbox": {"min": [0.0, 0.0, 0.0], "max": [1.0, math.inf, 1.0]}})
        assert any("NaN or Inf" in e for e in errors)

    def test_missing_sanity_passes(self):
        errors = validate_no_nan({})
        assert errors == []


class TestValidateMetadata:
    def test_normal_model_passes(self):
        metadata = {
            "triangle_count": 8500,
            "bbox": {"min": [0.0, 0.0, 0.0], "max": [0.5, 1.0, 0.5]},
            "sanity": {"has_nan_vertices": False},
        }
        result = validate_metadata(metadata)
        assert result["valid"]
        assert result["errors"] == []

    def test_triangle_count_over_limit_fails(self):
        metadata = {"triangle_count": 600_000}
        result = validate_metadata(metadata)
        assert not result["valid"]
        assert any("exceeds limit" in e for e in result["errors"])

    def test_bbox_out_of_range_fails(self):
        metadata = {"bbox": {"min": [0.0, 0.0, 0.0], "max": [0.001, 1.0, 0.5]}}
        result = validate_metadata(metadata)
        assert not result["valid"]
        assert any("below minimum" in e for e in result["errors"])

    def test_nan_vertices_fails(self):
        metadata = {"sanity": {"has_nan_vertices": True}}
        result = validate_metadata(metadata)
        assert not result["valid"]
        assert any("NaN vertices" in e for e in result["errors"])

    def test_empty_metadata_passes(self):
        result = validate_metadata({})
        assert result["valid"]


def _make_valid_glb_file() -> str:
    """Write a minimal valid GLB file to a temp path and return its path."""
    with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as f:
        f.write(GLB_MAGIC)
        f.write(struct.pack("<I", 2))   # version
        f.write(struct.pack("<I", 12))  # total length
        return f.name


def _make_mock_gltf(
    *,
    skins=None,
    meshes=None,
    nodes=None,
):
    """Build a MagicMock that looks like a pygltflib GLTF2 instance."""
    gltf = MagicMock()
    gltf.skins = skins if skins is not None else []
    gltf.meshes = meshes if meshes is not None else []
    gltf.nodes = nodes if nodes is not None else []
    return gltf


def _make_skin(joints=None, inverse_bind=0):
    """Build a mock skin object."""
    skin = MagicMock()
    skin.joints = joints if joints is not None else [0, 1, 2]
    skin.inverseBindMatrices = inverse_bind
    return skin


def _make_primitive(joints_0=0, weights_0=1):
    """Build a mock mesh primitive with JOINTS_0 and WEIGHTS_0 attributes."""
    attrs = MagicMock()
    attrs.JOINTS_0 = joints_0
    attrs.WEIGHTS_0 = weights_0
    prim = MagicMock()
    prim.attributes = attrs
    return prim


def _make_mesh(primitives=None):
    """Build a mock mesh with the given primitives."""
    mesh = MagicMock()
    mesh.primitives = primitives if primitives is not None else [_make_primitive()]
    return mesh


def _make_node(name: str):
    node = MagicMock()
    node.name = name
    return node


class TestValidateRiggedGlb:
    def test_validate_rigged_glb_calls_validate_glb_first(self):
        """An invalid GLB header must fail before skin check is ever attempted."""
        with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as f:
            f.write(b"NOT_GLB_DATA")
            path = f.name
        try:
            result = validate_rigged_glb(path)
            assert not result["valid"]
            assert any("Invalid magic" in e for e in result["errors"])
        finally:
            os.unlink(path)

    def test_validate_rigged_glb_valid(self):
        """Valid GLB header + valid skin passes."""
        path = _make_valid_glb_file()
        try:
            skin = _make_skin()
            mesh = _make_mesh()
            gltf = _make_mock_gltf(skins=[skin], meshes=[mesh])
            with patch("pygltflib.GLTF2") as MockGLTF2:
                MockGLTF2.load.return_value = gltf
                result = validate_rigged_glb(path)
            assert result["valid"]
            assert result["errors"] == []
        finally:
            os.unlink(path)


class TestValidateSkinMetadata:
    def test_validate_skin_metadata_no_skins(self):
        """GLB with empty skins list is invalid."""
        path = _make_valid_glb_file()
        try:
            gltf = _make_mock_gltf(skins=[])
            with patch("pygltflib.GLTF2") as MockGLTF2:
                MockGLTF2.load.return_value = gltf
                result = validate_skin_metadata(path)
            assert not result["valid"]
            assert any("No skins found" in e for e in result["errors"])
        finally:
            os.unlink(path)

    def test_validate_skin_metadata_no_joints(self):
        """Skin with empty joints list is invalid."""
        path = _make_valid_glb_file()
        try:
            skin = _make_skin(joints=[])
            mesh = _make_mesh()
            gltf = _make_mock_gltf(skins=[skin], meshes=[mesh])
            with patch("pygltflib.GLTF2") as MockGLTF2:
                MockGLTF2.load.return_value = gltf
                result = validate_skin_metadata(path)
            assert not result["valid"]
            assert any("no joints" in e for e in result["errors"])
        finally:
            os.unlink(path)

    def test_validate_skin_metadata_no_inverse_bind(self):
        """Skin missing inverseBindMatrices is invalid."""
        path = _make_valid_glb_file()
        try:
            skin = _make_skin(inverse_bind=None)
            mesh = _make_mesh()
            gltf = _make_mock_gltf(skins=[skin], meshes=[mesh])
            with patch("pygltflib.GLTF2") as MockGLTF2:
                MockGLTF2.load.return_value = gltf
                result = validate_skin_metadata(path)
            assert not result["valid"]
            assert any("inverseBindMatrices" in e for e in result["errors"])
        finally:
            os.unlink(path)

    def test_validate_skin_metadata_no_joints_0_attr(self):
        """Mesh primitive without JOINTS_0 attribute is invalid."""
        path = _make_valid_glb_file()
        try:
            skin = _make_skin()
            prim = _make_primitive(joints_0=None)
            mesh = _make_mesh(primitives=[prim])
            gltf = _make_mock_gltf(skins=[skin], meshes=[mesh])
            with patch("pygltflib.GLTF2") as MockGLTF2:
                MockGLTF2.load.return_value = gltf
                result = validate_skin_metadata(path)
            assert not result["valid"]
            assert any("JOINTS_0" in e for e in result["errors"])
        finally:
            os.unlink(path)

    def test_validate_skin_metadata_no_weights_0_attr(self):
        """Mesh primitive without WEIGHTS_0 attribute is invalid."""
        path = _make_valid_glb_file()
        try:
            skin = _make_skin()
            prim = _make_primitive(weights_0=None)
            mesh = _make_mesh(primitives=[prim])
            gltf = _make_mock_gltf(skins=[skin], meshes=[mesh])
            with patch("pygltflib.GLTF2") as MockGLTF2:
                MockGLTF2.load.return_value = gltf
                result = validate_skin_metadata(path)
            assert not result["valid"]
            assert any("WEIGHTS_0" in e for e in result["errors"])
        finally:
            os.unlink(path)


class TestValidateRequiredBones:
    def _make_gltf_with_bones(self, bone_names: list[str]):
        """Return a mock GLTF2 with a skin whose joints reference named nodes."""
        nodes = [_make_node(name) for name in bone_names]
        skin = _make_skin(joints=list(range(len(bone_names))))
        return _make_mock_gltf(skins=[skin], nodes=nodes)

    def test_validate_required_bones_top_valid(self):
        """All required TOP bones present — must pass."""
        path = _make_valid_glb_file()
        try:
            top_bones = [
                "pelvis", "spine1", "spine2", "spine3",
                "neck", "head",
                "left_collar", "right_collar",
                "left_shoulder", "right_shoulder",
                "left_elbow", "right_elbow",
                "left_wrist", "right_wrist",
            ]
            gltf = self._make_gltf_with_bones(top_bones)
            with patch("pygltflib.GLTF2") as MockGLTF2:
                MockGLTF2.load.return_value = gltf
                result = validate_required_bones(path, "TOP")
            assert result["valid"]
            assert result["errors"] == []
        finally:
            os.unlink(path)

    def test_validate_required_bones_top_missing(self):
        """Missing shoulder bones for TOP slot — must fail."""
        path = _make_valid_glb_file()
        try:
            partial_bones = ["pelvis", "spine1", "spine2", "spine3", "neck"]
            gltf = self._make_gltf_with_bones(partial_bones)
            with patch("pygltflib.GLTF2") as MockGLTF2:
                MockGLTF2.load.return_value = gltf
                result = validate_required_bones(path, "TOP")
            assert not result["valid"]
            assert any("Missing required bones" in e for e in result["errors"])
        finally:
            os.unlink(path)

    def test_validate_required_bones_returns_bone_names(self):
        """bone_names list in result must reflect actual joint node names."""
        path = _make_valid_glb_file()
        try:
            bones = ["pelvis", "left_hip", "right_hip", "left_knee", "right_knee",
                     "left_ankle", "right_ankle", "left_foot", "right_foot"]
            gltf = self._make_gltf_with_bones(bones)
            with patch("pygltflib.GLTF2") as MockGLTF2:
                MockGLTF2.load.return_value = gltf
                result = validate_required_bones(path, "BOTTOM")
            assert result["valid"]
            assert set(result["bone_names"]) == set(bones)
        finally:
            os.unlink(path)
