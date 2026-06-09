import os
import sys

# Ensure parent directory is in sys.path to allow absolute imports of 'backend'
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from celery import Celery
from backend.config import settings


celery_app = Celery(
    "hr_recruitment",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["backend.tasks.pipeline_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    beat_schedule={
        "check-engagement-deadlines": {
            "task": "backend.tasks.pipeline_tasks.check_engagement_deadline_task",
            "schedule": 3600.0,  # Every hour
        },
    },
)
