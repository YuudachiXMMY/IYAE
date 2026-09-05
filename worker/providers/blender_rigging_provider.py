"""Blender-based garment rigging provider.

Runs Blender headless to transfer bone weights from an SMPL-X avatar mesh to a
garment GLB, producing a skinned GLB ready for skeletal animation.

Requires Blender >=3.6 installed and accessible via ``blender_path``.
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
import time

logger = logging.getLogger(__name__)

_SCRIPT_DIR = os.path.join(os.path.dirname(__file__), "blender_scripts")
_RIG_SCRIPT = os.path.join(_SCRIPT_DIR, "rig_garment.py")
_BLENDER_TIMEOUT = 300  # 5 minutes


class RiggingError(Exception):
    """Raised when Blender reports a failed rigging result."""

    def __init__(self, errors: list[str], failure_code: str) -> None:
        self.errors = errors
        self.failure_code = failure_code
        super().__init__(f"Rigging failed [{failure_code}]: {errors}")


class BlenderRiggingProvider:
    """Rigs garment GLB files using Blender's data-transfer weight system.

    Args:
        output_dir: Base directory for all generated files.
        blender_path: Path (or name) of the Blender executable.
    """

    def __init__(
        self,
        output_dir: str = "/var/iyae/assets",
        blender_path: str = "blender",
    ) -> None:
        self.output_dir = output_dir
        self.blender_path = blender_path

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate(
        self,
        task_id: int,
        garment_asset_id: int,
        input_payload: dict | None,
    ) -> dict:
        """Run Blender rigging and return an output payload dict.

        Args:
            task_id: The rigging task ID (for tracing/logging).
            garment_asset_id: ID of the garment asset being rigged.
            input_payload: Dict with keys:
                - source_glb_url  : URL or /assets/-relative path to the garment GLB
                - avatar_glb_url  : URL or /assets/-relative path to the avatar GLB
                - slot_hint       : "TOP" | "BOTTOM" | "DRESS"

        Returns:
            Output payload dict (schemaVersion=2).

        Raises:
            ValueError: If required input_payload keys are missing.
            RiggingError: If Blender reports a failure.
        """
        start_time = time.time()

        if not input_payload or "source_glb_url" not in input_payload:
            raise ValueError("input_payload must contain 'source_glb_url'")

        work_dir = os.path.join(self.output_dir, "rigged", str(garment_asset_id))
        os.makedirs(work_dir, exist_ok=True)

        output_path = os.path.join(work_dir, "garment-rigged.glb")
        result_path = os.path.join(work_dir, "result.json")
        job_path = os.path.join(work_dir, "job.json")

        job = {
            "source_glb_url": self._resolve_path(input_payload["source_glb_url"]),
            "avatar_glb_url": self._resolve_path(input_payload.get("avatar_glb_url", "")),
            "slot_hint": input_payload.get("slot_hint", "DRESS"),
            "output_path": output_path,
            "result_path": result_path,
        }

        with open(job_path, "w") as f:
            json.dump(job, f, indent=2)

        logger.info(
            "Launching Blender rigging: task_id=%d garment_asset_id=%d slot=%s",
            task_id,
            garment_asset_id,
            job["slot_hint"],
        )

        result = self._run_blender(job_path, result_path)
        elapsed_ms = int((time.time() - start_time) * 1000)
        return self._build_output_payload(garment_asset_id, input_payload, result, elapsed_ms)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _run_blender(self, job_path: str, result_path: str) -> dict:
        """Invoke Blender as a subprocess and read back the result JSON.

        Raises:
            RuntimeError: If Blender exits with a non-zero code and no result
                JSON was written.
        """
        cmd = [
            self.blender_path,
            "--background",
            "--python", _RIG_SCRIPT,
            "--", job_path,
        ]
        completed = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=_BLENDER_TIMEOUT,
        )

        if completed.returncode != 0:
            logger.warning(
                "Blender exited with code %d; stderr: %s",
                completed.returncode,
                completed.stderr[-2000:],
            )

        if not os.path.isfile(result_path):
            raise RuntimeError(
                f"Blender did not produce result.json (exit code {completed.returncode}). "
                f"stderr: {completed.stderr[-500:]}"
            )

        with open(result_path) as f:
            return json.load(f)

    def _build_output_payload(
        self,
        garment_asset_id: int,
        input_payload: dict,
        result: dict,
        elapsed_ms: int,
    ) -> dict:
        """Convert Blender result JSON into the provider output payload.

        Raises:
            RiggingError: If result["success"] is False.
        """
        if not result.get("success"):
            raise RiggingError(
                errors=result.get("errors", ["Unknown error"]),
                failure_code=result.get("failure_code", "BLENDER_EXPORT_FAILED"),
            )

        return {
            "schemaVersion": 2,
            "provider_used": "BLENDER",
            "garment_asset_id": garment_asset_id,
            "rigged_glb_path": f"rigged/{garment_asset_id}/garment-rigged.glb",
            "rigged_glb_url": f"/assets/rigged/{garment_asset_id}/garment-rigged.glb",
            "slot_hint": input_payload.get("slot_hint"),
            "triangle_count": result.get("triangle_count", 0),
            "bbox": result.get("bbox"),
            "skin": {
                "has_skin": True,
                "joint_count": result.get("joint_count", 0),
            },
            "rigging": {
                "method": "BLENDER_DATA_TRANSFER",
                "pose": "A_POSE",
            },
            "elapsed_ms": elapsed_ms,
        }

    def _resolve_path(self, url_or_path: str) -> str:
        """Resolve a /assets/-relative URL to an absolute filesystem path.

        Absolute paths and http(s) URLs are returned unchanged.
        """
        if not url_or_path:
            return url_or_path
        if url_or_path.startswith(("http://", "https://")):
            return url_or_path
        if url_or_path.startswith("/assets/"):
            relative = url_or_path[len("/assets/"):]
            return os.path.join(self.output_dir, relative)
        return url_or_path
