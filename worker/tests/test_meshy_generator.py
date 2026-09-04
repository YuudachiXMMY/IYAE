"""Tests for MeshyGenerator: init, generate, errors, and payload schema."""
import base64
import pytest
from unittest.mock import MagicMock, patch
from providers.meshy_generator import MeshyGenerator, MESHY_API_BASE


class TestResolveImageUrl:
    """Tests for _resolve_image_url: converts relative paths to base64 data URIs."""

    def test_https_url_returned_as_is(self):
        gen = MeshyGenerator(api_key="k")
        url = "https://example.com/image.jpg"
        assert gen._resolve_image_url(url) == url

    def test_http_url_returned_as_is(self):
        gen = MeshyGenerator(api_key="k")
        url = "http://example.com/image.jpg"
        assert gen._resolve_image_url(url) == url

    def test_data_uri_returned_as_is(self):
        gen = MeshyGenerator(api_key="k")
        url = "data:image/jpeg;base64,/9j/4AAQ"
        assert gen._resolve_image_url(url) == url

    def test_relative_path_converted_to_base64(self, tmp_path):
        img_dir = tmp_path / "uploads" / "products"
        img_dir.mkdir(parents=True)
        img_file = img_dir / "test.jpg"
        img_file.write_bytes(b"\xff\xd8\xff\xe0fake-jpeg-data")

        gen = MeshyGenerator(api_key="k", output_base_dir=str(tmp_path))
        result = gen._resolve_image_url("/uploads/products/test.jpg")
        assert result.startswith("data:image/jpeg;base64,")
        decoded = base64.b64decode(result.split(",", 1)[1])
        assert decoded == b"\xff\xd8\xff\xe0fake-jpeg-data"

    def test_relative_path_png_gets_correct_mime(self, tmp_path):
        img_dir = tmp_path / "uploads" / "products"
        img_dir.mkdir(parents=True)
        (img_dir / "test.png").write_bytes(b"\x89PNG\r\n\x1a\nfake-png")

        gen = MeshyGenerator(api_key="k", output_base_dir=str(tmp_path))
        result = gen._resolve_image_url("/uploads/products/test.png")
        assert result.startswith("data:image/png;base64,")

    def test_missing_file_raises_file_not_found(self, tmp_path):
        gen = MeshyGenerator(api_key="k", output_base_dir=str(tmp_path))
        with pytest.raises(FileNotFoundError, match="Image file not found"):
            gen._resolve_image_url("/uploads/products/nonexistent.jpg")


class TestMeshyGeneratorInit:
    def test_stores_api_key(self):
        gen = MeshyGenerator(api_key="test-key")
        assert gen.api_key == "test-key"

    def test_default_output_dir(self):
        gen = MeshyGenerator(api_key="test-key")
        assert gen.output_base_dir == "/var/clossette/assets"

    def test_custom_output_dir(self, tmp_path):
        gen = MeshyGenerator(api_key="test-key", output_base_dir=str(tmp_path))
        assert gen.output_base_dir == str(tmp_path)

    def test_authorization_header_uses_bearer_token(self):
        gen = MeshyGenerator(api_key="abc123")
        assert gen.headers["Authorization"] == "Bearer abc123"

    def test_content_type_header_is_json(self):
        gen = MeshyGenerator(api_key="test-key")
        assert gen.headers["Content-Type"] == "application/json"


