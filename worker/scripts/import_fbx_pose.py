"""CLI wrapper: convert an FBX animation file to a skeleton-only pose GLB.

Invokes Blender headless via subprocess to run the companion Blender script
``providers/blender_scripts/fbx_to_pose_glb.py``.  The resulting GLB contains
only an armature with animation keyframes (no meshes), suitable for driving
SMPL-X pose playback in the web viewer.

Usage:
    python import_fbx_pose.py --input walk.fbx --name "walk-cycle" \
        [--frame-range 0-60] [--fps 30] [--loop] \
        [--blender-path blender] [--no-retarget] \
        [--output-dir ../../web/public/models/poses]
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
_WORKER_ROOT = _SCRIPT_DIR.parent
_BLENDER_SCRIPT = _WORKER_ROOT / "providers" / "blender_scripts" / "fbx_to_pose_glb.py"
_DEFAULT_OUTPUT_DIR = _SCRIPT_DIR.parents[1] / "web" / "public" / "models" / "poses"
_BLENDER_TIMEOUT = 300  # 5 minutes

sys.path.insert(0, str(_SCRIPT_DIR))
import pose_manifest


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Build and parse CLI arguments."""
    parser = argparse.ArgumentParser(
        description="Convert an FBX animation to a skeleton-only pose GLB via Blender.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python import_fbx_pose.py --input walk.fbx --name walk-cycle\n"
            "  python import_fbx_pose.py --input dance.fbx --name dance --fps 60 --frame-range 0-120\n"
            "  python import_fbx_pose.py --input idle.fbx --name idle --no-retarget --loop\n"
        ),
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="Path to the source FBX file.",
    )
    parser.add_argument(
        "--name", "-n",
        required=True,
        help="Pose name used for the output filename (e.g. 'walk-cycle' -> walk-cycle.glb).",
    )
    parser.add_argument(
        "--frame-range",
        default=None,
        help="Frame range as 'start-end' (e.g. '0-60'). Defaults to the full FBX range.",
    )
    parser.add_argument(
        "--fps",
        type=int,
        default=30,
        help="Frames per second for the animation (default: 30).",
    )
    parser.add_argument(
        "--loop",
        action="store_true",
        help="Mark this pose as looping in the generated pose-config snippet.",
    )
    parser.add_argument(
        "--blender-path",
        default=None,
        help="Path to the Blender executable. Falls back to BLENDER_PATH env var, then 'blender'.",
    )
    parser.add_argument(
        "--no-retarget",
        action="store_true",
        help="Skip Mixamo->SMPL-X bone renaming (use when bones already match SMPL-X names).",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help=f"Output directory for the GLB file (default: {_DEFAULT_OUTPUT_DIR}).",
    )
    parser.add_argument(
        "--label",
        default=None,
        help="Display label for the pose (default: auto-generated from --name).",
    )
    parser.add_argument(
        "--label-zh",
        default=None,
        help="Chinese display label for the pose.",
    )
    parser.add_argument(
        "--category",
        default="movement",
        choices=["stationary", "movement", "lifestyle"],
        help="Pose category (default: movement).",
    )
    return parser.parse_args(argv)


def _resolve_blender_path(cli_arg: str | None) -> str:
    """Determine the Blender executable path from CLI, env, or default."""
    if cli_arg:
        return cli_arg
    return os.environ.get("BLENDER_PATH", "blender")


def _parse_frame_range(frame_range: str | None) -> tuple[int, int]:
    """Parse a 'start-end' string into (start, end) integers.

    Returns (-1, -1) when no range is specified (let Blender use FBX defaults).

    Raises:
        ValueError: If the format is invalid.
    """
    if frame_range is None:
        return (-1, -1)
    parts = frame_range.split("-")
    if len(parts) != 2:
        raise ValueError(
            f"Invalid frame range '{frame_range}'. Expected format: 'start-end' (e.g. '0-60')."
        )
    return (int(parts[0]), int(parts[1]))


