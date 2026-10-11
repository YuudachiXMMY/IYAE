"""Tests for task_queue module."""
import pytest
from unittest.mock import MagicMock, PropertyMock, patch
from task_queue import TaskQueue


class TestTaskQueue:
    def setup_method(self):
        self.db_config = {
            "host": "localhost",
            "port": 3306,
            "database": "iyae_test",
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


class TestFailTaskGuard:
    """#27: fail_task must not overwrite a task that is no longer RUNNING."""

    def test_fail_task_only_touches_running_tasks(self):
        queue = TaskQueue({})
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 1
        mock_conn.cursor.return_value = mock_cursor

        with patch.object(queue, "get_connection", return_value=mock_conn):
            assert queue.fail_task(7, "boom") is True

        sql = mock_cursor.execute.call_args[0][0]
        assert "status = 'RUNNING'" in sql, (
            "without this guard a late failure path could flip an already-READY task back to "
            "FAILED, losing a successful generation"
        )

    def test_fail_task_reports_when_it_changed_nothing(self):
        # The task had already reached READY (or was reclaimed and finished elsewhere).
        queue = TaskQueue({})
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 0
        mock_conn.cursor.return_value = mock_cursor

        with patch.object(queue, "get_connection", return_value=mock_conn):
            assert queue.fail_task(7, "boom") is False


class TestHeartbeat:
    """#28: a long-running task must be able to prove it is still alive."""

    def test_heartbeat_pushes_out_updated_at_for_running_tasks_only(self):
        queue = TaskQueue({})
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor

        with patch.object(queue, "get_connection", return_value=mock_conn):
            queue.heartbeat(11)

        sql = mock_cursor.execute.call_args[0][0]
        assert "updated_at = NOW()" in sql
        assert "status = 'RUNNING'" in sql

    def test_heartbeat_swallows_database_errors(self):
        # Diagnostics must never take down the poll loop.
        from mysql.connector import Error

        queue = TaskQueue({})
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.execute.side_effect = Error("gone")
        mock_conn.cursor.return_value = mock_cursor

        with patch.object(queue, "get_connection", return_value=mock_conn):
            queue.heartbeat(11)  # must not raise


class TestReclaimAttemptCap:
    """#28: an unbounded reclaim loop lets one poison task starve the whole queue."""

    def test_reclaim_fails_tasks_that_have_exhausted_their_attempts(self):
        queue = TaskQueue({})
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 1
        mock_conn.cursor.return_value = mock_cursor

        with patch.object(queue, "get_connection", return_value=mock_conn):
            queue.reclaim_stale_tasks()

        statements = [c[0][0] for c in mock_cursor.execute.call_args_list]
        assert len(statements) == 2, "one statement fails the exhausted tasks, one reclaims"
        assert "status = 'FAILED'" in statements[0]
        assert "attempt_count, 0) >= %s" in statements[0]
        assert "status = 'PENDING'" in statements[1]
        assert "attempt_count, 0) < %s" in statements[1]

    def test_reclaim_returns_only_the_reclaimed_count(self):
        queue = TaskQueue({})
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        # 2 exhausted then 5 reclaimed; the return value is the reclaimed half.
        type(mock_cursor).rowcount = PropertyMock(side_effect=[2, 5])
        mock_conn.cursor.return_value = mock_cursor

        with patch.object(queue, "get_connection", return_value=mock_conn):
            assert queue.reclaim_stale_tasks() == 5

    def test_retry_and_the_sweep_share_one_attempt_cap(self):
        # Two hardcoded 3s would be two places to change.
        assert TaskQueue.MAX_ATTEMPTS == 3
