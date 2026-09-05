"""CLI script to generate pose GLB files for SMPL-X skeleton animation.

Generates GLB files, each containing the full 55-joint SMPL-X skeleton
hierarchy plus an AnimationClip for each predefined pose. Supports both
single-frame static poses and multi-frame animated sequences.

Usage:
    python worker/scripts/generate_pose_glbs.py

Output:
    web/public/models/poses/a-pose.glb
    web/public/models/poses/standing-relaxed.glb
    web/public/models/poses/walking.glb
    web/public/models/poses/sitting.glb
    web/public/models/poses/contrapposto.glb
    web/public/models/poses/breathing-idle.glb
"""

from __future__ import annotations

import math
import os
import struct
import sys
from pathlib import Path
from typing import NamedTuple

import pygltflib

# ---------------------------------------------------------------------------
# Resolve worker package root so we can import provider modules
# ---------------------------------------------------------------------------
_SCRIPT_DIR = Path(__file__).resolve().parent
_WORKER_ROOT = _SCRIPT_DIR.parent
sys.path.insert(0, str(_WORKER_ROOT))

from providers.canonical_skeleton import SMPLX_JOINT_NAMES, SMPLX_PARENT_INDICES  # noqa: E402

import pose_manifest  # noqa: E402

# ---------------------------------------------------------------------------
# Output directory
# ---------------------------------------------------------------------------
_OUTPUT_DIR = Path(__file__).resolve().parents[2] / "web" / "public" / "models" / "poses"

# ---------------------------------------------------------------------------
# Quaternion helpers
# ---------------------------------------------------------------------------


def axis_angle_to_quaternion(
    ax: float, ay: float, az: float
) -> tuple[float, float, float, float]:
    """Convert axis-angle (radians) to quaternion (x, y, z, w) in glTF convention."""
    angle = math.sqrt(ax * ax + ay * ay + az * az)
    if angle < 1e-8:
        return (0.0, 0.0, 0.0, 1.0)
    half = angle / 2.0
    s = math.sin(half) / angle
    return (ax * s, ay * s, az * s, math.cos(half))


def compose_quaternions(
    q1: tuple[float, float, float, float],
    q2: tuple[float, float, float, float],
) -> tuple[float, float, float, float]:
    """Multiply two quaternions (q1 * q2) in xyzw convention."""
    x1, y1, z1, w1 = q1
    x2, y2, z2, w2 = q2
    return (
        w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
        w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
        w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
        w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
    )


def invert_quaternion(
    q: tuple[float, float, float, float],
) -> tuple[float, float, float, float]:
    """Invert a unit quaternion (conjugate)."""
    x, y, z, w = q
    return (-x, -y, -z, w)


# ---------------------------------------------------------------------------
# Pose definitions
# Each pose is a dict mapping joint_index -> list of axis-angle tuples.
# Multiple axis-angle tuples for a joint are composed in order.
# ---------------------------------------------------------------------------


class PoseDef(NamedTuple):
    name: str
    filename: str
    # joint_index -> list of (ax, ay, az) axis-angle tuples to compose
    joints: dict[int, list[tuple[float, float, float]]]
    # Multi-frame animation sequence (each frame is a joints dict).
    # When not None, generates a multi-keyframe AnimationClip instead
    # of a single-frame clip.  ``joints`` is ignored when ``frames``
    # is provided.
    frames: list[dict[int, list[tuple[float, float, float]]]] | None = None
    fps: float = 30.0
    # UI metadata (used for manifest generation)
    label: str = ""
    label_zh: str = ""
    category: str = "stationary"
    is_default: bool = False
    loop: bool = False


