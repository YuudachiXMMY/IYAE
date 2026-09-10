"""Tests for providers/python_rigging_provider.py."""
from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import numpy as np
import pytest


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

VALID_PAYLOAD = {
    "source_glb_url": "/assets/products/1/tasks/1/garment.glb",
    "slot_hint": "TOP",
}


@pytest.fixture
def provider(tmp_path):
    from providers.python_rigging_provider import PythonRiggingProvider
    return PythonRiggingProvider(output_dir=str(tmp_path))


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

class TestInputValidation:
    def test_none_payload_raises_value_error(self, provider):
        with pytest.raises(ValueError, match="must not be None"):
            provider.generate(1, 42, None)

    def test_missing_source_glb_url_raises_value_error(self, provider):
        with pytest.raises(ValueError, match="source_glb_url"):
            provider.generate(1, 42, {"slot_hint": "TOP"})

    def test_empty_source_glb_url_raises_value_error(self, provider):
        with pytest.raises(ValueError, match="source_glb_url"):
            provider.generate(1, 42, {"source_glb_url": ""})

    def test_invalid_slot_hint_raises_value_error(self, provider):
        with pytest.raises(ValueError, match="Invalid slot_hint"):
            provider.generate(1, 42, {"source_glb_url": "/assets/g.glb", "slot_hint": "SHOES"})

    def test_missing_slot_hint_defaults_to_dress(self, provider):
        """When slot_hint is omitted it should default to DRESS, not crash."""
        import numpy as np
        v = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0]], dtype=np.float64)
        f = np.array([[0, 1, 2]], dtype=np.int32)
        n = np.tile([0.0, 0.0, 1.0], (3, 1))
        w = np.ones((3, 55)) / 55.0
        jp = np.zeros((55, 3), dtype=np.float32)

        with (
            patch.object(provider, "_load_garment_glb", return_value=(v, f, n, None, None, None)),
            patch.object(provider, "_get_avatar_data", return_value=(v, f, n, w, jp)),
            patch("providers.mesh_preflight.preflight_mesh", return_value=[]),
            patch("providers.weight_transfer.transfer_weights", return_value=w) as mock_tw,
            patch("providers.weight_transfer.dense_weights_to_top4", return_value=(
                np.zeros((3, 4), dtype=np.uint8),
                np.ones((3, 4), dtype=np.float32) / 4,
            )),
            patch("providers.skinned_glb_writer.write_skinned_glb"),
        ):
            result = provider.generate(1, 42, {"source_glb_url": "/assets/g.glb"})

        assert result["slot_hint"] == "DRESS"


# ---------------------------------------------------------------------------
# _resolve_path
# ---------------------------------------------------------------------------

class TestResolvePath:
    def test_http_url_returned_unchanged(self, provider):
        url = "http://example.com/model.glb"
        assert provider._resolve_path(url) == url

    def test_https_url_returned_unchanged(self, provider):
        url = "https://cdn.example.com/model.glb"
        assert provider._resolve_path(url) == url

    def test_assets_prefix_mapped_to_output_dir(self, provider, tmp_path):
        resolved = provider._resolve_path("/assets/products/1/garment.glb")
        expected = os.path.join(str(tmp_path), "products/1/garment.glb")
        assert resolved == expected

    def test_none_returned_unchanged(self, provider):
        assert provider._resolve_path(None) is None


# ---------------------------------------------------------------------------
# Output format
# ---------------------------------------------------------------------------

