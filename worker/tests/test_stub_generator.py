"""Tests for StubGenerator output validation."""
import struct
from providers.stub_generator import StubGenerator, create_minimal_glb
from validator import validate_glb, validate_metadata


class TestCreateMinimalGlb:
    def test_returns_bytes(self):
        data = create_minimal_glb()
        assert isinstance(data, bytes)

    def test_has_valid_glb_magic_header(self):
        data = create_minimal_glb()
        assert data[:4] == b"glTF"

    def test_has_version_2(self):
        data = create_minimal_glb()
        version = struct.unpack("<I", data[4:8])[0]
        assert version == 2

    def test_total_length_matches_actual(self):
        data = create_minimal_glb()
        total_length = struct.unpack("<I", data[8:12])[0]
        assert total_length == len(data)


class TestStubGeneratorGenerate:
    def test_creates_glb_file(self, tmp_path):
        gen = StubGenerator(output_base_dir=str(tmp_path))
        gen.generate(task_id=1, product_id=42, input_payload=None)
        glb = tmp_path / "products" / "42" / "tasks" / "1" / "preview.glb"
        assert glb.exists()
        assert glb.stat().st_size > 0

    def test_creates_usdz_file(self, tmp_path):
        gen = StubGenerator(output_base_dir=str(tmp_path))
        gen.generate(task_id=1, product_id=42, input_payload=None)
        usdz = tmp_path / "products" / "42" / "tasks" / "1" / "preview.usdz"
        assert usdz.exists()
        assert usdz.stat().st_size > 0

    def test_creates_correct_directory_structure(self, tmp_path):
        gen = StubGenerator(output_base_dir=str(tmp_path))
        gen.generate(task_id=7, product_id=99, input_payload=None)
        expected_dir = tmp_path / "products" / "99" / "tasks" / "7"
        assert expected_dir.is_dir()

    def test_different_tasks_write_to_different_dirs(self, tmp_path):
        gen = StubGenerator(output_base_dir=str(tmp_path))
        gen.generate(task_id=1, product_id=42, input_payload=None)
        gen.generate(task_id=2, product_id=42, input_payload=None)
        assert (tmp_path / "products" / "42" / "tasks" / "1" / "preview.glb").exists()
        assert (tmp_path / "products" / "42" / "tasks" / "2" / "preview.glb").exists()


class TestStubGeneratorOutputPayload:
    REQUIRED_KEYS = {
        "schemaVersion", "provider_used", "provider_request_id",
        "glb_path", "usdz_path", "triangle_count", "bbox",
        "sanity", "elapsed_ms", "glb_url", "usdz_url",
    }

    def test_payload_has_all_required_keys(self, tmp_path):
        gen = StubGenerator(output_base_dir=str(tmp_path))
        payload = gen.generate(task_id=1, product_id=42, input_payload=None)
        assert set(payload.keys()) == self.REQUIRED_KEYS

    def test_payload_values_match_schema(self, tmp_path):
        gen = StubGenerator(output_base_dir=str(tmp_path))
        payload = gen.generate(task_id=1, product_id=42, input_payload=None)
        assert payload["schemaVersion"] == 1
        assert payload["provider_used"] == "STUB"
        assert payload["provider_request_id"] is None
        assert payload["triangle_count"] == 0
        assert payload["sanity"]["has_nan_vertices"] is False

    def test_payload_paths_contain_task_and_product_ids(self, tmp_path):
        gen = StubGenerator(output_base_dir=str(tmp_path))
        payload = gen.generate(task_id=5, product_id=100, input_payload=None)
        for key in ("glb_path", "usdz_path", "glb_url", "usdz_url"):
            assert "100" in payload[key], f"{key} missing product_id"
            assert "5" in payload[key], f"{key} missing task_id"


class TestStubGeneratorValidatorIntegration:
    def test_generated_glb_passes_validate_glb(self, tmp_path):
        gen = StubGenerator(output_base_dir=str(tmp_path))
        payload = gen.generate(task_id=1, product_id=42, input_payload=None)
        glb_path = str(tmp_path / payload["glb_path"])
        result = validate_glb(glb_path)
        assert result["valid"], f"GLB validation failed: {result['errors']}"

    def test_output_payload_passes_validate_metadata(self, tmp_path):
        gen = StubGenerator(output_base_dir=str(tmp_path))
        payload = gen.generate(task_id=1, product_id=42, input_payload=None)
        result = validate_metadata(payload)
        assert result["valid"], f"Metadata validation failed: {result['errors']}"