POSES: list[PoseDef] = [
    PoseDef(
        name="a-pose",
        filename="a-pose.glb",
        joints={
            16: [(0.0, 0.0, 0.5236)],   # left_shoulder: Z +30deg
            17: [(0.0, 0.0, -0.5236)],  # right_shoulder: Z -30deg
        },
        label="A-Pose",
        label_zh="A姿势",
        category="stationary",
        is_default=True,
    ),
    PoseDef(
        name="standing-relaxed",
        filename="standing-relaxed.glb",
        joints={
            16: [(0.0, 0.0, 0.7)],    # left_shoulder: Z +0.7 rad
            17: [(0.0, 0.0, -0.7)],   # right_shoulder: Z -0.7 rad
            18: [(0.0, 0.3, 0.0)],    # left_elbow: Y +0.3 rad
            19: [(0.0, -0.3, 0.0)],   # right_elbow: Y -0.3 rad
        },
        label="Relaxed",
        label_zh="放松站姿",
        category="stationary",
    ),
    PoseDef(
        name="walking",
        filename="walking.glb",
        joints={
            1:  [(-0.4, 0.0, 0.0)],           # left_hip: X -0.4 rad
            2:  [(0.3, 0.0, 0.0)],            # right_hip: X +0.3 rad
            4:  [(0.3, 0.0, 0.0)],            # left_knee: X +0.3 rad
            5:  [(0.1, 0.0, 0.0)],            # right_knee: X +0.1 rad
            16: [(0.3, 0.0, 0.5)],            # left_shoulder: Z +0.5, X +0.3 rad
            17: [(-0.3, 0.0, -0.5)],          # right_shoulder: Z -0.5, X -0.3 rad
        },
        label="Walking",
        label_zh="行走",
        category="movement",
    ),
    PoseDef(
        name="sitting",
        filename="sitting.glb",
        joints={
            1:  [(-1.5708, 0.0, 0.0)],   # left_hip: X -90deg
            2:  [(-1.5708, 0.0, 0.0)],   # right_hip: X -90deg
            4:  [(1.5708, 0.0, 0.0)],    # left_knee: X +90deg
            5:  [(1.5708, 0.0, 0.0)],    # right_knee: X +90deg
            16: [(0.0, 0.0, 0.5236)],    # left_shoulder: Z +30deg
            17: [(0.0, 0.0, -0.5236)],   # right_shoulder: Z -30deg
        },
        label="Sitting",
        label_zh="坐姿",
        category="lifestyle",
    ),
    PoseDef(
        name="contrapposto",
        filename="contrapposto.glb",
        joints={
            0:  [(0.0, 0.0, 0.05)],     # pelvis: Z +0.05 rad slight tilt
            3:  [(0.0, 0.0, -0.03)],    # spine1: Z -0.03 rad counter-rotate
            1:  [(-0.1, 0.0, 0.05)],    # left_hip: X -0.1, Z +0.05 rad
            2:  [(0.05, 0.0, 0.0)],     # right_hip: X +0.05 rad
            4:  [(0.15, 0.0, 0.0)],     # left_knee: X +0.15 rad slight bend
            16: [(0.0, 0.0, 0.6)],      # left_shoulder: Z +0.6 rad
            17: [(0.0, 0.0, -0.4)],     # right_shoulder: Z -0.4 rad
            12: [(0.0, 0.1, 0.0)],      # neck: Y +0.1 rad slight turn
        },
        label="Contrapposto",
        label_zh="对立式",
        category="stationary",
    ),
    PoseDef(
        name="breathing-idle",
        filename="breathing-idle.glb",
        joints={},  # not used for multi-frame poses
        frames=[
            # Keyframe 0: natural stance (slight forward head tilt)
            {3: [(0.02, 0.0, 0.0)], 16: [(0.0, 0.0, 0.5)], 17: [(0.0, 0.0, -0.5)]},
            # Keyframe 1: inhale (spine extends slightly)
            {3: [(-0.02, 0.0, 0.0)], 6: [(-0.02, 0.0, 0.0)], 16: [(0.0, 0.0, 0.5)], 17: [(0.0, 0.0, -0.5)]},
            # Keyframe 2: back to natural stance
            {3: [(0.02, 0.0, 0.0)], 16: [(0.0, 0.0, 0.5)], 17: [(0.0, 0.0, -0.5)]},
        ],
        fps=15.0,
        label="Breathing Idle",
        label_zh="呼吸待机",
        category="stationary",
        loop=True,
    ),
]

# ---------------------------------------------------------------------------
# GLB builder
# ---------------------------------------------------------------------------

_IDENTITY_QUAT = [0.0, 0.0, 0.0, 1.0]


