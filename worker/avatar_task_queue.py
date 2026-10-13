"""MySQL-based avatar task queue using SELECT ... FOR UPDATE SKIP LOCKED."""
import json
import logging
from mysql.connector import Error

from queue_base import TaskQueueBase

logger = logging.getLogger(__name__)


class AvatarTaskQueue(TaskQueueBase):
    #: Connection handling, ``MAX_ATTEMPTS`` and ``heartbeat`` come from the base class.
    TABLE = "avatar_generation_tasks"

    def claim_task(self) -> dict | None:
        """Claim one PENDING avatar task using FOR UPDATE SKIP LOCKED.

        Filtered on ``attempt_count``, like the model and rigging queues. Without it an avatar
        task that reliably crashes or hangs the worker (an OOM loading the SMPL-X model body,
        say) was reset to PENDING by the stale sweep every 15 minutes forever and — because the
        claim orders by ``created_at ASC`` and that column never changes — re-claimed ahead of
        every newer request each cycle, so one poison task starved avatar generation entirely.
        """
        conn = self.get_connection()
        cursor = conn.cursor(dictionary=True)
        try:
            conn.start_transaction()
            cursor.execute("""
                SELECT id, user_id, input_payload, attempt_count
                FROM avatar_generation_tasks
                WHERE status = 'PENDING'
                  AND COALESCE(attempt_count, 0) < %s
                ORDER BY created_at ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            """, (self.MAX_ATTEMPTS,))
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

    def reclaim_stale_tasks(self) -> int:
        """Reset RUNNING avatar tasks stuck >15 minutes back to PENDING.

        Capped at ``MAX_ATTEMPTS``, mirroring ``TaskQueue`` and ``RiggingTaskQueue``. This
        queue had been left out of that fix: an avatar task that takes the worker down every
        time it is claimed was reset to PENDING here forever, and re-claimed at the head of the
        queue on each cycle, starving every newer avatar request indefinitely. Over the cap the
        task is failed instead, which is a terminal state a human can see.

        Staleness is measured from ``updated_at``, which :meth:`heartbeat` refreshes during a
        long run, so a slow job is not mistaken for an abandoned one.

        Returns the number of tasks reclaimed (not those failed for exceeding the cap).
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                UPDATE avatar_generation_tasks
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
                UPDATE avatar_generation_tasks
                SET status = 'PENDING'
                WHERE status = 'RUNNING'
                  AND updated_at < NOW() - INTERVAL 15 MINUTE
                  AND COALESCE(attempt_count, 0) < %s
            """, (self.MAX_ATTEMPTS,))
            reclaimed = cursor.rowcount
            conn.commit()

            if exhausted > 0:
                logger.error(
                    f"Failed {exhausted} stale avatar task(s) that had already used all "
                    f"{self.MAX_ATTEMPTS} attempts — they are poison and need investigation"
                )
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
