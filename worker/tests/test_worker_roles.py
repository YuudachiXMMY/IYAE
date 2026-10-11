"""#5: the rigging container must not claim model or avatar tasks.

It runs the same `main.py`, so before the role switch it was a second claimant for all three
queues — and configured with MODEL_GENERATION_PROVIDER=mock, it completed genuine generation
requests with stub output whenever it won the race against the real worker.
"""
import os
import time
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import ALL_ROLES, get_roles  # noqa: E402


class TestGetRoles:
    def test_unset_defaults_to_every_role(self, monkeypatch):
        # The single-worker production topology, which must keep working untouched.
        monkeypatch.delenv("WORKER_ROLES", raising=False)
        assert get_roles() == set(ALL_ROLES)

    def test_blank_defaults_to_every_role(self, monkeypatch):
        monkeypatch.setenv("WORKER_ROLES", "   ")
        assert get_roles() == set(ALL_ROLES)

    def test_single_role(self, monkeypatch):
        monkeypatch.setenv("WORKER_ROLES", "rigging")
        assert get_roles() == {"rigging"}

    def test_multiple_roles_with_whitespace_and_case(self, monkeypatch):
        monkeypatch.setenv("WORKER_ROLES", " Model , AVATAR ")
        assert get_roles() == {"model", "avatar"}

    def test_unknown_role_raises_rather_than_silently_claiming_nothing(self, monkeypatch):
        # A typo must not start a worker that quietly processes no queues.
        monkeypatch.setenv("WORKER_ROLES", "rigging,riggin")
        with pytest.raises(ValueError, match="riggin"):
            get_roles()

    def test_only_separators_raises(self, monkeypatch):
        monkeypatch.setenv("WORKER_ROLES", ",,,")
        with pytest.raises(ValueError):
            get_roles()


class TestHeartbeat:
    def test_touch_heartbeat_writes_a_timestamp(self, monkeypatch, tmp_path):
        import importlib
        import main as main_module

        path = tmp_path / "hb"
        monkeypatch.setenv("WORKER_HEARTBEAT_PATH", str(path))
        importlib.reload(main_module)

        main_module.touch_heartbeat()

        assert path.exists()
        assert int(path.read_text()) > 0

    def test_touch_heartbeat_survives_an_unwritable_path(self, monkeypatch):
        # The heartbeat is diagnostics; it must never be able to kill the poll loop.
        import importlib
        import main as main_module

        monkeypatch.setenv("WORKER_HEARTBEAT_PATH", "/nonexistent-dir/hb")
        importlib.reload(main_module)

        main_module.touch_heartbeat()  # must not raise


class TestTaskHeartbeatWiring:
    """#28: the heartbeat only fixes anything if it is actually called during a run.

    It was first shipped as a method nobody invoked — the reclaim docstring claimed slow jobs
    were safe while a real Tripo3D job (which polls for up to 10 minutes) would still be
    reclaimed mid-run and handed to a second claimant.
    """

    def test_heartbeats_while_the_block_runs(self, monkeypatch):
        import importlib
        import main as main_module

        monkeypatch.setenv("WORKER_TASK_HEARTBEAT_INTERVAL", "0")
        importlib.reload(main_module)

        class FakeQueue:
            def __init__(self):
                self.beats = 0

            def heartbeat(self, task_id):
                self.beats += 1

        queue = FakeQueue()
        with main_module.task_heartbeat(queue, 42):
            # A zero interval makes the thread spin; give it a moment to tick.
            deadline = time.time() + 2
            while queue.beats == 0 and time.time() < deadline:
                time.sleep(0.01)

        assert queue.beats > 0, "the heartbeat thread never called queue.heartbeat"

    def test_stops_beating_once_the_block_exits(self, monkeypatch):
        import importlib
        import main as main_module

        monkeypatch.setenv("WORKER_TASK_HEARTBEAT_INTERVAL", "0")
        importlib.reload(main_module)

        class FakeQueue:
            def __init__(self):
                self.beats = 0

            def heartbeat(self, task_id):
                self.beats += 1

        queue = FakeQueue()
        with main_module.task_heartbeat(queue, 42):
            deadline = time.time() + 2
            while queue.beats == 0 and time.time() < deadline:
                time.sleep(0.01)

        settled = queue.beats
        time.sleep(0.2)
        assert queue.beats == settled, "the heartbeat thread outlived its task"

    def test_a_failing_heartbeat_does_not_escape(self, monkeypatch):
        # Diagnostics must never be able to fail the task they are reporting on.
        import importlib
        import main as main_module

        monkeypatch.setenv("WORKER_TASK_HEARTBEAT_INTERVAL", "0")
        importlib.reload(main_module)

        class ExplodingQueue:
            def heartbeat(self, task_id):
                raise RuntimeError("database gone")

        with main_module.task_heartbeat(ExplodingQueue(), 42):
            time.sleep(0.05)
        # Reaching here without an exception is the assertion.

    def test_all_three_queues_expose_heartbeat(self):
        # main.py wraps the model, avatar and rigging generate() calls in the same context
        # manager, so a queue missing the method would degrade to a warning every tick
        # instead of failing loudly.
        from task_queue import TaskQueue
        from avatar_task_queue import AvatarTaskQueue
        from rigging_task_queue import RiggingTaskQueue

        for cls in (TaskQueue, AvatarTaskQueue, RiggingTaskQueue):
            assert callable(getattr(cls, "heartbeat", None)), f"{cls.__name__}.heartbeat missing"