def _compute_joint_quaternions(
    pose: PoseDef,
) -> dict[int, tuple[float, float, float, float]]:
    """Compute final xyzw quaternion for each non-identity joint in the pose."""
    return _compute_quaternions_from_joints(pose.joints)


def _compute_quaternions_from_joints(
    joints: dict[int, list[tuple[float, float, float]]],
) -> dict[int, tuple[float, float, float, float]]:
    """Compute xyzw quaternion for each joint from axis-angle rotations."""
    result: dict[int, tuple[float, float, float, float]] = {}
    for joint_idx, aa_list in joints.items():
        q = (0.0, 0.0, 0.0, 1.0)  # identity
        for ax, ay, az in aa_list:
            q_delta = axis_angle_to_quaternion(ax, ay, az)
            q = compose_quaternions(q, q_delta)
        result[joint_idx] = q
    return result


# ---------------------------------------------------------------------------
# A-pose relative rotation helpers
#
# The avatar mesh is generated in A-pose with identity bone rotations.
# Pose animations must therefore encode rotations RELATIVE to A-pose,
# not absolute from T-pose.  Otherwise bones get double-rotated.
# ---------------------------------------------------------------------------

_IDENTITY_QUAT_TUPLE = (0.0, 0.0, 0.0, 1.0)

# A-pose only affects shoulders (30° outward Z rotation)
_A_POSE_QUATS: dict[int, tuple[float, float, float, float]] = _compute_quaternions_from_joints({
    16: [(0.0, 0.0, 0.5236)],   # left_shoulder
    17: [(0.0, 0.0, -0.5236)],  # right_shoulder
})

# Number of SMPL-X body joints (indices 0-21, excludes hands/face)
_NUM_BODY_JOINTS_FULL = 22


def _to_apose_relative_full(
    abs_quats: dict[int, tuple[float, float, float, float]],
) -> dict[int, tuple[float, float, float, float]]:
    """Convert absolute quaternions to A-pose-relative for ALL 22 body joints.

    Every body joint gets an explicit track so that switching between any two
    poses cleanly resets all bones (no residual rotations from previous poses).
    """
    result: dict[int, tuple[float, float, float, float]] = {}
    for ji in range(_NUM_BODY_JOINTS_FULL):
        q_abs = abs_quats.get(ji, _IDENTITY_QUAT_TUPLE)
        q_apose = _A_POSE_QUATS.get(ji, _IDENTITY_QUAT_TUPLE)
        q_apose_inv = invert_quaternion(q_apose)
        result[ji] = compose_quaternions(q_apose_inv, q_abs)
    return result


def _pack_floats(values: list[float]) -> bytes:
    return struct.pack(f"{len(values)}f", *values)


def _build_pose_glb(pose: PoseDef) -> bytes:
    """Build a GLB containing 55 SMPL-X nodes and an animation clip.

    Supports both single-frame static poses (``pose.frames is None``)
    and multi-frame animated sequences (``pose.frames`` is a list of
    per-frame joint dicts).
    """

    # Determine whether this is a multi-frame or single-frame pose.
    if pose.frames is not None:
        return _build_multiframe_pose_glb(pose)

    return _build_singleframe_pose_glb(pose)


