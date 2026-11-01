"""
Pipeline dispatcher — one entry point for queueing parse / extract / score work.

    PIPELINE_MODE=celery  → tasks are sent to Celery workers through Redis.
    PIPELINE_MODE=inline  → tasks run one at a time on a background asyncio
                            consumer inside the API process (no Redis needed).

All functions here are synchronous and thread-safe, so they can be called from
the API (via asyncio.to_thread), from Celery tasks or from inline coroutines.

Task chain:  upload → parse_cv_task → extract_info_task
             POST /matching/run → score_match_task (one per CV)
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

PARSE_TASK = "app.workers.parse_task.parse_cv_task"
EXTRACT_TASK = "app.workers.extract_task.extract_info_task"
SCORE_TASK = "app.workers.score_task.score_match_task"

QUEUES = {PARSE_TASK: "parse", EXTRACT_TASK: "extract", SCORE_TASK: "score"}


# ── Inline runner ───────────────────────────────────────────
class InlineRunner:
    """Single-consumer asyncio queue; sequential execution keeps SQLite writes safe."""

    def __init__(self) -> None:
        self._loop: asyncio.AbstractEventLoop | None = None
        self._queue: asyncio.Queue[tuple[str, tuple[Any, ...]]] | None = None
        self._consumer: asyncio.Task[None] | None = None

    def start(self, loop: asyncio.AbstractEventLoop | None = None) -> None:
        loop = loop or asyncio.get_running_loop()
        if self._loop is loop and self._consumer and not self._consumer.done():
            return
        self._loop = loop
        self._queue = asyncio.Queue()
        self._consumer = loop.create_task(self._consume(), name="inline-pipeline")

    async def stop(self) -> None:
        if self._consumer:
            self._consumer.cancel()
            try:
                await self._consumer
            except asyncio.CancelledError:
                pass
        self._consumer = None
        self._loop = None
        self._queue = None

    async def join(self) -> None:
        """Wait until every queued task has finished (used by tests)."""
        if self._queue is not None:
            await self._queue.join()

    def submit(self, task_name: str, args: tuple[Any, ...]) -> None:
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None

        if self._loop is None or self._loop.is_closed():
            if running is None:
                logger.warning("Inline pipeline is not running; dropped %s%s", task_name, args)
                return
            self.start(running)

        assert self._loop is not None and self._queue is not None
        if running is self._loop:
            self._queue.put_nowait((task_name, args))
        else:
            self._loop.call_soon_threadsafe(self._queue.put_nowait, (task_name, args))

    async def _consume(self) -> None:
        assert self._queue is not None
        while True:
            task_name, args = await self._queue.get()
            try:
                await _resolve(task_name)(*args)
            except Exception:  # noqa: BLE001 — one failed CV must not stop the consumer
                logger.exception("Inline task %s%s failed", task_name, args)
            finally:
                self._queue.task_done()


def _resolve(task_name: str) -> Callable[..., Awaitable[Any]]:
    # Deferred imports: task modules import services that import this module.
    if task_name == PARSE_TASK:
        from app.workers.parse_task import _process_cv_parsing

        return _process_cv_parsing
    if task_name == EXTRACT_TASK:
        from app.workers.extract_task import process_extraction

        return process_extraction
    if task_name == SCORE_TASK:
        from app.workers.score_task import process_scoring

        return process_scoring
    raise ValueError(f"Unknown task {task_name}")


inline_runner = InlineRunner()


# ── Public API ──────────────────────────────────────────────
def _dispatch(task_name: str, *args: Any) -> None:
    if settings.PIPELINE_MODE.lower() == "inline":
        inline_runner.submit(task_name, args)
        return

    from app.workers.celery_app import celery_app

    celery_app.send_task(task_name, args=list(args), queue=QUEUES[task_name])
    logger.info("Sent %s%s to Celery queue '%s'.", task_name, args, QUEUES[task_name])


def enqueue_parse(cv_id: int) -> None:
    _dispatch(PARSE_TASK, cv_id)


def enqueue_extract(cv_id: int) -> None:
    _dispatch(EXTRACT_TASK, cv_id)


def enqueue_score(job_id: int, cv_id: int) -> None:
    _dispatch(SCORE_TASK, job_id, cv_id)