def run(argv: list[str] | None = None) -> int:
    """Main entry point. Returns 0 on success, 1 on error."""
    args = _parse_args(argv)

    if not re.match(r'^[a-z0-9][a-z0-9-]*$', args.name):
        print(
            "ERROR: --name must be lowercase kebab-case "
            "(letters a-z, digits 0-9, hyphens only, must start with letter or digit)",
            file=sys.stderr,
        )
        return 1

    # Validate input FBX
    input_fbx = Path(args.input).resolve()
    if not input_fbx.is_file():
        print(f"ERROR: FBX file not found: {input_fbx}", file=sys.stderr)
        return 1

    # Parse frame range
    try:
        frame_start, frame_end = _parse_frame_range(args.frame_range)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    # Resolve paths
    blender_path = _resolve_blender_path(args.blender_path)
    output_dir = Path(args.output_dir).resolve() if args.output_dir else _DEFAULT_OUTPUT_DIR
    output_filename = f"{args.name}.glb"
    final_output = output_dir / output_filename

    # Retarget mode
    retarget_mode = "" if args.no_retarget else "mixamo"

    # Use a temp directory for the intermediate GLB
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_glb = Path(tmp_dir) / output_filename

        # Build Blender subprocess command
        cmd = [
            blender_path,
            "--background",
            "--python", str(_BLENDER_SCRIPT),
            "--",
            str(input_fbx),
            str(tmp_glb),
            str(frame_start),
            str(frame_end),
            str(args.fps),
            retarget_mode,
        ]

        print(f"Running Blender: {' '.join(cmd)}")
        print()

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=_BLENDER_TIMEOUT,
            )
        except FileNotFoundError:
            print(
                f"ERROR: Blender not found at '{blender_path}'. "
                "Install Blender or set --blender-path / BLENDER_PATH.",
                file=sys.stderr,
            )
            return 1
        except subprocess.TimeoutExpired:
            print(
                f"ERROR: Conversion timed out after {_BLENDER_TIMEOUT} seconds.",
                file=sys.stderr,
            )
            return 1

        # Print Blender output
        if result.stdout:
            for line in result.stdout.strip().splitlines():
                print(f"  [blender] {line}")

        if result.returncode != 0:
            print(f"\nERROR: Blender exited with code {result.returncode}.", file=sys.stderr)
            if result.stderr:
                print("Blender stderr:", file=sys.stderr)
                print(result.stderr[-2000:], file=sys.stderr)
            return 1

        # Verify output GLB was created
        if not tmp_glb.is_file():
            print("ERROR: Blender did not produce the output GLB file.", file=sys.stderr)
            if result.stderr:
                print("Blender stderr:", file=sys.stderr)
                print(result.stderr[-2000:], file=sys.stderr)
            return 1

        glb_size = tmp_glb.stat().st_size
        if glb_size == 0:
            print("ERROR: Output GLB file is empty.", file=sys.stderr)
            return 1

        # Copy to final output directory
        output_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(tmp_glb), str(final_output))

    print(f"\nSuccess: {final_output} ({glb_size:,} bytes)")
    print()

    # Update poses manifest
    label = args.label if args.label else args.name.replace("-", " ").title()
    label_zh = args.label_zh if args.label_zh else label
    manifest = pose_manifest.read_manifest()
    entry = {
        "id": args.name,
        "filename": output_filename,
        "label": label,
        "labelZh": label_zh,
        "category": args.category,
        "isDefault": False,
        "duration": None,  # FBX poses don't have frame count at this point
        "loop": args.loop,
    }
    manifest = pose_manifest.upsert_pose(manifest, entry)
    pose_manifest.write_manifest(pose_manifest.DEFAULT_MANIFEST_PATH, manifest)
    print(f"Manifest updated: {pose_manifest.DEFAULT_MANIFEST_PATH}")

    return 0


if __name__ == "__main__":
    sys.exit(run())
