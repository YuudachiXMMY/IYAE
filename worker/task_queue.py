"""MySQL-based task queue using SELECT ... FOR UPDATE SKIP LOCKED."""
import logging
from mysql.connector import Error

from queue_base import TaskQueueBase

logger = logging.getLogger(__name__)


class TaskQueue(TaskQueueBase):
    #: Connection handling, ``MAX_ATTEMPTS`` and ``heartbeat`` come from the base class.
    TABLE = "model_generation_tasks"

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

    def fail_task(self, task_id: int, error_message: str) -> bool:
        """Mark a RUNNING task as FAILED.

        The ``status = 'RUNNING'`` guard is the point. Without it this was an unconditional
        write, so a late failure path could flip a task that had already reached READY (or that
        a reclaim had handed to another worker, which then finished it) back to FAILED — losing
        a successful generation and showing the designer an error for output that exists.

        Returns True when this call is what failed the task.
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE model_generation_tasks
                SET status = 'FAILED', error_message = %s, completed_at = NOW()
                WHERE id = %s AND status = 'RUNNING'
            """, (error_message, task_id))
            conn.commit()
            if cursor.rowcount == 0:
                logger.warning(
                    f"fail_task: task {task_id} was not RUNNING — leaving its status alone "
                    f"rather than overwriting it. Error was: {error_message}"
                )
                return False
            return True
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
                WHERE id = %s AND status = 'FAILED' AND COALESCE(attempt_count, 0) < %s
            """, (task_id, self.MAX_ATTEMPTS))
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

        Capped at ``MAX_ATTEMPTS``. Without a cap, a task that crashes the worker mid-run was
        reclaimed, crashed it again, was reclaimed again — forever, and at the front of the
        queue, so one poison task could starve every real one behind it. Over the cap the task
        is failed instead, which is a terminal state a human can see. This mirrors what
        ``RiggingTaskQueue.reclaim_stale_tasks`` already did.

        Staleness is measured from ``updated_at``, which :meth:`heartbeat` refreshes during a
        long run, so a slow job is no longer mistaken for an abandoned one.

        Returns the number of tasks reclaimed (not those failed for exceeding the cap).
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE model_generation_tasks
                SET status = 'FAILED',
                    error_message = %s,
                    completed_at = NOW()
                WHERE status = 'RUNNING'
                  AND updated_at < NOW() - INTERVAL 15 MINUTE
                  AND COALESCE(attempt_count, 0) >= %s
            """, (
                f"MAX_ATTEMPTS_EXCEEDED: still RUNNING and stale after "
                f"{self.MAX_ATTEMPTS} attempts",
                self.MAX_ATTEMPTS,
            ))
            exhausted = cursor.rowcount

            cursor.execute("""
                UPDATE model_generation_tasks
                SET status = 'PENDING'
                WHERE status = 'RUNNING'
                  AND updated_at < NOW() - INTERVAL 15 MINUTE
                  AND COALESCE(attempt_count, 0) < %s
            """, (self.MAX_ATTEMPTS,))
            reclaimed = cursor.rowcount
            conn.commit()

            if exhausted > 0:
                logger.error(
                    f"Failed {exhausted} stale task(s) that had already used all "
                    f"{self.MAX_ATTEMPTS} attempts — they are poison and need investigation"
                )
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
