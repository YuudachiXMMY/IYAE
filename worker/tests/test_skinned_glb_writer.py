"""Tests for skinned_glb_writer — round-trip GLB validation."""
import struct
from pathlib import Path

import numpy as np
import pytest
import pygltflib

from providers.skinned_glb_writer import (
    build_joint_hierarchy,
    compute_inverse_bind_matrices,
    write_skinned_glb,
)
from providers.canonical_skeleton import (
    SLOT_BONE_SUBSETS,
    SMPLX_JOINT_NAMES,
    SMPLX_PARENT_INDICES,
)
from validator import (
    validate_glb,
    validate_glb_geometry,
    validate_material_and_uv,
    validate_skin_metadata,
    validate_required_bones,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_test_mesh():
    vertices = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]], dtype=np.float32)
    normals = np.array([[0, 0, 1], [0, 0, 1], [0, 0, 1], [0, 0, 1]], dtype=np.float32)
    indices = np.array([[0, 1, 2], [0, 2, 3]], dtype=np.uint32)
    joint_indices = np.array([[0, 1, 2, 3]] * 4, dtype=np.uint8)
    joint_weights = np.array([[0.7, 0.1, 0.1, 0.1]] * 4, dtype=np.float32)
    return vertices, normals, indices, joint_indices, joint_weights


def make_joint_positions(names: list[str]) -> np.ndarray:
    positions = np.zeros((len(names), 3), dtype=np.float32)
    for i in range(len(names)):
        positions[i, 1] = i * 0.1
    return positions


def write_for_slot(tmp_path: Path, slot: str) -> Path:
    subset = SLOT_BONE_SUBSETS[slot]
    if subset is None:
        names = SMPLX_JOINT_NAMES
        parents = SMPLX_PARENT_INDICES
    else:
        full_name_set = set(subset)
        names = [n for n in SMPLX_JOINT_NAMES if n in full_name_set]
        parents_map = {n: SMPLX_PARENT_INDICES[i] for i, n in enumerate(SMPLX_JOINT_NAMES)}
        name_to_idx = {n: i for i, n in enumerate(names)}
        parents = []
        for name in names:
            old_parent = parents_map[name]
            if old_parent == -1:
                parents.append(-1)
            else:
                old_parent_name = SMPLX_JOINT_NAMES[old_parent]
                parents.append(name_to_idx.get(old_parent_name, -1))

    positions = make_joint_positions(names)
    vertices, normals, indices, ji, jw = make_test_mesh()
    # Clamp joint indices to valid range for this subset
    ji_clamped = np.clip(ji, 0, max(0, len(names) - 1)).astype(np.uint8)

    out = tmp_path / f"test_{slot.lower()}.glb"
    write_skinned_glb(
        output_path=out,
        vertices=vertices,
        normals=normals,
        indices=indices,
        joint_indices=ji_clamped,
        joint_weights=jw,
        joint_names=names,
        parent_indices=parents,
        joint_positions=positions,
        slot_hint=slot,
    )
    return out


# ---------------------------------------------------------------------------
# Unit tests for helper functions
# ---------------------------------------------------------------------------

class TestBuildJointHierarchy:
    def test_single_root(self):
        names = ["root", "child"]
        parents = [-1, 0]
        nodes, roots = build_joint_hierarchy(names, parents)
        assert roots == [0]
        assert 1 in nodes[0]["children"]

    def test_names_preserved(self):
        names = ["a", "b", "c"]
        parents = [-1, 0, 0]
        nodes, _ = build_joint_hierarchy(names, parents)
        assert [n["name"] for n in nodes] == names


