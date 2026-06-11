"""
Firestore CRUD service — all database operations for candidates, assessments,
jobs, and hr_users collections. Uses asyncio.run_in_executor for non-blocking
calls inside FastAPI async endpoints.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from functools import partial
from typing import Any, Optional

from firebase_admin import firestore as firestore_module
from google.cloud.firestore_v1.base_query import FieldFilter

from backend.firebase_admin_init import db


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _run_sync(func, *args, **kwargs):
    """Run a synchronous Firestore SDK call in a thread executor."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(func, *args, **kwargs))


def _serialize_doc(doc_snapshot) -> dict[str, Any]:
    """Convert a Firestore document snapshot to a dict with its ID."""
    data = doc_snapshot.to_dict() or {}
    data["id"] = doc_snapshot.id
    return data


# ---------------------------------------------------------------------------
# Candidates Collection
# ---------------------------------------------------------------------------

CANDIDATES_COL = "candidates"


async def create_candidate(candidate_id: str, data: dict[str, Any]) -> str:
    """Create a new candidate document with explicit ID."""
    data["createdAt"] = datetime.utcnow()
    data["stateHistory"] = [
        {"state": "UPLOADED", "timestamp": datetime.utcnow(), "meta": {}}
    ]
    ref = db.collection(CANDIDATES_COL).document(candidate_id)
    await _run_sync(ref.set, data, merge=True)
    return candidate_id


async def get_candidate(candidate_id: str) -> Optional[dict[str, Any]]:
    """Fetch a single candidate document by ID."""
    ref = db.collection(CANDIDATES_COL).document(candidate_id)
    doc = await _run_sync(ref.get)
    if not doc.exists:
        return None
    return _serialize_doc(doc)


async def update_candidate(candidate_id: str, data: dict[str, Any]) -> None:
    """Update fields on an existing candidate document."""
    ref = db.collection(CANDIDATES_COL).document(candidate_id)
    await _run_sync(ref.update, data)


async def append_state_history(
    candidate_id: str,
    state: str,
    meta: Optional[dict] = None,
) -> None:
    """Append a new state entry to the candidate's stateHistory using ArrayUnion."""
    entry = {
        "state": state,
        "timestamp": datetime.utcnow(),
        "meta": meta or {},
    }
    ref = db.collection(CANDIDATES_COL).document(candidate_id)
    await _run_sync(
        ref.update,
        {"stateHistory": firestore_module.ArrayUnion([entry])},
    )


async def list_candidates(
    status: Optional[str] = None,
    min_score: Optional[float] = None,
    max_score: Optional[float] = None,
    job_id: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    order_by: str = "createdAt",
    limit: int = 50,
) -> list[dict[str, Any]]:
    """List candidates with in-memory filters to avoid requiring Firestore composite indexes."""
    query = db.collection(CANDIDATES_COL)
    docs = await _run_sync(query.get)
    candidates = [_serialize_doc(doc) for doc in docs]

    # Apply filters in memory
    if status:
        candidates = [c for c in candidates if c.get("status") == status]
    if job_id:
        candidates = [c for c in candidates if c.get("jobId") == job_id]
    if min_score is not None:
        candidates = [c for c in candidates if c.get("compositeScore", 0) >= min_score]
    if max_score is not None:
        candidates = [c for c in candidates if c.get("compositeScore", 0) <= max_score]
    if date_from:
        candidates = [c for c in candidates if c.get("createdAt") and c.get("createdAt") >= date_from]
    if date_to:
        candidates = [c for c in candidates if c.get("createdAt") and c.get("createdAt") <= date_to]

    # Sort in memory
    candidates.sort(key=lambda c: c.get(order_by) or (datetime.min if order_by == "createdAt" else 0), reverse=True)
    
    # Limit results
    return candidates[:limit]


async def delete_candidate(candidate_id: str) -> None:
    """Delete a candidate document."""
    ref = db.collection(CANDIDATES_COL).document(candidate_id)
    await _run_sync(ref.delete)


# ---------------------------------------------------------------------------
# Assessments Collection
# ---------------------------------------------------------------------------

ASSESSMENTS_COL = "assessments"


async def create_assessment(token: str, data: dict[str, Any]) -> str:
    """Create an assessment document keyed by token."""
    data["createdAt"] = datetime.utcnow()
    ref = db.collection(ASSESSMENTS_COL).document(token)
    await _run_sync(ref.set, data)
    return token


async def get_assessment(token: str) -> Optional[dict[str, Any]]:
    """Fetch an assessment document by token."""
    ref = db.collection(ASSESSMENTS_COL).document(token)
    doc = await _run_sync(ref.get)
    if not doc.exists:
        return None
    return _serialize_doc(doc)


async def update_assessment(token: str, data: dict[str, Any]) -> None:
    """Update fields on an existing assessment document."""
    ref = db.collection(ASSESSMENTS_COL).document(token)
    await _run_sync(ref.update, data)


# ---------------------------------------------------------------------------
# Jobs Collection
# ---------------------------------------------------------------------------

JOBS_COL = "jobs"


async def create_job(data: dict[str, Any]) -> str:
    """Create a new job document with auto-generated ID."""
    data["createdAt"] = datetime.utcnow()
    ref = db.collection(JOBS_COL).document()
    await _run_sync(ref.set, data)
    return ref.id


async def get_job(job_id: str) -> Optional[dict[str, Any]]:
    """Fetch a single job document by ID."""
    ref = db.collection(JOBS_COL).document(job_id)
    doc = await _run_sync(ref.get)
    if not doc.exists:
        return None
    return _serialize_doc(doc)


