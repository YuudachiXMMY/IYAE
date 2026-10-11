"""SMPL-X based avatar generation provider."""
import json
import logging
import os
import time

from providers.a_pose import get_a_pose_body_pose
# Shared single source of truth for the fit-accuracy threshold. Imported for
# documentation/reuse; the emitted ``fit_accuracy`` block below is unchanged in
# shape. The worker avatar path validates the emitted block against this constant.
from providers.fit_accuracy import FIT_ACCURACY_MAX_HEIGHT_ERROR_CM

logger = logging.getLogger(__name__)

# Approximate population means per gender. ``neutral`` reproduces the original
# hand-authored reference values exactly, so neutral betas are unchanged (the
# near-zero regression test still holds). ``male``/``female`` shift the means to
# gender-condition the shape estimate.
_POPULATION_MEANS = {
    "neutral": {
        "height": 170.0, "weight": 70.0, "chest": 90.0, "waist": 75.0,
        "hips": 95.0, "shoulders": 40.0, "inseam": 80.0,
    },
    "male": {
        "height": 175.0, "weight": 78.0, "chest": 98.0, "waist": 83.0,
        "hips": 98.0, "shoulders": 45.0, "inseam": 83.0,
    },
    "female": {
        "height": 162.0, "weight": 62.0, "chest": 86.0, "waist": 70.0,
        "hips": 97.0, "shoulders": 36.0, "inseam": 76.0,
    },
}

# Safe SMPL-X shape-parameter range; betas beyond this produce degenerate bodies.
BETA_MIN = -4.0
BETA_MAX = 4.0


def _is_lfs_pointer(path: str, max_bytes: int = 512) -> bool:
    """Return True when path appears to be a Git LFS pointer file."""
    if not os.path.isfile(path):
        return False
    if os.path.getsize(path) > 1024:
        return False
    try:
        with open(path, "rb") as f:
            head = f.read(max_bytes)
        return (
            head.startswith(b"version https://git-lfs.github.com/spec/v1")
            and b"oid sha256:" in head
            and b"size " in head
        )
    except OSError:
        return False


def _resolve_smplx_model_path(base_path: str) -> str:
    """Find the correct SMPL-X model directory containing full model files.

    The smplx library expects ``model_path`` to be a directory whose
    ``smplx/`` subdirectory contains ``SMPLX_{GENDER}.{ext}`` files
    **with hand component data** (``hands_componentsl``, etc.).

    Official SMPL-X downloads often nest the full models under
    ``smplx/models/smplx/`` while placing stripped (11-key) copies at
    ``smplx/SMPLX_*.npz``.  Loading the stripped files causes::

        'Struct' object has no attribute 'hands_componentsl'

    This helper walks known nesting patterns and returns the deepest
    directory that the library should receive as ``model_path``.
    """
    import numpy as np

    # Candidate paths ordered from most-specific to least-specific.
    # The library internally appends ``/smplx`` when model_path is a dir,
    # so we return the *parent* of the ``smplx/`` folder that holds the
    # full model files.
    candidates = [
        os.path.join(base_path, "smplx", "models"),  # smplx_models/smplx/models/
        os.path.join(base_path, "models"),            # smplx_models/models/
        base_path,                                    # smplx_models/
    ]

    for candidate in candidates:
        smplx_dir = os.path.join(candidate, "smplx")
        neutral_npz = os.path.join(smplx_dir, "SMPLX_NEUTRAL.npz")
        if not os.path.isfile(neutral_npz):
            continue
        if _is_lfs_pointer(neutral_npz):
            logger.warning(
                "SMPL-X model file at %s appears to be a Git LFS pointer "
                "(%d bytes). Run 'git lfs pull' to download actual model files.",
                neutral_npz,
                os.path.getsize(neutral_npz),
            )
            continue
        try:
            data = np.load(neutral_npz, allow_pickle=True)
            if "hands_componentsl" in data:
                logger.info(
                    "Resolved SMPL-X model path: %s (full model with hand data)",
                    candidate,
                )
                return candidate
            logger.debug(
                "Skipping %s -- npz missing hands_componentsl (%d keys)",
                neutral_npz,
                len(list(data.keys())),
            )
        except Exception as exc:
            logger.warning(
                "Skipping %s -- failed to inspect npz: %s",
                neutral_npz,
                exc,
            )

    # Fallback: return the original path and let smplx.create() raise a
    # clear error if the model files are genuinely missing.
    logger.warning(
        "Could not locate full SMPL-X model files under %s; "
        "falling back to base path. If model files are Git LFS pointers, "
        "run 'git lfs pull' to download them.",
        base_path,
    )
    return base_path