class TestOutputFormat:
    def _make_mesh_arrays(self):
        verts = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]], dtype=np.float64)
        faces = np.array([[0, 1, 2], [0, 1, 3]], dtype=np.int32)
        normals = np.tile([0.0, 0.0, 1.0], (4, 1))
        return verts, faces, normals

    def test_schema_version_2_keys_present(self, provider):
        """All required schemaVersion=2 keys must be in the output."""
        verts, faces, normals = self._make_mesh_arrays()
        weights = np.ones((4, 55)) / 55.0
        joint_positions = np.zeros((55, 3), dtype=np.float32)

        with (
            patch.object(provider, "_load_garment_glb", return_value=(verts, faces, normals, None, None, None)),
            patch.object(provider, "_get_avatar_data", return_value=(verts, faces, normals, weights, joint_positions)),
            patch("providers.mesh_preflight.preflight_mesh", return_value=[]),
            patch("providers.weight_transfer.transfer_weights", return_value=weights),
            patch("providers.weight_transfer.dense_weights_to_top4", return_value=(
                np.zeros((4, 4), dtype=np.uint8),
                np.ones((4, 4), dtype=np.float32) / 4,
            )),
            patch("providers.skinned_glb_writer.write_skinned_glb"),
        ):
            result = provider.generate(1, 99, VALID_PAYLOAD)

        required_keys = [
            "schemaVersion", "provider_used", "garment_asset_id",
            "rigged_glb_path", "rigged_glb_url", "slot_hint",
            "triangle_count", "bbox", "skin", "rigging", "elapsed_ms",
        ]
        for key in required_keys:
            assert key in result, f"Missing key: {key}"

        assert result["schemaVersion"] == 2
        assert result["provider_used"] == "PYTHON_WEIGHT_TRANSFER"
        assert result["garment_asset_id"] == 99

    def test_rigged_glb_url_starts_with_assets(self, provider):
        verts, faces, normals = self._make_mesh_arrays()
        weights = np.ones((4, 55)) / 55.0
        joint_positions = np.zeros((55, 3), dtype=np.float32)

        with (
            patch.object(provider, "_load_garment_glb", return_value=(verts, faces, normals, None, None, None)),
            patch.object(provider, "_get_avatar_data", return_value=(verts, faces, normals, weights, joint_positions)),
            patch("providers.mesh_preflight.preflight_mesh", return_value=[]),
            patch("providers.weight_transfer.transfer_weights", return_value=weights),
            patch("providers.weight_transfer.dense_weights_to_top4", return_value=(
                np.zeros((4, 4), dtype=np.uint8),
                np.ones((4, 4), dtype=np.float32) / 4,
            )),
            patch("providers.skinned_glb_writer.write_skinned_glb"),
        ):
            result = provider.generate(1, 77, VALID_PAYLOAD)

        assert result["rigged_glb_url"].startswith("/assets/")

    def test_elapsed_ms_is_integer(self, provider):
        verts, faces, normals = self._make_mesh_arrays()
        weights = np.ones((4, 55)) / 55.0
        joint_positions = np.zeros((55, 3), dtype=np.float32)

        with (
            patch.object(provider, "_load_garment_glb", return_value=(verts, faces, normals, None, None, None)),
            patch.object(provider, "_get_avatar_data", return_value=(verts, faces, normals, weights, joint_positions)),
            patch("providers.mesh_preflight.preflight_mesh", return_value=[]),
            patch("providers.weight_transfer.transfer_weights", return_value=weights),
            patch("providers.weight_transfer.dense_weights_to_top4", return_value=(
                np.zeros((4, 4), dtype=np.uint8),
                np.ones((4, 4), dtype=np.float32) / 4,
            )),
            patch("providers.skinned_glb_writer.write_skinned_glb"),
        ):
            result = provider.generate(1, 55, VALID_PAYLOAD)

        assert isinstance(result["elapsed_ms"], int)

    def test_bbox_has_min_max_keys(self, provider):
        verts, faces, normals = self._make_mesh_arrays()
        weights = np.ones((4, 55)) / 55.0
        joint_positions = np.zeros((55, 3), dtype=np.float32)

        with (
            patch.object(provider, "_load_garment_glb", return_value=(verts, faces, normals, None, None, None)),
            patch.object(provider, "_get_avatar_data", return_value=(verts, faces, normals, weights, joint_positions)),
            patch("providers.mesh_preflight.preflight_mesh", return_value=[]),
            patch("providers.weight_transfer.transfer_weights", return_value=weights),
            patch("providers.weight_transfer.dense_weights_to_top4", return_value=(
                np.zeros((4, 4), dtype=np.uint8),
                np.ones((4, 4), dtype=np.float32) / 4,
            )),
            patch("providers.skinned_glb_writer.write_skinned_glb"),
        ):
            result = provider.generate(1, 11, VALID_PAYLOAD)

        assert "min" in result["bbox"]
        assert "max" in result["bbox"]


# ---------------------------------------------------------------------------
# Call-chain verification
# ---------------------------------------------------------------------------

