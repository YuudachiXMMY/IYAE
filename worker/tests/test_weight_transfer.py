"""Tests for providers/weight_transfer.py.

Uses synthetic geometry (unit cube, plane) so no real SMPL-X data is needed.
igl and robust_laplacian are mocked where they are not available in CI.
"""
from __future__ import annotations

import importlib

import numpy as np
import pytest

_igl_available = importlib.util.find_spec("igl") is not None
_robust_laplacian_available = importlib.util.find_spec("robust_laplacian") is not None


# ---------------------------------------------------------------------------
# Helpers — build minimal synthetic meshes
# ---------------------------------------------------------------------------

def _make_cube_mesh():
    """Return (verts, faces, normals) for a unit cube (12 triangles)."""
    verts = np.array(
        [
            [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
            [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
        ],
        dtype=np.float64,
    )
    faces = np.array(
        [
            [0, 1, 2], [0, 2, 3],  # bottom
            [4, 5, 6], [4, 6, 7],  # top
            [0, 1, 5], [0, 5, 4],  # front
            [2, 3, 7], [2, 7, 6],  # back
            [0, 3, 7], [0, 7, 4],  # left
            [1, 2, 6], [1, 6, 5],  # right
        ],
        dtype=np.int32,
    )
    normals = np.zeros_like(verts)
    for f in faces:
        v0, v1, v2 = verts[f[0]], verts[f[1]], verts[f[2]]
        n = np.cross(v1 - v0, v2 - v0)
        n_len = np.linalg.norm(n)
        if n_len > 0:
            n = n / n_len
        normals[f[0]] += n
        normals[f[1]] += n
        normals[f[2]] += n
    row_norms = np.linalg.norm(normals, axis=1, keepdims=True)
    normals = normals / np.where(row_norms > 1e-8, row_norms, 1.0)
    return verts, faces, normals


def _make_plane_mesh(n: int = 3):
    """Return (verts, faces, normals) for an n×n planar grid."""
    xs = np.linspace(0, 1, n)
    ys = np.linspace(0, 1, n)
    xv, yv = np.meshgrid(xs, ys)
    verts = np.column_stack([xv.ravel(), yv.ravel(), np.zeros(n * n)])
    verts = np.asarray(verts, dtype=np.float64)
    faces = []
    for row in range(n - 1):
        for col in range(n - 1):
            i = row * n + col
            faces.append([i, i + 1, i + n])
            faces.append([i + 1, i + n + 1, i + n])
    faces = np.array(faces, dtype=np.int32)
    normals = np.tile([0.0, 0.0, 1.0], (len(verts), 1))
    return verts, faces, normals


def _synthetic_weights(num_verts: int, num_joints: int = 55) -> np.ndarray:
    """Create normalised random weights as stand-in for SMPL-X lbs_weights."""
    rng = np.random.default_rng(42)
    w = rng.random((num_verts, num_joints))
    w = w / w.sum(axis=1, keepdims=True)
    return w


# ---------------------------------------------------------------------------
# Phase 1 tests
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not _igl_available, reason="igl not installed")
class TestFindClosestSurfaceMatches:

    def test_phase1_match_rate_above_zero(self):
        """Garment verts on the same surface should have > 0 matches."""
        from providers.weight_transfer import find_closest_surface_matches

        av, af, an = _make_cube_mesh()
        a_weights = _synthetic_weights(len(av))

        # Garment verts are coincident with avatar — expect all to match.
        gv = av.copy()
        gn = an.copy()
        matched, weights = find_closest_surface_matches(gv, gn, av, af, an, a_weights)

        assert matched.dtype == bool
        assert matched.shape == (len(gv),)
        assert matched.sum() > 0, "Expected at least one matched vertex"

    def test_far_away_verts_not_matched(self):
        """Verts far from the avatar surface should not be matched."""
        from providers.weight_transfer import find_closest_surface_matches

        av, af, an = _make_cube_mesh()
        a_weights = _synthetic_weights(len(av))

        gv = av + 10.0  # move garment far away
        gn = an.copy()
        matched, weights = find_closest_surface_matches(
            gv, gn, av, af, an, a_weights, distance_threshold=0.02
        )

        assert matched.sum() == 0, "Far verts should not match"

    def test_output_weight_shape(self):
        """Output weight matrix should be (G, J)."""
        from providers.weight_transfer import find_closest_surface_matches

        av, af, an = _make_cube_mesh()
        a_weights = _synthetic_weights(len(av), num_joints=55)

        gv, _, gn = _make_plane_mesh(3)
        matched, weights = find_closest_surface_matches(gv, gn, av, af, an, a_weights)

        assert weights.shape == (len(gv), 55)


# ---------------------------------------------------------------------------
# Phase 2 tests
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not _robust_laplacian_available, reason="robust_laplacian not installed")
class TestInpaintWeights:

    def test_all_verts_nonzero_after_inpaint(self):
        """After inpainting, all vertices should have non-zero weights."""
        from providers.weight_transfer import inpaint_weights

        gv, gf, _ = _make_plane_mesh(4)
        n = len(gv)
        num_joints = 55

        # Only the first vertex is matched
        matched = np.zeros(n, dtype=bool)
        matched[0] = True

        init_w = np.zeros((n, num_joints))
        init_w[0] = _synthetic_weights(1, num_joints)[0]

        result = inpaint_weights(gv, gf, matched, init_w)

        assert result.shape == (n, num_joints)
        row_sums = result.sum(axis=1)
        assert np.all(row_sums >= 0), "Weights should be non-negative"

    def test_inpaint_does_not_mutate_input(self):
        """inpaint_weights must not mutate initial_weights."""
        from providers.weight_transfer import inpaint_weights

        gv, gf, _ = _make_plane_mesh(3)
        n = len(gv)
        matched = np.ones(n, dtype=bool)
        init_w = _synthetic_weights(n)
        original = init_w.copy()

        inpaint_weights(gv, gf, matched, init_w)

        np.testing.assert_array_equal(init_w, original)

    def test_all_matched_returns_copy(self):
        """When all verts are matched, result equals initial_weights."""
        from providers.weight_transfer import inpaint_weights

        gv, gf, _ = _make_plane_mesh(3)
        n = len(gv)
        matched = np.ones(n, dtype=bool)
        init_w = _synthetic_weights(n)

        result = inpaint_weights(gv, gf, matched, init_w)

        # Should be a copy, not the same object
        assert result is not init_w