def _build_singleframe_pose_glb(pose: PoseDef) -> bytes:
    """Build a GLB with a single-frame animation (original behaviour)."""
    if pose.is_default:
        # Rest pose: identity rotation for all body joints.
        # The avatar mesh is already in A-pose, so bones at identity = correct.
        # Including all 22 body joints ensures crossfading from any pose
        # cleanly resets every bone.
        joint_quats = {i: _IDENTITY_QUAT_TUPLE for i in range(_NUM_BODY_JOINTS_FULL)}
    else:
        abs_quats = _compute_joint_quaternions(pose)
        joint_quats = _to_apose_relative_full(abs_quats)

    gltf = pygltflib.GLTF2()
    gltf.asset = pygltflib.Asset(version="2.0", generator="IYAE PoseGLBGenerator")

    # ------------------------------------------------------------------
    # Scene
    # ------------------------------------------------------------------
    scene = pygltflib.Scene(name=pose.name, nodes=[0])
    gltf.scenes.append(scene)
    gltf.scene = 0

    # ------------------------------------------------------------------
    # Nodes (one per joint)
    # ------------------------------------------------------------------
    for i, joint_name in enumerate(SMPLX_JOINT_NAMES):
        q = joint_quats.get(i, (0.0, 0.0, 0.0, 1.0))
        parent_idx = SMPLX_PARENT_INDICES[i]

        node = pygltflib.Node(
            name=joint_name,
            rotation=list(q),
            translation=[0.0, 0.0, 0.0],
            scale=[1.0, 1.0, 1.0],
        )
        gltf.nodes.append(node)

        # Link children: set parent's children list
        if parent_idx >= 0:
            parent_node = gltf.nodes[parent_idx]
            if parent_node.children is None:
                parent_node.children = []
            parent_node.children.append(i)

    # ------------------------------------------------------------------
    # Animation binary data
    # ------------------------------------------------------------------
    # Non-identity joints only
    anim_joints = sorted(joint_quats.keys())

    # Build buffer data: for each animated joint we need
    #   - time accessor: 1 x SCALAR float = [0.0]  (shared across all channels)
    #   - rotation accessor: 1 x VEC4 float = [x, y, z, w]

    buffer_chunks: list[bytes] = []
    byte_offset = 0

    # Shared time buffer (one float: 0.0)
    time_bytes = _pack_floats([0.0])
    time_offset = byte_offset
    buffer_chunks.append(time_bytes)
    byte_offset += len(time_bytes)

    # Per-joint rotation buffers
    rot_offsets: dict[int, int] = {}
    for ji in anim_joints:
        q = joint_quats[ji]
        rot_bytes = _pack_floats(list(q))
        rot_offsets[ji] = byte_offset
        buffer_chunks.append(rot_bytes)
        byte_offset += len(rot_bytes)

    # Ensure 4-byte alignment
    if byte_offset % 4 != 0:
        pad = 4 - (byte_offset % 4)
        buffer_chunks.append(b"\x00" * pad)
        byte_offset += pad

    combined_buffer = b"".join(buffer_chunks)
    buf = pygltflib.Buffer(byteLength=len(combined_buffer))
    gltf.buffers.append(buf)

    # BufferViews + Accessors
    # Time bufferView (shared)
    time_bv_idx = len(gltf.bufferViews)
    gltf.bufferViews.append(
        pygltflib.BufferView(
            buffer=0,
            byteOffset=time_offset,
            byteLength=4,  # 1 float
        )
    )
    time_acc_idx = len(gltf.accessors)
    gltf.accessors.append(
        pygltflib.Accessor(
            bufferView=time_bv_idx,
            byteOffset=0,
            componentType=pygltflib.FLOAT,
            count=1,
            type=pygltflib.SCALAR,
            min=[0.0],
            max=[0.0],
        )
    )

    # Per-joint rotation bufferViews + accessors
    samplers: list[pygltflib.AnimationSampler] = []
    channels: list[pygltflib.AnimationChannel] = []

    for ji in anim_joints:
        q = joint_quats[ji]
        rot_bv_idx = len(gltf.bufferViews)
        gltf.bufferViews.append(
            pygltflib.BufferView(
                buffer=0,
                byteOffset=rot_offsets[ji],
                byteLength=16,  # 4 floats
            )
        )
        rot_acc_idx = len(gltf.accessors)
        gltf.accessors.append(
            pygltflib.Accessor(
                bufferView=rot_bv_idx,
                byteOffset=0,
                componentType=pygltflib.FLOAT,
                count=1,
                type=pygltflib.VEC4,
                min=list(q),
                max=list(q),
            )
        )

        sampler_idx = len(samplers)
        samplers.append(
            pygltflib.AnimationSampler(
                input=time_acc_idx,
                output=rot_acc_idx,
                interpolation="LINEAR",
            )
        )
        channels.append(
            pygltflib.AnimationChannel(
                sampler=sampler_idx,
                target=pygltflib.AnimationChannelTarget(
                    node=ji,
                    path="rotation",
                ),
            )
        )

    animation = pygltflib.Animation(
        name=f"{pose.name}-clip",
        samplers=samplers,
        channels=channels,
    )
    gltf.animations.append(animation)

    # Attach binary blob
    gltf.set_binary_blob(combined_buffer)

    # Serialize to GLB bytes
    return b"".join(gltf.save_to_bytes())


