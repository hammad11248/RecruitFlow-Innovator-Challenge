"""
Evaluation API Routes — Role-based dual-portal endpoints.

Candidate Portal endpoints: public, token-based access via candidateId.
    Returns sanitized data — no HR notes, rationale, or other candidates' info.

HR Portal endpoints: require authenticated HR user.
    Returns full analytical breakdown: raw scores, rationale, CV data, etc.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.routes.auth import verify_firebase_token, require_hr_user
from backend.services import firestore_service

router = APIRouter(tags=["Evaluation"])


# ===========================================================================
# Helper: Build sanitized candidate portal view
# ===========================================================================

def _build_candidate_portal_view(candidate: dict) -> dict:
    """
    Build a sanitized view of candidate data for the Candidate Portal.
    Strips sensitive HR-only fields (rationale, raw CV text, admin notes).
    Preserves dimension scores for transparent performance display.
    """
    score_dims = candidate.get("scoreDimensions", {})

    # Build sanitized dimension scores — include label, weight, and rawScore
    # but strip rationale and internal dimension codes
    sanitized_dimensions = {}
    for key, dim in score_dims.items():
        sanitized_dimensions[key] = {
            "label": dim.get("label", key),
            "weight": dim.get("weight", 0),
            "rawScore": dim.get("rawScore", 0),
            "weightedScore": dim.get("weightedScore", 0),
        }

    # Build filtered state history — remove internal meta that may contain
    # sensitive HR comments or screening threshold data
    raw_history = candidate.get("stateHistory", [])
    sanitized_history = []
    for entry in raw_history:
        sanitized_entry = {
            "state": entry.get("state", ""),
            "timestamp": entry.get("timestamp"),
        }
        # Only include non-sensitive meta fields
        meta = entry.get("meta", {})
        safe_meta = {}
        if "submittedAt" in meta:
            safe_meta["submittedAt"] = meta["submittedAt"]
        if "interviewTime" in meta:
            safe_meta["interviewTime"] = meta["interviewTime"]
        if "meetingLink" in meta:
            safe_meta["meetingLink"] = meta["meetingLink"]
        if safe_meta:
            sanitized_entry["meta"] = safe_meta
        sanitized_history.append(sanitized_entry)

    # Determine completed modules for progress display
    status = candidate.get("status", "UPLOADED")
    completed_modules = []
    module_map = {
        "UPLOADED": ["CV Upload"],
        "PROCESSING": ["CV Upload"],
        "AI_SCREENING_PASSED": ["CV Upload", "AI Screening"],
        "ASSESSMENT_SENT": ["CV Upload", "AI Screening", "Assessment Assigned"],
        "ASSESSMENT_SUBMITTED": ["CV Upload", "AI Screening", "Assessment Assigned", "Assessment Completed"],
        "SCORED": ["CV Upload", "AI Screening", "Assessment Assigned", "Assessment Completed", "Scoring Complete"],
        "INTERVIEW_SCHEDULED": ["CV Upload", "AI Screening", "Assessment Assigned", "Assessment Completed", "Scoring Complete", "Interview Scheduled"],
    }
    completed_modules = module_map.get(status, ["CV Upload"])

    # Compute aggregate completion percentage
    total_possible_modules = 6
    completion_pct = round((len(completed_modules) / total_possible_modules) * 100)

    return {
        "id": candidate.get("id", ""),
        "name": candidate.get("name", ""),
        "email": candidate.get("email", ""),
        "status": status,
        "compositeScore": candidate.get("compositeScore", 0),
        "screeningScore": candidate.get("screeningScore", 0),
        "assessmentScore": candidate.get("assessmentScore", 0),
        "scoreDimensions": sanitized_dimensions,
        "stateHistory": sanitized_history,
        "completedModules": completed_modules,
        "completionPercentage": completion_pct,
        "assessmentToken": candidate.get("assessmentToken", ""),
        "interviewScheduledAt": candidate.get("interviewScheduledAt"),
        "createdAt": candidate.get("createdAt"),
    }


# ===========================================================================
# Helper: Build full HR analytical view
# ===========================================================================

def _build_hr_drilldown_view(candidate: dict) -> dict:
    """
    Build the full analytical breakdown for HR drill-down.
    Includes all raw data, rationale, CV parsed data, and assessment details.
    """
    parsed_json = candidate.get("parsedJson", {})
    score_dims = candidate.get("scoreDimensions", {})

    # Extract skills for tag display
    skills = parsed_json.get("skills", [])
    inferred_tech = parsed_json.get("inferredTechnologies", [])

    # Experience entries
    experience = parsed_json.get("experience", [])

    # Education entries
    education = parsed_json.get("education", [])

    return {
        "id": candidate.get("id", ""),
        "name": candidate.get("name", ""),
        "email": candidate.get("email", ""),
        "phone": candidate.get("phone", ""),
        "status": candidate.get("status", "UPLOADED"),
        "jobId": candidate.get("jobId", ""),
        "compositeScore": candidate.get("compositeScore", 0),
        "screeningScore": candidate.get("screeningScore", 0),
        "assessmentScore": candidate.get("assessmentScore", 0),
        "scoreDimensions": score_dims,
        "parsedJson": parsed_json,
        "skills": skills,
        "inferredTechnologies": inferred_tech,
        "experience": experience,
        "education": education,
        "seniorityLevel": parsed_json.get("seniorityLevel", ""),
        "totalYearsExperience": parsed_json.get("totalYearsExperience", 0),
        "stateHistory": candidate.get("stateHistory", []),
        "assessmentToken": candidate.get("assessmentToken", ""),
        "assessmentSentAt": candidate.get("assessmentSentAt"),
        "assessmentSubmittedAt": candidate.get("assessmentSubmittedAt"),
        "interviewScheduledAt": candidate.get("interviewScheduledAt"),
        "cvDownloadUrl": candidate.get("cvDownloadUrl", ""),
        "createdAt": candidate.get("createdAt"),
    }


# ===========================================================================
# CANDIDATE PORTAL ENDPOINTS (public, token-based via candidateId)
# ===========================================================================

@router.get("/candidate-portal/{candidate_id}")
async def get_candidate_portal(candidate_id: str, user: dict = Depends(verify_firebase_token)):
    """
    Candidate Portal endpoint — returns sanitized candidate dashboard data.
    Only allows access if the authenticated user is HR or the candidate themselves.
    """
    if not user:
        raise HTTPException(status_code=401, detail="Authentication credentials missing.")

    candidate = await firestore_service.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    role = user.get("role")
    email = user.get("email")
    is_hr = role in ("hr", "recruiter", "interviewer", "hr_manager")
    is_self = email and candidate.get("email") and email.strip().lower() == candidate.get("email").strip().lower()

    if not (is_hr or is_self):
        raise HTTPException(status_code=403, detail="Access denied. You can only view your own candidate portal.")

    return _build_candidate_portal_view(candidate)


# ===========================================================================
# HR PORTAL ENDPOINTS (authenticated)
# ===========================================================================

@router.get("/hr/leaderboard")
async def get_hr_leaderboard(
    status: Optional[str] = Query(None, description="Filter by pipeline status"),
    min_score: Optional[float] = Query(None, description="Minimum composite score"),
    max_score: Optional[float] = Query(None, description="Maximum composite score"),
    job_id: Optional[str] = Query(None, description="Filter by job ID"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    sort_by: str = Query("compositeScore", description="Sort field"),
    sort_dir: str = Query("desc", description="Sort direction: asc or desc"),
    limit: int = Query(100, description="Maximum results", ge=1, le=500),
    user: dict = Depends(require_hr_user),
):
    """
    HR Leaderboard endpoint — returns all candidates ranked by composite score.
    Supports filtering, searching, and sorting for the HR dashboard table.
    """
    candidates = await firestore_service.list_candidates(
        status=status,
        min_score=min_score,
        max_score=max_score,
        job_id=job_id,
        order_by="compositeScore",
        limit=limit,
    )

    # Apply name/email search filter in-memory
    if search:
        search_lower = search.lower()
        candidates = [
            c for c in candidates
            if search_lower in (c.get("name", "").lower())
            or search_lower in (c.get("email", "").lower())
        ]

    # Apply custom sort
    reverse = sort_dir.lower() != "asc"
    if sort_by in ("compositeScore", "screeningScore", "assessmentScore"):
        candidates.sort(key=lambda c: c.get(sort_by, 0), reverse=reverse)
    elif sort_by == "name":
        candidates.sort(key=lambda c: c.get("name", "").lower(), reverse=reverse)
    elif sort_by == "createdAt":
        candidates.sort(
            key=lambda c: c.get("createdAt") or "",
            reverse=reverse,
        )

    # Build leaderboard entries with rank
    leaderboard = []
    for rank, candidate in enumerate(candidates, start=1):
        dims = candidate.get("scoreDimensions", {})
        parsed = candidate.get("parsedJson", {})

        leaderboard.append({
            "rank": rank,
            "id": candidate.get("id", ""),
            "name": candidate.get("name", ""),
            "email": candidate.get("email", ""),
            "status": candidate.get("status", ""),
            "compositeScore": candidate.get("compositeScore", 0),
            "screeningScore": candidate.get("screeningScore", 0),
            "assessmentScore": candidate.get("assessmentScore", 0),
            "dimensions": {
                key: {
                    "label": dim.get("label", key),
                    "rawScore": dim.get("rawScore", 0),
                    "weight": dim.get("weight", 0),
                }
                for key, dim in dims.items()
            },
            "skills": parsed.get("skills", [])[:8],
            "seniorityLevel": parsed.get("seniorityLevel", ""),
            "createdAt": candidate.get("createdAt"),
        })

    return {
        "leaderboard": leaderboard,
        "count": len(leaderboard),
        "sortBy": sort_by,
        "sortDir": sort_dir,
    }
@router.get("/hr/candidate/{candidate_id}/drill-down")
async def get_hr_candidate_drilldown(
    candidate_id: str,
    user: dict = Depends(require_hr_user),
):
    """
    HR Drill-Down endpoint — returns the full analytical breakdown
    for a single candidate, including all 6 dimension raw scores,
    rationale, CV data, skills, experience, and assessment details.
    """
    candidate = await firestore_service.get_candidate(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    drilldown_view = _build_hr_drilldown_view(candidate)
    
    # Fetch assessment document if candidate has an assessmentToken
    token = candidate.get("assessmentToken")
    if token:
        assessment = await firestore_service.get_assessment(token)
        if assessment:
            drilldown_view["assessment"] = assessment
            
    return drilldown_view
