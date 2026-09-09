"""Tests for MeshyGenerator: init, generate, errors, and payload schema."""
import base64
import pytest
from unittest.mock import MagicMock, patch
from providers.meshy_generator import (
    MeshyGenerator,
    MESHY_API_BASE,
    _enforce_download_cap,
    MAX_DOWNLOAD_BYTES,
)


def _streaming_download_mock(content: bytes):
    """A mock download response matching the streaming contract (stream=True).

    Provides ``headers`` (empty -> no Content-Length short-circuit) and an
    ``iter_content`` that yields the body as a single chunk, so the file written
    by ``stream_to_file_capped`` equals ``content``.
    """
    m = MagicMock()
    m.headers = {}
    m.content = content
    m.iter_content = lambda chunk_size=1 << 20: iter([content])
    return m


def _real_box_glb_bytes(extents=(0.4, 1.0, 0.3)):
    """Build a real, parseable box GLB and return ``(glb_bytes, trimesh_box)``.

    A trimesh box has 12 triangles and POSITION accessor min/max equal to its
    bounds, so tests can assert the *computed* metadata against known values.
    """
    import trimesh

    box = trimesh.creation.box(extents=extents)
    return box.export(file_type="glb"), box


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

    def test_relative_path_traversal_rejected(self, tmp_path):
        gen = MeshyGenerator(api_key="k", output_base_dir=str(tmp_path))
        with pytest.raises(ValueError, match="escapes asset root"):
            gen._resolve_image_url("../../../../etc/passwd")

    def test_absolute_escape_rejected(self, tmp_path):
        gen = MeshyGenerator(api_key="k", output_base_dir=str(tmp_path))
        with pytest.raises(ValueError, match="escapes asset root"):
            gen._resolve_image_url("/../../etc/passwd")


