"""Tests for task_queue module."""
import pytest
from unittest.mock import MagicMock, patch
from task_queue import TaskQueue


class TestTaskQueue:
    def setup_method(self):
        self.db_config = {
            "host": "localhost",
            "port": 3306,
            "database": "clossette_test",
            "user": "test",
            "password": "test",
        }
        self.queue = TaskQueue(self.db_config)

    @patch("task_queue.mysql.connector.connect")
    def test_claim_task_returns_none_when_empty(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        result = self.queue.claim_task()
        assert result is None
        mock_conn.rollback.assert_called_once()

    @patch("task_queue.mysql.connector.connect")
    def test_claim_task_returns_task(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        task_data = {"id": 1, "product_id": 42, "input_payload": None, "attempt_count": 0}
        mock_cursor.fetchone.return_value = task_data
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        result = self.queue.claim_task()
        assert result == task_data
        mock_conn.commit.assert_called_once()


class TestRetryTask:
    def setup_method(self):
        self.queue = TaskQueue({
            "host": "localhost", "port": 3306,
            "database": "test", "user": "test", "password": "test",
        })

    @patch("task_queue.mysql.connector.connect")
    def test_retry_resets_failed_task_when_under_limit(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 1
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        result = self.queue.retry_task(42)

        assert result is True
        mock_conn.commit.assert_called_once()

    @patch("task_queue.mysql.connector.connect")
    def test_retry_refuses_when_not_eligible(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 0
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        result = self.queue.retry_task(42)

        assert result is False
        mock_conn.commit.assert_called_once()

    @patch("task_queue.mysql.connector.connect")
    def test_retry_returns_false_on_exception(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.execute.side_effect = Exception("DB error")
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        result = self.queue.retry_task(99)

        assert result is False
        mock_conn.rollback.assert_called_once()
        mock_conn.commit.assert_not_called()


class TestReclaimStaleTasks:
    def setup_method(self):
        self.queue = TaskQueue({
            "host": "localhost", "port": 3306,
            "database": "test", "user": "test", "password": "test",
        })

    @patch("task_queue.mysql.connector.connect")
    def test_reclaim_updates_stale_running_tasks(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 2
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        reclaimed = self.queue.reclaim_stale_tasks()

        assert reclaimed == 2
        mock_conn.commit.assert_called_once()
        sql = mock_cursor.execute.call_args[0][0]
        assert "INTERVAL 15 MINUTE" in sql
        assert "RUNNING" in sql

    @patch("task_queue.mysql.connector.connect")
    def test_reclaim_returns_zero_when_none_stale(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 0
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        reclaimed = self.queue.reclaim_stale_tasks()

        assert reclaimed == 0
        mock_conn.commit.assert_called_once()
