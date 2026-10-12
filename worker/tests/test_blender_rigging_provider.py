"""Tests for BlenderRiggingProvider and StubRiggingProvider."""
from __future__ import annotations

import json
import os
import struct
import pytest
from unittest.mock import MagicMock, patch, call

from providers.blender_rigging_provider import BlenderRiggingProvider, RiggingError
from providers.stub_rigging_provider import StubRiggingProvider


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_minimal_glb() -> bytes:
    """Return a minimal valid GLB (JSON-only, empty scene)."""
    scene_json = json.dumps({
        "asset": {"version": "2.0", "generator": "test-stub"},
        "scene": 0,
        "scenes": [{"nodes": []}],
    }).encode("utf-8")
    padding = (4 - len(scene_json) % 4) % 4
    scene_json += b" " * padding
    total_length = 12 + 8 + len(scene_json)
    header = struct.pack("<4sII", b"glTF", 2, total_length)
    chunk_header = struct.pack("<II", len(scene_json), 0x4E4F534A)
    return header + chunk_header + scene_json


def _successful_result(output_path: str) -> dict:
    return {
        "success": True,
        "output_path": output_path,
        "triangle_count": 1200,
        "bbox": {"min": [-0.3, 0.0, -0.2], "max": [0.3, 1.5, 0.2]},
        "joint_count": 14,
        "elapsed_ms": 4200,
        "errors": [],
        "warnings": [],
    }


def _failed_result(failure_code: str = "BLENDER_EXPORT_FAILED", errors: list[str] | None = None) -> dict:
    return {
        "success": False,
        "errors": errors or ["Something went wrong"],
        "failure_code": failure_code,
        "elapsed_ms": 800,
        "warnings": [],
    }


# ---------------------------------------------------------------------------
# BlenderRiggingProvider — init
# ---------------------------------------------------------------------------

class TestBlenderRiggingProviderInit:
    def test_default_output_dir(self):
        provider = BlenderRiggingProvider()
        assert provider.output_dir == "/var/iyae/assets"

    def test_default_blender_path(self):
        provider = BlenderRiggingProvider()
        assert provider.blender_path == "blender"

    def test_custom_output_dir_and_blender_path(self, tmp_path):
        provider = BlenderRiggingProvider(
            output_dir=str(tmp_path),
            blender_path="/usr/local/bin/blender",
        )
        assert provider.output_dir == str(tmp_path)
        assert provider.blender_path == "/usr/local/bin/blender"


# ---------------------------------------------------------------------------
# BlenderRiggingProvider — _resolve_path
# ---------------------------------------------------------------------------

class TestResolvePathBlender:
    def setup_method(self):
        self.provider = BlenderRiggingProvider(output_dir="/var/iyae/assets")

    def test_assets_prefix_resolved_to_output_dir(self):
        result = self.provider._resolve_path("/assets/products/5/preview.glb")
        assert result == "/var/iyae/assets/products/5/preview.glb"

    def test_http_url_returned_unchanged(self):
        url = "http://example.com/model.glb"
        assert self.provider._resolve_path(url) == url

    def test_https_url_returned_unchanged(self):
        url = "https://cdn.example.com/model.glb"
        assert self.provider._resolve_path(url) == url

    def test_absolute_path_returned_unchanged(self):
        path = "/var/data/model.glb"
        assert self.provider._resolve_path(path) == path

    def test_empty_string_returned_unchanged(self):
        assert self.provider._resolve_path("") == ""


# ---------------------------------------------------------------------------
# BlenderRiggingProvider — generate (success path)
# ---------------------------------------------------------------------------

