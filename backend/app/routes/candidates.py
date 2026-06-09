import io
import uuid
import asyncio
import pypdf
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, Request
from typing import Optional, List
from pydantic import BaseModel
from backend.firebase_admin_init import db
from backend.app.models.candidate import CandidateApplication, ScoreRubric

router = APIRouter(tags=["Candidates Ingestion"])
executor = ThreadPoolExecutor()

def extract_pdf_text(file_bytes: bytes) -> str:
    try:
        pdf = pypdf.PdfReader(io.BytesIO(file_bytes))
        text_parts = []
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        return "\n\n".join(text_parts)
    except Exception as e:
        raise ValueError(f"Failed to read PDF pages: {e}")

async def extract_pdf_text_async(file_bytes: bytes) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(executor, extract_pdf_text, file_bytes)

@router.post("/candidates/upload", status_code=201, response_model=CandidateApplication)
async def upload_candidate(
    request: Request,
    file: Optional[UploadFile] = File(None),
    job_id: Optional[str] = Form(None, alias="jobId"),
    email: Optional[str] = Form(None),
    full_name: Optional[str] = Form(None, alias="name"),
):
    content_type = request.headers.get("content-type", "")
    
    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON body: {e}")
        
        job_id = body.get("jobId") or body.get("job_id") or "job-frontend"
        email = body.get("email") or f"candidate_{uuid.uuid4().hex[:8]}@example.com"
        full_name = body.get("name") or body.get("full_name") or f"Candidate {uuid.uuid4().hex[:8]}"
        cv_text = body.get("cv_text") or body.get("cvText") or ""
        
        candidate_id = str(uuid.uuid4())
        if len(cv_text.strip()) < 100:
            cv_text = f"Candidate Name: {full_name}\nEmail: {email}\nApplied Position: {job_id}\nResume Details:\n{cv_text}"
    else:
        if not file or not job_id or not email or not full_name:
            raise HTTPException(status_code=400, detail="Missing required form parameters or file")
            
        # MIME Type Guard
        if file.content_type != "application/pdf":
            raise HTTPException(
                status_code=400,
                detail="Invalid file format. Only PDF documents are allowed."
            )
        
        candidate_id = str(uuid.uuid4())
        file_bytes = await file.read()
        
        try:
            cv_text = await extract_pdf_text_async(file_bytes)
        except Exception as e:
            # Save as PARSE_FAILED
            application = CandidateApplication(
                id=candidate_id,
                job_id=job_id,
                email=email,
                full_name=full_name,
                funnel_status="PARSE_FAILED",
                cv_text=None,
                scores=ScoreRubric()
            )
            db.collection("candidates").document(candidate_id).set(application.model_dump())
            raise HTTPException(
                status_code=422,
                detail=f"CV text extraction failed: {e}"
            )
        
    if not cv_text or len(cv_text.strip()) < 100:
        # Save to database with status PARSE_FAILED
        application = CandidateApplication(
            id=candidate_id,
            job_id=job_id,
            email=email,
            full_name=full_name,
            funnel_status="PARSE_FAILED",
            cv_text=cv_text,
            scores=ScoreRubric()
        )
        db.collection("candidates").document(candidate_id).set(application.model_dump())
        raise HTTPException(
            status_code=422,
            detail="CV parse failed: text length less than 100 characters."
        )
        
    # Pass the text to the cv_parser_agent
    try:
        from backend.app.agents.cv_parser_agent import parse_cv_to_json
        parsed_data = await parse_cv_to_json(cv_text)
        
        parsed_scores = parsed_data.get("scores", {})
        scores = ScoreRubric(
            technical_skills=parsed_scores.get("technical_skills", 0.0),
            experience=parsed_scores.get("experience", 0.0),
            assessment=0.0,
            communication=parsed_scores.get("communication", 0.0),
            cultural_fit=parsed_scores.get("cultural_fit", 0.0),
            engagement=0.0
        )
        
        final_email = parsed_data.get("email") or email
        final_name = parsed_data.get("full_name") or full_name
        
        application = CandidateApplication(
            id=candidate_id,
            job_id=job_id,
            email=final_email,
            full_name=final_name,
            funnel_status="SCREENING_PENDING",
            cv_text=cv_text,
            scores=scores
        )
    except Exception as e:
        application = CandidateApplication(
            id=candidate_id,
            job_id=job_id,
            email=email,
            full_name=full_name,
            funnel_status="PARSE_FAILED",
            cv_text=cv_text,
            scores=ScoreRubric()
        )
        db.collection("candidates").document(candidate_id).set(application.model_dump())
        raise HTTPException(
            status_code=422,
            detail=f"Gemini CV parsing failed: {e}"
        )
    
    # Save into Firestore
    db.collection("candidates").document(candidate_id).set(application.model_dump())
    
    return application


class BulkCandidateImport(BaseModel):
    id: str
    job_id: str
    email: str
    full_name: str
    cv_text: Optional[str] = None
    scores: Optional[ScoreRubric] = None
    funnel_status: str = "SCREENING_PENDING"


@router.post("/candidates/bulk-import", status_code=201)
async def bulk_import_candidates(candidates: List[BulkCandidateImport]):
    """
    Bulk import candidates from JSON payload.
    Bypasses Gemini CV parser to allow fast, rate-limit-free uploads.
    Supports Firestore batch writes (500 limit) and Mock mode in-memory writes.
    """
    imported_count = 0
    is_mock = hasattr(db, "store")
    
    if is_mock:
        # Optimize mock database by disabling auto-saving for the duration of the ingestion loop
        store = db.store
        old_save = store._save
        store._save = lambda *args, **kwargs: None
        try:
            for cand in candidates:
                scores = cand.scores or ScoreRubric()
                application = CandidateApplication(
                    id=cand.id,
                    job_id=cand.job_id,
                    email=cand.email,
                    full_name=cand.full_name,
                    funnel_status=cand.funnel_status,
                    cv_text=cand.cv_text,
                    scores=scores
                )
                db.collection("candidates").document(cand.id).set(application.model_dump())
                imported_count += 1
        finally:
            # Restore and save once at the end
            store._save = old_save
            store._save()
    else:
        # Real Firestore - execute in batch chunks of 500 operations
        chunk_size = 500
        for i in range(0, len(candidates), chunk_size):
            batch = db.batch()
            chunk = candidates[i : i + chunk_size]
            for cand in chunk:
                scores = cand.scores or ScoreRubric()
                application = CandidateApplication(
                    id=cand.id,
                    job_id=cand.job_id,
                    email=cand.email,
                    full_name=cand.full_name,
                    funnel_status=cand.funnel_status,
                    cv_text=cand.cv_text,
                    scores=scores
                )
                doc_ref = db.collection("candidates").document(cand.id)
                batch.set(doc_ref, application.model_dump())
            batch.commit()
            imported_count += len(chunk)
        
    return {
        "message": f"Successfully imported {imported_count} candidates.",
        "count": imported_count
    }
