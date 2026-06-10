import asyncio
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Queue to hold the tasks as tuples of (task_name, payload)
_queue: asyncio.Queue[tuple[str, dict[str, Any]]] = asyncio.Queue()
_worker_task: asyncio.Task | None = None
_periodic_task: asyncio.Task | None = None

async def _process_task_immediately(task_name: str, payload: dict[str, Any]):
    """Process pipeline tasks immediately and synchronously (for Vercel serverless environment)."""
    from backend.tasks.pipeline_tasks import (
        parse_cv_task,
        screening_decision_task,
        send_assessment_email_task,
        notify_hr_task,
        evaluate_assessment_task,
    )
    from backend.services.firestore_service import get_candidate

    logger.info(f"Vercel Serverless: Processing task '{task_name}' immediately and synchronously.")
    try:
        if task_name == "process-cv":
            candidate_id = payload.get("candidate_id")
            if candidate_id:
                # Step 1: Parse CV
                await parse_cv_task(candidate_id)
                # Step 2: Screening Decision
                await screening_decision_task(candidate_id)
                
                # Check if passed or failed to route next step
                candidate = await get_candidate(candidate_id)
                if candidate and candidate.get("status") == "AI_SCREENING_PASSED":
                    await _process_task_immediately("send-email", {"candidate_id": candidate_id})
                else:
                    await notify_hr_task(candidate_id)
        
        elif task_name == "send-email":
            candidate_id = payload.get("candidate_id")
            if candidate_id:
                # Step 3: Send Assessment Email
                await send_assessment_email_task(candidate_id)
                # Step 4: Notify HR
                await notify_hr_task(candidate_id)
        
        elif task_name == "score-candidate":
            token = payload.get("token")
            if token:
                await evaluate_assessment_task(token)
        else:
            logger.warning(f"Unknown/unsupported immediate task name: {task_name}")
    except Exception as e:
        logger.error(f"Error executing immediate task {task_name}: {e}", exc_info=True)

async def enqueue(task_name: str, payload: dict[str, Any]):
    """Enqueue a task to the background queue or process immediately if on Vercel."""
    logger.info(f"Enqueuing task: {task_name} with payload: {payload}")
    import os
    if os.getenv("VERCEL") == "1":
        await _process_task_immediately(task_name, payload)
    else:
        await _queue.put((task_name, payload))

async def _worker_loop():
    """Background worker loop that processes tasks from the queue."""
    from backend.tasks.pipeline_tasks import (
        parse_cv_task,
        screening_decision_task,
        send_assessment_email_task,
        notify_hr_task,
        evaluate_assessment_task,
    )
    from backend.services.firestore_service import get_candidate

    logger.info("Background task queue worker started.")
    while True:
        try:
            task_name, payload = await _queue.get()
            logger.info(f"Processing task: {task_name} with payload: {payload}")
            
            try:
                if task_name == "process-cv":
                    candidate_id = payload.get("candidate_id")
                    if candidate_id:
                        # Step 1: Parse CV
                        await parse_cv_task(candidate_id)
                        # Step 2: Screening Decision
                        await screening_decision_task(candidate_id)
                        
                        # Check if passed or failed to route next step
                        candidate = await get_candidate(candidate_id)
                        if candidate and candidate.get("status") == "AI_SCREENING_PASSED":
                            await enqueue("send-email", {"candidate_id": candidate_id})
                        else:
                            await notify_hr_task(candidate_id)
                
                elif task_name == "send-email":
                    candidate_id = payload.get("candidate_id")
                    if candidate_id:
                        # Step 3: Send Assessment Email
                        await send_assessment_email_task(candidate_id)
                        # Step 4: Notify HR
                        await notify_hr_task(candidate_id)
                
                elif task_name == "score-candidate":
                    token = payload.get("token")
                    if token:
                        await evaluate_assessment_task(token)
                        
                else:
                    logger.warning(f"Unknown task name: {task_name}")
            except Exception as e:
                logger.error(f"Error executing task {task_name}: {e}", exc_info=True)
            finally:
                _queue.task_done()
        except asyncio.CancelledError:
            logger.info("Worker loop cancelled.")
            break
        except Exception as e:
            logger.error(f"Error in worker loop: {e}", exc_info=True)
            await asyncio.sleep(1)

async def _periodic_deadline_checker():
    """Periodic task to check candidate engagement deadlines (runs every 10 minutes)."""
    from backend.tasks.pipeline_tasks import check_engagement_deadline_task
    logger.info("Periodic deadline checker loop started.")
    while True:
        try:
            await asyncio.sleep(600)  # Check every 10 minutes
            logger.info("Running periodic engagement deadline check...")
            await check_engagement_deadline_task()
        except asyncio.CancelledError:
            logger.info("Periodic deadline checker loop cancelled.")
            break
        except Exception as e:
            logger.error(f"Error in periodic deadline checker: {e}", exc_info=True)

def start_worker():
    """Start the background worker tasks."""
    global _worker_task, _periodic_task
    if _worker_task is None:
        _worker_task = asyncio.create_task(_worker_loop())
    if _periodic_task is None:
        _periodic_task = asyncio.create_task(_periodic_deadline_checker())

async def stop_worker():
    """Stop the background worker tasks and wait for queue to drain."""
    global _worker_task, _periodic_task
    logger.info("Stopping background task queue worker...")
    
    # Wait for remaining tasks in the queue to be completed
    if _queue.qsize() > 0:
        logger.info(f"Draining {_queue.qsize()} tasks in the queue...")
        try:
            await asyncio.wait_for(_queue.join(), timeout=10.0)
        except asyncio.TimeoutError:
            logger.warning("Timeout waiting for queue to drain.")
            
    if _worker_task:
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
        _worker_task = None
        
    if _periodic_task:
        _periodic_task.cancel()
        try:
            await _periodic_task
        except asyncio.CancelledError:
            pass
        _periodic_task = None
        
    logger.info("Background task queue worker stopped.")
