"""Tests for rigging_task_queue module."""
import pytest
from unittest.mock import MagicMock, patch
from rigging_task_queue import RiggingTaskQueue, MAX_RIGGING_ATTEMPTS


class TestRiggingTaskQueueClaim:
    def setup_method(self):
        self.db_config = {
            "host": "localhost",
            "port": 3306,
            "database": "clossette_test",
            "user": "test",
            "password": "test",
        }
        self.queue = RiggingTaskQueue(self.db_config)

    @patch("rigging_task_queue.mysql.connector.connect")
    def test_claim_task_returns_task_dict(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        task_data = {
            "id": 1,
            "garment_asset_id": 10,
            "product_id": 5,
            "user_id": 3,
            "input_payload": None,
            "attempt_count": 0,
        }
        mock_cursor.fetchone.return_value = task_data
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        result = self.queue.claim_task()

        assert result == task_data
        mock_conn.commit.assert_called_once()

    @patch("rigging_task_queue.mysql.connector.connect")
    def test_claim_task_returns_none_when_empty(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        result = self.queue.claim_task()

        assert result is None
        mock_conn.rollback.assert_called_once()

    @patch("rigging_task_queue.mysql.connector.connect")
    def test_claim_skips_max_attempts(self, mock_connect):
        """Tasks with attempt_count >= MAX_RIGGING_ATTEMPTS should not be claimed."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None  # no eligible tasks
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        result = self.queue.claim_task()

        assert result is None
        # Verify the SQL includes attempt_count filter
        sql = mock_cursor.execute.call_args_list[0][0][0]
        assert "attempt_count" in sql


class TestRiggingTaskQueueComplete:
    def setup_method(self):
        self.queue = RiggingTaskQueue({
            "host": "localhost",
            "port": 3306,
            "database": "test",
            "user": "test",
            "password": "test",
        })

    @patch("rigging_task_queue.mysql.connector.connect")
    def test_complete_task_updates_status(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 1
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        output = {"glb_path": "products/5/tasks/1/preview.glb"}
        self.queue.complete_task(1, output)

        mock_conn.commit.assert_called_once()
        sql, params = mock_cursor.execute.call_args[0]
        assert "rigging_tasks" in sql
        assert "READY" in sql
        assert params[1] == 1


class TestRiggingTaskQueueFail:
    def setup_method(self):
        self.queue = RiggingTaskQueue({
            "host": "localhost",
            "port": 3306,
            "database": "test",
            "user": "test",
            "password": "test",
        })

    @patch("rigging_task_queue.mysql.connector.connect")
    def test_fail_task_with_failure_code(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        self.queue.fail_task(42, "Rigging failed", failure_code="INVALID_MESH")

        mock_conn.commit.assert_called_once()
        sql, params = mock_cursor.execute.call_args[0]
        assert "rigging_tasks" in sql
        assert "FAILED" in sql
        assert params[0] == "Rigging failed"
        assert params[1] == "INVALID_MESH"
        assert params[2] == 42

    @patch("rigging_task_queue.mysql.connector.connect")
    def test_fail_task_without_failure_code(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        self.queue.fail_task(7, "Unknown error")

        mock_conn.commit.assert_called_once()
        sql, params = mock_cursor.execute.call_args[0]
        assert "FAILED" in sql
        assert params[1] is None


class TestRiggingReclaimStaleTasks:
    def setup_method(self):
        self.queue = RiggingTaskQueue({
            "host": "localhost",
            "port": 3306,
            "database": "test",
            "user": "test",
            "password": "test",
        })

    @patch("rigging_task_queue.mysql.connector.connect")
    def test_reclaim_stale_tasks(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 2
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        reclaimed = self.queue.reclaim_stale_tasks()

        assert reclaimed == 2
        mock_conn.commit.assert_called_once()
        sql = mock_cursor.execute.call_args[0][0]
        assert "rigging_tasks" in sql
        assert "INTERVAL 15 MINUTE" in sql
        assert "RUNNING" in sql
        assert "claimed_at" in sql

    @patch("rigging_task_queue.mysql.connector.connect")
    def test_reclaim_stale_fails_max_attempts(self, mock_connect):
        """Stale tasks over attempt limit should be set to FAILED with MAX_ATTEMPTS_EXCEEDED."""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.rowcount = 0
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        self.queue.reclaim_stale_tasks()

        # Should have called execute twice: first to reclaim, second to fail over-limit
        assert mock_cursor.execute.call_count == 2
        second_sql = mock_cursor.execute.call_args_list[1][0][0]
        assert "MAX_ATTEMPTS_EXCEEDED" in second_sql
