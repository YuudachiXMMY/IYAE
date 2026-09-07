"""Fit-accuracy scoring + validation for SMPL-X avatar generation.

Single source of truth for the fit-accuracy threshold and a *dependency-free*
validator over the ``fit_accuracy`` block emitted by ``SmplxProvider.generate``.

This module deliberately imports nothing beyond the standard library: it must be
CI-testable with zero heavy deps (no torch/smplx/trimesh/numpy). ``score_height_error``
mirrors the computation in ``smplx_provider.py`` so the provider and the validation
harness call the same code.
"""

# Maximum acceptable height-reconstruction error (cm) for the fit-accuracy metric.
#
# SMPL-X neutral-shape height reconstruction from the linear beta map is typically
# within a few cm at population-typical inputs; 5 cm is a generous, non-flaky ceiling
# chosen as a provisional gate. Tighten this once a trained betas regressor
# (Measurements2SMPL) replaces the hand-authored linear map. The check is a
# non-fatal WARN in the worker avatar path, never a hard failure.
FIT_ACCURACY_MAX_HEIGHT_ERROR_CM = 5.0


def score_height_error(mesh_bbox_min, mesh_bbox_max, input_height_cm) -> float:
    """Return the absolute height-reconstruction error in cm.

    Reconstructs the requested height from the mesh's Y-extent and reports the
    absolute error. Mirrors ``smplx_provider.py`` so both the provider and the
    validation harness share one implementation.

    Args:
        mesh_bbox_min: Mesh bounding-box min corner (index 1 is the Y axis).
        mesh_bbox_max: Mesh bounding-box max corner (index 1 is the Y axis).
        input_height_cm: The requested body height in cm.
    """
    mesh_height_cm = (mesh_bbox_max[1] - mesh_bbox_min[1]) * 100.0
    return abs(mesh_height_cm - float(input_height_cm))


def validate_fit_accuracy(payload: dict) -> list[str]:
    """Validate the ``fit_accuracy`` block of an avatar output payload.

    Returns a list of human-readable warning strings; an empty list means the
    metric passed (mirrors the ``validator.py`` return-``[]``-on-pass convention).

    Returns ``[]`` when ``fit_accuracy`` is absent -- the dev stub
    (``SmplxStubProvider``) emits no such block, so stub avatars log nothing.

    Warns (non-fatal) when:
      - ``height_error_cm`` strictly exceeds ``FIT_ACCURACY_MAX_HEIGHT_ERROR_CM``
        (exactly at the threshold passes).
      - ``betas_in_range`` is ``False``.
    """
    warnings: list[str] = []

    fit_accuracy = (payload or {}).get("fit_accuracy")
    if not fit_accuracy:
        return warnings

    height_error_cm = fit_accuracy.get("height_error_cm")
    if (
        height_error_cm is not None
        and height_error_cm > FIT_ACCURACY_MAX_HEIGHT_ERROR_CM
    ):
        warnings.append(
            f"height_error_cm {height_error_cm} exceeds threshold of "
            f"{FIT_ACCURACY_MAX_HEIGHT_ERROR_CM}"
        )

    if fit_accuracy.get("betas_in_range") is False:
        warnings.append("betas_in_range is False (estimated shape betas out of safe range)")

    return warnings