class TestComputeInverseBindMatrices:
    def test_shape(self):
        positions = np.array([[1.0, 2.0, 3.0], [0.0, 0.0, 0.0]], dtype=np.float32)
        ibms = compute_inverse_bind_matrices(positions)
        assert ibms.shape == (2, 4, 4)

    def test_inverse_translation(self):
        positions = np.array([[1.0, 2.0, 3.0]], dtype=np.float32)
        ibms = compute_inverse_bind_matrices(positions)
        flat = ibms[0].reshape(-1)
        # Column-major: translation at flat index 12, 13, 14
        assert flat[12] == pytest.approx(-1.0)
        assert flat[13] == pytest.approx(-2.0)
        assert flat[14] == pytest.approx(-3.0)
        assert flat[15] == pytest.approx(1.0)
        # Old row-major positions should be zero
        assert flat[3] == pytest.approx(0.0)
        assert flat[7] == pytest.approx(0.0)
        assert flat[11] == pytest.approx(0.0)

    def test_ibm_column_major_tobytes(self):
        """Verify tobytes() produces glTF-compatible column-major float32 layout."""
        import struct as _struct
        positions = np.array([[1.0, 2.0, 3.0]], dtype=np.float32)
        ibms = compute_inverse_bind_matrices(positions)
        raw = ibms[0].tobytes()
        assert len(raw) == 64
        floats = _struct.unpack('<16f', raw)
        assert floats[12] == pytest.approx(-1.0)
        assert floats[13] == pytest.approx(-2.0)
        assert floats[14] == pytest.approx(-3.0)
        assert floats[15] == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# Round-trip integration tests
# ---------------------------------------------------------------------------

class TestPositionBounds:
    """C1: POSITION accessor must carry min/max, else validate_glb_geometry fails closed."""

    def test_position_accessor_has_min_max(self, tmp_path):
        out = write_for_slot(tmp_path, "TOP")
        gltf = pygltflib.GLTF2.load(str(out))
        pos = gltf.accessors[0]  # accessor 0 is POSITION
        assert pos.min is not None and pos.max is not None
        # make_test_mesh vertices span [0,0,0] -> [1,1,1]
        assert pos.min == pytest.approx([0.0, 0.0, 0.0])
        assert pos.max == pytest.approx([1.0, 1.0, 1.0])

    def test_skinned_glb_passes_geometry_validation(self, tmp_path):
        # Exact production repro: before the fix, write_skinned_glb output failed
        # validate_glb_geometry with "POSITION min/max bounds absent", rejecting every
        # rigged garment and every real SMPL-X avatar.
        out = write_for_slot(tmp_path, "TOP")
        result = validate_glb_geometry(str(out))
        assert result["valid"], result["errors"]
        assert not any("bounds absent" in e for e in result["errors"])


class TestRoundTripGlbHeader:
    def test_valid_glb_header(self, tmp_path):
        out = write_for_slot(tmp_path, "TOP")
        result = validate_glb(str(out))
        assert result["valid"], result["errors"]


class TestRoundTripSkinMetadata:
    def test_skin_metadata_passes(self, tmp_path):
        out = write_for_slot(tmp_path, "TOP")
        result = validate_skin_metadata(str(out))
        assert result["valid"], result["errors"]

    def test_dress_skin_metadata_passes(self, tmp_path):
        out = write_for_slot(tmp_path, "DRESS")
        result = validate_skin_metadata(str(out))
        assert result["valid"], result["errors"]


class TestRoundTripRequiredBones:
    def test_top_required_bones(self, tmp_path):
        out = write_for_slot(tmp_path, "TOP")
        result = validate_required_bones(str(out), "TOP")
        assert result["valid"], result["errors"]

    def test_bottom_required_bones(self, tmp_path):
        out = write_for_slot(tmp_path, "BOTTOM")
        result = validate_required_bones(str(out), "BOTTOM")
        assert result["valid"], result["errors"]

    def test_dress_required_bones(self, tmp_path):
        out = write_for_slot(tmp_path, "DRESS")
        result = validate_required_bones(str(out), "DRESS")
        assert result["valid"], result["errors"]


class TestBufferAlignment:
    def test_all_buffer_views_4byte_aligned(self, tmp_path):
        out = write_for_slot(tmp_path, "TOP")
        gltf = pygltflib.GLTF2.load(str(out))
        for bv in gltf.bufferViews:
            assert bv.byteOffset % 4 == 0, (
                f"BufferView byteOffset {bv.byteOffset} is not 4-byte aligned"
            )


