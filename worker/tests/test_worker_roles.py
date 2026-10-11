"""#5: the rigging container must not claim model or avatar tasks.

It runs the same `main.py`, so before the role switch it was a second claimant for all three
queues — and configured with MODEL_GENERATION_PROVIDER=mock, it completed genuine generation
requests with stub output whenever it won the race against the real worker.
"""
import os
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
