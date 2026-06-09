"""
Schedule API routes — interview slot availability and booking.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.services import calendar_service, firestore_service

router = APIRouter(tags=["Schedule"])


class BookSlotRequest(BaseModel):
    """Request body for booking an interview slot."""
    candidate_id: str
    start_time: str  # ISO format
    duration_minutes: int = 60


# ---------------------------------------------------------------------------
# GET /api/schedule
# ---------------------------------------------------------------------------

@router.get("/schedule")
async def get_available_slots(
    dateFrom: Optional[str] = Query(None, description="Start date (ISO format)"),
    dateTo: Optional[str] = Query(None, description="End date (ISO format)"),
    durationMinutes: int = Query(60, description="Slot duration in minutes"),
):
    """
    Get available interview time slots from Google Calendar.
    Defaults to next 14 days if no date range specified.
    """
    now = datetime.utcnow()

    if dateFrom:
        date_from = datetime.fromisoformat(dateFrom)
    else:
        date_from = now + timedelta(days=1)

    if dateTo:
        date_to = datetime.fromisoformat(dateTo)
    else:
        date_to = now + timedelta(days=14)

    slots = await calendar_service.get_available_slots(
        date_from=date_from,
        date_to=date_to,
        slot_duration_minutes=durationMinutes,
    )

    return {"slots": slots, "count": len(slots)}


# ---------------------------------------------------------------------------
# POST /api/schedule
# ---------------------------------------------------------------------------

@router.post("/schedule")
async def book_interview_slot(request: BookSlotRequest):
    """
    Book an interview slot for a candidate.
    Creates a Google Calendar event and updates the candidate document.
    """
    candidate = await firestore_service.get_candidate(request.candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    start_time = datetime.fromisoformat(request.start_time)

    job_id = candidate.get("jobId", "")
    job = await firestore_service.get_job(job_id) if job_id else None
    job_title = job.get("title", "Position") if job else "Position"

    event = await calendar_service.create_interview_event(
        candidate_name=candidate.get("name", ""),
        candidate_email=candidate.get("email", ""),
        job_title=job_title,
        start_time=start_time,
        duration_minutes=request.duration_minutes,
    )

    await firestore_service.update_candidate(request.candidate_id, {
        "status": "INTERVIEW_SCHEDULED",
        "interviewScheduledAt": start_time,
    })

    await firestore_service.append_state_history(
        request.candidate_id,
        "INTERVIEW_SCHEDULED",
        {
            "eventId": event.get("eventId", ""),
            "interviewTime": start_time.isoformat(),
            "meetingLink": event.get("hangoutLink", ""),
            "bookedManually": True,
        },
    )

    return {
        "message": "Interview scheduled successfully",
        "event": event,
        "candidateId": request.candidate_id,
    }


# ---------------------------------------------------------------------------
# GET /api/schedule/interviews
# ---------------------------------------------------------------------------

@router.get("/schedule/interviews")
async def get_scheduled_interviews():
    """Get all candidates with scheduled interviews."""
    candidates = await firestore_service.list_candidates(
        status="INTERVIEW_SCHEDULED",
        limit=100,
    )
    return {"interviews": candidates, "count": len(candidates)}