class TestMeshyGeneratorInit:
    def test_stores_api_key(self):
        gen = MeshyGenerator(api_key="test-key")
        assert gen.api_key == "test-key"

    def test_default_output_dir(self):
        gen = MeshyGenerator(api_key="test-key")
        assert gen.output_base_dir == "/var/iyae/assets"

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
                return _streaming_download_mock(glb_content)
            else:
                return _streaming_download_mock(usdz_content)

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
                return _streaming_download_mock(b"glTF" + b"\x00" * 8)
            else:
                return _streaming_download_mock(usdz_content)

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
            return _streaming_download_mock(b"data")

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
            return _streaming_download_mock(b"data")

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
                return _streaming_download_mock(b"data")

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

    def _run_generate_with_glb(self, tmp_path, glb_bytes):
        """Run generate() while serving real GLB bytes for the .glb download."""
        with patch("providers.meshy_generator.time.sleep"), \
             patch("providers.meshy_generator.requests.post") as mock_post, \
             patch("providers.meshy_generator.requests.get") as mock_get:
            mock_post.return_value.json.return_value = {"result": "meshy-real"}
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
                return _streaming_download_mock(
                    glb_bytes if url.endswith(".glb") else b"usdz-stub"
                )

            mock_get.side_effect = get_side_effect

            gen = MeshyGenerator(api_key="test-key", output_base_dir=str(tmp_path))
            return gen.generate(
                task_id=1,
                product_id=42,
                input_payload={"image_url": "https://example.com/img.jpg"},
            )

    def test_triangle_count_computed_from_downloaded_glb(self, tmp_path):
        # triangle_count must be the real count read from the GLB, not a hardcoded estimate.
        glb_bytes, box = _real_box_glb_bytes()
        payload = self._run_generate_with_glb(tmp_path, glb_bytes)
        assert payload["triangle_count"] == len(box.faces)

    def test_bbox_computed_from_downloaded_glb(self, tmp_path):
        # bbox min/max must match the GLB's POSITION accessor bounds, not None.
        glb_bytes, box = _real_box_glb_bytes(extents=(0.4, 1.0, 0.3))
        payload = self._run_generate_with_glb(tmp_path, glb_bytes)
        bbox = payload["bbox"]
        assert bbox is not None
        assert bbox["min"] == pytest.approx(box.bounds[0].tolist(), abs=1e-3)
        assert bbox["max"] == pytest.approx(box.bounds[1].tolist(), abs=1e-3)

    def test_sanity_has_nan_vertices_false_for_valid_glb(self, tmp_path):
        glb_bytes, _ = _real_box_glb_bytes()
        payload = self._run_generate_with_glb(tmp_path, glb_bytes)
        assert payload["sanity"]["has_nan_vertices"] is False

    def test_metadata_none_when_glb_unparseable(self, tmp_path):
        # A non-parseable download must not crash generate(); metadata degrades to None.
        payload = self._run_generate(tmp_path)
        assert payload["triangle_count"] is None
        assert payload["bbox"] is None
        assert payload["sanity"]["has_nan_vertices"] is False

    def test_elapsed_ms_is_positive_integer(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert isinstance(payload["elapsed_ms"], int)
        assert payload["elapsed_ms"] >= 0

    def test_glb_size_bytes_read_from_file_not_consumed_stream(self, tmp_path):
        # H1: the GLB is streamed to disk (stream=True + iter_content via
        # stream_to_file_capped), so glb_resp.content is already consumed and raises
        # StreamConsumedError. glb_size_bytes must come from os.path.getsize(file).
        glb_bytes, _ = _real_box_glb_bytes()

        class _ConsumedStreamResponse:
            """Mimics a real requests streaming Response: .content raises after
            iter_content has drained the body."""

            def __init__(self, content):
                self._content = content
                self.headers = {}

            def iter_content(self, chunk_size=1 << 20):
                yield self._content

            @property
            def content(self):
                raise RuntimeError("StreamConsumedError: content after iter_content")

            def raise_for_status(self):
                pass

        with patch("providers.meshy_generator.time.sleep"), \
             patch("providers.meshy_generator.requests.post") as mock_post, \
             patch("providers.meshy_generator.requests.get") as mock_get:
            mock_post.return_value.json.return_value = {"result": "meshy-h1"}
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
                if url.endswith(".glb"):
                    return _ConsumedStreamResponse(glb_bytes)
                return _streaming_download_mock(b"usdz-stub")

            mock_get.side_effect = get_side_effect

            gen = MeshyGenerator(api_key="test-key", output_base_dir=str(tmp_path))
            payload = gen.generate(
                task_id=1, product_id=42,
                input_payload={"image_url": "https://example.com/img.jpg"},
            )

        # No crash, and size matches the file that was written (== the downloaded bytes).
        assert payload["sanity"]["glb_size_bytes"] == len(glb_bytes)

    def test_tier2_has_nan_true_for_inf_vertices(self, monkeypatch, tmp_path):
        # M3: the trimesh fallback (Tier-2) must flag Inf, not just NaN. Force Tier-1
        # (pygltflib accessor bounds) to fail so Tier-2 runs, then hand it an Inf vertex.
        import numpy as np
        import pygltflib
        import trimesh
        from types import SimpleNamespace
        from providers import meshy_generator as mg

        glb = tmp_path / "x.glb"
        glb.write_bytes(b"glTF" + b"\x00" * 8)

        def _raise(*a, **k):
            raise RuntimeError("forced Tier-1 failure")

        monkeypatch.setattr(pygltflib.GLTF2, "load", _raise)
        fake_mesh = SimpleNamespace(
            vertices=np.array([[0.0, 0.0, 0.0], [float("inf"), 1.0, 1.0]], dtype=float),
            faces=np.array([[0, 1, 0]]),
        )
        monkeypatch.setattr(trimesh, "load", lambda p, process=False: fake_mesh)

        result = mg._compute_glb_metadata(str(glb))
        assert result["has_nan"] is True


class TestDownloadCap:
    """L2: downloads are size-capped to bound the worker's memory / DoS surface."""

    def test_oversized_content_length_raises(self):
        resp = MagicMock()
        resp.headers = {"Content-Length": "999"}
        resp.content = b""
        with pytest.raises(RuntimeError, match="exceeds"):
            _enforce_download_cap(resp, "https://example.com/huge.glb", max_bytes=100)

    def test_oversized_body_raises(self):
        resp = MagicMock()
        resp.headers = {}
        resp.content = b"x" * 200
        with pytest.raises(RuntimeError, match="exceeds"):
            _enforce_download_cap(resp, "https://example.com/huge.glb", max_bytes=100)

    def test_within_cap_passes(self):
        resp = MagicMock()
        resp.headers = {"Content-Length": "50"}
        resp.content = b"x" * 50
        # Should not raise.
        _enforce_download_cap(resp, "https://example.com/ok.glb", max_bytes=100)

    def test_default_cap_is_100mb(self):
        assert MAX_DOWNLOAD_BYTES == 100 * 1024 * 1024


class TestStreamingDownloadCap:
    """M1/M3: streaming cap aborts mid-body, before the whole response is buffered."""

    def test_streaming_body_over_cap_raises_and_removes_partial(self, tmp_path):
        from providers.meshy_generator import stream_to_file_capped

        dest = tmp_path / "preview.glb"
        resp = MagicMock()
        resp.headers = {}  # lying/absent Content-Length -> header check passes

        # Yield chunks that individually fit but cumulatively exceed the cap.
        resp.iter_content = lambda chunk_size=1 << 20: iter([b"x" * 60, b"x" * 60])
        with pytest.raises(RuntimeError, match="exceeds"):
            stream_to_file_capped(resp, str(dest), "https://example.com/huge.glb", max_bytes=100)
        # Partial file must be cleaned up, not left for the geometry validator.
        assert not dest.exists()

    def test_streaming_declared_length_short_circuits(self, tmp_path):
        from providers.meshy_generator import stream_to_file_capped

        dest = tmp_path / "preview.glb"
        resp = MagicMock()
        resp.headers = {"Content-Length": "999"}

        def _boom(chunk_size=1 << 20):
            raise AssertionError("body must not be streamed when header over cap")

        resp.iter_content = _boom
        with pytest.raises(RuntimeError, match="Content-Length"):
            stream_to_file_capped(resp, str(dest), "https://example.com/huge.glb", max_bytes=100)

    def test_streaming_within_cap_writes_file(self, tmp_path):
        from providers.meshy_generator import stream_to_file_capped

        dest = tmp_path / "preview.glb"
        resp = MagicMock()
        resp.headers = {}
        resp.iter_content = lambda chunk_size=1 << 20: iter([b"abc", b"def"])
        stream_to_file_capped(resp, str(dest), "https://example.com/ok.glb", max_bytes=100)
        assert dest.read_bytes() == b"abcdef"