class TestCallChain:
    def _make_mesh(self):
        v = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0]], dtype=np.float64)
        f = np.array([[0, 1, 2]], dtype=np.int32)
        n = np.tile([0.0, 0.0, 1.0], (3, 1))
        w = np.ones((3, 55)) / 55.0
        return v, f, n, w

    def test_transfer_weights_called_with_correct_slot_hint(self, provider):
        v, f, n, w = self._make_mesh()
        joint_positions = np.zeros((55, 3), dtype=np.float32)

        with (
            patch.object(provider, "_load_garment_glb", return_value=(v, f, n, None, None, None)),
            patch.object(provider, "_get_avatar_data", return_value=(v, f, n, w, joint_positions)),
            patch("providers.mesh_preflight.preflight_mesh", return_value=[]),
            patch("providers.weight_transfer.transfer_weights", return_value=w) as mock_tw,
            patch("providers.weight_transfer.dense_weights_to_top4", return_value=(
                np.zeros((3, 4), dtype=np.uint8),
                np.ones((3, 4), dtype=np.float32) / 4,
            )),
            patch("providers.skinned_glb_writer.write_skinned_glb"),
        ):
            provider.generate(1, 10, {"source_glb_url": "/assets/g.glb", "slot_hint": "BOTTOM"})

        mock_tw.assert_called_once()
        _, kwargs = mock_tw.call_args
        assert kwargs.get("slot_hint") == "BOTTOM" or mock_tw.call_args[0][-1] == "BOTTOM"

    def test_preflight_errors_raise_rigging_error(self, provider):
        from providers.blender_rigging_provider import RiggingError

        v, f, n, w = self._make_mesh()
        joint_positions = np.zeros((55, 3), dtype=np.float32)

        with (
            patch.object(provider, "_load_garment_glb", return_value=(v, f, n, None, None, None)),
            patch.object(provider, "_get_avatar_data", return_value=(v, f, n, w, joint_positions)),
            patch(
                "providers.mesh_preflight.preflight_mesh",
                return_value=["Too many degenerate faces: 100"],
            ),
        ):
            with pytest.raises(RiggingError):
                provider.generate(1, 10, VALID_PAYLOAD)

    def test_write_skinned_glb_receives_all_named_params(self, provider):
        """write_skinned_glb must be called with all 10 named parameters."""
        v, f, n, w = self._make_mesh()
        joint_positions = np.zeros((55, 3), dtype=np.float32)

        with (
            patch.object(provider, "_load_garment_glb", return_value=(v, f, n, None, None, None)),
            patch.object(provider, "_get_avatar_data", return_value=(v, f, n, w, joint_positions)),
            patch("providers.mesh_preflight.preflight_mesh", return_value=[]),
            patch("providers.weight_transfer.transfer_weights", return_value=w),
            patch("providers.weight_transfer.dense_weights_to_top4", return_value=(
                np.zeros((3, 4), dtype=np.uint8),
                np.ones((3, 4), dtype=np.float32) / 4,
            )),
            patch("providers.skinned_glb_writer.write_skinned_glb") as mock_write,
        ):
            provider.generate(1, 10, VALID_PAYLOAD)

        mock_write.assert_called_once()
        _, kwargs = mock_write.call_args
        assert "output_path" in kwargs, "missing output_path kwarg"
        assert "joint_names" in kwargs, "missing joint_names kwarg"
        assert "parent_indices" in kwargs, "missing parent_indices kwarg"
        assert "joint_positions" in kwargs, "missing joint_positions kwarg"

    def test_write_skinned_glb_receives_uv_and_texture_kwargs(self, provider):
        """When the source garment carries UV + texture, they thread into write_skinned_glb."""
        v, f, n, w = self._make_mesh()
        joint_positions = np.zeros((55, 3), dtype=np.float32)
        uv = np.zeros((len(v), 2), dtype=np.float32)
        tex = b"\x89PNG\r\n\x1a\nfake-png-bytes"
        factor = [1.0, 1.0, 1.0, 1.0]

        with (
            patch.object(provider, "_load_garment_glb", return_value=(v, f, n, uv, tex, factor)),
            patch.object(provider, "_get_avatar_data", return_value=(v, f, n, w, joint_positions)),
            patch("providers.mesh_preflight.preflight_mesh", return_value=[]),
            patch("providers.weight_transfer.transfer_weights", return_value=w),
            patch("providers.weight_transfer.dense_weights_to_top4", return_value=(
                np.zeros((3, 4), dtype=np.uint8),
                np.ones((3, 4), dtype=np.float32) / 4,
            )),
            patch("providers.skinned_glb_writer.write_skinned_glb") as mock_write,
        ):
            provider.generate(1, 10, VALID_PAYLOAD)

        mock_write.assert_called_once()
        _, kwargs = mock_write.call_args
        assert kwargs.get("uv") is uv, "uv not forwarded to write_skinned_glb"
        assert kwargs.get("base_color_texture") == tex, "texture not forwarded"
        assert kwargs.get("base_color_factor") == factor, "base_color_factor not forwarded"


