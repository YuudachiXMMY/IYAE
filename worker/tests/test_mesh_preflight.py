"""Tests for mesh_preflight topology checks."""
import numpy as np
import pytest
import trimesh

from providers.mesh_preflight import preflight_mesh


def _box_mesh() -> tuple[np.ndarray, np.ndarray]:
    box = trimesh.creation.box()
    return np.array(box.vertices, dtype=np.float32), np.array(box.faces, dtype=np.int32)


class TestPreflightMeshValid:
    def test_valid_box_returns_no_errors(self):
        vertices, faces = _box_mesh()
        assert preflight_mesh(vertices, faces) == []


class TestPreflightMeshDegenerateFaces:
    def test_many_degenerate_faces_returns_error(self):
        """Build a mesh where >50 faces are degenerate (three collinear vertices)."""
        base_v, base_f = _box_mesh()
        # Add 60 degenerate faces: all three vertices at the same position
        extra_verts = []
        extra_faces = []
        base_count = len(base_v)
        for i in range(60):
            pt = np.array([[i * 0.01, 0.0, 0.0]], dtype=np.float32)
            extra_verts.extend([pt, pt, pt])
            idx = base_count + i * 3
            extra_faces.append([idx, idx + 1, idx + 2])
        vertices = np.vstack([base_v] + extra_verts)
        faces = np.vstack([base_f, np.array(extra_faces, dtype=np.int32)])
        errors = preflight_mesh(vertices, faces)
        assert any("degenerate" in e for e in errors)

    def test_few_degenerate_faces_no_error(self):
        """Fewer than threshold degenerate faces should not trigger error."""
        base_v, base_f = _box_mesh()
        # Add only 10 degenerate faces (below threshold of 50)
        extra_verts = []
        extra_faces = []
        base_count = len(base_v)
        for i in range(10):
            pt = np.array([[i * 0.01, 0.0, 0.0]], dtype=np.float32)
            extra_verts.extend([pt, pt, pt])
            idx = base_count + i * 3
            extra_faces.append([idx, idx + 1, idx + 2])
        vertices = np.vstack([base_v] + extra_verts)
        faces = np.vstack([base_f, np.array(extra_faces, dtype=np.int32)])
        errors = preflight_mesh(vertices, faces)
        assert not any("degenerate" in e for e in errors)


class TestPreflightMeshLooseVertices:
    def test_loose_vertices_returns_no_error(self):
        """Loose vertices produce a warning but not an error."""
        base_v, base_f = _box_mesh()
        # Append extra vertices not referenced by any face
        extra = np.array([[10.0, 10.0, 10.0], [11.0, 11.0, 11.0]], dtype=np.float32)
        vertices = np.vstack([base_v, extra])
        errors = preflight_mesh(vertices, base_f)
        assert errors == []


class TestPreflightMeshNonManifold:
    def test_non_manifold_edges_above_threshold_returns_error(self):
        """Construct a mesh with >100 non-manifold edges.

        Strategy: create a grid of triangles where interior edges are each
        shared by 3 faces instead of 2, giving many non-manifold edges.
        We build pairs of triangles that share an edge, then add a third
        triangle on each shared edge, creating >100 non-manifold edges.
        """
        verts = []
        faces = []
        # Create 110 sets of 4 vertices, each contributing one non-manifold edge
        # (3 triangles share 1 edge per set)
        for i in range(110):
            base = len(verts)
            # 4 vertices forming a quad plus an extra apex
            verts.extend([
                [float(i) * 0.1, 0.0, 0.0],   # base+0
                [float(i) * 0.1 + 0.05, 0.0, 0.0],  # base+1 (shared edge endpoint)
                [float(i) * 0.1, 0.05, 0.0],   # base+2
                [float(i) * 0.1, -0.05, 0.0],  # base+3
                [float(i) * 0.1, 0.0, 0.05],   # base+4 (third face apex)
            ])
            # Three faces sharing edge (base, base+1) -> non-manifold
            faces.extend([
                [base, base + 1, base + 2],
                [base, base + 1, base + 3],
                [base, base + 1, base + 4],
            ])
        vertices = np.array(verts, dtype=np.float32)
        tri_faces = np.array(faces, dtype=np.int32)
        errors = preflight_mesh(vertices, tri_faces)
        assert any("non-manifold" in e for e in errors)


class TestCheckScaleRatio:
    """Tests for check_scale_ratio warning function."""

    def _avatar_box(self):
        """Minimal avatar-like bbox: 1.7m tall."""
        return np.array([[-0.3, 0.0, -0.15], [0.3, 1.7, 0.15]], dtype=np.float64)

    def test_normal_ratio_no_warnings(self):
        """Garment at similar scale to avatar produces no warnings."""
        from providers.mesh_preflight import check_scale_ratio
        avatar = self._avatar_box()
        garment = np.array([[-0.2, 0.5, -0.1], [0.2, 1.3, 0.1]], dtype=np.float64)  # ~0.8m
        warnings = check_scale_ratio(garment, avatar)
        assert warnings == []

    def test_garment_too_large_warns(self):
        """Garment 100x taller than avatar triggers warning."""
        from providers.mesh_preflight import check_scale_ratio
        avatar = self._avatar_box()
        garment = np.array([[0, 0, 0], [1, 170.0, 1]], dtype=np.float64)  # 170m tall
        warnings = check_scale_ratio(garment, avatar)
        assert len(warnings) == 1
        assert "taller" in warnings[0]

    def test_garment_too_small_warns(self):
        """Garment 100x smaller than avatar triggers warning."""
        from providers.mesh_preflight import check_scale_ratio
        avatar = self._avatar_box()
        garment = np.array([[0, 0, 0], [0.001, 0.017, 0.001]], dtype=np.float64)  # 0.017m
        warnings = check_scale_ratio(garment, avatar)
        assert len(warnings) == 1
        assert "smaller" in warnings[0]

    def test_at_threshold_warns(self):
        """Garment exactly at max_ratio boundary triggers warning."""
        from providers.mesh_preflight import check_scale_ratio
        avatar = self._avatar_box()
        # 50 * 1.7 = 85m, so 85.1m should trigger
        garment = np.array([[0, 0, 0], [1, 85.1, 1]], dtype=np.float64)
        warnings = check_scale_ratio(garment, avatar, max_ratio=50.0)
        assert len(warnings) == 1
