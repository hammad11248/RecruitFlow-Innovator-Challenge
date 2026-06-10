"""
Assessments API routes — submit answers, fetch assessment by token.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException

from backend.models.assessment import AssessmentSubmission
from backend.services import firestore_service

router = APIRouter(tags=["Assessments"])


# ---------------------------------------------------------------------------
# POST /api/assessments/submit
# ---------------------------------------------------------------------------

@router.post("/assessments/submit")
async def submit_assessment(submission: AssessmentSubmission):
    """
    Submit assessment answers.
    1. Validates the token exists
    2. Writes answers to Firestore assessment document
    3. Updates candidate status to ASSESSMENT_SUBMITTED
    4. Dispatches evaluation Celery task
    """
    token = submission.token
    assessment = await firestore_service.get_assessment(token)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

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
async def get_assessment(token: str):
    """Fetch assessment document by token (for candidate portal)."""
    assessment = await firestore_service.get_assessment(token)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

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