# ---------------------------------------------------------------------------
# Phase 3 tests
# ---------------------------------------------------------------------------

class TestPruneAndNormalizeWeights:
    def test_max_four_influences_per_vertex(self):
        """Each vertex should have at most 4 non-zero weights."""
        from providers.weight_transfer import prune_and_normalize_weights

        rng = np.random.default_rng(0)
        w = rng.random((10, 55))
        w = w / w.sum(axis=1, keepdims=True)

        result = prune_and_normalize_weights(w, slot_hint="DRESS", max_influences=4)

        nonzero_per_row = (result > 0).sum(axis=1)
        assert np.all(nonzero_per_row <= 4), f"Max influences exceeded: {nonzero_per_row}"

    def test_row_sums_approximately_one(self):
        """After normalisation, all row sums should be ≈ 1.0."""
        from providers.weight_transfer import prune_and_normalize_weights

        rng = np.random.default_rng(1)
        w = rng.random((10, 55))
        w = w / w.sum(axis=1, keepdims=True)

        result = prune_and_normalize_weights(w, slot_hint="DRESS")

        row_sums = result.sum(axis=1)
        np.testing.assert_allclose(row_sums, 1.0, atol=1e-6)

    def test_top_slot_bone_masking(self):
        """TOP slot should only retain weights for the 14 TOP bones."""
        from providers.weight_transfer import prune_and_normalize_weights
        from providers.canonical_skeleton import SLOT_BONE_SUBSETS, SMPLX_JOINT_NAMES

        rng = np.random.default_rng(2)
        w = rng.random((5, 55))
        w = w / w.sum(axis=1, keepdims=True)

        result = prune_and_normalize_weights(w, slot_hint="TOP")

        top_bones = SLOT_BONE_SUBSETS["TOP"]
        top_indices = {SMPLX_JOINT_NAMES.index(b) for b in top_bones}
        non_top_indices = [i for i in range(55) if i not in top_indices]

        # All non-TOP bone weights must be zero
        assert np.all(result[:, non_top_indices] == 0.0), (
            "Non-TOP bones should be zeroed for TOP slot"
        )

    def test_dress_slot_preserves_all_bones(self):
        """DRESS slot (None subset) should not zero any bone columns."""
        from providers.weight_transfer import prune_and_normalize_weights

        # Give each vertex weight on ALL 55 bones
        w = np.ones((4, 55), dtype=np.float64)
        w = w / w.sum(axis=1, keepdims=True)

        result = prune_and_normalize_weights(w, slot_hint="DRESS", max_influences=55)

        # All columns should still have some weight (DRESS = all joints)
        col_sums = result.sum(axis=0)
        assert np.all(col_sums > 0), "DRESS slot should keep all 55 bone columns active"

    def test_does_not_mutate_input(self):
        """prune_and_normalize_weights must not mutate the input array."""
        from providers.weight_transfer import prune_and_normalize_weights

        rng = np.random.default_rng(3)
        w = rng.random((6, 55))
        w = w / w.sum(axis=1, keepdims=True)
        original = w.copy()

        prune_and_normalize_weights(w, slot_hint="BOTTOM")

        np.testing.assert_array_equal(w, original)


# ---------------------------------------------------------------------------
# Full pipeline integration test
# ---------------------------------------------------------------------------

@pytest.mark.skipif(
    not _igl_available or not _robust_laplacian_available,
    reason="igl or robust_laplacian not installed",
)
class TestTransferWeightsPipeline:

    def test_pipeline_output_shape_and_normalisation(self):
        """End-to-end pipeline should return (G, 55) normalised weights."""
        from providers.weight_transfer import transfer_weights

        av, af, an = _make_cube_mesh()
        a_weights = _synthetic_weights(len(av), 55)

        gv, gf, gn = _make_plane_mesh(3)

        result = transfer_weights(gv, gf, gn, av, af, an, a_weights, slot_hint="DRESS")

        assert result.shape == (len(gv), 55)
        row_sums = result.sum(axis=1)
        np.testing.assert_allclose(row_sums, 1.0, atol=1e-5)


