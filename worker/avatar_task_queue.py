"""MySQL-based avatar task queue using SELECT ... FOR UPDATE SKIP LOCKED."""
import json
import logging
import mysql.connector
from mysql.connector import Error

logger = logging.getLogger(__name__)


class AvatarTaskQueue:
    def __init__(self, db_config: dict):
        self.db_config = db_config

    def get_connection(self):
        return mysql.connector.connect(**self.db_config)

    def claim_task(self) -> dict | None:
        """Claim one PENDING avatar task using FOR UPDATE SKIP LOCKED."""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            conn.start_transaction()
            cursor.execute("""
                SELECT id, user_id, input_payload, attempt_count
                FROM avatar_generation_tasks
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
                UPDATE avatar_generation_tasks
                SET status = 'RUNNING', claimed_at = NOW(), attempt_count = attempt_count + 1
                WHERE id = %s
            """, (task['id'],))
            conn.commit()
            return task
        except Error as e:
            conn.rollback()
            logger.error(f"Failed to claim avatar task: {e}")
            return None
        finally:
            cursor.close()
            conn.close()

    def complete_task(self, task_id: int, output_payload: dict):
        """Mark avatar task as READY with output payload.

        Only updates if the task is still RUNNING — prevents superseded
        (FAILED) tasks from resurrecting.
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE avatar_generation_tasks
                SET status = 'READY', output_payload = %s, completed_at = NOW()
                WHERE id = %s AND status = 'RUNNING'
            """, (json.dumps(output_payload), task_id))
            conn.commit()
            if cursor.rowcount == 0:
                logger.warning(f"Avatar task {task_id} was not in RUNNING state — skipping completion")
        finally:
            cursor.close()
            conn.close()

    def fail_task(self, task_id: int, error_message: str):
        """Mark avatar task as FAILED."""
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE avatar_generation_tasks
                SET status = 'FAILED', error_message = %s, completed_at = NOW()
                WHERE id = %s
            """, (error_message, task_id))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def reclaim_stale_tasks(self) -> int:
        """Reset RUNNING avatar tasks stuck >15 minutes back to PENDING."""
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE avatar_generation_tasks
                SET status = 'PENDING'
                WHERE status = 'RUNNING'
                  AND updated_at < NOW() - INTERVAL 15 MINUTE
            """)
            reclaimed = cursor.rowcount
            conn.commit()
            if reclaimed > 0:
                logger.info(f"Reclaimed {reclaimed} stale avatar RUNNING task(s)")
            return reclaimed
        except Error as e:
            conn.rollback()
            logger.error(f"Failed to reclaim stale avatar tasks: {e}")
            return 0
        finally:
            cursor.close()
            conn.close()
