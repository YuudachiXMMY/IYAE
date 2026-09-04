"""CLI tool to import SMPL-X body_pose parameters and generate pose GLB files.

Converts a JSON file containing SMPL-X body_pose vectors (63 floats per frame,
21 body joints x 3 axis-angle) into a GLB file with skeleton animation, ready
for use in the Clossette virtual try-on viewer.

Usage:
    # Single-frame pose
    python import_smplx_pose.py --input pose.json --name "my-pose"

    # Multi-frame animation with looping
    python import_smplx_pose.py --input walk.json --name "custom-walk" --fps 24 --loop

    # Custom output directory
    python import_smplx_pose.py --input pose.json --name "my-pose" --output-dir ./out

Input JSON format:
    Single frame:  {"body_pose": [0.0, 0.0, 0.5236, ..., 0.0]}        (63 floats)
    Multi-frame:   {"body_pose": [[...63...], [...63...], ...], "fps": 30}
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Resolve worker package root so we can import sibling modules
# ---------------------------------------------------------------------------
_SCRIPT_DIR = Path(__file__).resolve().parent
_WORKER_ROOT = _SCRIPT_DIR.parent
sys.path.insert(0, str(_WORKER_ROOT))
sys.path.insert(0, str(_SCRIPT_DIR))

from generate_pose_glbs import PoseDef, _build_pose_glb  # noqa: E402
import pose_manifest  # noqa: E402

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_SMPLX_BODY_JOINTS = 21
_AXIS_ANGLE_DIM = 3
_BODY_POSE_DIM = _SMPLX_BODY_JOINTS * _AXIS_ANGLE_DIM  # 63

_DEFAULT_OUTPUT_DIR = (
    Path(__file__).resolve().parents[2] / "web" / "public" / "models" / "poses"
)
_DEFAULT_FPS = 30.0


# ---------------------------------------------------------------------------
# Conversion helpers
# ---------------------------------------------------------------------------


def _parse_input_json(file_path: Path) -> dict[str, Any]:
    """Read and parse a JSON file, raising clear errors on failure."""
    if not file_path.exists():
        raise FileNotFoundError(f"Input file not found: {file_path}")

    text = file_path.read_text(encoding="utf-8")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {file_path}: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError(
            f"Expected a JSON object at top level, got {type(data).__name__}"
        )
    if "body_pose" not in data:
        raise ValueError('Input JSON must contain a "body_pose" field')

    return data


def _validate_body_pose_single(body_pose: list[float]) -> None:
    """Validate that a single-frame body_pose has exactly 63 floats."""
    if len(body_pose) != _BODY_POSE_DIM:
        raise ValueError(
            f"body_pose must have exactly {_BODY_POSE_DIM} values "
            f"(21 body joints x 3 axis-angle), got {len(body_pose)}"
        )


def _body_pose_to_joints(
    body_pose: list[float],
) -> dict[int, list[tuple[float, float, float]]]:
    """Convert a 63-dim body_pose vector to a joints dict for PoseDef.

    SMPL-X body_pose encodes joints 1-21 (skipping pelvis at index 0).
    Each group of 3 floats is one axis-angle rotation.
    """
    joints: dict[int, list[tuple[float, float, float]]] = {}
    for i in range(_SMPLX_BODY_JOINTS):
        offset = i * _AXIS_ANGLE_DIM
        ax = float(body_pose[offset])
        ay = float(body_pose[offset + 1])
        az = float(body_pose[offset + 2])
        # Skip identity rotations (all zeros) to keep GLB compact
        if abs(ax) > 1e-8 or abs(ay) > 1e-8 or abs(az) > 1e-8:
            # Joint index is i+1 because body_pose skips pelvis (index 0)
            joints[i + 1] = [(ax, ay, az)]
    return joints


def _is_multi_frame(body_pose: Any) -> bool:
    """Determine whether body_pose is a list of frames (list of lists)."""
    if not isinstance(body_pose, list) or len(body_pose) == 0:
        return False
    return isinstance(body_pose[0], list)


def _build_pose_def_from_json(
    data: dict[str, Any],
    name: str,
    fps_override: float | None,
    loop: bool,
) -> PoseDef:
    """Build a PoseDef from parsed JSON data."""
    body_pose = data["body_pose"]
    fps = fps_override if fps_override is not None else data.get("fps", _DEFAULT_FPS)

    if _is_multi_frame(body_pose):
        # Multi-frame animation
        frames: list[dict[int, list[tuple[float, float, float]]]] = []
        for frame_idx, frame_data in enumerate(body_pose):
            if not isinstance(frame_data, list):
                raise ValueError(
                    f"Frame {frame_idx}: expected a list of floats, "
                    f"got {type(frame_data).__name__}"
                )
            if len(frame_data) != _BODY_POSE_DIM:
                raise ValueError(
                    f"Frame {frame_idx}: body_pose must have exactly "
                    f"{_BODY_POSE_DIM} values (21 body joints x 3 axis-angle), "
                    f"got {len(frame_data)}"
                )
            frames.append(_body_pose_to_joints(frame_data))

        return PoseDef(
            name=name,
            filename=f"{name}.glb",
            joints={},  # not used for multi-frame
            frames=frames,
            fps=float(fps),
        )
    else:
        # Single-frame pose
        if not isinstance(body_pose, list):
            raise ValueError(
                f"body_pose must be a list of floats, got {type(body_pose).__name__}"
            )
        _validate_body_pose_single(body_pose)
        joints = _body_pose_to_joints(body_pose)

        return PoseDef(
            name=name,
            filename=f"{name}.glb",
            joints=joints,
        )


# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------


def _name_to_label(name: str) -> str:
    """Convert a kebab-case name to a Title Case label.

    Example: "custom-walk" -> "Custom Walk"
    """
    return " ".join(word.capitalize() for word in name.split("-"))


def _compute_duration(pose: PoseDef) -> float | None:
    """Compute the animation duration in seconds, or None for single-frame."""
    if pose.frames is None:
        return None
    num_frames = len(pose.frames)
    if num_frames <= 1:
        return None
    return (num_frames - 1) / pose.fps


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Import SMPL-X body_pose parameters from JSON and generate a pose GLB file."
        ),
        epilog=(
            "Input JSON format:\n"
            '  Single frame:  {"body_pose": [63 floats]}\n'
            '  Multi-frame:   {"body_pose": [[63 floats], ...], "fps": 30}\n'
            "\n"
            "SMPL-X body_pose: 63 values = 21 body joints x 3 axis-angle (radians).\n"
            "Joints are indexed 1-21 (pelvis/index 0 is skipped)."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--input",
        required=True,
        type=Path,
        help="Path to input JSON file containing body_pose data",
    )
    parser.add_argument(
        "--name",
        required=True,
        help='Pose name in kebab-case (e.g. "custom-walk")',
    )
    parser.add_argument(
        "--fps",
        type=float,
        default=None,
        help=f"Frames per second for multi-frame animation (default: {_DEFAULT_FPS})",
    )
    parser.add_argument(
        "--loop",
        action="store_true",
        help="Mark the pose as looping in the generated config snippet",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help=f"Output directory for GLB file (default: {_DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--label",
        default=None,
        help="Display label for the pose (default: auto-generated from --name)",
    )
    parser.add_argument(
        "--label-zh",
        default=None,
        help="Chinese display label for the pose",
    )
    parser.add_argument(
        "--category",
        default="stationary",
        choices=["stationary", "movement", "lifestyle"],
        help='Pose category (default: "stationary")',
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    """Entry point for the CLI tool. Returns 0 on success, 1 on error."""
    parser = _build_arg_parser()
    args = parser.parse_args(argv)

    if not re.match(r'^[a-z0-9][a-z0-9-]*$', args.name):
        print(
            "ERROR: --name must be lowercase kebab-case "
            "(letters a-z, digits 0-9, hyphens only, must start with letter or digit)",
            file=sys.stderr,
        )
        return 1

    output_dir: Path = args.output_dir if args.output_dir is not None else _DEFAULT_OUTPUT_DIR

    # Parse and validate input
    try:
        data = _parse_input_json(args.input)
        pose_def = _build_pose_def_from_json(data, args.name, args.fps, args.loop)
    except (FileNotFoundError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    # Build GLB
    try:
        glb_bytes = _build_pose_glb(pose_def)
    except (ValueError, RuntimeError) as exc:
        print(f"Error building GLB: {exc}", file=sys.stderr)
        return 1

    # Write output
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / f"{args.name}.glb"
    out_path.write_bytes(glb_bytes)
    print(f"Generated: {out_path} ({len(glb_bytes):,} bytes)")

    if pose_def.frames is not None:
        num_frames = len(pose_def.frames)
        duration = _compute_duration(pose_def)
        print(f"  Frames: {num_frames}, FPS: {pose_def.fps}, Duration: {duration:.2f}s")

    # Update poses manifest
    label = args.label if args.label else _name_to_label(args.name)
    label_zh = args.label_zh if args.label_zh else label
    duration = _compute_duration(pose_def)
    manifest = pose_manifest.read_manifest()
    entry = {
        "id": args.name,
        "filename": f"{args.name}.glb",
        "label": label,
        "labelZh": label_zh,
        "category": args.category,
        "isDefault": False,
        "duration": round(duration, 2) if duration is not None else None,
        "loop": args.loop,
    }
    manifest = pose_manifest.upsert_pose(manifest, entry)
    pose_manifest.write_manifest(pose_manifest.DEFAULT_MANIFEST_PATH, manifest)
    print(f"Manifest updated: {pose_manifest.DEFAULT_MANIFEST_PATH}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
