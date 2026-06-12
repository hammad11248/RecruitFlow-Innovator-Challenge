"""
Assessments API routes — submit answers, fetch assessment by token.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from backend.routes.auth import verify_firebase_token

from backend.models.assessment import AssessmentSubmission
from backend.services import firestore_service

router = APIRouter(tags=["Assessments"])


# ---------------------------------------------------------------------------
# POST /api/assessments/submit
# ---------------------------------------------------------------------------

@router.post("/assessments/submit")
async def submit_assessment(submission: AssessmentSubmission, user: dict = Depends(verify_firebase_token)):
    """
    Submit assessment answers.
    1. Validates the token exists
    2. Validates user is authorized
    3. Writes answers to Firestore assessment document
    4. Updates candidate status to ASSESSMENT_SUBMITTED
    5. Dispatches evaluation Celery task
    """
    if not user:
        raise HTTPException(status_code=401, detail="Authentication credentials missing.")

    token = submission.token
    assessment = await firestore_service.get_assessment(token)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    candidate_id = assessment.get("candidateId", "")
    candidate = await firestore_service.get_candidate(candidate_id) if candidate_id else None
    if not candidate:
        raise HTTPException(status_code=404, detail="Associated candidate not found")

    role = user.get("role")
    email = user.get("email")
    is_hr = role in ("hr", "recruiter", "interviewer", "hr_manager")
    is_self = email and candidate.get("email") and email.strip().lower() == candidate.get("email").strip().lower()

    if not (is_hr or is_self):
        raise HTTPException(status_code=403, detail="Access denied. You can only submit your own assessment.")

    if assessment.get("answers") and len(assessment["answers"]) > 0:
        raise HTTPException(status_code=400, detail="Assessment already submitted")

    answers_data = [
        {
            "questionId": a.question_id,
            "answer": a.answer,
            "codeSubmissionsCount": a.code_submissions_count,
            "submittedAt": datetime.utcnow().isoformat(),
        }
        for a in submission.answers
    ]

    now = datetime.utcnow()

    await firestore_service.update_assessment(token, {
        "answers": answers_data,
        "submittedAt": now,
    })

    candidate_id = assessment.get("candidateId", "")
    if candidate_id:
        await firestore_service.update_candidate(candidate_id, {
            "status": "ASSESSMENT_SUBMITTED",
            "assessmentSubmittedAt": now,
        })
        await firestore_service.append_state_history(
            candidate_id, "ASSESSMENT_SUBMITTED",
            {"token": token, "submittedAt": now.isoformat()},
        )

    try:
        from backend.services import task_queue_service
        await task_queue_service.enqueue("score-candidate", {"token": token})
    except Exception as e:
        import logging
        logging.getLogger(__name__).error("Could not enqueue score-candidate task: %s", e)

    return {
        "message": "Assessment submitted successfully. Evaluation in progress.",
        "token": token,
        "status": "ASSESSMENT_SUBMITTED",
    }



# ---------------------------------------------------------------------------
# GET /api/assessments/{token}
# ---------------------------------------------------------------------------

@router.get("/assessments/{token}")
async def get_assessment(token: str, user: dict = Depends(verify_firebase_token)):
    """Fetch assessment document by token (for candidate portal)."""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication credentials missing.")

    assessment = await firestore_service.get_assessment(token)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    candidate_id = assessment.get("candidateId", "")
    candidate = await firestore_service.get_candidate(candidate_id) if candidate_id else None
    if not candidate:
        raise HTTPException(status_code=404, detail="Associated candidate not found")

    role = user.get("role")
    email = user.get("email")
    is_hr = role in ("hr", "recruiter", "interviewer", "hr_manager")
    is_self = email and candidate.get("email") and email.strip().lower() == candidate.get("email").strip().lower()

    if not (is_hr or is_self):
        raise HTTPException(status_code=403, detail="Access denied. You can only view your own assessment.")

    response = {
        "token": assessment.get("token", token),
        "candidateId": assessment.get("candidateId", ""),
        "questions": assessment.get("questions", []),
        "timeLimitMinutes": assessment.get("timeLimitMinutes", 120),
        "createdAt": assessment.get("createdAt"),
    }

    if assessment.get("answers") and len(assessment["answers"]) > 0:
        response["submitted"] = True
        response["score"] = assessment.get("score", 0)
        response["passed"] = assessment.get("passed", False)
        response["scoreBreakdown"] = assessment.get("scoreBreakdown", [])
    else:
        response["submitted"] = False

    return response