def _build_multiframe_pose_glb(pose: PoseDef) -> bytes:
    """Build a GLB with a multi-keyframe animation from ``pose.frames``."""
    if pose.frames is None:
        raise ValueError("_build_multiframe_pose_glb requires pose.frames to be set")
    if len(pose.frames) < 2:
        raise ValueError(
            f"Multi-frame pose '{pose.name}' requires at least 2 frames, "
            f"got {len(pose.frames)}"
        )

    num_frames = len(pose.frames)
    fps = pose.fps

    # ------------------------------------------------------------------
    # Pre-compute per-frame quaternions for every frame
    # ------------------------------------------------------------------
    frame_quats: list[dict[int, tuple[float, float, float, float]]] = [
        _compute_quaternions_from_joints(frame_joints)
        for frame_joints in pose.frames
    ]

    # Convert to A-pose-relative rotations (all 22 body joints per frame)
    if not pose.is_default:
        frame_quats = [_to_apose_relative_full(fq) for fq in frame_quats]

    # Union of all animated joint indices across every frame
    all_anim_joints: set[int] = set()
    for fq in frame_quats:
        all_anim_joints.update(fq.keys())
    anim_joints = sorted(all_anim_joints)

    # Use first frame's quaternions for the node rest pose
    first_frame_quats = frame_quats[0] if frame_quats else {}

    gltf = pygltflib.GLTF2()
    gltf.asset = pygltflib.Asset(version="2.0", generator="IYAE PoseGLBGenerator")

    # ------------------------------------------------------------------
    # Scene
    # ------------------------------------------------------------------
    scene = pygltflib.Scene(name=pose.name, nodes=[0])
    gltf.scenes.append(scene)
    gltf.scene = 0

    # ------------------------------------------------------------------
    # Nodes (one per joint)
    # ------------------------------------------------------------------
    for i, joint_name in enumerate(SMPLX_JOINT_NAMES):
        q = first_frame_quats.get(i, (0.0, 0.0, 0.0, 1.0))
        parent_idx = SMPLX_PARENT_INDICES[i]

        node = pygltflib.Node(
            name=joint_name,
            rotation=list(q),
            translation=[0.0, 0.0, 0.0],
            scale=[1.0, 1.0, 1.0],
        )
        gltf.nodes.append(node)

        if parent_idx >= 0:
            parent_node = gltf.nodes[parent_idx]
            if parent_node.children is None:
                parent_node.children = []
            parent_node.children.append(i)

    # ------------------------------------------------------------------
    # Animation binary data (multi-frame)
    # ------------------------------------------------------------------
    identity_quat = (0.0, 0.0, 0.0, 1.0)

    buffer_chunks: list[bytes] = []
    byte_offset = 0

    # Shared time buffer: N floats [0.0, 1/fps, 2/fps, ...]
    time_values = [i / fps for i in range(num_frames)]
    time_bytes = _pack_floats(time_values)
    time_offset = byte_offset
    buffer_chunks.append(time_bytes)
    byte_offset += len(time_bytes)

    # Per-joint rotation buffers: N x VEC4 (one quaternion per frame)
    rot_offsets: dict[int, int] = {}
    # Track per-component min/max for accessor bounds
    rot_min_max: dict[int, tuple[list[float], list[float]]] = {}

    for ji in anim_joints:
        rot_data: list[float] = []
        comp_min = [float("inf")] * 4
        comp_max = [float("-inf")] * 4

        for fq in frame_quats:
            q = fq.get(ji, identity_quat)
            for c in range(4):
                rot_data.append(q[c])
                if q[c] < comp_min[c]:
                    comp_min[c] = q[c]
                if q[c] > comp_max[c]:
                    comp_max[c] = q[c]

        rot_bytes = _pack_floats(rot_data)
        rot_offsets[ji] = byte_offset
        rot_min_max[ji] = (comp_min, comp_max)
        buffer_chunks.append(rot_bytes)
        byte_offset += len(rot_bytes)

    # Ensure 4-byte alignment
    if byte_offset % 4 != 0:
        pad = 4 - (byte_offset % 4)
        buffer_chunks.append(b"\x00" * pad)
        byte_offset += pad

    combined_buffer = b"".join(buffer_chunks)
    buf = pygltflib.Buffer(byteLength=len(combined_buffer))
    gltf.buffers.append(buf)

    # ------------------------------------------------------------------
    # BufferViews + Accessors
    # ------------------------------------------------------------------
    # Time bufferView (shared)
    time_bv_idx = len(gltf.bufferViews)
    time_byte_length = num_frames * 4  # N floats
    gltf.bufferViews.append(
        pygltflib.BufferView(
            buffer=0,
            byteOffset=time_offset,
            byteLength=time_byte_length,
        )
    )
    time_acc_idx = len(gltf.accessors)
    gltf.accessors.append(
        pygltflib.Accessor(
            bufferView=time_bv_idx,
            byteOffset=0,
            componentType=pygltflib.FLOAT,
            count=num_frames,
            type=pygltflib.SCALAR,
            min=[time_values[0]],
            max=[time_values[-1]],
        )
    )

    # Per-joint rotation bufferViews + accessors
    samplers: list[pygltflib.AnimationSampler] = []
    channels: list[pygltflib.AnimationChannel] = []

    for ji in anim_joints:
        rot_byte_length = num_frames * 16  # N * 4 floats
        rot_bv_idx = len(gltf.bufferViews)
        gltf.bufferViews.append(
            pygltflib.BufferView(
                buffer=0,
                byteOffset=rot_offsets[ji],
                byteLength=rot_byte_length,
            )
        )

        comp_min, comp_max = rot_min_max[ji]
        rot_acc_idx = len(gltf.accessors)
        gltf.accessors.append(
            pygltflib.Accessor(
                bufferView=rot_bv_idx,
                byteOffset=0,
                componentType=pygltflib.FLOAT,
                count=num_frames,
                type=pygltflib.VEC4,
                min=comp_min,
                max=comp_max,
            )
        )

        sampler_idx = len(samplers)
        samplers.append(
            pygltflib.AnimationSampler(
                input=time_acc_idx,
                output=rot_acc_idx,
                interpolation="LINEAR",
            )
        )
        channels.append(
            pygltflib.AnimationChannel(
                sampler=sampler_idx,
                target=pygltflib.AnimationChannelTarget(
                    node=ji,
                    path="rotation",
                ),
            )
        )

    animation = pygltflib.Animation(
        name=f"{pose.name}-clip",
        samplers=samplers,
        channels=channels,
    )
    gltf.animations.append(animation)

    # Attach binary blob
    gltf.set_binary_blob(combined_buffer)

    # Serialize to GLB bytes
    return b"".join(gltf.save_to_bytes())


