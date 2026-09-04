import pytest
from providers.a_pose import get_a_pose_body_pose, A_POSE_SHOULDER_ANGLE

class TestGetAPoseBodyPose:
    def test_returns_63_floats(self):
        pose = get_a_pose_body_pose()
        assert len(pose) == 63
        assert all(isinstance(v, float) for v in pose)

    def test_left_shoulder_z_positive(self):
        pose = get_a_pose_body_pose()
        assert pose[15 * 3 + 2] == pytest.approx(A_POSE_SHOULDER_ANGLE)

    def test_right_shoulder_z_negative(self):
        pose = get_a_pose_body_pose()
        assert pose[16 * 3 + 2] == pytest.approx(-A_POSE_SHOULDER_ANGLE)

    def test_only_shoulders_nonzero(self):
        pose = get_a_pose_body_pose()
        for i, v in enumerate(pose):
            if i in (47, 50):  # 15*3+2, 16*3+2
                continue
            assert v == 0.0, f"Expected 0.0 at index {i}, got {v}"

    def test_immutability(self):
        pose1 = get_a_pose_body_pose()
        pose2 = get_a_pose_body_pose()
        pose1[0] = 999.0
        assert pose2[0] == 0.0
