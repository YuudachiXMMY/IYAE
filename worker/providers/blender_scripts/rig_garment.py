"""Blender headless script for garment rigging via weight transfer.

Usage:
    blender --background --python rig_garment.py -- /path/to/job.json

The job JSON must contain:
    source_glb_url  : local filesystem path to the garment GLB
    avatar_glb_url  : local filesystem path to the SMPL-X avatar GLB (with armature)
    slot_hint       : garment slot — "TOP", "BOTTOM", or "DRESS"
    output_path     : destination path for the rigged GLB
    result_path     : destination path for the result JSON written by this script

The result JSON written to result_path contains:
    success         : bool
    output_path     : str  (only when success=True)
    triangle_count  : int  (only when success=True)
    bbox            : dict with "min"/"max" lists (only when success=True)
    joint_count     : int  (only when success=True)
    elapsed_ms      : int
    errors          : list[str]
    warnings        : list[str]
    failure_code    : str  (only when success=False)
"""
from __future__ import annotations

import json
import os
import sys
import time
import logging

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """Parse job JSON, rig garment mesh, write result JSON."""
    try:
        separator_index = sys.argv.index("--")
    except ValueError:
        _die("Usage: blender --background --python rig_garment.py -- job.json")

    job_path = sys.argv[separator_index + 1]

    with open(job_path) as f:
        job = json.load(f)

    result: dict = {"success": False, "errors": [], "warnings": []}
    start_ms = time.time() * 1000

    try:
        import bpy  # noqa: PLC0415 — must be inside Blender

        # Start from an empty scene
        bpy.ops.wm.read_homefile(use_empty=True)

        avatar_obj, armature = _import_avatar_with_armature(bpy, job["avatar_glb_url"])
        garment_obj = _import_garment(bpy, job["source_glb_url"])
        _normalize_scene_units(bpy)

        preflight_errors = _preflight_mesh(garment_obj)
        if preflight_errors:
            result["errors"] = preflight_errors
            result["failure_code"] = "TOPOLOGY_REPAIR_REQUIRED"
            _write_result(job["result_path"], result)
            return

        _transfer_weights(bpy, avatar_obj, armature, garment_obj, job.get("slot_hint", "DRESS"))
        _prune_and_normalize_weights(bpy, garment_obj)
        _export_rigged_glb(bpy, garment_obj, armature, job["output_path"])

        result["success"] = True
        result["output_path"] = job["output_path"]
        result["triangle_count"] = _count_triangles(garment_obj)
        result["bbox"] = _compute_bbox(garment_obj)
        result["joint_count"] = len(armature.data.bones)

    except Exception as exc:
        result["errors"].append(str(exc))
        result["failure_code"] = "BLENDER_EXPORT_FAILED"

    result["elapsed_ms"] = int(time.time() * 1000 - start_ms)
    _write_result(job["result_path"], result)


# ---------------------------------------------------------------------------
# Scene setup helpers
# ---------------------------------------------------------------------------

def _import_avatar_with_armature(bpy, path: str):
    """Import GLB containing SMPL-X avatar with its armature.

    Returns:
        Tuple of (mesh_object, armature_object).

    Raises:
        ValueError: If the GLB contains no armature.
    """
    bpy.ops.import_scene.gltf(filepath=path)
    armature = None
    mesh = None
    for obj in bpy.context.selected_objects:
        if obj.type == "ARMATURE":
            armature = obj
        elif obj.type == "MESH" and mesh is None:
            mesh = obj
    if armature is None:
        raise ValueError(f"Avatar GLB '{path}' does not contain an armature")
    return mesh, armature


def _import_garment(bpy, path: str):
    """Import garment GLB and return its mesh object.

    Raises:
        ValueError: If the GLB contains no mesh.
    """
    bpy.ops.import_scene.gltf(filepath=path)
    for obj in bpy.context.selected_objects:
        if obj.type == "MESH":
            return obj
    raise ValueError(f"Garment GLB '{path}' does not contain a mesh")


def _normalize_scene_units(bpy) -> None:
    """Ensure the scene uses metric units (Y-up, scale 1 m)."""
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0


# ---------------------------------------------------------------------------
# Mesh quality checks
# ---------------------------------------------------------------------------

