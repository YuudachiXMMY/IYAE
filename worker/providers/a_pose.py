"""A-pose body_pose vector for SMPL-X avatar generation.

Provides a 63-dimensional body_pose vector (21 body joints × 3 axis-angle)
compatible with the ``smplx`` library's ``body_pose`` parameter.

SMPL-X splits its 55 joints across several parameters:
  - global_orient: joint 0 (pelvis) — 3 values
  - body_pose: joints 1–21 — 63 values  ← this module provides this
  - jaw_pose, leye_pose, reye_pose: joints 22–24 — 9 values
  - left_hand_pose: joints 25–39 — 45 values
  - right_hand_pose: joints 40–54 — 45 values

Only the left_shoulder (skeleton joint 16 → body_pose index 15) and
right_shoulder (skeleton joint 17 → body_pose index 16) are non-zero;
both are rotated ~30° around the Z-axis to bring the arms toward the body.
"""

# 30 degrees in radians (~0.5236 rad)
A_POSE_SHOULDER_ANGLE: float = 0.5236

# body_pose covers skeleton joints 1–21 (21 joints, 63 values).
# Indices below are relative to body_pose (skeleton index minus 1).
_NUM_BODY_JOINTS: int = 21

_LEFT_SHOULDER_BP_IDX: int = 15   # skeleton joint 16 - 1
_RIGHT_SHOULDER_BP_IDX: int = 16  # skeleton joint 17 - 1


def get_a_pose_body_pose() -> list[float]:
    """Return the 63-dimensional SMPL-X body_pose vector for A-pose.

    The vector is zero-initialised except for:
    - Index 15*3+2 = 47 (left_shoulder  Z): +A_POSE_SHOULDER_ANGLE (+30°)
    - Index 16*3+2 = 50 (right_shoulder Z): -A_POSE_SHOULDER_ANGLE (-30°)

    Returns:
        A list of 63 floats representing body joint axis-angle rotations.
    """
    pose: list[float] = [0.0] * (_NUM_BODY_JOINTS * 3)
    pose[_LEFT_SHOULDER_BP_IDX * 3 + 2] = A_POSE_SHOULDER_ANGLE
    pose[_RIGHT_SHOULDER_BP_IDX * 3 + 2] = -A_POSE_SHOULDER_ANGLE
    return pose