class TestShapeValidation:
    def test_wrong_vertex_shape_raises(self, tmp_path):
        """Vertices with wrong shape should raise ValueError."""
        bad_verts = np.zeros((5, 2), dtype=np.float32)  # should be (5, 3)
        normals = np.zeros((5, 3), dtype=np.float32)
        indices = np.array([[0, 1, 2]], dtype=np.uint32)
        ji = np.zeros((5, 4), dtype=np.uint8)
        jw = np.ones((5, 4), dtype=np.float32) / 4
        with pytest.raises(ValueError, match="vertices must be"):
            write_skinned_glb(
                output_path=tmp_path / "bad.glb",
                vertices=bad_verts, normals=normals, indices=indices,
                joint_indices=ji, joint_weights=jw,
                joint_names=["root"], parent_indices=[-1],
                joint_positions=np.zeros((1, 3), dtype=np.float32),
            )

    def test_wrong_joint_indices_shape_raises(self, tmp_path):
        """joint_indices with wrong shape should raise ValueError."""
        verts = np.zeros((5, 3), dtype=np.float32)
        normals = np.zeros((5, 3), dtype=np.float32)
        indices = np.array([[0, 1, 2]], dtype=np.uint32)
        bad_ji = np.zeros((5, 3), dtype=np.uint8)  # should be (5, 4)
        jw = np.ones((5, 4), dtype=np.float32) / 4
        with pytest.raises(ValueError, match="joint_indices must be"):
            write_skinned_glb(
                output_path=tmp_path / "bad.glb",
                vertices=verts, normals=normals, indices=indices,
                joint_indices=bad_ji, joint_weights=jw,
                joint_names=["root"], parent_indices=[-1],
                joint_positions=np.zeros((1, 3), dtype=np.float32),
            )

    def test_wrong_joint_weights_shape_raises(self, tmp_path):
        """joint_weights with wrong shape should raise ValueError."""
        verts = np.zeros((5, 3), dtype=np.float32)
        normals = np.zeros((5, 3), dtype=np.float32)
        indices = np.array([[0, 1, 2]], dtype=np.uint32)
        ji = np.zeros((5, 4), dtype=np.uint8)
        bad_jw = np.ones((5, 3), dtype=np.float32) / 3  # should be (5, 4)
        with pytest.raises(ValueError, match="joint_weights must be"):
            write_skinned_glb(
                output_path=tmp_path / "bad.glb",
                vertices=verts, normals=normals, indices=indices,
                joint_indices=ji, joint_weights=bad_jw,
                joint_names=["root"], parent_indices=[-1],
                joint_positions=np.zeros((1, 3), dtype=np.float32),
            )


class TestLocalJointTranslations:
    def test_child_uses_local_offset(self, tmp_path):
        """Non-root joints should have local (relative to parent) translations."""
        names = ["root", "child", "grandchild"]
        parents = [-1, 0, 1]
        positions = np.array([[0, 1.0, 0], [0, 1.5, 0], [0, 2.0, 0]], dtype=np.float32)
        vertices, normals, indices, ji, jw = make_test_mesh()
        ji_clamped = np.clip(ji, 0, len(names) - 1).astype(np.uint8)
        out = tmp_path / "local_test.glb"
        write_skinned_glb(
            output_path=out, vertices=vertices, normals=normals, indices=indices,
            joint_indices=ji_clamped, joint_weights=jw,
            joint_names=names, parent_indices=parents, joint_positions=positions,
        )
        gltf = pygltflib.GLTF2.load(str(out))
        assert gltf.nodes[0].translation[1] == pytest.approx(1.0)
        assert gltf.nodes[1].translation[1] == pytest.approx(0.5)
        assert gltf.nodes[2].translation[1] == pytest.approx(0.5)

    def test_root_joint_keeps_world_position(self, tmp_path):
        """Root joints (parent=-1) should retain world position as translation."""
        names = ["root"]
        parents = [-1]
        positions = np.array([[0.5, 1.0, 0.3]], dtype=np.float32)
        vertices, normals, indices, ji, jw = make_test_mesh()
        ji_clamped = np.zeros_like(ji)
        out = tmp_path / "root_test.glb"
        write_skinned_glb(
            output_path=out, vertices=vertices, normals=normals, indices=indices,
            joint_indices=ji_clamped, joint_weights=jw,
            joint_names=names, parent_indices=parents, joint_positions=positions,
        )
        gltf = pygltflib.GLTF2.load(str(out))
        assert gltf.nodes[0].translation[0] == pytest.approx(0.5)
        assert gltf.nodes[0].translation[1] == pytest.approx(1.0)
        assert gltf.nodes[0].translation[2] == pytest.approx(0.3)


# ---------------------------------------------------------------------------
# B1: material + UV emission
# ---------------------------------------------------------------------------

