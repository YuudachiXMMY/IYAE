"""Plumbing shared by the three MySQL task queues (model, avatar, rigging).

The three queues already shared the claim / complete / fail shape, and ``heartbeat`` had been
copied into each of them verbatim — same body, same docstring, differing only in the table
name. Three copies of a correctness fix drift apart; subclasses now declare ``TABLE`` and
inherit one implementation.
"""
import logging
import mysql.connector
from mysql.connector import Error

logger = logging.getLogger(__name__)


class TaskQueueBase:
    """Connection handling, the attempt cap and the staleness heartbeat."""

    #: Name of this queue's MySQL table. Subclasses must set it. Interpolated into SQL, so it
    #: must stay a class constant — never a value derived from a task payload or the
    #: environment.
    TABLE: str = None

    #: Hard cap on how many times a task may be attempted. Shared by the retry paths and the
    #: stale sweep so a poison task cannot be recycled forever at the head of the queue,
    #: starving every real task behind it.
    MAX_ATTEMPTS = 3

    def __init__(self, db_config: dict):
        self.db_config = db_config

    def get_connection(self):
        return mysql.connector.connect(**self.db_config)

    def heartbeat(self, task_id: int) -> None:
        """Push out a RUNNING task's staleness clock.

        ``reclaim_stale_tasks`` decides staleness from ``updated_at``, which nothing refreshed
        during a run — so a job that legitimately outlives the 15-minute threshold was
        reclaimed and handed to a second claimant while the first was still working on it, and
        both then wrote output for the same task. ``main.py`` holds a heartbeat thread open for
        the duration of ``provider.generate()``, so "stale" means "the worker is gone" rather
        than "the job is slow".
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                f"""
                UPDATE {self.TABLE}
                SET updated_at = NOW()
                WHERE id = %s AND status = 'RUNNING'
            """,
                (task_id,),
            )
            conn.commit()
        except Error as e:
            logger.warning(f"Heartbeat for task {task_id} failed: {e}")
            conn.rollback()
        finally:
            cursor.close()
            conn.close()
