"""
Celery application configuration.
Owner: Person B

This module creates and configures the Celery application instance.
All Celery tasks must be discovered here so that the worker process
can find them automatically.

Usage:
    Start worker:
        celery -A app.workers.celery_app worker --loglevel=info

    Inspect:
        celery -A app.workers.celery_app inspect active
"""

from celery import Celery

from app.config import settings

# ── Celery app instance ──────────────────────────────────────────────────────
celery_app = Celery(
    "ai_resume_screening",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        # Register task modules here so the worker discovers them on startup.
        # Person B owns:
        "app.workers.parse_task",
        # Person C will add:
        # "app.workers.extract_task",
        # "app.workers.score_task",
    ],
)

# ── Configuration ────────────────────────────────────────────────────────────
celery_app.conf.update(
    # Serialisation
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # Timezone
    timezone="UTC",
    enable_utc=True,

    # Result expiry — keep results for 24 hours then auto-expire from Redis
    result_expires=86_400,

    # Task routing: default queue is "default"; "parse" queue for parsing tasks
    task_default_queue="default",
    task_queues={
        "default": {},
        "parse": {},
    },
    task_routes={
        "app.workers.parse_task.parse_cv_task": {"queue": "parse"},
    },

    # Retry policy defaults
    task_acks_late=True,           # ACK after task completes, not before
    worker_prefetch_multiplier=1,  # One task at a time per worker process

    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
)