class SmplxProvider:
    """Generates body-accurate avatars using the SMPL-X parametric body model.

    Heavy dependencies (torch, smplx, trimesh) are lazy-loaded on first use
    so the worker process starts quickly when using another provider.
    """

    def __init__(
        self,
        output_base_dir: str = "/var/iyae/assets",
        model_path: str = "/var/iyae/smplx_models",
    ):
        self.output_base_dir = output_base_dir
        self.model_path = model_path
        # Lazy-loaded heavy dependencies
        self._models: dict = {}
        self._torch = None
        self._smplx = None

    def _get_model(self, gender: str):
        """Return a cached SMPL-X model for the given gender, loading on first use."""
        gender = (gender or "neutral").lower()
        if gender not in ("male", "female", "neutral"):
            gender = "neutral"
        if gender not in self._models:
            self._load_model_for_gender(gender)
        return self._models[gender]

    def _load_model_for_gender(self, gender: str) -> None:
        """Lazy-load SMPL-X model and dependencies for a specific gender."""
        resolved_path = self.model_path  # default before resolution
        try:
            import torch
            import smplx as smplx_lib

            self._torch = torch
            self._smplx = smplx_lib

            resolved_path = _resolve_smplx_model_path(self.model_path)
            self._models[gender] = smplx_lib.create(
                resolved_path,
                model_type="smplx",
                gender=gender,
                use_face_contour=False,
                num_betas=10,
                use_pca=False,
                flat_hand_mean=True,
                ext="npz",
            )
            logger.info("SMPL-X %s model loaded successfully", gender)
        except ImportError as e:
            raise RuntimeError(f"SMPL-X dependencies not installed: {e}") from e
        except Exception as e:
            gender_upper = gender.upper()
            expected_file = os.path.join(resolved_path, "smplx", f"SMPLX_{gender_upper}.npz")
            raise RuntimeError(
                f"Failed to load SMPL-X {gender} model from model_path={self.model_path}, "
                f"resolved_path={resolved_path}. Expected full model at "
                f"{expected_file}. If files are Git LFS pointers, run "
                f"'git lfs pull' to download actual model data. "
                f"Original error: {e}"
            ) from e

    @staticmethod
    def _raw_betas(measurements: dict, gender: str = "neutral") -> list[float]:
        """Compute the raw (pre-clamp) 10 beta params from 7 body measurements.

        Returns the unclamped linear-regression output. ``measurements_to_betas``
        wraps this and clamps to ``[BETA_MIN, BETA_MAX]``; callers that need to
        know whether the *estimated* shape fell inside the safe range (e.g. the
        ``fit_accuracy.betas_in_range`` flag) must inspect these raw values, since
        clamping would otherwise make any in-range check tautologically true.

        Args:
            measurements: Body measurements dict.
            gender: ``neutral`` (default) reproduces the original mapping exactly;
                ``male``/``female`` shift the population means used for normalization
                so the shape is gender-conditioned. Unknown values fall back to
                ``neutral``.
        """
        gender = (gender or "neutral").lower()
        if gender not in ("male", "female", "neutral"):
            gender = "neutral"
        means = _POPULATION_MEANS[gender]

        height = measurements.get("heightCm", means["height"])
        weight = measurements.get("weightKg", means["weight"])
        chest = measurements.get("chestCm", means["chest"])
        waist = measurements.get("waistCm", means["waist"])
        hips = measurements.get("hipsCm", means["hips"])
        shoulders = measurements.get("shoulderWidthCm", means["shoulders"])
        inseam = measurements.get("inseamCm", means["inseam"])

        # Normalize to zero-mean (gender-specific approximate population averages)
        h_norm = (height - means["height"]) / 10.0
        w_norm = (weight - means["weight"]) / 15.0
        c_norm = (chest - means["chest"]) / 10.0
        wa_norm = (waist - means["waist"]) / 10.0
        hi_norm = (hips - means["hips"]) / 10.0
        s_norm = (shoulders - means["shoulders"]) / 5.0
        i_norm = (inseam - means["inseam"]) / 5.0

        # Approximate beta mapping (simplified linear regression coefficients)
        return [
            h_norm * 1.5 + w_norm * 0.5,   # beta0: overall size
            w_norm * 1.2 + wa_norm * 0.8,  # beta1: weight/width
            c_norm * 0.8 + hi_norm * 0.6,  # beta2: upper/lower proportion
            s_norm * 1.0,                   # beta3: shoulder width
            i_norm * 0.9 + h_norm * 0.3,   # beta4: leg length
            wa_norm * 0.7 - hi_norm * 0.3, # beta5: waist-hip ratio
            c_norm * 0.5 + s_norm * 0.5,   # beta6: upper body
            hi_norm * 0.8,                  # beta7: hip width
            h_norm * 0.3 - w_norm * 0.2,   # beta8: height-weight ratio
            0.0,                            # beta9: reserved
        ]

    @staticmethod
    def measurements_to_betas(measurements: dict, gender: str = "neutral") -> list[float]:
        """Simple linear regression from 7 body measurements to 10 beta params.

        Maps: heightCm, weightKg, chestCm, waistCm, hipsCm, shoulderWidthCm, inseamCm
        to 10 SMPL-X shape parameters (betas).

        This is a simplified approximation. A production system would use a trained
        regression model (e.g., from Measurements2SMPL).

        Args:
            measurements: Body measurements dict.
            gender: ``neutral`` (default) reproduces the original mapping exactly;
                ``male``/``female`` shift the population means used for normalization
                so the shape is gender-conditioned. Unknown values fall back to
                ``neutral``.

        Each returned beta is clamped to ``[BETA_MIN, BETA_MAX]`` to guard against
        degenerate SMPL-X shapes from extreme/out-of-distribution measurements. Use
        ``_raw_betas`` when the pre-clamp values are needed.
        """
        # Clamp to a safe range (near-zero neutral values are unaffected).
        return [
            max(BETA_MIN, min(BETA_MAX, b))
            for b in SmplxProvider._raw_betas(measurements, gender)
        ]

    def generate(self, task_id: int, user_id: int, input_payload: dict | None) -> dict:
        """Generate SMPL-X avatar from body measurements.

        Args:
            task_id: The generation task ID (used for logging/tracing).
            user_id: The user ID; determines the output directory.
            input_payload: Body measurements dict (heightCm, weightKg, etc.).

        Returns:
            Output payload dict conforming to avatar schema v1.
        """
        start_time = time.time()

        measurements = input_payload or {}
        gender = (measurements.get("gender") or "neutral").lower()
        model = self._get_model(gender)
        betas = self.measurements_to_betas(measurements, gender)

        torch = self._torch
        betas_tensor = torch.tensor([betas], dtype=torch.float32)

        # Forward pass with A-pose body_pose (shoulders rotated 30° outward)
        a_pose = get_a_pose_body_pose()
        body_pose_tensor = torch.tensor(a_pose, dtype=torch.float32).reshape(1, -1)
        output = model(betas=betas_tensor, body_pose=body_pose_tensor, return_verts=True)
        vertices = output.vertices.detach().numpy()[0]  # (N, 3)
        faces = model.faces  # (F, 3)

        # Export GLB as skinned mesh with skeleton and blend weights
        import trimesh
        import numpy as np
        from providers.skinned_glb_writer import write_skinned_glb
        from providers.weight_transfer import dense_weights_to_top4
        from providers.canonical_skeleton import SMPLX_JOINT_NAMES, SMPLX_PARENT_INDICES

        lbs_weights = model.lbs_weights.detach().numpy()  # (V, 55)
        joints = output.joints.detach().numpy()[0][:55]   # (55, 3)
        normals = trimesh.Trimesh(vertices=vertices, faces=faces).vertex_normals

        joint_indices, joint_weights = dense_weights_to_top4(lbs_weights)

        # Per-TASK directory, not per-user. Every unauthenticated visitor shares the one
        # internal guest account, so a per-user path meant all guests wrote to the same
        # file — a visitor could be shown another visitor's body mesh, generated from
        # their measurements. The server resolves the file from the payload path below, so
        # this layout is the single source of truth for where an avatar lives.
        output_dir = os.path.join(self.output_base_dir, f"avatars/{user_id}/{task_id}")
        os.makedirs(output_dir, exist_ok=True)
        glb_path = os.path.join(output_dir, "avatar.glb")
        write_skinned_glb(
            glb_path,
            vertices.astype(np.float32),
            normals.astype(np.float32),
            faces,
            joint_indices,
            joint_weights,
            SMPLX_JOINT_NAMES,
            SMPLX_PARENT_INDICES,
            joints.astype(np.float32),
            slot_hint="DRESS",
        )

        glb_size = os.path.getsize(glb_path)
        elapsed_ms = int((time.time() - start_time) * 1000)

        # Compute bounding box
        bbox_min = vertices.min(axis=0).tolist()
        bbox_max = vertices.max(axis=0).tolist()
        has_nan = bool(__import__("numpy").isnan(vertices).any())

        # Tracked fit accuracy: reconstruct the requested height from the mesh's
        # Y-extent and report the error, plus whether the shape betas stayed in
        # the safe range. Observable proxy for how measurement-true the body is.
        input_height_cm = float(measurements.get("heightCm", 170.0))
        mesh_height_cm = (bbox_max[1] - bbox_min[1]) * 100.0
        height_error_cm = abs(mesh_height_cm - input_height_cm)
        # Reflect whether the *estimated* shape fell inside the safe range. The
        # ``betas`` used for the forward pass are already clamped, so an in-range
        # check on them would be tautologically true; inspect the raw values.
        raw_betas = self._raw_betas(measurements, gender)
        betas_in_range = all(BETA_MIN <= b <= BETA_MAX for b in raw_betas)

        return {
            "schemaVersion": 1,
            "provider_used": "SMPLX",
            "provider_request_id": None,
            "glb_path": f"avatars/{user_id}/{task_id}/avatar.glb",
            "triangle_count": len(faces),
            "bbox": {"min": bbox_min, "max": bbox_max},
            "sanity": {"glb_size_bytes": glb_size, "has_nan_vertices": has_nan},
            "fit_accuracy": {
                "height_error_cm": round(height_error_cm, 2),
                "betas_in_range": betas_in_range,
            },
            "elapsed_ms": elapsed_ms,
            "glb_url": f"/assets/avatars/{user_id}/{task_id}/avatar.glb",
            "skin": {"has_skin": True, "joint_count": 55},
        }