def _tiny_png_bytes() -> bytes:
    """Build a 2x2 PNG in-memory (mirrors the extract-end PIL save path)."""
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (2, 2)).save(buf, format="PNG")
    return buf.getvalue()


def _write_with_uv_and_texture(tmp_path: Path, with_texture: bool = True) -> Path:
    """Write a small skinned GLB carrying a UV (and optionally a baseColor texture)."""
    vertices, normals, indices, ji, jw = make_test_mesh()
    uv = np.array([[0, 0], [1, 0], [0, 1], [1, 1]], dtype=np.float32)
    names = ["root"]
    parents = [-1]
    positions = np.zeros((1, 3), dtype=np.float32)
    ji_clamped = np.zeros_like(ji)
    out = tmp_path / ("mat_uv.glb" if with_texture else "mat_uv_notex.glb")
    write_skinned_glb(
        output_path=out, vertices=vertices, normals=normals, indices=indices,
        joint_indices=ji_clamped, joint_weights=jw,
        joint_names=names, parent_indices=parents, joint_positions=positions,
        uv=uv,
        base_color_texture=_tiny_png_bytes() if with_texture else None,
    )
    return out


class TestMaterialAndUv:
    def test_uv_and_texture_round_trip(self, tmp_path):
        out = _write_with_uv_and_texture(tmp_path, with_texture=True)
        gltf = pygltflib.GLTF2.load(str(out))

        # A VEC2 TEXCOORD_0 accessor must exist and be referenced by the primitive.
        texcoord_idx = gltf.meshes[0].primitives[0].attributes.TEXCOORD_0
        assert texcoord_idx is not None
        assert gltf.accessors[texcoord_idx].type == "VEC2"
        assert gltf.accessors[texcoord_idx].count == 4

        # A fabric PBR material (metalness 0) must be present.
        assert gltf.materials, "no materials written"
        assert gltf.materials[0].pbrMetallicRoughness.metallicFactor == 0

        # Image + texture + sampler must all be present.
        assert gltf.images, "no images written"
        assert gltf.textures, "no textures written"
        assert gltf.samplers, "no samplers written"
        assert gltf.materials[0].pbrMetallicRoughness.baseColorTexture is not None

        assert validate_material_and_uv(str(out))["valid"] is True

    def test_no_texture_still_writes_material(self, tmp_path):
        out = _write_with_uv_and_texture(tmp_path, with_texture=False)
        gltf = pygltflib.GLTF2.load(str(out))

        # Material written even without a texture (metalness 0 kills the plastic look).
        assert gltf.materials, "no materials written"
        assert gltf.materials[0].pbrMetallicRoughness.metallicFactor == 0
        assert not gltf.images, "no image expected when base_color_texture is None"

        # Geometry validation still passes (POSITION bounds intact).
        result = validate_glb_geometry(str(out))
        assert result["valid"], result["errors"]

    def test_no_uv_reports_no_texcoord(self, tmp_path):
        """A material-only write (uv=None) has no TEXCOORD_0."""
        out = write_for_slot(tmp_path, "TOP")
        audit = validate_material_and_uv(str(out))
        assert audit["has_texcoord"] is False
        # Material is now always written, so has_material is True.
        assert audit["has_material"] is True

    def test_uv_shape_mismatch_raises(self, tmp_path):
        vertices, normals, indices, ji, jw = make_test_mesh()
        bad_uv = np.zeros((3, 2), dtype=np.float32)  # 3 rows, mesh has 4 verts
        with pytest.raises(ValueError, match="uv must be"):
            write_skinned_glb(
                output_path=tmp_path / "bad_uv.glb",
                vertices=vertices, normals=normals, indices=indices,
                joint_indices=np.zeros_like(ji), joint_weights=jw,
                joint_names=["root"], parent_indices=[-1],
                joint_positions=np.zeros((1, 3), dtype=np.float32),
                uv=bad_uv,
            )

    def test_all_buffer_views_4byte_aligned_with_texture(self, tmp_path):
        out = _write_with_uv_and_texture(tmp_path, with_texture=True)
        gltf = pygltflib.GLTF2.load(str(out))
        for bv in gltf.bufferViews:
            assert bv.byteOffset % 4 == 0, (
                f"BufferView byteOffset {bv.byteOffset} is not 4-byte aligned"
            )
