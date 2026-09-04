"""Utilities for reading and writing the poses-manifest.json file.

The manifest at ``web/lib/poses-manifest.json`` is the single source of
truth for pose definitions consumed by both the TypeScript frontend and
the Python generation/import scripts.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# Default path: {project_root}/web/lib/poses-manifest.json
DEFAULT_MANIFEST_PATH: Path = (
    Path(__file__).resolve().parents[2] / "web" / "lib" / "poses-manifest.json"
)

DEFAULT_CATEGORIES: list[dict[str, str]] = [
    {"id": "stationary", "label": "Stationary", "labelZh": "静态"},
    {"id": "movement", "label": "Movement", "labelZh": "动态"},
    {"id": "lifestyle", "label": "Lifestyle", "labelZh": "生活"},
]


def read_manifest(path: Path = DEFAULT_MANIFEST_PATH) -> dict[str, Any]:
    """Read the manifest JSON file.

    Returns an empty skeleton ``{"version": 1, "poses": [], "categories": [...]}``
    if the file does not exist.
    """
    if not path.exists():
        return {
            "version": 1,
            "poses": [],
            "categories": list(DEFAULT_CATEGORIES),
        }
    text = path.read_text(encoding="utf-8")
    return json.loads(text)


def write_manifest(path: Path, manifest: dict[str, Any]) -> None:
    """Write the manifest dict to *path* as pretty-printed JSON.

    Uses indent=2, ensure_ascii=False, and appends a trailing newline
    to match standard JSON formatting conventions.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(manifest, indent=2, ensure_ascii=False)
    path.write_text(text + "\n", encoding="utf-8")


def upsert_pose(manifest: dict[str, Any], entry: dict[str, Any]) -> dict[str, Any]:
    """Insert or update a pose entry in *manifest* by ``id``.

    If the entry sets ``isDefault=True``, all other poses have their
    ``isDefault`` cleared to ``False`` to enforce the single-default
    invariant.

    Returns a **new** manifest dict (does not mutate the original).
    """
    pose_id = entry["id"]
    poses = list(manifest.get("poses", []))

    # If new entry is default, clear others
    if entry.get("isDefault"):
        poses = [{**p, "isDefault": False} for p in poses]

    # Find existing index
    idx = next((i for i, p in enumerate(poses) if p["id"] == pose_id), None)
    if idx is not None:
        poses[idx] = entry
    else:
        poses.append(entry)

    return {**manifest, "poses": poses}


def remove_pose(manifest: dict[str, Any], pose_id: str) -> dict[str, Any]:
    """Remove a pose entry from *manifest* by ``id``.

    Returns a **new** manifest dict (does not mutate the original).
    """
    poses = [p for p in manifest.get("poses", []) if p["id"] != pose_id]
    return {**manifest, "poses": poses}


def compute_duration(frames: int, fps: float) -> float | None:
    """Compute animation duration in seconds.

    Returns ``None`` for single-frame (or fewer) poses.
    """
    if frames <= 1:
        return None
    return round((frames - 1) / fps, 2)
