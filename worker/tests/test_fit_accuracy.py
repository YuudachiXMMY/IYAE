"""Ground-truth validation harness for the fit-accuracy metric.

This is the "validated metric" deliverable for the author-flagged linear beta map:
a dependency-free ground-truth set + threshold assertions over the pure scorer and
validator, plus an optional real-model check that runs only when SMPL-X is installed
(it skips cleanly in CI/this env where the heavy deps are absent).
"""
import importlib.util

import pytest

from providers.fit_accuracy import (
    FIT_ACCURACY_MAX_HEIGHT_ERROR_CM,
    score_height_error,
    validate_fit_accuracy,
)
from providers.smplx_provider import SmplxProvider, BETA_MIN, BETA_MAX

_smplx_available = importlib.util.find_spec("smplx") is not None


# ---------------------------------------------------------------------------
# Ground-truth set: (measurements_dict, gender, expected_height_cm)
# Population-typical + edge inputs (short/tall, neutral/male/female). Inline
# dicts follow the repo convention (test_smplx_provider.py:227-235) -- there are
# no external fixture files anywhere in worker/.
# ---------------------------------------------------------------------------
GROUND_TRUTH = [
    # neutral population average
    (
        {
            "heightCm": 170.0, "weightKg": 70.0, "chestCm": 90.0, "waistCm": 75.0,
            "hipsCm": 95.0, "shoulderWidthCm": 40.0, "inseamCm": 80.0,
        },
        "neutral",
        170.0,
    ),
    # male population average
    (
        {
            "heightCm": 175.0, "weightKg": 78.0, "chestCm": 98.0, "waistCm": 83.0,
            "hipsCm": 98.0, "shoulderWidthCm": 45.0, "inseamCm": 83.0,
        },
        "male",
        175.0,
    ),
    # female population average
    (
        {
            "heightCm": 162.0, "weightKg": 62.0, "chestCm": 86.0, "waistCm": 70.0,
            "hipsCm": 97.0, "shoulderWidthCm": 36.0, "inseamCm": 76.0,
        },
        "female",
        162.0,
    ),
    # short edge
    (
        {
            "heightCm": 150.0, "weightKg": 50.0, "chestCm": 82.0, "waistCm": 68.0,
            "hipsCm": 88.0, "shoulderWidthCm": 35.0, "inseamCm": 68.0,
        },
        "female",
        150.0,
    ),
    # tall edge
    (
        {
            "heightCm": 195.0, "weightKg": 95.0, "chestCm": 108.0, "waistCm": 92.0,
            "hipsCm": 105.0, "shoulderWidthCm": 50.0, "inseamCm": 95.0,
        },
        "male",
        195.0,
    ),
]


# ---------------------------------------------------------------------------
# Pure path: measurements_to_betas over the ground-truth set
# ---------------------------------------------------------------------------


class TestGroundTruthBetas:
    def test_all_betas_within_safe_range(self):
        for measurements, gender, _ in GROUND_TRUTH:
            betas = SmplxProvider.measurements_to_betas(measurements, gender)
            assert len(betas) == 10
            for i, b in enumerate(betas):
                assert BETA_MIN <= b <= BETA_MAX, (
                    f"beta[{i}]={b} out of [{BETA_MIN},{BETA_MAX}] "
                    f"for gender={gender} measurements={measurements}"
                )

    def test_population_mean_produces_near_zero_betas(self):
        # At each gender's own population mean, betas should be ~0
        # (mirror test_default_measurements_produce_near_zero_betas).
        means = [
            (
                {
                    "heightCm": 170.0, "weightKg": 70.0, "chestCm": 90.0,
                    "waistCm": 75.0, "hipsCm": 95.0, "shoulderWidthCm": 40.0,
                    "inseamCm": 80.0,
                },
                "neutral",
            ),
            (
                {
                    "heightCm": 175.0, "weightKg": 78.0, "chestCm": 98.0,
                    "waistCm": 83.0, "hipsCm": 98.0, "shoulderWidthCm": 45.0,
                    "inseamCm": 83.0,
                },
                "male",
            ),
            (
                {
                    "heightCm": 162.0, "weightKg": 62.0, "chestCm": 86.0,
                    "waistCm": 70.0, "hipsCm": 97.0, "shoulderWidthCm": 36.0,
                    "inseamCm": 76.0,
                },
                "female",
            ),
        ]
        for measurements, gender in means:
            betas = SmplxProvider.measurements_to_betas(measurements, gender)
            for i, b in enumerate(betas):
                assert abs(b) < 0.01, (
                    f"beta[{i}]={b} expected ~0 at {gender} population mean"
                )


