"""Blender headless script: convert FBX animation to skeleton-only pose GLB.

Usage:
    blender --background --python fbx_to_pose_glb.py -- \
        input.fbx output.glb frame_start frame_end fps retarget_mode

Arguments (after ``--``):
    input_fbx       : Path to the source FBX file.
    output_glb      : Destination path for the exported GLB.
    frame_start     : First frame to include (integer, -1 = use FBX default).
    frame_end       : Last frame to include (integer, -1 = use FBX default).
    fps             : Frames per second (integer).
    retarget_mode   : ``"mixamo"`` to rename bones via the built-in Mixamo->SMPL-X
                      mapping, or ``""`` to skip retargeting.

The script clears the default Blender scene, imports the FBX, optionally
renames bones, removes all mesh objects (keeping only the armature and its
animation), and exports a GLB with animations enabled.
"""
from __future__ import annotations

import json
import os
import sys

# ---------------------------------------------------------------------------
# Mixamo -> SMPL-X bone name mapping (22 entries)
# ---------------------------------------------------------------------------
MIXAMO_TO_SMPLX: dict[str, str] = {
    "mixamorig:Hips": "pelvis",
    "mixamorig:Spine": "spine1",
    "mixamorig:Spine1": "spine2",
    "mixamorig:Spine2": "spine3",
    "mixamorig:Neck": "neck",
    "mixamorig:Head": "head",
    "mixamorig:LeftShoulder": "left_collar",
    "mixamorig:RightShoulder": "right_collar",
    "mixamorig:LeftArm": "left_shoulder",
    "mixamorig:RightArm": "right_shoulder",
    "mixamorig:LeftForeArm": "left_elbow",
    "mixamorig:RightForeArm": "right_elbow",
    "mixamorig:LeftHand": "left_wrist",
    "mixamorig:RightHand": "right_wrist",
    "mixamorig:LeftUpLeg": "left_hip",
    "mixamorig:RightUpLeg": "right_hip",
    "mixamorig:LeftLeg": "left_knee",
    "mixamorig:RightLeg": "right_knee",
    "mixamorig:LeftFoot": "left_ankle",
    "mixamorig:RightFoot": "right_ankle",
    "mixamorig:LeftToeBase": "left_foot",
    "mixamorig:RightToeBase": "right_foot",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_args() -> tuple[str, str, int, int, int, str]:
    """Parse arguments after the ``--`` separator.

    Returns:
        (input_fbx, output_glb, frame_start, frame_end, fps, retarget_mode)

    Raises:
        SystemExit: If ``--`` separator is missing or argument count is wrong.
    """
    try:
        sep = sys.argv.index("--")
    except ValueError:
        _die("Usage: blender --background --python fbx_to_pose_glb.py -- "
             "input.fbx output.glb frame_start frame_end fps retarget_mode")

    args = sys.argv[sep + 1:]
    if len(args) != 6:
        _die(f"Expected 6 arguments after '--', got {len(args)}")

    input_fbx = args[0]
    output_glb = args[1]
    frame_start = int(args[2])
    frame_end = int(args[3])
    fps = int(args[4])
    retarget_mode = args[5]
    return input_fbx, output_glb, frame_start, frame_end, fps, retarget_mode


def _die(message: str) -> None:
    """Print error to stderr and exit."""
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Core pipeline
# ---------------------------------------------------------------------------

def _find_armature(bpy) -> object:
    """Find the first ARMATURE object in the scene.

    Raises:
        ValueError: If no armature exists.
    """
    for obj in bpy.data.objects:
        if obj.type == "ARMATURE":
            return obj
    raise ValueError("No armature found in FBX file")


def _retarget_bones(armature, mapping: dict[str, str]) -> int:
    """Rename armature bones using the provided mapping.

    Returns:
        Number of bones renamed.
    """
    renamed = 0
    for bone in armature.data.bones:
        if bone.name in mapping:
            new_name = mapping[bone.name]
            bone.name = new_name
            renamed += 1
    return renamed


def _remove_mesh_objects(bpy) -> int:
    """Delete all MESH objects from the scene, keeping only armatures.

    Returns:
        Number of mesh objects removed.
    """
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    for obj in meshes:
        bpy.data.objects.remove(obj, do_unlink=True)
    return len(meshes)


def main() -> None:
    """Import FBX, optionally retarget bones, strip meshes, export GLB."""
    input_fbx, output_glb, frame_start, frame_end, fps, retarget_mode = _parse_args()

    if not os.path.isfile(input_fbx):
        _die(f"FBX file not found: {input_fbx}")

    try:
        import bpy  # noqa: PLC0415 -- only available inside Blender
    except ImportError:
        _die("This script must be run inside Blender "
             "(blender --background --python ...)")

    # Clear default scene
    bpy.ops.wm.read_homefile(use_empty=True)

    # Import FBX
    bpy.ops.import_scene.fbx(filepath=input_fbx)

    # Find armature
    armature = _find_armature(bpy)

    # Set frame range
    scene = bpy.context.scene
    if frame_start >= 0:
        scene.frame_start = frame_start
    if frame_end >= 0:
        scene.frame_end = frame_end
    if fps > 0:
        scene.render.fps = fps

    # Optional bone retargeting
    if retarget_mode == "mixamo":
        renamed = _retarget_bones(armature, MIXAMO_TO_SMPLX)
        print(f"Retargeted {renamed} bones (Mixamo -> SMPL-X)")

    # Remove all mesh objects (keep skeleton animation only)
    removed = _remove_mesh_objects(bpy)
    print(f"Removed {removed} mesh object(s)")

    # Ensure output directory exists
    os.makedirs(os.path.dirname(os.path.abspath(output_glb)), exist_ok=True)

    # Select armature for export
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature

    # Export GLB with animations
    bpy.ops.export_scene.gltf(
        filepath=output_glb,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_skins=False,
    )

    print(f"Exported pose GLB: {output_glb}")
    actual_start = scene.frame_start
    actual_end = scene.frame_end
    print(f"Frame range: {actual_start}-{actual_end}, FPS: {scene.render.fps}")


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    main()