def _preflight_mesh(garment_obj) -> list[str]:
    """Check mesh topology for rigging compatibility.

    Returns:
        List of error strings.  Empty list means the mesh is acceptable.
    """
    import bmesh  # noqa: PLC0415 — Blender-internal module

    errors: list[str] = []
    bm = bmesh.new()
    bm.from_mesh(garment_obj.data)

    non_manifold = [e for e in bm.edges if not e.is_manifold and not e.is_boundary]
    if len(non_manifold) > 100:
        errors.append(f"non_manifold_edges:{len(non_manifold)}")

    loose = [v for v in bm.verts if not v.link_edges]
    if loose:
        errors.append(f"loose_vertices:{len(loose)}")

    degenerate = [f for f in bm.faces if f.calc_area() < 1e-8]
    if len(degenerate) > 50:
        errors.append(f"degenerate_faces:{len(degenerate)}")

    bm.free()
    return errors


# ---------------------------------------------------------------------------
# Weight transfer
# ---------------------------------------------------------------------------

def _transfer_weights(bpy, avatar_mesh, armature, garment_obj, slot_hint: str) -> None:
    """Transfer bone weights from the avatar mesh to the garment.

    Steps:
    1. Parent the garment to the armature and add an Armature modifier.
    2. Use a DataTransfer modifier (vertex group weights, nearest-poly-interp).
    3. Apply the DataTransfer result.
    4. Prune vertex groups not in the slot's bone subset.
    """
    import sys as _sys  # keep reference to real sys before any bpy overrides
    import os as _os

    # Parent garment to armature
    garment_obj.parent = armature
    arm_mod = garment_obj.modifiers.new(name="Armature", type="ARMATURE")
    arm_mod.object = armature

    # Data-transfer modifier from avatar mesh
    bpy.context.view_layer.objects.active = garment_obj
    dt_mod = garment_obj.modifiers.new(name="DataTransfer", type="DATA_TRANSFER")
    dt_mod.object = avatar_mesh
    dt_mod.use_vert_data = True
    dt_mod.data_types_verts = {"VGROUP_WEIGHTS"}
    dt_mod.vert_mapping = "POLYINTERP_NEAREST"
    bpy.ops.object.datalayout_transfer(modifier=dt_mod.name)
    bpy.ops.object.modifier_apply(modifier=dt_mod.name)

    # Prune bones not in the slot's allowed subset
    if slot_hint and slot_hint != "DRESS":
        # Import canonical_skeleton from same directory as this script
        script_dir = _os.path.dirname(_os.path.abspath(__file__))
        if script_dir not in _sys.path:
            _sys.path.insert(0, script_dir)
        from canonical_skeleton import SLOT_BONE_SUBSETS  # noqa: PLC0415
        allowed = set(SLOT_BONE_SUBSETS.get(slot_hint) or [])
        if allowed:
            for vg in list(garment_obj.vertex_groups):
                if vg.name not in allowed:
                    garment_obj.vertex_groups.remove(vg)


def _prune_and_normalize_weights(bpy, garment_obj) -> None:
    """Remove near-zero weights and normalize remaining groups."""
    bpy.context.view_layer.objects.active = garment_obj
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    bpy.ops.object.vertex_group_clean(group_select_mode="ALL", limit=0.01)
    bpy.ops.object.vertex_group_normalize_all()
    bpy.ops.object.mode_set(mode="OBJECT")


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------

def _export_rigged_glb(bpy, garment_obj, armature, output_path: str) -> None:
    """Export the rigged garment (mesh + armature) as a GLB file."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    garment_obj.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        use_selection=True,
        export_skins=True,
        export_animations=False,
    )


# ---------------------------------------------------------------------------
# Mesh metrics
# ---------------------------------------------------------------------------

def _count_triangles(garment_obj) -> int:
    """Return the triangle count for the garment mesh."""
    import bmesh  # noqa: PLC0415

    bm = bmesh.new()
    bm.from_mesh(garment_obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    count = len(bm.faces)
    bm.free()
    return count


def _compute_bbox(garment_obj) -> dict | None:
    """Compute world-space axis-aligned bounding box of the garment."""
    coords = [garment_obj.matrix_world @ v.co for v in garment_obj.data.vertices]
    if not coords:
        return None
    xs = [c.x for c in coords]
    ys = [c.y for c in coords]
    zs = [c.z for c in coords]
    return {
        "min": [min(xs), min(ys), min(zs)],
        "max": [max(xs), max(ys), max(zs)],
    }


# ---------------------------------------------------------------------------
# I/O helpers
# ---------------------------------------------------------------------------

def _write_result(path: str, result: dict) -> None:
    """Write result dict as JSON to path, creating parent directories."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(result, f, indent=2)


def _die(message: str) -> None:
    """Print error and exit with non-zero status."""
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    main()