# ---------------------------------------------------------------------------
# Pure scorer: score_height_error
# ---------------------------------------------------------------------------


class TestScoreHeightError:
    def test_exact_match_is_zero(self):
        # bbox spans 1.70m in Y -> reconstructs 170 cm -> error 0.
        err = score_height_error([0.0, 0.0, 0.0], [0.0, 1.70, 0.0], 170.0)
        assert err == pytest.approx(0.0, abs=1e-6)

    def test_error_reflects_mismatch(self):
        # bbox spans 1.60m -> 160 cm; requested 170 -> error 10.
        err = score_height_error([0.0, 0.0, 0.0], [0.0, 1.60, 0.0], 170.0)
        assert err == pytest.approx(10.0, abs=1e-6)


# ---------------------------------------------------------------------------
# Validator: validate_fit_accuracy
# ---------------------------------------------------------------------------


class TestValidateFitAccuracy:
    def test_passes_at_zero_error(self):
        payload = {"fit_accuracy": {"height_error_cm": 0.0, "betas_in_range": True}}
        assert validate_fit_accuracy(payload) == []

    def test_passes_exactly_at_threshold(self):
        # Strict '>' -> exactly at the threshold passes.
        payload = {
            "fit_accuracy": {
                "height_error_cm": FIT_ACCURACY_MAX_HEIGHT_ERROR_CM,
                "betas_in_range": True,
            }
        }
        assert validate_fit_accuracy(payload) == []

    def test_warns_over_threshold(self):
        payload = {"fit_accuracy": {"height_error_cm": 9.9, "betas_in_range": True}}
        warnings = validate_fit_accuracy(payload)
        assert len(warnings) == 1
        assert "height_error_cm" in warnings[0]

    def test_warns_on_betas_out_of_range(self):
        # Height ok, but betas flagged out of range -> still warns.
        payload = {"fit_accuracy": {"height_error_cm": 1.0, "betas_in_range": False}}
        warnings = validate_fit_accuracy(payload)
        assert len(warnings) == 1
        assert "betas_in_range" in warnings[0]

    def test_warns_on_both(self):
        payload = {"fit_accuracy": {"height_error_cm": 12.0, "betas_in_range": False}}
        warnings = validate_fit_accuracy(payload)
        assert len(warnings) == 2

    def test_absent_block_returns_empty(self):
        # Stub payload emits no fit_accuracy -> pass (no warnings).
        assert validate_fit_accuracy({}) == []
        assert validate_fit_accuracy({"schemaVersion": 1}) == []

    def test_none_payload_returns_empty(self):
        assert validate_fit_accuracy(None) == []


# ---------------------------------------------------------------------------
# Optional real-model check (skips when SMPL-X is not installed)
# ---------------------------------------------------------------------------


@pytest.mark.skipif(not _smplx_available, reason="smplx not installed")
class TestRealModelFitAccuracy:
    def test_ground_truth_height_error_within_threshold(self, tmp_path):
        """With a real SMPL-X install, every ground-truth row reconstructs its
        height within the documented threshold."""
        provider = SmplxProvider(
            output_base_dir=str(tmp_path),
            model_path=str(tmp_path / "smplx_models"),
        )
        for measurements, gender, _ in GROUND_TRUTH:
            payload = dict(measurements)
            payload["gender"] = gender
            result = provider.generate(task_id=1, user_id=1, input_payload=payload)
            err = result["fit_accuracy"]["height_error_cm"]
            assert err <= FIT_ACCURACY_MAX_HEIGHT_ERROR_CM, (
                f"height_error_cm {err} exceeds {FIT_ACCURACY_MAX_HEIGHT_ERROR_CM} "
                f"for gender={gender}"
            )