class TestBlenderRiggingProviderGenerateSuccess:
    def _run_generate(self, tmp_path, result_override: dict | None = None):
        provider = BlenderRiggingProvider(
            output_dir=str(tmp_path),
            blender_path="blender",
        )
        output_path = str(tmp_path / "rigged" / "7" / "garment-rigged.glb")
        blender_result = result_override or _successful_result(output_path)

        def fake_run_blender(job_path, result_path):
            # Simulate Blender writing result.json
            os.makedirs(os.path.dirname(result_path), exist_ok=True)
            with open(result_path, "w") as f:
                json.dump(blender_result, f)
            return blender_result

        with patch.object(provider, "_run_blender", side_effect=fake_run_blender):
            return provider.generate(
                task_id=1,
                garment_asset_id=7,
                input_payload={
                    "source_glb_url": "/assets/products/10/preview.glb",
                    "avatar_glb_url": "/assets/avatars/3/avatar.glb",
                    "slot_hint": "TOP",
                },
            )

    def test_payload_schema_version_is_2(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["schemaVersion"] == 2

    def test_payload_provider_used_is_blender(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["provider_used"] == "BLENDER"

    def test_payload_contains_garment_asset_id(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["garment_asset_id"] == 7

    def test_payload_rigged_glb_url_contains_asset_id(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert "7" in payload["rigged_glb_url"]
        assert payload["rigged_glb_url"].startswith("/assets/rigged/")

    def test_payload_slot_hint_preserved(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["slot_hint"] == "TOP"

    def test_payload_triangle_count_from_result(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["triangle_count"] == 1200

    def test_payload_bbox_from_result(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["bbox"] == {"min": [-0.3, 0.0, -0.2], "max": [0.3, 1.5, 0.2]}

    def test_payload_skin_has_skin_true(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["skin"]["has_skin"] is True

    def test_payload_skin_joint_count_from_result(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["skin"]["joint_count"] == 14

    def test_payload_rigging_method_is_data_transfer(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert payload["rigging"]["method"] == "BLENDER_DATA_TRANSFER"
        assert payload["rigging"]["pose"] == "A_POSE"

    def test_payload_elapsed_ms_is_non_negative_int(self, tmp_path):
        payload = self._run_generate(tmp_path)
        assert isinstance(payload["elapsed_ms"], int)
        assert payload["elapsed_ms"] >= 0

    def test_job_json_written_with_correct_keys(self, tmp_path):
        provider = BlenderRiggingProvider(output_dir=str(tmp_path))
        written_job: dict = {}

        def fake_run_blender(job_path, result_path):
            with open(job_path) as jf:
                written_job.update(json.load(jf))
            blender_result = _successful_result(str(tmp_path / "rigged" / "42" / "garment-rigged.glb"))
            os.makedirs(os.path.dirname(result_path), exist_ok=True)
            with open(result_path, "w") as rf:
                json.dump(blender_result, rf)
            return blender_result

        with patch.object(provider, "_run_blender", side_effect=fake_run_blender):
            provider.generate(
                task_id=5,
                garment_asset_id=42,
                input_payload={
                    "source_glb_url": "/assets/products/1/preview.glb",
                    "avatar_glb_url": "/assets/avatars/2/avatar.glb",
                    "slot_hint": "BOTTOM",
                },
            )

        assert "source_glb_url" in written_job
        assert "avatar_glb_url" in written_job
        assert "slot_hint" in written_job
        assert written_job["slot_hint"] == "BOTTOM"
        assert "output_path" in written_job
        assert "result_path" in written_job

    def test_job_and_result_json_are_not_written_under_the_public_rigged_subtree(self, tmp_path):
        """job.json / result.json must stay out of /assets/rigged/.

        That subtree is served publicly — the rigged GLB is fetched straight from it by the
        try-on viewer, so nginx and SecurityConfig both allow it. These two files are not
        public: job.json carries absolute container paths and ``avatar_glb_url``, which
        contains the owning user's id. They belong under ``rigging-work``, which appears in no
        asset allow-list.
        """
        provider = BlenderRiggingProvider(output_dir=str(tmp_path))
        seen: dict = {}

        def fake_run_blender(job_path, result_path):
            seen["job_path"] = job_path
            seen["result_path"] = result_path
            blender_result = _successful_result(str(tmp_path / "rigged" / "42" / "garment-rigged.glb"))
            os.makedirs(os.path.dirname(result_path), exist_ok=True)
            with open(result_path, "w") as rf:
                json.dump(blender_result, rf)
            return blender_result

        with patch.object(provider, "_run_blender", side_effect=fake_run_blender):
            payload = provider.generate(
                task_id=5,
                garment_asset_id=42,
                input_payload={
                    "source_glb_url": "/assets/products/1/preview.glb",
                    "avatar_glb_url": "/assets/avatars/2/avatar.glb",
                    "slot_hint": "TOP",
                },
            )

        public_rigged = os.path.join(str(tmp_path), "rigged")
        work = os.path.join(str(tmp_path), "rigging-work")
        assert not seen["job_path"].startswith(public_rigged)
        assert not seen["result_path"].startswith(public_rigged)
        assert seen["job_path"].startswith(work)
        assert seen["result_path"].startswith(work)
        # The deliverable itself still goes to the public subtree, since that is what the
        # viewer fetches.
        assert payload["rigged_glb_url"].startswith("/assets/rigged/")


# ---------------------------------------------------------------------------
# BlenderRiggingProvider — generate (failure paths)
# ---------------------------------------------------------------------------

class TestBlenderRiggingProviderGenerateFailure:
    def test_raises_value_error_when_input_payload_is_none(self, tmp_path):
        provider = BlenderRiggingProvider(output_dir=str(tmp_path))
        with pytest.raises(ValueError, match="source_glb_url"):
            provider.generate(task_id=1, garment_asset_id=1, input_payload=None)

    def test_raises_value_error_when_source_glb_url_missing(self, tmp_path):
        provider = BlenderRiggingProvider(output_dir=str(tmp_path))
        with pytest.raises(ValueError, match="source_glb_url"):
            provider.generate(task_id=1, garment_asset_id=1, input_payload={"slot_hint": "TOP"})

    def test_raises_rigging_error_on_blender_failure(self, tmp_path):
        provider = BlenderRiggingProvider(output_dir=str(tmp_path))
        failed = _failed_result("BLENDER_EXPORT_FAILED", ["Armature import failed"])

        def fake_run_blender(job_path, result_path):
            os.makedirs(os.path.dirname(result_path), exist_ok=True)
            with open(result_path, "w") as f:
                json.dump(failed, f)
            return failed

        with patch.object(provider, "_run_blender", side_effect=fake_run_blender):
            with pytest.raises(RiggingError) as exc_info:
                provider.generate(
                    task_id=1,
                    garment_asset_id=9,
                    input_payload={"source_glb_url": "/assets/products/1/preview.glb"},
                )
        assert exc_info.value.failure_code == "BLENDER_EXPORT_FAILED"
        assert "Armature import failed" in exc_info.value.errors

    def test_raises_rigging_error_on_topology_failure(self, tmp_path):
        provider = BlenderRiggingProvider(output_dir=str(tmp_path))
        failed = _failed_result(
            "TOPOLOGY_REPAIR_REQUIRED",
            ["non_manifold_edges:512", "degenerate_faces:200"],
        )

        def fake_run_blender(job_path, result_path):
            os.makedirs(os.path.dirname(result_path), exist_ok=True)
            with open(result_path, "w") as f:
                json.dump(failed, f)
            return failed

        with patch.object(provider, "_run_blender", side_effect=fake_run_blender):
            with pytest.raises(RiggingError) as exc_info:
                provider.generate(
                    task_id=2,
                    garment_asset_id=11,
                    input_payload={"source_glb_url": "/assets/products/2/preview.glb"},
                )
        assert exc_info.value.failure_code == "TOPOLOGY_REPAIR_REQUIRED"

    def test_raises_runtime_error_when_blender_produces_no_result_json(self, tmp_path):
        provider = BlenderRiggingProvider(output_dir=str(tmp_path))

        with patch("providers.blender_rigging_provider.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=1, stderr="Blender crash", stdout="")
            with pytest.raises(RuntimeError, match="result.json"):
                provider.generate(
                    task_id=3,
                    garment_asset_id=13,
                    input_payload={"source_glb_url": "/assets/products/3/preview.glb"},
                )


# ---------------------------------------------------------------------------
# BlenderRiggingProvider — subprocess invocation
# ---------------------------------------------------------------------------

class TestBlenderSubprocessCommand:
    def test_blender_invoked_with_background_and_script_flags(self, tmp_path):
        provider = BlenderRiggingProvider(
            output_dir=str(tmp_path),
            blender_path="/usr/bin/blender",
        )

        blender_result = _successful_result(
            str(tmp_path / "rigged" / "20" / "garment-rigged.glb")
        )

        with patch("providers.blender_rigging_provider.subprocess.run") as mock_run, \
             patch("providers.blender_rigging_provider.os.path.isfile", return_value=True), \
             patch("builtins.open", side_effect=lambda p, *a, **k: (
                 __import__("io").StringIO(json.dumps(blender_result))
                 if p.endswith("result.json") else open.__wrapped__(p, *a, **k)
                 if hasattr(open, "__wrapped__") else __import__("io").StringIO("{}")
             )):
            mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")

            # patch open to handle all file writes and the result.json read
            with patch("providers.blender_rigging_provider.open",
                       __import__("unittest.mock", fromlist=["mock_open"]).mock_open(
                           read_data=json.dumps(blender_result)
                       )):
                try:
                    provider.generate(
                        task_id=1,
                        garment_asset_id=20,
                        input_payload={"source_glb_url": "/assets/products/1/preview.glb"},
                    )
                except Exception:
                    pass  # We only care about the subprocess call

            cmd = mock_run.call_args[0][0]
            assert "/usr/bin/blender" in cmd
            assert "--background" in cmd
            assert "--python" in cmd


# ---------------------------------------------------------------------------
# RiggingError
# ---------------------------------------------------------------------------

class TestRiggingError:
    def test_error_stores_errors_list(self):
        err = RiggingError(["mesh invalid"], "BLENDER_EXPORT_FAILED")
        assert err.errors == ["mesh invalid"]

    def test_error_stores_failure_code(self):
        err = RiggingError(["topology"], "TOPOLOGY_REPAIR_REQUIRED")
        assert err.failure_code == "TOPOLOGY_REPAIR_REQUIRED"

    def test_error_message_contains_failure_code(self):
        err = RiggingError(["bad mesh"], "BLENDER_EXPORT_FAILED")
        assert "BLENDER_EXPORT_FAILED" in str(err)

    def test_error_is_exception_subclass(self):
        err = RiggingError([], "BLENDER_EXPORT_FAILED")
        assert isinstance(err, Exception)


# ---------------------------------------------------------------------------
# StubRiggingProvider — init and resolve
# ---------------------------------------------------------------------------

class TestStubRiggingProviderInit:
    def test_default_output_dir(self):
        provider = StubRiggingProvider()
        assert provider.output_dir == "/var/iyae/assets"

    def test_custom_output_dir(self, tmp_path):
        provider = StubRiggingProvider(output_dir=str(tmp_path))
        assert provider.output_dir == str(tmp_path)


class TestStubRiggingProviderResolvePath:
    def setup_method(self):
        self.provider = StubRiggingProvider(output_dir="/var/iyae/assets")

    def test_assets_prefix_resolved(self):
        result = self.provider._resolve_path("/assets/products/1/preview.glb")
        assert result == "/var/iyae/assets/products/1/preview.glb"

    def test_https_url_unchanged(self):
        url = "https://cdn.example.com/garment.glb"
        assert self.provider._resolve_path(url) == url

    def test_absolute_path_unchanged(self):
        path = "/tmp/garment.glb"
        assert self.provider._resolve_path(path) == path


# ---------------------------------------------------------------------------
# StubRiggingProvider — generate (success path)
# ---------------------------------------------------------------------------

class TestStubRiggingProviderGenerate:
    def test_writes_skinned_glb_to_output_path(self, tmp_path):
        # Write a minimal GLB to act as source (existence check only)
        src_dir = tmp_path / "products" / "5" / "tasks" / "1"
        src_dir.mkdir(parents=True)
        src_file = src_dir / "preview.glb"
        src_file.write_bytes(_make_minimal_glb())

        provider = StubRiggingProvider(output_dir=str(tmp_path))
        provider.generate(
            task_id=1,
            garment_asset_id=99,
            input_payload={
                "source_glb_url": f"/assets/products/5/tasks/1/preview.glb",
                "slot_hint": "TOP",
            },
        )

        out = tmp_path / "rigged" / "99" / "garment-rigged.glb"
        assert out.exists()
        data = out.read_bytes()
        # Verify it's a valid GLB (magic header + version 2)
        assert data[:4] == b"glTF"
        import struct
        version = struct.unpack_from("<I", data, 4)[0]
        assert version == 2
        # Verify it's NOT a copy of the source (skinned GLB is generated, not copied)
        assert data != src_file.read_bytes()

    def test_payload_schema_version_is_2(self, tmp_path):
        src_dir = tmp_path / "src"
        src_dir.mkdir()
        src_file = src_dir / "garment.glb"
        src_file.write_bytes(_make_minimal_glb())

        provider = StubRiggingProvider(output_dir=str(tmp_path))
        payload = provider.generate(
            task_id=2,
            garment_asset_id=10,
            input_payload={"source_glb_url": str(src_file), "slot_hint": "BOTTOM"},
        )
        assert payload["schemaVersion"] == 2

    def test_payload_provider_used_is_stub_rigging(self, tmp_path):
        src = tmp_path / "g.glb"
        src.write_bytes(_make_minimal_glb())

        provider = StubRiggingProvider(output_dir=str(tmp_path))
        payload = provider.generate(
            task_id=3,
            garment_asset_id=11,
            input_payload={"source_glb_url": str(src)},
        )
        assert payload["provider_used"] == "STUB_RIGGING"

    def test_payload_rigged_glb_url_contains_asset_id(self, tmp_path):
        src = tmp_path / "g.glb"
        src.write_bytes(_make_minimal_glb())

        provider = StubRiggingProvider(output_dir=str(tmp_path))
        payload = provider.generate(
            task_id=4,
            garment_asset_id=55,
            input_payload={"source_glb_url": str(src)},
        )
        assert "55" in payload["rigged_glb_url"]
        assert payload["rigged_glb_url"].startswith("/assets/rigged/")

    def test_payload_skin_has_skin_true(self, tmp_path):
        src = tmp_path / "g.glb"
        src.write_bytes(_make_minimal_glb())

        provider = StubRiggingProvider(output_dir=str(tmp_path))
        payload = provider.generate(
            task_id=5,
            garment_asset_id=12,
            input_payload={"source_glb_url": str(src)},
        )
        assert payload["skin"]["has_skin"] is True
        assert payload["skin"]["joint_count"] == 22

    def test_payload_rigging_method_is_stub(self, tmp_path):
        src = tmp_path / "g.glb"
        src.write_bytes(_make_minimal_glb())

        provider = StubRiggingProvider(output_dir=str(tmp_path))
        payload = provider.generate(
            task_id=6,
            garment_asset_id=13,
            input_payload={"source_glb_url": str(src)},
        )
        assert payload["rigging"]["method"] == "STUB"

    def test_payload_elapsed_ms_is_non_negative_int(self, tmp_path):
        src = tmp_path / "g.glb"
        src.write_bytes(_make_minimal_glb())

        provider = StubRiggingProvider(output_dir=str(tmp_path))
        payload = provider.generate(
            task_id=7,
            garment_asset_id=14,
            input_payload={"source_glb_url": str(src)},
        )
        assert isinstance(payload["elapsed_ms"], int)
        assert payload["elapsed_ms"] >= 0

    def test_payload_slot_hint_preserved(self, tmp_path):
        src = tmp_path / "g.glb"
        src.write_bytes(_make_minimal_glb())

        provider = StubRiggingProvider(output_dir=str(tmp_path))
        payload = provider.generate(
            task_id=8,
            garment_asset_id=15,
            input_payload={"source_glb_url": str(src), "slot_hint": "DRESS"},
        )
        assert payload["slot_hint"] == "DRESS"


# ---------------------------------------------------------------------------
# StubRiggingProvider — failure paths
# ---------------------------------------------------------------------------

class TestStubRiggingProviderFailure:
    def test_raises_value_error_when_input_payload_is_none(self, tmp_path):
        provider = StubRiggingProvider(output_dir=str(tmp_path))
        with pytest.raises(ValueError, match="source_glb_url"):
            provider.generate(task_id=1, garment_asset_id=1, input_payload=None)

    def test_raises_value_error_when_source_glb_url_missing(self, tmp_path):
        provider = StubRiggingProvider(output_dir=str(tmp_path))
        with pytest.raises(ValueError, match="source_glb_url"):
            provider.generate(task_id=1, garment_asset_id=1, input_payload={"slot_hint": "TOP"})

    def test_raises_file_not_found_when_source_does_not_exist(self, tmp_path):
        provider = StubRiggingProvider(output_dir=str(tmp_path))
        with pytest.raises(FileNotFoundError, match="Source GLB not found"):
            provider.generate(
                task_id=1,
                garment_asset_id=1,
                input_payload={"source_glb_url": "/nonexistent/path/garment.glb"},
            )
