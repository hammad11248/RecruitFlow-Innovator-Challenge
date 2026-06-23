"""
Assessments API routes — submit answers, fetch assessment by token.

Token-based access: The assessment UUID token IS the authorization.
Knowing the token means the candidate received the email.
Firebase auth is optional (HR users can also access).
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Request
from backend.routes.auth import verify_firebase_token

from backend.models.assessment import AssessmentSubmission
from backend.services import firestore_service

router = APIRouter(tags=["Assessments"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _optional_firebase_user(request: Request) -> dict | None:
    """Try to extract Firebase user from Bearer token, return None if absent."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    # Delegate to the existing verify logic
    from fastapi.security import HTTPAuthorizationCredentials
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=auth_header[7:])
    from backend.routes.auth import verify_firebase_token as _verify
    # Re-use the dependency logic manually
    from backend.firebase_admin_init import MOCK_MODE
    token = creds.credentials
    if MOCK_MODE or token == "mock-token" or token.startswith("mock-"):
        # Let the existing mock logic handle it
        return await _verify(creds)
    try:
        return await _verify(creds)
    except Exception:
        return None


def _is_expired(expires_at: Any) -> bool:
    """Check if an expiration datetime has passed, handling both naive and tz-aware datetimes."""
    if not expires_at:
        return False
    if isinstance(expires_at, str):
        try:
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        except Exception:
            return False
    
    # Check if expires_at is timezone-aware
    if getattr(expires_at, "tzinfo", None) is not None:
        from datetime import timezone
        return datetime.now(timezone.utc) > expires_at
    else:
        return datetime.utcnow() > expires_at



# ---------------------------------------------------------------------------
# POST /api/assessments/submit
# ---------------------------------------------------------------------------

@router.post("/assessments/submit")
async def submit_assessment(submission: AssessmentSubmission, request: Request):
    """
    Submit assessment answers.
    Auth: token-based (the assessment UUID token IS the authorization).
    1. Validates the token exists and is not expired
    2. Checks the assessment hasn't already been submitted
    3. Writes answers to Firestore assessment document
    4. Marks assessment as submitted
    5. Updates candidate status to ASSESSMENT_SUBMITTED
    6. Dispatches evaluation task
    """
    token = submission.token
    assessment = await firestore_service.get_assessment(token)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Check expiry
    if _is_expired(assessment.get("expiresAt")):
        raise HTTPException(status_code=410, detail="Assessment link has expired.")

    # Check if already submitted
    if assessment.get("submitted") is True or (assessment.get("answers") and len(assessment["answers"]) > 0):
        raise HTTPException(status_code=400, detail="Assessment already submitted")

    candidate_id = assessment.get("candidateId", "")
    candidate = await firestore_service.get_candidate(candidate_id) if candidate_id else None
    if not candidate:
        raise HTTPException(status_code=404, detail="Associated candidate not found")

    # Optional Firebase auth check — if a Bearer token is present, verify access
    user = await _optional_firebase_user(request)
    if user:
        role = user.get("role")
        email = user.get("email")
        is_hr = role in ("hr", "recruiter", "interviewer", "hr_manager")
        is_self = email and candidate.get("email") and email.strip().lower() == candidate.get("email").strip().lower()
        if not (is_hr or is_self):
            raise HTTPException(status_code=403, detail="Access denied. You can only submit your own assessment.")

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
        "submitted": True,
    })

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
async def get_assessment(token: str, request: Request):
    """
    Fetch assessment document by token.
    Auth: token-based — knowing the token IS the authorization.
    """
    assessment = await firestore_service.get_assessment(token)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    # Check expiry
    if _is_expired(assessment.get("expiresAt")):
        raise HTTPException(status_code=410, detail="Assessment link has expired.")

    candidate_id = assessment.get("candidateId", "")

    response = {
        "token": assessment.get("token", token),
        "candidateId": assessment.get("candidateId", ""),
        "questions": assessment.get("questions", []),
        "timeLimitMinutes": assessment.get("timeLimitMinutes", 120),
        "createdAt": assessment.get("createdAt"),
    }

    if assessment.get("submitted") is True or (assessment.get("answers") and len(assessment["answers"]) > 0):
        response["submitted"] = True
        response["score"] = assessment.get("score", 0)
        response["passed"] = assessment.get("passed", False)
        response["scoreBreakdown"] = assessment.get("scoreBreakdown", [])
    else:
        response["submitted"] = False

    return response