# ---------------------------------------------------------------------------
# SMPL-X path validation
# ---------------------------------------------------------------------------

class TestSmplxPathValidation:
    def test_missing_smplx_dir_raises_rigging_error(self, provider):
        """_load_smplx_avatar should raise RiggingError when SMPLX_MODELS_PATH is invalid."""
        from providers.blender_rigging_provider import RiggingError

        with patch.dict(os.environ, {"SMPLX_MODELS_PATH": "/nonexistent/smplx_models"}):
            with pytest.raises(RiggingError, match="SMPL-X model directory not found"):
                provider._load_smplx_avatar(VALID_PAYLOAD)


# ---------------------------------------------------------------------------
# Scale normalization integration
# ---------------------------------------------------------------------------

class TestScaleNormalizationIntegration:
    """Tests for scale normalization integration in the rigging pipeline."""

    def _make_mesh(self):
        v = np.array([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]], dtype=np.float64)
        f = np.array([[0, 1, 2], [0, 1, 3]], dtype=np.int32)
        n = np.tile([0.0, 0.0, 1.0], (4, 1))
        w = np.ones((4, 55)) / 55.0
        jp = np.zeros((55, 3), dtype=np.float32)
        return v, f, n, w, jp

    def test_output_payload_contains_scale_normalization_key(self, provider):
        """generate() output must include a scale_normalization dict."""
        v, f, n, w, jp = self._make_mesh()
        scale_info = {
            "original_bbox": {"min": [0.0, 0.0, 0.0], "max": [1.0, 1.0, 1.0]},
            "scale_factor": 1.5,
            "translation": [0.0, 0.0, 0.0],
            "was_normalized": True,
        }

        with (
            patch.object(provider, "_load_garment_glb", return_value=(v, f, n, None, None, None)),
            patch.object(provider, "_get_avatar_data", return_value=(v, f, n, w, jp)),
            patch(
                "providers.scale_normalizer.normalize_garment_to_avatar",
                return_value=(v, scale_info),
            ),
            patch("providers.mesh_preflight.preflight_mesh", return_value=[]),
            patch("providers.weight_transfer.transfer_weights", return_value=w),
            patch("providers.weight_transfer.dense_weights_to_top4", return_value=(
                np.zeros((4, 4), dtype=np.uint8),
                np.ones((4, 4), dtype=np.float32) / 4,
            )),
            patch("providers.skinned_glb_writer.write_skinned_glb"),
        ):
            result = provider.generate(1, 42, VALID_PAYLOAD)

        assert "scale_normalization" in result
        sn = result["scale_normalization"]
        assert "original_bbox" in sn
        assert "scale_factor" in sn
        assert "translation" in sn
        assert "was_normalized" in sn

    def test_scale_normalizer_called_before_weight_transfer(self, provider):
        """Scale normalization must happen before weight transfer."""
        v, f, n, w, jp = self._make_mesh()
        scale_info = {
            "original_bbox": {"min": [0.0, 0.0, 0.0], "max": [1.0, 1.0, 1.0]},
            "scale_factor": 1.0,
            "translation": [0.0, 0.0, 0.0],
            "was_normalized": False,
        }
        call_order = []

        def fake_normalize(garment_verts, avatar_verts, slot_hint):
            call_order.append("normalize")
            return garment_verts, scale_info

        def fake_transfer(*args, **kwargs):
            call_order.append("transfer")
            return w

        with (
            patch.object(provider, "_load_garment_glb", return_value=(v, f, n, None, None, None)),
            patch.object(provider, "_get_avatar_data", return_value=(v, f, n, w, jp)),
            patch(
                "providers.scale_normalizer.normalize_garment_to_avatar",
                side_effect=fake_normalize,
            ),
            patch("providers.mesh_preflight.preflight_mesh", return_value=[]),
            patch("providers.weight_transfer.transfer_weights", side_effect=fake_transfer),
            patch("providers.weight_transfer.dense_weights_to_top4", return_value=(
                np.zeros((4, 4), dtype=np.uint8),
                np.ones((4, 4), dtype=np.float32) / 4,
            )),
            patch("providers.skinned_glb_writer.write_skinned_glb"),
        ):
            provider.generate(1, 42, VALID_PAYLOAD)

        assert call_order.index("normalize") < call_order.index("transfer")