class TestMeshyGeneratorGenerate:
    """Tests for the happy-path generate() flow."""

    def _make_status_response(self, meshy_task_id="meshy-abc", status="SUCCEEDED"):
        mock = MagicMock()
        mock.json.return_value = {
            "status": status,
            "consumed_credits": 5,
            "model_urls": {
                "glb": "https://cdn.meshy.ai/models/preview.glb",
                "usdz": "https://cdn.meshy.ai/models/preview.usdz",
            },
        }
        return mock

    @patch("providers.meshy_generator.time.sleep")
    @patch("providers.meshy_generator.requests.get")
    @patch("providers.meshy_generator.requests.post")
    def test_creates_glb_file(self, mock_post, mock_get, mock_sleep, tmp_path):
        mock_post.return_value.json.return_value = {"result": "meshy-abc"}
        glb_content = b"glTF" + b"\x00" * 8
        usdz_content = b"usdz-stub"
        status_mock = self._make_status_response()

        def get_side_effect(url, **kwargs):
            if "image-to-3d" in url:
                return status_mock
            elif url.endswith(".glb"):
                m = MagicMock()
                m.content = glb_content
                return m
            else:
                m = MagicMock()
                m.content = usdz_content
                return m

        mock_get.side_effect = get_side_effect

        gen = MeshyGenerator(api_key="test-key", output_base_dir=str(tmp_path))
        gen.generate(task_id=1, product_id=42, input_payload={"image_url": "https://example.com/img.jpg"})

        glb = tmp_path / "products" / "42" / "tasks" / "1" / "preview.glb"
        assert glb.exists()
        assert glb.read_bytes() == glb_content

    @patch("providers.meshy_generator.time.sleep")
    @patch("providers.meshy_generator.requests.get")
    @patch("providers.meshy_generator.requests.post")
    def test_creates_usdz_file_when_url_present(self, mock_post, mock_get, mock_sleep, tmp_path):
        mock_post.return_value.json.return_value = {"result": "meshy-abc"}
        usdz_content = b"usdz-stub"
        status_mock = self._make_status_response()

        def get_side_effect(url, **kwargs):
            if "image-to-3d" in url:
                return status_mock
            elif url.endswith(".glb"):
                m = MagicMock()
                m.content = b"glTF" + b"\x00" * 8
                return m
            else:
                m = MagicMock()
                m.content = usdz_content
                return m

        mock_get.side_effect = get_side_effect

        gen = MeshyGenerator(api_key="test-key", output_base_dir=str(tmp_path))
        gen.generate(task_id=1, product_id=42, input_payload={"image_url": "https://example.com/img.jpg"})

        usdz = tmp_path / "products" / "42" / "tasks" / "1" / "preview.usdz"
        assert usdz.exists()
        assert usdz.read_bytes() == usdz_content

    @patch("providers.meshy_generator.time.sleep")
    @patch("providers.meshy_generator.requests.get")
    @patch("providers.meshy_generator.requests.post")
    def test_post_request_includes_correct_model_params(self, mock_post, mock_get, mock_sleep, tmp_path):
        mock_post.return_value.json.return_value = {"result": "meshy-xyz"}
        status_mock = self._make_status_response(meshy_task_id="meshy-xyz")

        def get_side_effect(url, **kwargs):
            if "image-to-3d" in url:
                return status_mock
            m = MagicMock()
            m.content = b"data"
            return m

        mock_get.side_effect = get_side_effect

        gen = MeshyGenerator(api_key="test-key", output_base_dir=str(tmp_path))
        gen.generate(task_id=1, product_id=10, input_payload={"image_url": "https://example.com/img.jpg"})

        _, kwargs = mock_post.call_args
        body = kwargs["json"]
        assert body["ai_model"] == "meshy-6"
        assert body["topology"] == "triangle"
        assert body["target_polycount"] == 30000
        assert "glb" in body["target_formats"]

    @patch("providers.meshy_generator.time.sleep")
    @patch("providers.meshy_generator.requests.get")
    @patch("providers.meshy_generator.requests.post")
    def test_directory_structure_matches_task_and_product_id(self, mock_post, mock_get, mock_sleep, tmp_path):
        mock_post.return_value.json.return_value = {"result": "meshy-abc"}
        status_mock = self._make_status_response()

        def get_side_effect(url, **kwargs):
            if "image-to-3d" in url:
                return status_mock
            m = MagicMock()
            m.content = b"data"
            return m

        mock_get.side_effect = get_side_effect

        gen = MeshyGenerator(api_key="test-key", output_base_dir=str(tmp_path))
        gen.generate(task_id=7, product_id=99, input_payload={"image_url": "https://example.com/img.jpg"})

        expected_dir = tmp_path / "products" / "99" / "tasks" / "7"
        assert expected_dir.is_dir()


