"""
Candidates API routes — upload CV, list, get details.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, Depends

from backend.services import firestore_service, storage_service
from backend.routes.auth import verify_firebase_token, require_hr_user

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
        from backend.services import task_queue_service
        await task_queue_service.enqueue("process-cv", {"candidate_id": candidate_id})
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Could not enqueue process-cv task: %s", e)

    return {
        "candidateId": candidate_id,
        "status": "PROCESSING",
        "message": "CV uploaded successfully. Processing pipeline started.",
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
    user: dict = Depends(require_hr_user),
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
async def get_candidate(candidate_id: str, user: dict = Depends(verify_firebase_token)):
    """Fetch full candidate document from Firestore."""
    candidate = await firestore_service.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


# ---------------------------------------------------------------------------
# GET /api/candidate/lookup
# ---------------------------------------------------------------------------

@router.get("/candidate/lookup")
async def lookup_candidate(email: str = Query(..., description="Candidate email to look up")):
    """
    Look up a candidate by email and return their ID.
    Access is public so candidates can access their portal links.
    """
    candidate = await firestore_service.get_candidate_by_email(email)
    if not candidate:
        raise HTTPException(status_code=404, detail="No application found with this email.")
    return {
        "candidateId": candidate["id"],
        "name": candidate.get("name"),
        "status": candidate.get("status")
    }


# ---------------------------------------------------------------------------
# GET /api/jobs
# ---------------------------------------------------------------------------

@router.get("/jobs")
async def list_jobs(
    active_only: bool = Query(True, description="Only return active jobs"),
):
    """List jobs for the public application form and authenticated views."""
    jobs = await firestore_service.list_jobs(active_only=active_only)
    return {"jobs": jobs, "count": len(jobs)}


# ---------------------------------------------------------------------------
# POST /api/jobs
# ---------------------------------------------------------------------------

@router.post("/jobs")
async def create_job(job_data: dict, user: dict = Depends(require_hr_user)):
    """Create a new job posting."""
    job_id = await firestore_service.create_job(job_data)
    return {"jobId": job_id, "message": "Job created successfully"}


# ---------------------------------------------------------------------------
# GET /api/jobs/{job_id}
# ---------------------------------------------------------------------------

@router.get("/jobs/{job_id}")
async def get_job(job_id: str, user: dict = Depends(verify_firebase_token)):
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


# ---------------------------------------------------------------------------
# POST /api/candidates/bulk-import
# ---------------------------------------------------------------------------

from pydantic import BaseModel

class BulkCandidateImport(BaseModel):
    id: str
    job_id: str
    email: str
    full_name: str
    cv_text: Optional[str] = None
    scores: Optional[dict] = None
    funnel_status: str = "SCREENING_PENDING"

@router.post("/candidates/bulk-import", status_code=201)
async def bulk_import_candidates(candidates: list[BulkCandidateImport]):
    """
    Bulk import candidates from JSON payload.
    Bypasses Gemini CV parser to allow fast, rate-limit-free uploads.
    """
    from backend.firebase_admin_init import db
    
    mapped_candidates = {}
    for cand in candidates:
        scores = cand.scores or {}
        d1 = float(scores.get("technical_skills", 0.0))
        d2 = float(scores.get("experience", 0.0))
        d4 = float(scores.get("communication", 0.0))
        d5 = float(scores.get("cultural_fit", 0.0))
        
        w1 = 0.30
        w2 = 0.20
        w4 = 0.10
        w5 = 0.10
        total_w = w1 + w2 + w4 + w5
        partial_composite = 0.0
        if total_w > 0:
            partial_composite = (d1 * w1 + d2 * w2 + d4 * w4 + d5 * w5) / total_w
            
        candidate_data = {
            "name": cand.full_name,
            "email": cand.email,
            "phone": "",
            "jobId": cand.job_id,
            "status": cand.funnel_status,
            "cvText": cand.cv_text or "",
            "screeningScore": round(partial_composite, 2),
            "compositeScore": round(partial_composite, 2),
            "scoreDimensions": {
                "technicalSkills": {
                    "dimension": "D1",
                    "label": "Technical Skills Match",
                    "weight": w1,
                    "rawScore": d1,
                    "weightedScore": round(d1 * w1, 2),
                    "rationale": "Imported via bulk import",
                },
                "experienceSeniority": {
                    "dimension": "D2",
                    "label": "Experience & Seniority",
                    "weight": w2,
                    "rawScore": d2,
                    "weightedScore": round(d2 * w2, 2),
                    "rationale": "Imported via bulk import",
                },
                "cvQuality": {
                    "dimension": "D4",
                    "label": "CV Quality & Communication",
                    "weight": w4,
                    "rawScore": d4,
                    "weightedScore": round(d4 * w4, 2),
                    "rationale": "Imported via bulk import",
                },
                "culturalFit": {
                    "dimension": "D5",
                    "label": "Cultural & Role Fit",
                    "weight": w5,
                    "rawScore": d5,
                    "weightedScore": round(d5 * w5, 2),
                    "rationale": "Imported via bulk import",
                }
            },
            "createdAt": datetime.utcnow(),
            "stateHistory": [
                {"state": "UPLOADED", "timestamp": datetime.utcnow(), "meta": {}},
                {"state": cand.funnel_status, "timestamp": datetime.utcnow(), "meta": {}},
            ],
            "assessmentToken": "",
            "assessmentScore": 0.0,
            "assessmentSentAt": None,
            "assessmentSubmittedAt": None,
            "interviewScheduledAt": None,
        }
        mapped_candidates[cand.id] = candidate_data
        
    is_mock = hasattr(db, "store")
    imported_count = len(candidates)
    
    if is_mock:
        store = db.store
        old_save = store._save
        store._save = lambda *args, **kwargs: None
        try:
            for cand_id, data in mapped_candidates.items():
                db.collection("candidates").document(cand_id).set(data)
        finally:
            store._save = old_save
            store._save()
    else:
        chunk_size = 500
        cand_items = list(mapped_candidates.items())
        for i in range(0, len(cand_items), chunk_size):
            batch = db.batch()
            chunk = cand_items[i : i + chunk_size]
            for cand_id, data in chunk:
                doc_ref = db.collection("candidates").document(cand_id)
                batch.set(doc_ref, data)
            batch.commit()
            
    return {
        "message": f"Successfully imported {imported_count} candidates.",
        "count": imported_count
    }