async def list_jobs(active_only: bool = True) -> list[dict[str, Any]]:
    """List all jobs, optionally filtering to active only using in-memory sort/filter."""
    query = db.collection(JOBS_COL)
    docs = await _run_sync(query.get)
    jobs = [_serialize_doc(doc) for doc in docs]
    
    if active_only:
        jobs = [j for j in jobs if j.get("isActive") is True]
        
    jobs.sort(key=lambda j: j.get("createdAt") or datetime.min, reverse=True)
    return jobs


async def update_job(job_id: str, data: dict[str, Any]) -> None:
    """Update fields on an existing job document."""
    ref = db.collection(JOBS_COL).document(job_id)
    await _run_sync(ref.update, data)


# ---------------------------------------------------------------------------
# HR Users Collection
# ---------------------------------------------------------------------------

HR_USERS_COL = "hr_users"


async def get_hr_user(uid: str) -> Optional[dict[str, Any]]:
    """Fetch an HR user profile by Firebase Auth UID."""
    ref = db.collection(HR_USERS_COL).document(uid)
    doc = await _run_sync(ref.get)
    if not doc.exists:
        return None
    return _serialize_doc(doc)


async def create_hr_user(uid: str, data: dict[str, Any]) -> str:
    """Create or set an HR user profile document."""
    ref = db.collection(HR_USERS_COL).document(uid)
    await _run_sync(ref.set, data, merge=True)
    return uid


# ---------------------------------------------------------------------------
# Errors Collection
# ---------------------------------------------------------------------------

ERRORS_COL = "errors"


async def log_task_error(
    task_id: str,
    candidate_id: str,
    error_message: str,
    task_name: str,
    traceback_str: str = "",
) -> None:
    """Log a Celery task failure to the errors collection."""
    ref = db.collection(ERRORS_COL).document(task_id)
    await _run_sync(ref.set, {
        "taskId": task_id,
        "candidateId": candidate_id,
        "taskName": task_name,
        "errorMessage": error_message,
        "traceback": traceback_str,
        "createdAt": datetime.utcnow(),
    })


# ---------------------------------------------------------------------------
# Sync wrappers (for Celery tasks running outside async context)
# ---------------------------------------------------------------------------

def sync_get_candidate(candidate_id: str) -> Optional[dict[str, Any]]:
    """Synchronous version for Celery tasks."""
    ref = db.collection(CANDIDATES_COL).document(candidate_id)
    doc = ref.get()
    if not doc.exists:
        return None
    return _serialize_doc(doc)


def sync_update_candidate(candidate_id: str, data: dict[str, Any]) -> None:
    """Synchronous update for Celery tasks."""
    ref = db.collection(CANDIDATES_COL).document(candidate_id)
    ref.update(data)


def sync_append_state_history(
    candidate_id: str,
    state: str,
    meta: Optional[dict] = None,
) -> None:
    """Synchronous state history append for Celery tasks."""
    entry = {
        "state": state,
        "timestamp": datetime.utcnow(),
        "meta": meta or {},
    }
    ref = db.collection(CANDIDATES_COL).document(candidate_id)
    ref.update({"stateHistory": firestore_module.ArrayUnion([entry])})


def sync_get_assessment(token: str) -> Optional[dict[str, Any]]:
    """Synchronous assessment fetch for Celery tasks."""
    ref = db.collection(ASSESSMENTS_COL).document(token)
    doc = ref.get()
    if not doc.exists:
        return None
    return _serialize_doc(doc)


def sync_update_assessment(token: str, data: dict[str, Any]) -> None:
    """Synchronous assessment update for Celery tasks."""
    ref = db.collection(ASSESSMENTS_COL).document(token)
    ref.update(data)


def sync_create_assessment(token: str, data: dict[str, Any]) -> str:
    """Synchronous assessment creation for Celery tasks."""
    data["createdAt"] = datetime.utcnow()
    ref = db.collection(ASSESSMENTS_COL).document(token)
    ref.set(data)
    return token


def sync_get_job(job_id: str) -> Optional[dict[str, Any]]:
    """Synchronous job fetch for Celery tasks."""
    ref = db.collection(JOBS_COL).document(job_id)
    doc = ref.get()
    if not doc.exists:
        return None
    return _serialize_doc(doc)


def sync_log_task_error(
    task_id: str,
    candidate_id: str,
    error_message: str,
    task_name: str,
    traceback_str: str = "",
) -> None:
    """Synchronous error logging for Celery tasks."""
    ref = db.collection(ERRORS_COL).document(task_id)
    ref.set({
        "taskId": task_id,
        "candidateId": candidate_id,
        "taskName": task_name,
        "errorMessage": error_message,
        "traceback": traceback_str,
        "createdAt": datetime.utcnow(),
    })


def sync_list_candidates_by_status(status: str) -> list[dict[str, Any]]:
    """Synchronous candidate listing by status for Celery periodic tasks."""
    query = db.collection(CANDIDATES_COL).where(
        filter=FieldFilter("status", "==", status)
    )
    docs = query.get()
    return [_serialize_doc(doc) for doc in docs]


async def get_candidate_by_email(email: str) -> Optional[dict[str, Any]]:
    """Fetch candidate document by email."""
    query = db.collection(CANDIDATES_COL)
    docs = await _run_sync(query.get)
    for doc in docs:
        c = _serialize_doc(doc)
        if c.get("email") and c.get("email").strip().lower() == email.strip().lower():
            return c
    return None
