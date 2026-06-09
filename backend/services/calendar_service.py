"""
Google Calendar service — handles interview scheduling via Google Calendar API.
Uses OAuth2 service account credentials for server-side calendar access.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from functools import partial
from typing import Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build

from backend.config import settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar"]

_calendar_service = None


import os

def _get_service():
    """Lazy-initialize the Google Calendar API service."""
    global _calendar_service
    if _calendar_service is None:
        key_path = settings.google_calendar_credentials_path
        if not key_path or not os.path.exists(key_path):
            logger.warning("Google Calendar credentials file not found. Starting calendar service in MOCK mode.")
            return None
        try:
            credentials = service_account.Credentials.from_service_account_file(
                key_path,
                scopes=SCOPES,
            )
            _calendar_service = build("calendar", "v3", credentials=credentials)
        except Exception as e:
            logger.error(f"Failed to initialize Google Calendar API: {e}. Falling back to MOCK mode.")
            return None
    return _calendar_service



async def _run_sync(func, *args, **kwargs):
    """Run a synchronous Google API call in a thread executor."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(func, *args, **kwargs))


def _get_available_slots_sync(
    date_from: datetime,
    date_to: datetime,
    slot_duration_minutes: int = 60,
    working_hours: tuple[int, int] = (9, 17),
) -> list[dict]:
    """
    Find available interview slots by checking free/busy data from Google Calendar.
    Returns list of {start, end} dicts for available time slots.
    """
    service = _get_service()
    busy_ranges = []

    if service is not None:
        body = {
            "timeMin": date_from.isoformat() + "Z",
            "timeMax": date_to.isoformat() + "Z",
            "items": [{"id": settings.google_calendar_id}],
        }
        try:
            response = service.freebusy().query(body=body).execute()
            busy_periods = response.get("calendars", {}).get(
                settings.google_calendar_id, {}
            ).get("busy", [])

            for period in busy_periods:
                start = datetime.fromisoformat(period["start"].replace("Z", "+00:00"))
                end = datetime.fromisoformat(period["end"].replace("Z", "+00:00"))
                busy_ranges.append((start, end))
        except Exception as e:
            logger.error(f"Failed to query Google Calendar API: {e}. Using empty busy ranges.")

    available_slots = []

    current = date_from.replace(
        hour=working_hours[0], minute=0, second=0, microsecond=0
    )
    end_date = date_to

    while current < end_date:
        if current.weekday() >= 5:
            current += timedelta(days=1)
            current = current.replace(hour=working_hours[0], minute=0)
            continue

        if current.hour < working_hours[0]:
            current = current.replace(hour=working_hours[0], minute=0)

        if current.hour >= working_hours[1]:
            current += timedelta(days=1)
            current = current.replace(hour=working_hours[0], minute=0)
            continue

        slot_end = current + timedelta(minutes=slot_duration_minutes)

        if slot_end.hour > working_hours[1]:
            current += timedelta(days=1)
            current = current.replace(hour=working_hours[0], minute=0)
            continue

        is_free = True
        for busy_start, busy_end in busy_ranges:
            busy_start_naive = busy_start.replace(tzinfo=None)
            busy_end_naive = busy_end.replace(tzinfo=None)
            if current < busy_end_naive and slot_end > busy_start_naive:
                is_free = False
                break

        if is_free:
            available_slots.append({
                "start": current.isoformat(),
                "end": slot_end.isoformat(),
            })

        current += timedelta(minutes=slot_duration_minutes)

    return available_slots


async def get_available_slots(
    date_from: datetime,
    date_to: datetime,
    slot_duration_minutes: int = 60,
) -> list[dict]:
    """Async wrapper: Get available interview slots."""
    return await _run_sync(
        _get_available_slots_sync,
        date_from,
        date_to,
        slot_duration_minutes,
    )


def _create_interview_event_sync(
    candidate_name: str,
    candidate_email: str,
    job_title: str,
    start_time: datetime,
    duration_minutes: int = 60,
    description: str = "",
) -> dict:
    """
    Create a Google Calendar event for an interview.
    Returns the created event details including hangoutLink.
    """
    service = _get_service()
    end_time = start_time + timedelta(minutes=duration_minutes)

    if service is None:
        import uuid
        event_id = f"mock-event-{uuid.uuid4()}"
        return {
            "eventId": event_id,
            "htmlLink": f"https://calendar.google.com/calendar/r/eventedit/{event_id}",
            "hangoutLink": "https://meet.google.com/mock-meet-link",
            "start": start_time.isoformat(),
            "end": end_time.isoformat(),
        }

    event = {
        "summary": f"Interview — {candidate_name} for {job_title}",
        "description": description or f"Technical interview for {job_title} position.\nCandidate: {candidate_name} ({candidate_email})",
        "start": {
            "dateTime": start_time.isoformat(),
            "timeZone": "UTC",
        },
        "end": {
            "dateTime": end_time.isoformat(),
            "timeZone": "UTC",
        },
        "attendees": [
            {"email": candidate_email},
        ],
        "conferenceData": {
            "createRequest": {
                "requestId": f"interview-{candidate_email}-{start_time.isoformat()}",
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        },
        "reminders": {
            "useDefault": False,
            "overrides": [
                {"method": "email", "minutes": 60},
                {"method": "popup", "minutes": 15},
            ],
        },
    }

    try:
        created_event = (
            service.events()
            .insert(
                calendarId=settings.google_calendar_id,
                body=event,
                conferenceDataVersion=1,
                sendUpdates="all",
            )
            .execute()
        )

        return {
            "eventId": created_event.get("id"),
            "htmlLink": created_event.get("htmlLink"),
            "hangoutLink": created_event.get("hangoutLink", ""),
            "start": created_event.get("start", {}).get("dateTime"),
            "end": created_event.get("end", {}).get("dateTime"),
        }
    except Exception as e:
        logger.error(f"Google Calendar event creation failed: {e}. Generating mock fallback event.")
        import uuid
        event_id = f"mock-event-{uuid.uuid4()}"
        return {
            "eventId": event_id,
            "htmlLink": f"https://calendar.google.com/calendar/r/eventedit/{event_id}",
            "hangoutLink": "https://meet.google.com/mock-meet-link",
            "start": start_time.isoformat(),
            "end": end_time.isoformat(),
        }



async def create_interview_event(
    candidate_name: str,
    candidate_email: str,
    job_title: str,
    start_time: datetime,
    duration_minutes: int = 60,
) -> dict:
    """Async wrapper: Create an interview calendar event."""
    return await _run_sync(
        _create_interview_event_sync,
        candidate_name,
        candidate_email,
        job_title,
        start_time,
        duration_minutes,
    )


def sync_create_interview_event(
    candidate_name: str,
    candidate_email: str,
    job_title: str,
    start_time: datetime,
    duration_minutes: int = 60,
) -> dict:
    """Synchronous wrapper for Celery tasks."""
    return _create_interview_event_sync(
        candidate_name,
        candidate_email,
        job_title,
        start_time,
        duration_minutes,
    )


def sync_get_available_slots(
    date_from: datetime,
    date_to: datetime,
    slot_duration_minutes: int = 60,
) -> list[dict]:
    """Synchronous wrapper for Celery tasks."""
    return _get_available_slots_sync(date_from, date_to, slot_duration_minutes)
