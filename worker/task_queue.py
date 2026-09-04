"""MySQL-based task queue using SELECT ... FOR UPDATE SKIP LOCKED."""
import logging
import mysql.connector
from mysql.connector import Error

logger = logging.getLogger(__name__)


class TaskQueue:
    def __init__(self, db_config: dict):
        self.db_config = db_config

    def get_connection(self):
        return mysql.connector.connect(**self.db_config)

    def claim_task(self) -> dict | None:
        """Claim one PENDING task using FOR UPDATE SKIP LOCKED."""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            conn.start_transaction()
            cursor.execute("""
                SELECT id, product_id, input_payload, attempt_count
                FROM model_generation_tasks
                WHERE status = 'PENDING'
                ORDER BY created_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            """)
            task = cursor.fetchone()
            if task is None:
                conn.rollback()
                return None

            cursor.execute("""
                UPDATE model_generation_tasks
                SET status = 'RUNNING', claimed_at = NOW(), attempt_count = attempt_count + 1
                WHERE id = %s
            """, (task['id'],))
            conn.commit()
            return task
        except Error as e:
            conn.rollback()
            logger.error(f"Failed to claim task: {e}")
            return None
        finally:
            cursor.close()
            conn.close()

    def complete_task(self, task_id: int, output_payload: dict):
        """Mark task as READY with output payload.

        Only updates if the task is still RUNNING — prevents superseded
        (FAILED) tasks from resurrecting.
        """
        import json
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE model_generation_tasks
                SET status = 'READY', output_payload = %s, completed_at = NOW()
                WHERE id = %s AND status = 'RUNNING'
            """, (json.dumps(output_payload), task_id))
            conn.commit()
            if cursor.rowcount == 0:
                logger.warning(f"Task {task_id} was not in RUNNING state — skipping completion")
        finally:
            cursor.close()
            conn.close()

    def fail_task(self, task_id: int, error_message: str):
        """Mark task as FAILED."""
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE model_generation_tasks
                SET status = 'FAILED', error_message = %s, completed_at = NOW()
                WHERE id = %s
            """, (error_message, task_id))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def retry_task(self, task_id: int) -> bool:
        """Retry a failed task atomically. Returns True if successful."""
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE model_generation_tasks
                SET status = 'PENDING', error_message = NULL, updated_at = NOW()
                WHERE id = %s AND status = 'FAILED' AND COALESCE(attempt_count, 0) < 3
            """, (task_id,))
            conn.commit()
            success = cursor.rowcount > 0
            if success:
                logger.info(f"Task {task_id} retried successfully")
            else:
                logger.warning(f"Task {task_id} not eligible for retry (not FAILED or max retries reached)")
            return success
        except Exception as e:
            logger.error(f"Failed to retry task {task_id}: {e}")
            conn.rollback()
            return False
        finally:
            cursor.close()
            conn.close()

    def reclaim_stale_tasks(self) -> int:
        """Reset RUNNING tasks stuck for more than 15 minutes back to PENDING.

        Returns the number of tasks reclaimed.
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE model_generation_tasks
                SET status = 'PENDING'
                WHERE status = 'RUNNING'
                  AND updated_at < NOW() - INTERVAL 15 MINUTE
            """)
            reclaimed = cursor.rowcount
            conn.commit()
            if reclaimed > 0:
                logger.info(f"Reclaimed {reclaimed} stale RUNNING task(s) back to PENDING")
            return reclaimed
        except Error as e:
            conn.rollback()
            logger.error(f"Failed to reclaim stale tasks: {e}")
            return 0
        finally:
            cursor.close()
            conn.close()