def generate_all_poses(output_dir: Path) -> None:
    """Generate GLB files for all predefined poses."""
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"Output directory: {output_dir}")

    for pose in POSES:
        out_path = output_dir / pose.filename
        print(f"  Generating {pose.filename} ...")
        glb_bytes = _build_pose_glb(pose)
        out_path.write_bytes(glb_bytes)
        print(f"    -> {out_path} ({len(glb_bytes):,} bytes)")

    # Write poses manifest
    manifest = pose_manifest.read_manifest()
    for pose in POSES:
        duration = pose_manifest.compute_duration(
            len(pose.frames) if pose.frames else 0,
            pose.fps,
        )
        entry = {
            "id": pose.name,
            "filename": pose.filename,
            "label": pose.label,
            "labelZh": pose.label_zh,
            "category": pose.category,
            "isDefault": pose.is_default,
            "duration": duration,
            "loop": pose.loop,
        }
        manifest = pose_manifest.upsert_pose(manifest, entry)
    pose_manifest.write_manifest(pose_manifest.DEFAULT_MANIFEST_PATH, manifest)
    print(f"\nManifest written to {pose_manifest.DEFAULT_MANIFEST_PATH}")

    print(f"\nDone. {len(POSES)} GLB files written to {output_dir}")


if __name__ == "__main__":
    generate_all_poses(_OUTPUT_DIR)
