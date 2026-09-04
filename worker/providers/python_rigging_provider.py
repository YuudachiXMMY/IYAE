"""Pure-Python garment rigging provider.

Uses weight_transfer.py (Phase 1-3) instead of Blender subprocess.
Requires: igl, robust_laplacian, trimesh, numpy (all in requirements.txt).
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any

import numpy as np

from providers.a_pose import get_a_pose_body_pose
from providers.blender_rigging_provider import RiggingError
from providers.smplx_provider import _resolve_smplx_model_path

logger = logging.getLogger(__name__)


class PythonRiggingProvider:
    """Rig a garment GLB via pure-Python weight transfer (no Blender)."""

    def __init__(self, output_dir: str = "/var/clossette/assets") -> None:
        self.output_dir = output_dir

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def generate(
        self,
        task_id: int | str,
        garment_asset_id: int | str,
        input_payload: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """Rig *garment_asset_id* and return a schemaVersion=2 payload.

        Args:
            task_id:          Rigging task identifier (used for logging).
            garment_asset_id: ID used to name the output file.
            input_payload:    Must contain ``source_glb_url`` and optionally
                              ``avatar_glb_url`` and ``slot_hint``.

        Returns:
            Output payload dict (schemaVersion=2).

        Raises:
            ValueError:    If payload is None or missing required fields.
            RiggingError:  If the rigging pipeline fails.
        """
        t0 = time.monotonic()
        self._validate_payload(input_payload)

        source_url: str = input_payload["source_glb_url"]  # type: ignore[index]
        slot_hint: str = input_payload.get("slot_hint", "DRESS")  # type: ignore[union-attr]

        _VALID_SLOTS = {"TOP", "BOTTOM", "DRESS"}
        if slot_hint not in _VALID_SLOTS:
            raise ValueError(
                f"Invalid slot_hint: {slot_hint!r}. Must be one of {sorted(_VALID_SLOTS)}"
            )

        source_path = self._resolve_path(source_url)

        garment_verts, garment_faces, garment_normals = self._load_garment_glb(source_path)
        avatar_verts, avatar_faces, avatar_normals, avatar_weights, joint_positions = self._get_avatar_data(
            input_payload  # type: ignore[arg-type]
        )

        from providers.scale_normalizer import normalize_garment_to_avatar
        garment_verts, scale_info = normalize_garment_to_avatar(
            garment_verts, avatar_verts, slot_hint
        )
        if scale_info["was_normalized"]:
            logger.info(
                "Rigging task %s: garment scaled by %.3f (original height: %.3fm)",
                task_id, scale_info["scale_factor"],
                scale_info["original_bbox"]["max"][1] - scale_info["original_bbox"]["min"][1],
            )

        from providers.mesh_preflight import preflight_mesh
        errors = preflight_mesh(garment_verts, garment_faces)
        if errors:
            raise RiggingError(errors, "PREFLIGHT_FAILED")
        logger.info(
            "Rigging task %s: preflight passed for %d vertices, %d faces",
            task_id, len(garment_verts), len(garment_faces),
        )

        from providers.weight_transfer import transfer_weights
        skin_weights = transfer_weights(
            garment_verts,
            garment_faces,
            garment_normals,
            avatar_verts,
            avatar_faces,
            avatar_normals,
            avatar_weights,
            slot_hint=slot_hint,
        )
        logger.info("Rigging task %s: weight transfer complete, writing GLB", task_id)

        from providers.weight_transfer import dense_weights_to_top4
        from providers.skinned_glb_writer import write_skinned_glb
        from providers.canonical_skeleton import SMPLX_JOINT_NAMES, SMPLX_PARENT_INDICES

        ji, jw = dense_weights_to_top4(skin_weights)

        out_rel = f"rigged/{garment_asset_id}/garment-rigged.glb"
        out_abs = os.path.join(self.output_dir, out_rel)
        os.makedirs(os.path.dirname(out_abs), exist_ok=True)
        write_skinned_glb(
            output_path=out_abs,
            vertices=garment_verts.astype(np.float32),
            normals=garment_normals.astype(np.float32),
            indices=garment_faces.astype(np.uint32),
            joint_indices=ji,
            joint_weights=jw,
            joint_names=SMPLX_JOINT_NAMES,
            parent_indices=SMPLX_PARENT_INDICES,
            joint_positions=joint_positions,
            slot_hint=slot_hint,
        )
        logger.info("Rigging task %s: skinned GLB written to %s", task_id, out_abs)

        elapsed_ms = int((time.monotonic() - t0) * 1000)
        bbox_min = garment_verts.min(axis=0).tolist()
        bbox_max = garment_verts.max(axis=0).tolist()
        joint_count = len(SMPLX_JOINT_NAMES)

        return {
            "schemaVersion": 2,
            "provider_used": "PYTHON_WEIGHT_TRANSFER",
            "garment_asset_id": garment_asset_id,
            "rigged_glb_path": out_rel,
            "rigged_glb_url": f"/assets/{out_rel}",
            "slot_hint": slot_hint,
            "triangle_count": len(garment_faces),
            "bbox": {"min": bbox_min, "max": bbox_max},
            "skin": {"has_skin": True, "joint_count": joint_count},
            "rigging": {"method": "PYTHON_WEIGHT_TRANSFER", "pose": "A_POSE"},
            "scale_normalization": scale_info,
            "elapsed_ms": elapsed_ms,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _validate_payload(self, payload: dict[str, Any] | None) -> None:
        if payload is None:
            raise ValueError("input_payload must not be None")
        if not payload.get("source_glb_url"):
            raise ValueError("input_payload missing required field: source_glb_url")

    def _resolve_path(self, url_or_path: str | None) -> str | None:
        if not url_or_path:
            return url_or_path
        if url_or_path.startswith(("http://", "https://")):
            return url_or_path
        if url_or_path.startswith("/assets/"):
            relative = url_or_path[len("/assets/"):]
            return os.path.join(self.output_dir, relative)
        return url_or_path

    def _load_garment_glb(
        self, path: str | None
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Load garment GLB and return (verts, faces, normals)."""
        import trimesh

        if not path:
            raise RiggingError(["source_glb_url resolved to empty path"], "LOAD_FAILED")

        mesh = trimesh.load(path, force="mesh")
        if not isinstance(mesh, trimesh.Trimesh):
            raise RiggingError([f"Could not load mesh from {path}"], "LOAD_FAILED")

        verts = np.asarray(mesh.vertices, dtype=np.float64)
        faces = np.asarray(mesh.faces, dtype=np.int32)
        normals = np.asarray(mesh.vertex_normals, dtype=np.float64)
        return verts, faces, normals

    def _get_avatar_data(
        self, payload: dict[str, Any]
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Return avatar (verts, faces, normals, lbs_weights).

        Tries to load from an SMPL-X model if available; otherwise raises.
        """
        try:
            return self._load_smplx_avatar(payload)
        except Exception as exc:
            raise RiggingError([f"Failed to load avatar data: {exc}"], "AVATAR_LOAD_FAILED") from exc

    def _load_smplx_avatar(
        self, payload: dict[str, Any]
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Lazy-load SMPL-X model and extract mesh + LBS weights."""
        import smplx  # type: ignore[import]
        import torch  # type: ignore[import]

        smplx_path = os.environ.get("SMPLX_MODELS_PATH", "./smplx_models")
        if not os.path.isdir(smplx_path):
            raise RiggingError(
                [f"SMPL-X model directory not found: {smplx_path}. "
                 "Set SMPLX_MODELS_PATH or run: git lfs pull"],
                "AVATAR_LOAD_FAILED",
            )
        resolved_path = _resolve_smplx_model_path(smplx_path)
        model = smplx.create(resolved_path, model_type="smplx", gender="neutral", use_pca=False)
        a_pose = get_a_pose_body_pose()
        body_pose_tensor = torch.tensor(a_pose, dtype=torch.float32).reshape(1, -1)
        output = model(body_pose=body_pose_tensor, return_verts=True)

        verts = output.vertices.detach().cpu().numpy().squeeze()  # (6890, 3)
        faces = model.faces.astype(np.int32)                      # (F, 3)

        import trimesh
        mesh = trimesh.Trimesh(vertices=verts, faces=faces, process=False)
        normals = np.asarray(mesh.vertex_normals, dtype=np.float64)

        lbs_weights = model.lbs_weights.detach().cpu().numpy()   # (6890, 55)

        # Extract joint positions from the A-pose forward pass output
        joint_positions = output.joints.detach().cpu().numpy().squeeze()  # (55, 3)

        return (
            verts.astype(np.float64),
            faces,
            normals,
            lbs_weights.astype(np.float64),
            joint_positions.astype(np.float32),
        )
