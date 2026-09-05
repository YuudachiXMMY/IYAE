"""Tests for SmplxStubProvider and SmplxProvider.measurements_to_betas."""
import struct
from unittest.mock import MagicMock, patch

import pytest

from providers.smplx_stub_provider import SmplxStubProvider, create_avatar_glb
from providers.smplx_provider import SmplxProvider, _is_lfs_pointer, _resolve_smplx_model_path
from validator import validate_glb, validate_metadata


# ---------------------------------------------------------------------------
# SmplxStubProvider — file creation
# ---------------------------------------------------------------------------


class TestSmplxStubProviderGenerate:
    def test_creates_glb_file(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        provider.generate(task_id=1, user_id=42, input_payload=None)
        glb = tmp_path / "avatars" / "42" / "avatar.glb"
        assert glb.exists()
        assert glb.stat().st_size > 0

    def test_creates_correct_directory_structure(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        provider.generate(task_id=3, user_id=99, input_payload=None)
        expected_dir = tmp_path / "avatars" / "99"
        assert expected_dir.is_dir()

    def test_does_not_create_usdz_file(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        provider.generate(task_id=1, user_id=42, input_payload=None)
        usdz = tmp_path / "avatars" / "42" / "avatar.usdz"
        assert not usdz.exists()

    def test_different_users_write_to_different_dirs(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        provider.generate(task_id=1, user_id=10, input_payload=None)
        provider.generate(task_id=2, user_id=20, input_payload=None)
        assert (tmp_path / "avatars" / "10" / "avatar.glb").exists()
        assert (tmp_path / "avatars" / "20" / "avatar.glb").exists()

    def test_accepts_input_payload_without_error(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        payload = provider.generate(
            task_id=1,
            user_id=5,
            input_payload={"heightCm": 175, "weightKg": 68},
        )
        assert payload["provider_used"] == "SMPLX_STUB"


# ---------------------------------------------------------------------------
# SmplxStubProvider — output payload schema
# ---------------------------------------------------------------------------


class TestSmplxStubProviderOutputPayload:
    REQUIRED_KEYS = {
        "schemaVersion",
        "provider_used",
        "provider_request_id",
        "glb_path",
        "triangle_count",
        "bbox",
        "sanity",
        "elapsed_ms",
        "glb_url",
        "gender",
    }

    def test_payload_has_all_required_keys(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(task_id=1, user_id=42, input_payload=None)
        assert set(result.keys()) == self.REQUIRED_KEYS

    def test_payload_schema_version_is_1(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(task_id=1, user_id=42, input_payload=None)
        assert result["schemaVersion"] == 1

    def test_provider_used_is_smplx_stub(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(task_id=1, user_id=42, input_payload=None)
        assert result["provider_used"] == "SMPLX_STUB"

    def test_provider_request_id_is_none(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(task_id=1, user_id=42, input_payload=None)
        assert result["provider_request_id"] is None

    def test_no_usdz_keys_in_payload(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(task_id=1, user_id=42, input_payload=None)
        assert "usdz_path" not in result
        assert "usdz_url" not in result

    def test_paths_contain_user_id(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(task_id=5, user_id=123, input_payload=None)
        assert "123" in result["glb_path"], "glb_path missing user_id"
        assert "123" in result["glb_url"], "glb_url missing user_id"

    def test_glb_url_has_assets_prefix(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(task_id=1, user_id=7, input_payload=None)
        assert result["glb_url"].startswith("/assets/avatars/")

    def test_sanity_has_nan_vertices_false(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(task_id=1, user_id=42, input_payload=None)
        assert result["sanity"]["has_nan_vertices"] is False

    def test_sanity_glb_size_bytes_positive(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(task_id=1, user_id=42, input_payload=None)
        assert result["sanity"]["glb_size_bytes"] > 0

    def test_bbox_has_correct_humanoid_shape(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(task_id=1, user_id=42, input_payload=None)
        bbox = result["bbox"]
        assert len(bbox["min"]) == 3
        assert len(bbox["max"]) == 3
        # Height dimension (Y) should be close to 1.7m for humanoid
        height = bbox["max"][1] - bbox["min"][1]
        assert height == pytest.approx(1.7, abs=0.01)

    def test_elapsed_ms_is_non_negative_int(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(task_id=1, user_id=42, input_payload=None)
        assert isinstance(result["elapsed_ms"], int)
        assert result["elapsed_ms"] >= 0


# ---------------------------------------------------------------------------
# SmplxStubProvider — validator integration
# ---------------------------------------------------------------------------


class TestSmplxStubProviderValidatorIntegration:
    def test_generated_glb_passes_validate_glb(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(task_id=1, user_id=42, input_payload=None)
        glb_abs_path = str(tmp_path / result["glb_path"])
        validation = validate_glb(glb_abs_path)
        assert validation["valid"], f"GLB validation failed: {validation['errors']}"

    def test_output_payload_passes_validate_metadata(self, tmp_path):
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(task_id=1, user_id=42, input_payload=None)
        validation = validate_metadata(result)
        assert validation["valid"], f"Metadata validation failed: {validation['errors']}"

    def test_create_avatar_glb_has_valid_magic_header(self):
        data = create_avatar_glb()
        assert data[:4] == b"glTF"

    def test_create_avatar_glb_total_length_matches(self):
        data = create_avatar_glb()
        total_length = struct.unpack("<I", data[8:12])[0]
        assert total_length == len(data)

    def test_stub_glb_local_joint_translations(self):
        """Verify stub GLB uses local (not world) joint translations."""
        import json as _json
        import struct as _struct

        glb_data = create_avatar_glb()
        json_length = _struct.unpack_from('<I', glb_data, 12)[0]
        json_bytes = glb_data[20 : 20 + json_length]
        gltf_json = _json.loads(json_bytes.decode('utf-8').rstrip())

        nodes = gltf_json["nodes"]
        assert nodes[1]["name"] == "pelvis"
        assert nodes[1]["translation"] == [0.0, 0.85, 0.0]
        assert nodes[2]["name"] == "spine1"
        assert nodes[2]["translation"] == [0.0, 0.25, 0.0]
        assert nodes[3]["name"] == "head"
        assert nodes[3]["translation"] == [0.0, 0.5, 0.0]

    def test_stub_glb_cumulative_world_positions(self):
        """Verify local translations sum to correct world positions."""
        import json as _json
        import struct as _struct

        glb_data = create_avatar_glb()
        json_length = _struct.unpack_from('<I', glb_data, 12)[0]
        json_bytes = glb_data[20 : 20 + json_length]
        gltf_json = _json.loads(json_bytes.decode('utf-8').rstrip())

        nodes = gltf_json["nodes"]
        pelvis_y = nodes[1]["translation"][1]
        spine1_y = nodes[2]["translation"][1]
        head_y = nodes[3]["translation"][1]

        assert pelvis_y == pytest.approx(0.85)
        assert pelvis_y + spine1_y == pytest.approx(1.1)
        assert pelvis_y + spine1_y + head_y == pytest.approx(1.6)


# ---------------------------------------------------------------------------
# SmplxProvider.measurements_to_betas — static method
# ---------------------------------------------------------------------------


class TestMeasurementsToBetas:
    def test_returns_list_of_10_floats(self):
        betas = SmplxProvider.measurements_to_betas({})
        assert isinstance(betas, list)
        assert len(betas) == 10

    def test_all_elements_are_floats(self):
        betas = SmplxProvider.measurements_to_betas({})
        for i, b in enumerate(betas):
            assert isinstance(b, float), f"beta[{i}] is {type(b).__name__}, expected float"

    def test_default_measurements_produce_near_zero_betas(self):
        # At population average values, most betas should be close to zero
        default = {
            "heightCm": 170.0,
            "weightKg": 70.0,
            "chestCm": 90.0,
            "waistCm": 75.0,
            "hipsCm": 95.0,
            "shoulderWidthCm": 40.0,
            "inseamCm": 80.0,
        }
        betas = SmplxProvider.measurements_to_betas(default)
        assert len(betas) == 10
        for i, b in enumerate(betas):
            assert abs(b) < 0.01, f"beta[{i}]={b} expected ~0 at population average"

    def test_empty_dict_uses_defaults(self):
        betas_empty = SmplxProvider.measurements_to_betas({})
        betas_defaults = SmplxProvider.measurements_to_betas(
            {
                "heightCm": 170.0,
                "weightKg": 70.0,
                "chestCm": 90.0,
                "waistCm": 75.0,
                "hipsCm": 95.0,
                "shoulderWidthCm": 40.0,
                "inseamCm": 80.0,
            }
        )
        assert betas_empty == betas_defaults

    def test_taller_person_has_larger_beta0(self):
        short = SmplxProvider.measurements_to_betas({"heightCm": 155.0})
        tall = SmplxProvider.measurements_to_betas({"heightCm": 185.0})
        # beta0 has a positive coefficient for height
        assert tall[0] > short[0]

    def test_heavier_person_has_larger_beta1(self):
        light = SmplxProvider.measurements_to_betas({"weightKg": 55.0})
        heavy = SmplxProvider.measurements_to_betas({"weightKg": 100.0})
        # beta1 has a positive coefficient for weight
        assert heavy[1] > light[1]

    def test_different_measurements_produce_different_betas(self):
        betas_a = SmplxProvider.measurements_to_betas(
            {"heightCm": 160.0, "weightKg": 55.0}
        )
        betas_b = SmplxProvider.measurements_to_betas(
            {"heightCm": 180.0, "weightKg": 90.0}
        )
        assert betas_a != betas_b

    def test_beta9_is_always_zero(self):
        for measurements in [
            {},
            {"heightCm": 200.0, "weightKg": 120.0},
            {"heightCm": 150.0, "weightKg": 45.0},
        ]:
            betas = SmplxProvider.measurements_to_betas(measurements)
            assert betas[9] == 0.0, f"beta9 should be reserved/zero, got {betas[9]}"

    def test_extreme_measurements_clamped_to_range(self):
        """Very large measurements must not produce betas outside [-4, 4]."""
        extreme = {
            "heightCm": 230.0,
            "weightKg": 200.0,
            "chestCm": 150.0,
            "waistCm": 140.0,
            "hipsCm": 160.0,
            "shoulderWidthCm": 70.0,
            "inseamCm": 120.0,
        }
        betas = SmplxProvider.measurements_to_betas(extreme)
        for i, b in enumerate(betas):
            assert -4.0 <= b <= 4.0, f"beta[{i}]={b} not clamped to [-4, 4]"
        # At least one beta is saturated at the clamp bound (proves clamping is active).
        assert any(b == 4.0 for b in betas)

    def test_extreme_low_measurements_clamped_to_range(self):
        """Very small measurements must not produce betas below -4."""
        tiny = {
            "heightCm": 120.0,
            "weightKg": 30.0,
            "chestCm": 50.0,
            "waistCm": 45.0,
            "hipsCm": 55.0,
            "shoulderWidthCm": 20.0,
            "inseamCm": 40.0,
        }
        betas = SmplxProvider.measurements_to_betas(tiny)
        for i, b in enumerate(betas):
            assert -4.0 <= b <= 4.0, f"beta[{i}]={b} not clamped to [-4, 4]"
        assert any(b == -4.0 for b in betas)

    def test_neutral_gender_matches_default_arg(self):
        """Explicit gender='neutral' must equal the default (no-arg) behavior."""
        m = {"heightCm": 180.0, "weightKg": 85.0, "chestCm": 100.0}
        assert (
            SmplxProvider.measurements_to_betas(m)
            == SmplxProvider.measurements_to_betas(m, "neutral")
        )

    def test_gender_conditioning_shifts_betas(self):
        """male/female shift population means, so betas differ from neutral."""
        m = {"heightCm": 170.0}
        neutral = SmplxProvider.measurements_to_betas(m, "neutral")
        male = SmplxProvider.measurements_to_betas(m, "male")
        female = SmplxProvider.measurements_to_betas(m, "female")
        assert neutral != male
        assert neutral != female

    def test_unknown_gender_falls_back_to_neutral(self):
        """An unrecognized gender behaves like neutral."""
        m = {"heightCm": 180.0, "weightKg": 90.0}
        assert (
            SmplxProvider.measurements_to_betas(m, "alien")
            == SmplxProvider.measurements_to_betas(m, "neutral")
        )


# ---------------------------------------------------------------------------
# _is_lfs_pointer — Git LFS pointer detection
# ---------------------------------------------------------------------------


class TestIsLfsPointer:
    """Tests for _is_lfs_pointer() Git LFS pointer detection."""

    def test_detects_real_lfs_pointer(self, tmp_path):
        """Real LFS pointer content should be detected."""
        pointer = tmp_path / "model.npz"
        pointer.write_bytes(
            b"version https://git-lfs.github.com/spec/v1\n"
            b"oid sha256:abc123def456\n"
            b"size 123456789\n"
        )
        assert _is_lfs_pointer(str(pointer)) is True

    def test_large_file_not_pointer(self, tmp_path):
        """File larger than 1024 bytes should not be considered a pointer."""
        big_file = tmp_path / "model.npz"
        big_file.write_bytes(b"\x00" * 2048)
        assert _is_lfs_pointer(str(big_file)) is False

    def test_nonexistent_file(self, tmp_path):
        """Non-existent file should return False."""
        assert _is_lfs_pointer(str(tmp_path / "missing.npz")) is False

    def test_normal_binary_not_pointer(self, tmp_path):
        """Normal binary file should not be detected as pointer."""
        npz = tmp_path / "model.npz"
        npz.write_bytes(b"\x93NUMPY" + b"\x00" * 100)
        assert _is_lfs_pointer(str(npz)) is False

    def test_partial_lfs_signature_missing_oid(self, tmp_path):
        """LFS header without oid line should not match."""
        partial = tmp_path / "model.npz"
        partial.write_bytes(
            b"version https://git-lfs.github.com/spec/v1\n"
            b"size 123456789\n"
        )
        assert _is_lfs_pointer(str(partial)) is False

    def test_partial_lfs_signature_missing_size(self, tmp_path):
        """LFS header without size line should not match."""
        partial = tmp_path / "model.npz"
        partial.write_bytes(
            b"version https://git-lfs.github.com/spec/v1\n"
            b"oid sha256:abc123def456\n"
        )
        assert _is_lfs_pointer(str(partial)) is False


# ---------------------------------------------------------------------------
# _resolve_smplx_model_path — LFS pointer fallback behaviour
# ---------------------------------------------------------------------------


class TestResolveSmplxModelPathLfs:
    """Tests for LFS pointer handling in _resolve_smplx_model_path()."""

    def test_all_candidates_lfs_returns_base_path(self, tmp_path):
        """When all candidate npz files are LFS pointers, should fall back to base_path."""
        lfs_content = (
            b"version https://git-lfs.github.com/spec/v1\n"
            b"oid sha256:abc123\n"
            b"size 999\n"
        )
        # Create LFS pointer at base_path/smplx/SMPLX_NEUTRAL.npz
        smplx_dir = tmp_path / "smplx"
        smplx_dir.mkdir()
        (smplx_dir / "SMPLX_NEUTRAL.npz").write_bytes(lfs_content)

        result = _resolve_smplx_model_path(str(tmp_path))
        assert result == str(tmp_path)

    def test_missing_npz_returns_base_path(self, tmp_path):
        """When no npz files exist at any candidate, should fall back to base_path."""
        result = _resolve_smplx_model_path(str(tmp_path))
        assert result == str(tmp_path)


# ---------------------------------------------------------------------------
# SmplxProvider — gender selection via _get_model
# ---------------------------------------------------------------------------


class TestSmplxProviderGenderSelection:
    """Tests for multi-gender model loading and caching in SmplxProvider."""

    def _make_provider(self, tmp_path) -> SmplxProvider:
        return SmplxProvider(
            output_base_dir=str(tmp_path),
            model_path=str(tmp_path / "smplx_models"),
        )

    def _mock_load(self, provider: SmplxProvider) -> MagicMock:
        """Replace _load_model_for_gender with a mock that populates _models."""
        mock = MagicMock(
            side_effect=lambda g: provider._models.__setitem__(g, MagicMock())
        )
        provider._load_model_for_gender = mock
        return mock

    def test_get_model_male_calls_create_with_male(self, tmp_path):
        provider = self._make_provider(tmp_path)
        mock = self._mock_load(provider)
        provider._get_model("male")
        mock.assert_called_once_with("male")

    def test_get_model_female_calls_create_with_female(self, tmp_path):
        provider = self._make_provider(tmp_path)
        mock = self._mock_load(provider)
        provider._get_model("female")
        mock.assert_called_once_with("female")

    def test_get_model_neutral_calls_create_with_neutral(self, tmp_path):
        provider = self._make_provider(tmp_path)
        mock = self._mock_load(provider)
        provider._get_model("neutral")
        mock.assert_called_once_with("neutral")

    def test_get_model_unknown_falls_back_to_neutral(self, tmp_path):
        """_get_model('unknown') should normalize to 'neutral'."""
        provider = self._make_provider(tmp_path)
        mock = self._mock_load(provider)
        provider._get_model("unknown")
        mock.assert_called_once_with("neutral")

    def test_get_model_none_falls_back_to_neutral(self, tmp_path):
        """_get_model(None) should normalize to 'neutral'."""
        provider = self._make_provider(tmp_path)
        mock = self._mock_load(provider)
        provider._get_model(None)
        mock.assert_called_once_with("neutral")

    def test_generate_reads_gender_from_payload(self, tmp_path):
        """generate() with gender='female' in payload should load female model."""
        provider = self._make_provider(tmp_path)
        sentinel_model = MagicMock(name="female_model")
        captured_genders: list[str] = []

        def fake_get_model(gender: str):
            captured_genders.append(gender)
            return sentinel_model

        provider._get_model = fake_get_model

        import numpy as np

        mock_vertices = np.random.rand(100, 3).astype(np.float32)
        mock_output = MagicMock()
        mock_output.vertices.detach.return_value.numpy.return_value = np.array(
            [mock_vertices]
        )
        mock_output.joints.detach.return_value.numpy.return_value = np.random.rand(1, 55, 3).astype(np.float32)
        sentinel_model.return_value = mock_output
        sentinel_model.faces = np.array([[0, 1, 2]])
        sentinel_model.lbs_weights.detach.return_value.numpy.return_value = np.random.rand(100, 55).astype(np.float32)

        provider._torch = MagicMock()
        provider._torch.tensor.return_value = MagicMock()

        mock_trimesh = MagicMock()
        mock_trimesh.Trimesh.return_value.vertex_normals = np.random.rand(100, 3).astype(np.float32)
        mock_ji = np.zeros((100, 4), dtype=np.uint8)
        mock_jw = np.ones((100, 4), dtype=np.float32) * 0.25
        with patch.dict("sys.modules", {"trimesh": mock_trimesh}):
            with patch("providers.weight_transfer.dense_weights_to_top4", return_value=(mock_ji, mock_jw)):
                with patch("providers.skinned_glb_writer.write_skinned_glb"):
                    with patch("os.path.getsize", return_value=1024):
                        provider.generate(
                            task_id=1,
                            user_id=42,
                            input_payload={"gender": "female", "heightCm": 165},
                        )

        assert captured_genders == ["female"]

    def test_generate_defaults_to_neutral_without_gender(self, tmp_path):
        """generate() with no gender field should fall back to 'neutral'."""
        provider = self._make_provider(tmp_path)
        captured_genders: list[str] = []
        sentinel_model = MagicMock(name="neutral_model")

        def fake_get_model(gender: str):
            captured_genders.append(gender)
            return sentinel_model

        provider._get_model = fake_get_model

        import numpy as np

        mock_vertices = np.random.rand(100, 3).astype(np.float32)
        mock_output = MagicMock()
        mock_output.vertices.detach.return_value.numpy.return_value = np.array(
            [mock_vertices]
        )
        mock_output.joints.detach.return_value.numpy.return_value = np.random.rand(1, 55, 3).astype(np.float32)
        sentinel_model.return_value = mock_output
        sentinel_model.faces = np.array([[0, 1, 2]])
        sentinel_model.lbs_weights.detach.return_value.numpy.return_value = np.random.rand(100, 55).astype(np.float32)

        provider._torch = MagicMock()
        provider._torch.tensor.return_value = MagicMock()

        mock_trimesh = MagicMock()
        mock_trimesh.Trimesh.return_value.vertex_normals = np.random.rand(100, 3).astype(np.float32)
        mock_ji = np.zeros((100, 4), dtype=np.uint8)
        mock_jw = np.ones((100, 4), dtype=np.float32) * 0.25
        with patch.dict("sys.modules", {"trimesh": mock_trimesh}):
            with patch("providers.weight_transfer.dense_weights_to_top4", return_value=(mock_ji, mock_jw)):
                with patch("providers.skinned_glb_writer.write_skinned_glb"):
                    with patch("os.path.getsize", return_value=1024):
                        provider.generate(
                            task_id=1,
                            user_id=42,
                            input_payload={"heightCm": 170},
                        )

        assert captured_genders == ["neutral"]

    def test_model_caching_avoids_reload(self, tmp_path):
        """Calling _get_model('male') twice should only load the model once."""
        provider = self._make_provider(tmp_path)
        mock = self._mock_load(provider)
        provider._get_model("male")
        provider._get_model("male")
        mock.assert_called_once_with("male")


# ---------------------------------------------------------------------------
# SmplxStubProvider — gender passthrough
# ---------------------------------------------------------------------------


class TestSmplxStubProviderGenderPassthrough:
    """Tests that SmplxStubProvider passes gender from input to output."""

    def test_gender_from_input_appears_in_output(self, tmp_path):
        """The gender value in input_payload should appear in the output payload."""
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(
            task_id=1, user_id=42, input_payload={"gender": "female"}
        )
        assert result["gender"] == "female"

    def test_gender_defaults_to_neutral_when_absent(self, tmp_path):
        """When input_payload has no gender field, output should default to 'neutral'."""
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(task_id=1, user_id=42, input_payload={})
        assert result["gender"] == "neutral"

    def test_gender_defaults_to_neutral_when_payload_none(self, tmp_path):
        """When input_payload is None, output should default to 'neutral'."""
        provider = SmplxStubProvider(output_base_dir=str(tmp_path))
        result = provider.generate(task_id=1, user_id=42, input_payload=None)
        assert result["gender"] == "neutral"


# ---------------------------------------------------------------------------
# SmplxProvider — skinned GLB output
# ---------------------------------------------------------------------------


class TestSmplxProviderSkinnedGlbOutput:
    """Tests that SmplxProvider.generate() produces skinned GLB with skeleton data."""

    def _run_generate(self, tmp_path, input_payload=None, vertices=None):
        """Helper: run generate() with fully mocked SMPL-X dependencies.

        Pass ``vertices`` (shape (N, 3)) to control the mesh bounds (used by the
        fit-accuracy tests); otherwise a random 100-vertex cloud is used.
        """
        import numpy as np

        provider = SmplxProvider(
            output_base_dir=str(tmp_path),
            model_path=str(tmp_path / "smplx_models"),
        )

        sentinel_model = MagicMock(name="neutral_model")

        if vertices is None:
            mock_vertices = np.random.rand(100, 3).astype(np.float32)
        else:
            mock_vertices = np.asarray(vertices, dtype=np.float32)
        n = mock_vertices.shape[0]
        mock_faces = np.array([[0, 1, 2], [1, 2, 3]], dtype=np.int64)
        mock_lbs = np.random.rand(n, 55).astype(np.float32)
        mock_joints = np.random.rand(1, 55, 3).astype(np.float32)

        mock_output = MagicMock()
        mock_output.vertices.detach.return_value.numpy.return_value = np.array(
            [mock_vertices]
        )
        mock_output.joints.detach.return_value.numpy.return_value = mock_joints
        sentinel_model.return_value = mock_output
        sentinel_model.faces = mock_faces
        sentinel_model.lbs_weights.detach.return_value.numpy.return_value = mock_lbs

        provider._get_model = lambda g: sentinel_model
        provider._torch = MagicMock()
        provider._torch.tensor.return_value = MagicMock()

        mock_trimesh = MagicMock()
        mock_normals = np.random.rand(n, 3).astype(np.float32)
        mock_trimesh.Trimesh.return_value.vertex_normals = mock_normals

        mock_ji = np.zeros((n, 4), dtype=np.uint8)
        mock_jw = np.ones((n, 4), dtype=np.float32) * 0.25

        with patch.dict("sys.modules", {"trimesh": mock_trimesh}):
            with patch(
                "providers.weight_transfer.dense_weights_to_top4",
                return_value=(mock_ji, mock_jw),
            ) as mock_top4:
                with patch(
                    "providers.skinned_glb_writer.write_skinned_glb"
                ) as mock_write:
                    with patch("os.path.getsize", return_value=2048):
                        result = provider.generate(
                            task_id=1,
                            user_id=42,
                            input_payload=input_payload,
                        )

        return result, mock_write, mock_top4

    def test_output_payload_contains_skin_field(self, tmp_path):
        """generate() output should include a 'skin' field."""
        result, _, _ = self._run_generate(tmp_path)
        assert "skin" in result, "Output payload missing 'skin' field"

    def test_skin_has_skin_is_true(self, tmp_path):
        """skin.has_skin should be True."""
        result, _, _ = self._run_generate(tmp_path)
        assert result["skin"]["has_skin"] is True

    def test_skin_joint_count_is_55(self, tmp_path):
        """skin.joint_count should be 55 (full SMPL-X skeleton)."""
        result, _, _ = self._run_generate(tmp_path)
        assert result["skin"]["joint_count"] == 55

    def test_calls_write_skinned_glb(self, tmp_path):
        """generate() should call write_skinned_glb instead of trimesh export."""
        _, mock_write, _ = self._run_generate(tmp_path)
        mock_write.assert_called_once()

    def test_calls_dense_weights_to_top4(self, tmp_path):
        """generate() should convert LBS weights via dense_weights_to_top4."""
        _, _, mock_top4 = self._run_generate(tmp_path)
        mock_top4.assert_called_once()

    def test_output_payload_contains_fit_accuracy(self, tmp_path):
        """generate() output should include a tracked 'fit_accuracy' block."""
        result, _, _ = self._run_generate(tmp_path)
        assert "fit_accuracy" in result, "Output payload missing 'fit_accuracy'"
        fa = result["fit_accuracy"]
        assert "height_error_cm" in fa
        assert "betas_in_range" in fa
        assert isinstance(fa["height_error_cm"], float)
        assert isinstance(fa["betas_in_range"], bool)

    def test_fit_accuracy_height_error_reflects_mesh_height(self, tmp_path):
        """height_error_cm should be ~0 when the mesh Y-extent matches the requested height."""
        import numpy as np

        # Vertices spanning exactly 1.60m in Y (min 0.0, max 1.60).
        verts = np.array(
            [[0.0, 0.0, 0.0], [0.1, 1.60, 0.1], [-0.1, 0.8, -0.1]], dtype=np.float32
        )
        result, _, _ = self._run_generate(
            tmp_path, input_payload={"heightCm": 160.0}, vertices=verts
        )
        assert result["fit_accuracy"]["height_error_cm"] == pytest.approx(0.0, abs=0.5)
        assert result["fit_accuracy"]["betas_in_range"] is True

    def test_fit_accuracy_betas_in_range_true_for_normal_input(self, tmp_path):
        """Clamped betas from normal measurements are always in range."""
        result, _, _ = self._run_generate(
            tmp_path, input_payload={"heightCm": 170.0, "weightKg": 70.0}
        )
        assert result["fit_accuracy"]["betas_in_range"] is True