class TestMeshyGeneratorErrors:
    """Tests for error conditions in generate()."""

    def test_raises_value_error_when_input_payload_is_none(self, tmp_path):
        gen = MeshyGenerator(api_key="test-key", output_base_dir=str(tmp_path))
        with pytest.raises(ValueError, match="image_url"):
            gen.generate(task_id=1, product_id=1, input_payload=None)

    def test_raises_value_error_when_image_url_missing(self, tmp_path):
        gen = MeshyGenerator(api_key="test-key", output_base_dir=str(tmp_path))
        with pytest.raises(ValueError, match="image_url"):
            gen.generate(task_id=1, product_id=1, input_payload={"other_key": "value"})

    @patch("providers.meshy_generator.time.sleep")
    @patch("providers.meshy_generator.requests.get")
    @patch("providers.meshy_generator.requests.post")
    def test_raises_runtime_error_when_meshy_status_failed(self, mock_post, mock_get, mock_sleep, tmp_path):
        mock_post.return_value.json.return_value = {"result": "meshy-fail"}
        status_mock = MagicMock()
        status_mock.json.return_value = {
            "status": "FAILED",
            "task_error": {"message": "Insufficient image quality"},
        }
        mock_get.return_value = status_mock

        gen = MeshyGenerator(api_key="test-key", output_base_dir=str(tmp_path))
        with pytest.raises(RuntimeError, match="Meshy generation failed"):
            gen.generate(task_id=1, product_id=1, input_payload={"image_url": "https://example.com/img.jpg"})

    @patch("providers.meshy_generator.time.sleep")
    @patch("providers.meshy_generator.requests.get")
    @patch("providers.meshy_generator.requests.post")
    def test_raises_runtime_error_when_meshy_status_canceled(self, mock_post, mock_get, mock_sleep, tmp_path):
        mock_post.return_value.json.return_value = {"result": "meshy-cancel"}
        status_mock = MagicMock()
        status_mock.json.return_value = {"status": "CANCELED"}
        mock_get.return_value = status_mock

        gen = MeshyGenerator(api_key="test-key", output_base_dir=str(tmp_path))
        with pytest.raises(RuntimeError, match="canceled"):
            gen.generate(task_id=1, product_id=1, input_payload={"image_url": "https://example.com/img.jpg"})

    @patch("providers.meshy_generator.time.sleep")
    @patch("providers.meshy_generator.requests.get")
    @patch("providers.meshy_generator.requests.post")
    def test_raises_timeout_error_after_120_polls(self, mock_post, mock_get, mock_sleep, tmp_path):
        mock_post.return_value.json.return_value = {"result": "meshy-slow"}
        status_mock = MagicMock()
        status_mock.json.return_value = {"status": "PENDING"}
        mock_get.return_value = status_mock

        gen = MeshyGenerator(api_key="test-key", output_base_dir=str(tmp_path))
        with pytest.raises(TimeoutError, match="timed out"):
            gen.generate(task_id=1, product_id=1, input_payload={"image_url": "https://example.com/img.jpg"})

        assert mock_sleep.call_count == 120


class TestMeshyGeneratorPayload:
    """Tests for the returned payload schema."""

    REQUIRED_KEYS = {
        "schemaVersion", "provider_used", "provider_request_id",
        "glb_path", "usdz_path", "triangle_count", "bbox",
        "sanity", "elapsed_ms", "glb_url", "usdz_url",
    }

    def _run_generate(self, tmp_path):
        with patch("providers.meshy_generator.time.sleep"), \
             patch("providers.meshy_generator.requests.post") as mock_post, \
             patch("providers.meshy_generator.requests.get") as mock_get:
            mock_post.return_value.json.return_value = {"result": "meshy-paytest"}
            status_mock = MagicMock()
            status_mock.json.return_value = {
                "status": "SUCCEEDED",
                "consumed_credits": 3,
                "model_urls": {
                    "glb": "https://cdn.meshy.ai/models/preview.glb",
                    "usdz": "https://cdn.meshy.ai/models/preview.usdz",
                },
            }

            def get_side_effect(url, **kwargs):
                if "image-to-3d" in url:
                    return status_mock
                m = MagicMock()
                m.content = b"data"
                return m

            mock_get.side_effect = get_side_effect

            gen = MeshyGenerator(api_key="test-key", output_base_dir=str(tmp_path))
            return gen.generate(
                task_id=1,
                product_id=42,
                input_payload={"image_url": "https://example.com/img.jpg"},
            )

    def test_payload_has_all_required_keys(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert set(payload.keys()) == self.REQUIRED_KEYS

    def test_schema_version_is_1(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["schemaVersion"] == 1

    def test_provider_used_is_meshy(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["provider_used"] == "MESHY"

    def test_provider_request_id_matches_meshy_task_id(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["provider_request_id"] == "meshy-paytest"

    def test_glb_path_contains_product_and_task_ids(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert "42" in payload["glb_path"]
        assert "1" in payload["glb_path"]

    def test_usdz_path_contains_product_and_task_ids(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["usdz_path"] is not None
        assert "42" in payload["usdz_path"]
        assert "1" in payload["usdz_path"]

    def test_triangle_count_is_30000(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["triangle_count"] == 30000

    def test_bbox_is_none(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["bbox"] is None

    def test_sanity_has_nan_vertices_false(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["sanity"]["has_nan_vertices"] is False

    def test_elapsed_ms_is_positive_integer(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert isinstance(payload["elapsed_ms"], int)
        assert payload["elapsed_ms"] >= 0