# ---------------------------------------------------------------------------
# TestDenseWeightsToTop4 tests
# ---------------------------------------------------------------------------

class TestDenseWeightsToTop4:
    def test_output_shapes(self):
        """Output should be (G, 4) for both arrays."""
        from providers.weight_transfer import dense_weights_to_top4

        w = _synthetic_weights(10, 55)
        ji, jw = dense_weights_to_top4(w)
        assert ji.shape == (10, 4)
        assert jw.shape == (10, 4)

    def test_output_dtypes(self):
        """joint_indices should be uint8, joint_weights should be float32."""
        from providers.weight_transfer import dense_weights_to_top4

        w = _synthetic_weights(5, 55)
        ji, jw = dense_weights_to_top4(w)
        assert ji.dtype == np.uint8
        assert jw.dtype == np.float32

    def test_row_sums_approximately_one(self):
        """All weight rows should sum to ~1.0."""
        from providers.weight_transfer import dense_weights_to_top4

        w = _synthetic_weights(8, 55)
        _, jw = dense_weights_to_top4(w)
        np.testing.assert_allclose(jw.sum(axis=1), 1.0, atol=1e-6)

    def test_max_four_nonzero_per_row(self):
        """Each row should have at most 4 non-zero entries."""
        from providers.weight_transfer import dense_weights_to_top4

        w = _synthetic_weights(10, 55)
        _, jw = dense_weights_to_top4(w)
        nonzero = (jw > 0).sum(axis=1)
        assert np.all(nonzero <= 4)

    def test_zero_row_fallback_to_pelvis(self):
        """Zero-weight rows should fall back to pelvis (index 0, weight 1.0)."""
        from providers.weight_transfer import dense_weights_to_top4

        w = np.zeros((3, 55))
        ji, jw = dense_weights_to_top4(w)
        assert ji[0, 0] == 0
        assert jw[0, 0] == pytest.approx(1.0)
        assert jw[0, 1:].sum() == pytest.approx(0.0)

    def test_does_not_mutate_input(self):
        """dense_weights_to_top4 must not modify the input array."""
        from providers.weight_transfer import dense_weights_to_top4

        w = _synthetic_weights(5, 55)
        original = w.copy()
        dense_weights_to_top4(w)
        np.testing.assert_array_equal(w, original)


class TestDegenerateVertexGuard:
    """#31: a degenerate transfer used to ship silently.

    Vertices with no usable weight are bound rigidly to the pelvis, so a garment with many of
    them deforms as one lump at the hips. That happened with no error, no log and nothing in
    the validator to catch it, which made a failed transfer look like a modelling problem.
    """

    def test_counts_rows_with_no_weight(self):
        from providers.weight_transfer import count_degenerate_vertices

        w = np.zeros((5, 55))
        w[0, 3] = 1.0
        w[4, 7] = 0.5

        assert count_degenerate_vertices(w) == 3

    def test_counts_zero_for_a_fully_weighted_matrix(self):
        from providers.weight_transfer import count_degenerate_vertices

        w = np.zeros((4, 55))
        w[:, 0] = 1.0

        assert count_degenerate_vertices(w) == 0

    def test_handles_an_empty_matrix(self):
        from providers.weight_transfer import count_degenerate_vertices

        assert count_degenerate_vertices(np.zeros((0, 55))) == 0

    def test_agrees_with_the_fallback_it_reports_on(self):
        """The count must describe the same vertices dense_weights_to_top4 actually rescues.

        The two use different expressions — the full row sum here, the top-k sum there — and
        they only coincide because Phase 3 has already pruned each row to at most 4 influences.
        If that ever stops holding, the guard would under-report and this fails.
        """
        from providers.weight_transfer import count_degenerate_vertices, dense_weights_to_top4

        w = np.zeros((6, 55))
        w[1, 2] = 1.0
        w[3, 5] = 0.8
        w[3, 9] = 0.2

        counted = count_degenerate_vertices(w)
        ji, jw = dense_weights_to_top4(w)
        # A rescued row is weight 1.0 on joint index 0 (the pelvis) and nothing else. The joint
        # index matters: a row legitimately carrying its whole weight on some other single
        # joint also normalises to [1, 0, 0, 0], and must not be counted as rescued.
        rescued = int(
            np.sum((ji[:, 0] == 0) & (jw[:, 0] == 1.0) & (jw[:, 1:].sum(axis=1) == 0.0))
        )

        assert counted == rescued == 4

    def test_the_threshold_is_a_small_fraction(self):
        from providers.weight_transfer import MAX_DEGENERATE_VERTEX_FRACTION

        # A handful of stray vertices is tolerable; a twentieth of the mesh is not.
        assert 0 < MAX_DEGENERATE_VERTEX_FRACTION <= 0.05
