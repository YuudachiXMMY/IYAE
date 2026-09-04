"""SMPL-X A-pose canonical skeleton definition for garment rigging.

This module provides joint names, parent indices, and bone subsets keyed by
garment slot (TOP / BOTTOM / DRESS).  It is a pure data module with no external
dependencies so it can be imported both inside Blender and by the host worker.
"""

# ---------------------------------------------------------------------------
# 55 SMPL-X joint names in hierarchy order
# Indices 0-21  : body joints
# Indices 22-36 : left-hand finger joints
# Indices 37-51 : right-hand finger joints
# Indices 52-54 : jaw + left/right eye-balls
# ---------------------------------------------------------------------------
SMPLX_JOINT_NAMES: list[str] = [
    # Body (0-21)
    "pelvis",           # 0
    "left_hip",         # 1
    "right_hip",        # 2
    "spine1",           # 3
    "left_knee",        # 4
    "right_knee",       # 5
    "spine2",           # 6
    "left_ankle",       # 7
    "right_ankle",      # 8
    "spine3",           # 9
    "left_foot",        # 10
    "right_foot",       # 11
    "neck",             # 12
    "left_collar",      # 13
    "right_collar",     # 14
    "head",             # 15
    "left_shoulder",    # 16
    "right_shoulder",   # 17
    "left_elbow",       # 18
    "right_elbow",      # 19
    "left_wrist",       # 20
    "right_wrist",      # 21
    # Left hand (22-36)
    "left_index1",      # 22
    "left_index2",      # 23
    "left_index3",      # 24
    "left_middle1",     # 25
    "left_middle2",     # 26
    "left_middle3",     # 27
    "left_pinky1",      # 28
    "left_pinky2",      # 29
    "left_pinky3",      # 30
    "left_ring1",       # 31
    "left_ring2",       # 32
    "left_ring3",       # 33
    "left_thumb1",      # 34
    "left_thumb2",      # 35
    "left_thumb3",      # 36
    # Right hand (37-51)
    "right_index1",     # 37
    "right_index2",     # 38
    "right_index3",     # 39
    "right_middle1",    # 40
    "right_middle2",    # 41
    "right_middle3",    # 42
    "right_pinky1",     # 43
    "right_pinky2",     # 44
    "right_pinky3",     # 45
    "right_ring1",      # 46
    "right_ring2",      # 47
    "right_ring3",      # 48
    "right_thumb1",     # 49
    "right_thumb2",     # 50
    "right_thumb3",     # 51
    # Face (52-54)
    "jaw",              # 52
    "left_eye",         # 53
    "right_eye",        # 54
]

# ---------------------------------------------------------------------------
# Parent index for each joint (-1 = root)
# ---------------------------------------------------------------------------
SMPLX_PARENT_INDICES: list[int] = [
    # Body (0-21)
    -1,   # 0  pelvis (root)
     0,   # 1  left_hip
     0,   # 2  right_hip
     0,   # 3  spine1
     1,   # 4  left_knee
     2,   # 5  right_knee
     3,   # 6  spine2
     4,   # 7  left_ankle
     5,   # 8  right_ankle
     6,   # 9  spine3
     7,   # 10 left_foot
     8,   # 11 right_foot
     9,   # 12 neck
     9,   # 13 left_collar
     9,   # 14 right_collar
    12,   # 15 head
    13,   # 16 left_shoulder
    14,   # 17 right_shoulder
    16,   # 18 left_elbow
    17,   # 19 right_elbow
    18,   # 20 left_wrist
    19,   # 21 right_wrist
    # Left hand (22-36)
    20,   # 22 left_index1
    22,   # 23 left_index2
    23,   # 24 left_index3
    20,   # 25 left_middle1
    25,   # 26 left_middle2
    26,   # 27 left_middle3
    20,   # 28 left_pinky1
    28,   # 29 left_pinky2
    29,   # 30 left_pinky3
    20,   # 31 left_ring1
    31,   # 32 left_ring2
    32,   # 33 left_ring3
    20,   # 34 left_thumb1
    34,   # 35 left_thumb2
    35,   # 36 left_thumb3
    # Right hand (37-51)
    21,   # 37 right_index1
    37,   # 38 right_index2
    38,   # 39 right_index3
    21,   # 40 right_middle1
    40,   # 41 right_middle2
    41,   # 42 right_middle3
    21,   # 43 right_pinky1
    43,   # 44 right_pinky2
    44,   # 45 right_pinky3
    21,   # 46 right_ring1
    46,   # 47 right_ring2
    47,   # 48 right_ring3
    21,   # 49 right_thumb1
    49,   # 50 right_thumb2
    50,   # 51 right_thumb3
    # Face (52-54)
    15,   # 52 jaw
    15,   # 53 left_eye
    15,   # 54 right_eye
]

# ---------------------------------------------------------------------------
# Bone subsets by garment slot
# None means use ALL 55 joints (e.g. full-body dress).
# ---------------------------------------------------------------------------
SLOT_BONE_SUBSETS: dict[str, list[str] | None] = {
    "TOP": [
        "pelvis",
        "spine1", "spine2", "spine3",
        "neck", "head",
        "left_collar", "right_collar",
        "left_shoulder", "right_shoulder",
        "left_elbow", "right_elbow",
        "left_wrist", "right_wrist",
    ],
    "BOTTOM": [
        "pelvis",
        "left_hip", "right_hip",
        "left_knee", "right_knee",
        "left_ankle", "right_ankle",
        "left_foot", "right_foot",
    ],
    "DRESS": None,  # Use all joints
}
