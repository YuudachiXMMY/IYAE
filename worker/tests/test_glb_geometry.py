"""Unit tests for the shared GLB geometry helper (glb_geometry.py).

Uses lightweight SimpleNamespace fakes for the pygltflib GLTF2 shape so these
tests carry no heavy dependency — the helper only reads attribute values.
"""
import math
from types import SimpleNamespace

from glb_geometry import compute_glb_geometry_stats, _tris_for_mode


def _acc(count, mn=None, mx=None):
    return SimpleNamespace(count=count, min=mn, max=mx)


def _prim(pos=None, indices=None, mode=None):
    attrs = SimpleNamespace()
    if pos is not None:
        attrs.POSITION = pos
    return SimpleNamespace(attributes=attrs, indices=indices, mode=mode)


def _gltf(accessors, meshes_prims):
    meshes = [SimpleNamespace(primitives=prims) for prims in meshes_prims]
    return SimpleNamespace(accessors=accessors, meshes=meshes)


class TestTrisForMode:
    def test_triangles_mode_divides_by_three(self):
        assert _tris_for_mode(4, 9) == 3

    def test_triangle_strip_and_fan_are_count_minus_two(self):
        assert _tris_for_mode(5, 100) == 98
        assert _tris_for_mode(6, 100) == 98

    def test_strip_with_fewer_than_three_never_negative(self):
        assert _tris_for_mode(5, 1) == 0

    def test_points_and_lines_contribute_no_triangles(self):
        assert _tris_for_mode(0, 3000) == 0  # POINTS
        assert _tris_for_mode(1, 3000) == 0  # LINES
        assert _tris_for_mode(2, 3000) == 0  # LINE_LOOP
        assert _tris_for_mode(3, 3000) == 0  # LINE_STRIP

    def test_triangles_mode_negative_count_clamped_to_zero(self):
        # H1: a provider-declared negative accessor count must not yield a
        # negative triangle contribution (which could drag the aggregate below
        # the upper-bound cap and pass validation).
        assert _tris_for_mode(4, -2_100_000) == 0
        assert _tris_for_mode(4, -1) == 0
        assert _tris_for_mode(None, -9) == 0  # None default == TRIANGLES


class TestComputeGlbGeometryStats:
    def test_triangles_via_index_accessor(self):
        gltf = _gltf([_acc(9)], [[_prim(pos=None, indices=0, mode=4)]])
        stats = compute_glb_geometry_stats(gltf)
        assert stats["triangle_count"] == 3
        assert stats["errors"] == []

    def test_default_mode_is_triangles(self):
        # mode=None must be treated as TRIANGLES (4).
        gltf = _gltf([_acc(30)], [[_prim(pos=0, indices=None, mode=None)]])
        stats = compute_glb_geometry_stats(gltf)
        assert stats["triangle_count"] == 10

    def test_line_mode_does_not_inflate_triangle_count(self):
        # A 3000-index LINES decoration must add zero triangles (M6).
        gltf = _gltf([_acc(3000)], [[_prim(pos=None, indices=0, mode=1)]])
        stats = compute_glb_geometry_stats(gltf)
        assert stats["triangle_count"] == 0

    def test_multi_mesh_bbox_union(self):
        accessors = [
            _acc(24, [0.0, 0.0, 0.0], [1.0, 1.0, 1.0]),
            _acc(24, [-1.0, -1.0, -1.0], [0.5, 0.5, 0.5]),
        ]
        gltf = _gltf(accessors, [[_prim(pos=0)], [_prim(pos=1)]])
        stats = compute_glb_geometry_stats(gltf)
        assert stats["bounds_found"] is True
        assert stats["mins"] == [-1.0, -1.0, -1.0]
        assert stats["maxs"] == [1.0, 1.0, 1.0]
        assert stats["triangle_count"] == 16  # 24//3 + 24//3

    def test_nan_bound_propagates_through_union(self):
        # M2: Python min/max silently drop NaN, so a NaN in one mesh's POSITION min
        # would vanish from the union and escape the validator's NaN check. It must
        # survive so validate_glb_geometry can reject the file.
        accessors = [
            _acc(24, [0.0, 0.0, 0.0], [1.0, 1.0, 1.0]),
            _acc(24, [float("nan"), -1.0, -1.0], [0.5, 0.5, 0.5]),
        ]
        gltf = _gltf(accessors, [[_prim(pos=0)], [_prim(pos=1)]])
        stats = compute_glb_geometry_stats(gltf)
        assert stats["bounds_found"] is True
        assert math.isnan(stats["mins"][0])

    def test_nan_bound_is_sticky_regardless_of_order(self):
        # NaN in the FIRST mesh must not be overwritten by a later real value.
        accessors = [
            _acc(24, [float("nan"), 0.0, 0.0], [1.0, 1.0, 1.0]),
            _acc(24, [-1.0, -1.0, -1.0], [0.5, 0.5, 0.5]),
        ]
        gltf = _gltf(accessors, [[_prim(pos=0)], [_prim(pos=1)]])
        stats = compute_glb_geometry_stats(gltf)
        assert math.isnan(stats["mins"][0])

    def test_negative_index_reported_as_error(self):
        gltf = _gltf([_acc(9)], [[_prim(pos=None, indices=-1, mode=4)]])
        stats = compute_glb_geometry_stats(gltf)
        assert any("out of range" in e for e in stats["errors"])
        # A negative index is never used to index a (wrong) accessor.
        assert stats["triangle_count"] == 0

    def test_out_of_range_index_reported_as_error(self):
        gltf = _gltf([_acc(9)], [[_prim(pos=None, indices=5, mode=4)]])
        stats = compute_glb_geometry_stats(gltf)
        assert any("out of range" in e for e in stats["errors"])

    def test_empty_geometry(self):
        gltf = SimpleNamespace(accessors=[], meshes=[])
        stats = compute_glb_geometry_stats(gltf)
        assert stats["triangle_count"] == 0
        assert stats["bounds_found"] is False
        assert stats["mins"] == [math.inf, math.inf, math.inf]

    def test_negative_count_single_primitive_clamped(self):
        # H1: a single primitive with a crafted negative count contributes 0,
        # never a negative triangle_count.
        gltf = _gltf([_acc(-2_100_000)], [[_prim(pos=None, indices=0, mode=4)]])
        stats = compute_glb_geometry_stats(gltf)
        assert stats["triangle_count"] == 0

    def test_negative_count_cannot_offset_oversized_primitive(self):
        # H1 exact scenario: primitive A (+666_666) and primitive B (-700_000)
        # must NOT sum to a negative aggregate that slips under the cap.
        accessors = [_acc(2_000_000), _acc(-2_100_000)]
        gltf = _gltf(
            accessors,
            [[_prim(pos=None, indices=0, mode=4)], [_prim(pos=None, indices=1, mode=4)]],
        )
        stats = compute_glb_geometry_stats(gltf)
        assert stats["triangle_count"] >= 0
        # A clamps to 666_666; B clamps to 0.
        assert stats["triangle_count"] == 2_000_000 // 3
