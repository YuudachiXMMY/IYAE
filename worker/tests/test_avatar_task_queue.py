"""Tests for avatar_task_queue module."""
import pytest
from unittest.mock import MagicMock, patch
from avatar_task_queue import AvatarTaskQueue


class TestAvatarTaskQueue:
    def setup_method(self):
        self.db_config = {
            "host": "localhost",
            "port": 3306,
            "database": "iyae_test",
            "user": "test",
            "password": "test",
        }
        self.queue = AvatarTaskQueue(self.db_config)

    @patch("avatar_task_queue.mysql.connector.connect")
    def test_claim_task_returns_none_when_empty(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        result = self.queue.claim_task()

        assert result is None
        mock_conn.rollback.assert_called_once()

    @patch("avatar_task_queue.mysql.connector.connect")
    def test_claim_task_returns_task(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        task_data = {"id": 1, "user_id": 7, "input_payload": None, "attempt_count": 0}
        mock_cursor.fetchone.return_value = task_data
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        result = self.queue.claim_task()

        assert result == task_data
        mock_conn.commit.assert_called_once()


class TestAvatarReclaimStaleTasks:
    def setup_method(self):
        self.queue = AvatarTaskQueue({
            "host": "localhost",
            "port": 3306,
            "database": "test",
            "user": "test",
            "password": "test",
        })

    @patch("avatar_task_queue.mysql.connector.connect")
    def test_reclaim_updates_stale_running_tasks(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 3
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        reclaimed = self.queue.reclaim_stale_tasks()

        assert reclaimed == 3
        mock_conn.commit.assert_called_once()
        sql = mock_cursor.execute.call_args[0][0]
        assert "INTERVAL 15 MINUTE" in sql
        assert "RUNNING" in sql
        assert "avatar_generation_tasks" in sql

    @patch("avatar_task_queue.mysql.connector.connect")
    def test_reclaim_returns_zero_when_none_stale(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 0
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        reclaimed = self.queue.reclaim_stale_tasks()

        assert reclaimed == 0
        mock_conn.commit.assert_called_once()
