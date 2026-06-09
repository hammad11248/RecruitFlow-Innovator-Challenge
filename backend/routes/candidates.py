"""
Candidates API routes — upload CV, list, get details.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from backend.services import firestore_service, storage_service
from backend.tasks.pipeline_tasks import build_pipeline_chain

router = APIRouter(tags=["Candidates"])


# ---------------------------------------------------------------------------
# POST /api/candidates/upload
# ---------------------------------------------------------------------------

@router.post("/candidates/upload")
async def upload_candidate(
    file: UploadFile = File(...),
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    jobId: str = Form(...),
):
    """
    Upload a candidate CV (PDF/DOCX).
    1. Validates file
    2. Uploads to Firebase Storage at cvs/{candidateId}/{filename}
    3. Creates Firestore candidate document with status UPLOADED
    4. Dispatches Celery pipeline task chain
    5. Returns { candidateId, status: "PROCESSING" }
    """
    file_bytes = await file.read()
    filename = file.filename or "cv.pdf"

    validation_error = storage_service.validate_cv_file(filename, len(file_bytes))
    if validation_error:
        raise HTTPException(status_code=400, detail=validation_error)

    candidate_id = str(uuid.uuid4())

    content_type = file.content_type or "application/octet-stream"
    storage_path, download_url = await storage_service.upload_cv(
        file_bytes=file_bytes,
        candidate_id=candidate_id,
        filename=filename,
        content_type=content_type,
    )

    candidate_data = {
        "name": name,
        "email": email,
        "phone": phone,
        "jobId": jobId,
        "cvStoragePath": storage_path,
        "cvDownloadUrl": download_url,
        "status": "UPLOADED",
        "screeningScore": 0,
        "compositeScore": 0,
        "assessmentToken": "",
        "assessmentScore": 0,
        "assessmentSentAt": None,
        "assessmentSubmittedAt": None,
        "interviewScheduledAt": None,
    }

    await firestore_service.create_candidate(candidate_id, candidate_data)

    try:
        pipeline = build_pipeline_chain(candidate_id)
        pipeline.apply_async()
    except Exception as e:
        import logging
        import threading
        from backend.tasks.pipeline_tasks import parse_cv_task, screening_decision_task, send_assessment_email_task, notify_hr_task
        
        logging.getLogger(__name__).warning(f"Could not dispatch to Celery (Redis down?): {e}. Running pipeline in local thread fallback.")
        
        def run_fallback():
            try:
                # Execute in sequence like Celery chain
                parse_cv_task(candidate_id)
                screening_decision_task(candidate_id)
                send_assessment_email_task(candidate_id)
                notify_hr_task(candidate_id)
            except Exception as fe:
                logging.getLogger(__name__).error(f"Fallback pipeline failed for {candidate_id}: {fe}")
                
        threading.Thread(target=run_fallback, daemon=True).start()

    return {
        "candidateId": candidate_id,
        "status": "PROCESSING",
        "message": "CV uploaded successfully. Processing pipeline started (using fallback thread if Celery is down).",
    }



# ---------------------------------------------------------------------------
# GET /api/candidates
# ---------------------------------------------------------------------------

@router.get("/candidates")
async def list_candidates(
    status: Optional[str] = Query(None, description="Filter by status"),
    minScore: Optional[float] = Query(None, description="Minimum composite score"),
    maxScore: Optional[float] = Query(None, description="Maximum composite score"),
    jobId: Optional[str] = Query(None, description="Filter by job ID"),
    dateFrom: Optional[str] = Query(None, description="Filter from date (ISO format)"),
    dateTo: Optional[str] = Query(None, description="Filter to date (ISO format)"),
    orderBy: str = Query("createdAt", description="Field to order by"),
    limit: int = Query(50, description="Max results", ge=1, le=200),
):
    """
    List candidates with optional filters, querying Firestore directly.
    """
    date_from = None
    date_to = None
    if dateFrom:
        date_from = datetime.fromisoformat(dateFrom)
    if dateTo:
        date_to = datetime.fromisoformat(dateTo)

    candidates = await firestore_service.list_candidates(
        status=status,
        min_score=minScore,
        max_score=maxScore,
        job_id=jobId,
        date_from=date_from,
        date_to=date_to,
        order_by=orderBy,
        limit=limit,
    )

    return {"candidates": candidates, "count": len(candidates)}


# ---------------------------------------------------------------------------
# GET /api/candidates/{candidate_id}
# ---------------------------------------------------------------------------

@router.get("/candidates/{candidate_id}")
async def get_candidate(candidate_id: str):
    """Fetch full candidate document from Firestore."""
    candidate = await firestore_service.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


# ---------------------------------------------------------------------------
# GET /api/jobs
# ---------------------------------------------------------------------------

@router.get("/jobs")
async def list_jobs(
    active_only: bool = Query(True, description="Only return active jobs"),
):
    """List all jobs."""
    jobs = await firestore_service.list_jobs(active_only=active_only)
    return {"jobs": jobs, "count": len(jobs)}


# ---------------------------------------------------------------------------
# POST /api/jobs
# ---------------------------------------------------------------------------

@router.post("/jobs")
async def create_job(job_data: dict):
    """Create a new job posting."""
    job_id = await firestore_service.create_job(job_data)
    return {"jobId": job_id, "message": "Job created successfully"}


# ---------------------------------------------------------------------------
# GET /api/jobs/{job_id}
# ---------------------------------------------------------------------------

@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Fetch a single job document."""
    job = await firestore_service.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ---------------------------------------------------------------------------
# GET /api/mock/cv/{storage_path:path} (Fallback for Offline Mock Mode)
# ---------------------------------------------------------------------------

from fastapi.responses import Response

@router.get("/mock/cv/{storage_path:path}")
async def get_mock_cv(storage_path: str):
    """Retrieve CV file bytes in mock mode."""
    from backend.firebase_admin_init import MOCK_MODE
    if not MOCK_MODE:
        raise HTTPException(status_code=400, detail="Mock mode is not active")
    
    from backend.firebase_admin_init_mock import mock_store
    file_bytes = mock_store._get_file(storage_path)
    if not file_bytes:
        raise HTTPException(status_code=404, detail="CV file not found")
        
    return Response(content=file_bytes, media_type="application/pdf")
