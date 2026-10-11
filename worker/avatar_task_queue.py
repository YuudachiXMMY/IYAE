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

    def fail_task(self, task_id: int, error_message: str) -> bool:
        """Mark a RUNNING avatar task as FAILED.

        The `status = 'RUNNING'` guard mirrors `TaskQueue.fail_task`. Without it this was an
        unconditional write, so a late failure path could flip a task that had already reached
        READY — or that a reclaim had handed to another worker, which then finished it — back
        to FAILED, destroying a generated avatar and showing the user an error for a body model
        that exists.

        Returns True when this call is what failed the task.
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE avatar_generation_tasks
                SET status = 'FAILED', error_message = %s, completed_at = NOW()
                WHERE id = %s AND status = 'RUNNING'
            """, (error_message, task_id))
            conn.commit()
            if cursor.rowcount == 0:
                logger.warning(
                    f"fail_task: avatar task {task_id} was not RUNNING — leaving its status "
                    f"alone rather than overwriting it. Error was: {error_message}"
                )
                return False
            return True
        finally:
            cursor.close()
            conn.close()

    def heartbeat(self, task_id: int) -> None:
        """Push out a RUNNING task's staleness clock.

        `reclaim_stale_tasks` decides staleness from `updated_at`, which nothing refreshed
        during a run — so a job that legitimately outlives the 15-minute threshold was
        reclaimed and handed to a second claimant while the first was still working on it.
        `main.py` holds a heartbeat thread open for the duration of `provider.generate()`.
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE avatar_generation_tasks
                SET updated_at = NOW()
                WHERE id = %s AND status = 'RUNNING'
            """, (task_id,))
            conn.commit()
        except Error as e:
            logger.warning(f"Heartbeat for task {task_id} failed: {e}")
            conn.rollback()
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
