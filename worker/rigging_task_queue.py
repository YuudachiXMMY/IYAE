"""MySQL-based rigging task queue using SELECT ... FOR UPDATE SKIP LOCKED."""
import json
import logging
from mysql.connector import Error

from queue_base import TaskQueueBase

logger = logging.getLogger(__name__)

#: Kept as a module-level name because callers and tests import it directly; the value is the
#: shared cap on the base class, so the three queues cannot drift to different limits.
MAX_RIGGING_ATTEMPTS = TaskQueueBase.MAX_ATTEMPTS


class RiggingTaskQueue(TaskQueueBase):
    #: Connection handling, ``MAX_ATTEMPTS`` and ``heartbeat`` come from the base class.
    TABLE = "rigging_tasks"

    def claim_task(self) -> dict | None:
        """Claim one PENDING rigging task using FOR UPDATE SKIP LOCKED."""
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            conn.start_transaction()
            cursor.execute("""
                SELECT id, garment_asset_id, product_id, user_id, input_payload, attempt_count
                FROM rigging_tasks
                WHERE status = 'PENDING'
                  AND attempt_count < %s
                ORDER BY created_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            """, (MAX_RIGGING_ATTEMPTS,))
            task = cursor.fetchone()
            if task is None:
                conn.rollback()
                return None

            cursor.execute("""
                UPDATE rigging_tasks
                SET status = 'RUNNING', claimed_at = NOW(), attempt_count = attempt_count + 1
                WHERE id = %s
            """, (task['id'],))
            conn.commit()
            return task
        except Error as e:
            conn.rollback()
            logger.error("Failed to claim rigging task: %s", e)
            return None
        finally:
            cursor.close()
            conn.close()

    def complete_task(self, task_id: int, output_payload: dict):
        """Mark rigging task as READY with output payload.

        Only updates if the task is still RUNNING — prevents superseded
        (FAILED) tasks from resurrecting.
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE rigging_tasks
                SET status = 'READY', output_payload = %s, completed_at = NOW()
                WHERE id = %s AND status = 'RUNNING'
            """, (json.dumps(output_payload), task_id))
            conn.commit()
            if cursor.rowcount == 0:
                logger.warning("Rigging task %s was not in RUNNING state — skipping completion", task_id)
        finally:
            cursor.close()
            conn.close()

    def fail_task(self, task_id: int, error_message: str, failure_code: str = None):
        """Mark rigging task as FAILED with optional failure_code."""
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE rigging_tasks
                SET status = 'FAILED', error_message = %s, failure_code = %s, completed_at = NOW()
                WHERE id = %s AND status = 'RUNNING'
            """, (error_message, failure_code, task_id))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def reclaim_stale_tasks(self) -> int:
        """Reset stale RUNNING rigging tasks.

        Tasks under the attempt limit are returned to PENDING.
        Tasks at or over the limit are marked FAILED.

        Staleness is measured from ``updated_at``, not ``claimed_at``. ``claimed_at`` is written
        once when the task is claimed and never refreshed, so keying off it made
        ``TaskQueueBase.heartbeat()`` — which bumps ``updated_at`` every
        ``WORKER_TASK_HEARTBEAT_INTERVAL`` while ``provider.generate()`` runs — completely inert
        for this queue, while ``TaskQueue`` and ``AvatarTaskQueue`` both honour it. A rigging job
        legitimately running past 15 minutes (``PythonRiggingProvider`` has no timeout and does
        SMPL-X loading plus biharmonic inpainting) was reclaimed to PENDING under the original
        worker, letting a second claimant process the same task concurrently — the exact case the
        heartbeat exists to prevent.
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            # Reclaim retryable tasks back to PENDING
            cursor.execute("""
                UPDATE rigging_tasks
                SET status = 'PENDING', claimed_at = NULL
                WHERE status = 'RUNNING'
                  AND updated_at < NOW() - INTERVAL 15 MINUTE
                  AND attempt_count < %s
            """, (MAX_RIGGING_ATTEMPTS,))
            reclaimed = cursor.rowcount

            # Fail tasks that have exceeded max attempts
            cursor.execute("""
                UPDATE rigging_tasks
                SET status = 'FAILED',
                    failure_code = 'MAX_ATTEMPTS_EXCEEDED',
                    error_message = 'Task exceeded maximum retry attempts',
                    completed_at = NOW()
                WHERE status = 'RUNNING'
                  AND updated_at < NOW() - INTERVAL 15 MINUTE
                  AND attempt_count >= %s
            """, (MAX_RIGGING_ATTEMPTS,))
            failed = cursor.rowcount

            conn.commit()
            if reclaimed > 0:
                logger.info("Reclaimed %d stale rigging task(s)", reclaimed)
            if failed > 0:
                logger.info("Failed %d rigging task(s) exceeding max attempts", failed)
            return reclaimed
        except Error as e:
            conn.rollback()
            logger.error("Failed to reclaim stale rigging tasks: %s", e)
            return 0
        finally:
            cursor.close()
            conn.close()
