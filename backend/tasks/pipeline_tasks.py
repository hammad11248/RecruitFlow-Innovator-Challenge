"""
Pipeline tasks — the full recruitment pipeline tasks implemented as async functions.
Each task reads/writes Firestore directly with error handling.

Task Chain:
  parse_cv_task → screening_decision_task → send_assessment_email_task → notify_hr_task

Standalone tasks:
  evaluate_assessment_task — triggered when a candidate submits their assessment
  check_engagement_deadline_task — periodic task for auto-rejection of non-responsive candidates
"""

from __future__ import annotations

import asyncio
import logging
import traceback
import uuid
from datetime import datetime

from backend.config import settings
from backend.services.firestore_service import (
    get_candidate,
    update_candidate,
    append_state_history,
    get_job,
    create_assessment,
    log_task_error,
    list_candidates,
    get_assessment,
)
from backend.services.email_service import (
    send_assessment_email,
    send_hr_notification,
    send_rejection_email,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Error handler
# ---------------------------------------------------------------------------

async def _handle_task_failure(task_name: str, exc: Exception, candidate_id: str):
    """Common failure handler: update Firestore status and log error."""
    try:
        candidate = await get_candidate(candidate_id)
        status = "PARSE_FAILED" if (candidate and candidate.get("status") == "PARSE_FAILED") else "PROCESSING_FAILED"
        
        await update_candidate(candidate_id, {"status": status})
        await append_state_history(candidate_id, status, {
            "error": str(exc),
            "task": task_name,
        })
        await log_task_error(
            task_id=str(uuid.uuid4()),
            candidate_id=candidate_id,
            error_message=str(exc),
            task_name=task_name,
            traceback_str=traceback.format_exc(),
        )
    except Exception as log_err:
        logger.error(f"Failed to log task error: {log_err}")


# ---------------------------------------------------------------------------
# Task 1: Parse CV
# ---------------------------------------------------------------------------

async def parse_cv_task(candidate_id: str) -> str:
    """
    Parse CV using Google Gemini AI agent.
    Computes Dimensions 1, 2, 4 of the scoring rubric.
    Returns candidate_id for the next task in the chain.
    """
    try:
        from backend.agents.cv_parser_agent import process_cv
        result = await asyncio.to_thread(process_cv, candidate_id)
        logger.info(f"CV parsed successfully for {candidate_id}")
        return result
    except Exception as exc:
        await _handle_task_failure("parse_cv_task", exc, candidate_id)
        raise exc


# ---------------------------------------------------------------------------
# Task 2: Screening Decision
# ---------------------------------------------------------------------------

async def screening_decision_task(candidate_id: str) -> str:
    """
    Make a pass/fail screening decision based on partial composite (D1+D2+D4).
    If passed: status → AI_SCREENING_PASSED
    If failed: status → AI_SCREENING_FAILED, sends rejection email.
    Returns candidate_id.
    """
    try:
        candidate = await get_candidate(candidate_id)
        if not candidate:
            raise ValueError(f"Candidate {candidate_id} not found")

        job_id = candidate.get("jobId", "")
        job = await get_job(job_id) if job_id else None

        screening_threshold = 40.0
        if job:
            screening_threshold = job.get("screeningThreshold", 40.0)

        score_dims = candidate.get("scoreDimensions", {})
        d1 = score_dims.get("technicalSkills", {}).get("rawScore", 0)
        d2 = score_dims.get("experienceSeniority", {}).get("rawScore", 0)
        d4 = score_dims.get("cvQuality", {}).get("rawScore", 0)

        weights = {}
        if job and "scoringWeights" in job:
            weights = job["scoringWeights"]

        w1 = weights.get("technicalSkills", 0.30)
        w2 = weights.get("experienceSeniority", 0.20)
        w4 = weights.get("cvQuality", 0.10)

        total_weight = w1 + w2 + w4
        if total_weight > 0:
            partial_composite = (d1 * w1 + d2 * w2 + d4 * w4) / total_weight
        else:
            partial_composite = (d1 + d2 + d4) / 3

        screening_score = candidate.get("screeningScore", partial_composite)

        if screening_score >= screening_threshold:
            await update_candidate(candidate_id, {"status": "AI_SCREENING_PASSED"})
            await append_state_history(candidate_id, "AI_SCREENING_PASSED", {
                "screeningScore": round(screening_score, 2),
                "threshold": screening_threshold,
                "partialComposite": round(partial_composite, 2),
            })
            logger.info(
                f"Candidate {candidate_id} PASSED screening: "
                f"score={screening_score:.1f} >= threshold={screening_threshold}"
            )
        else:
            await update_candidate(candidate_id, {"status": "AI_SCREENING_FAILED"})
            await append_state_history(candidate_id, "AI_SCREENING_FAILED", {
                "screeningScore": round(screening_score, 2),
                "threshold": screening_threshold,
                "partialComposite": round(partial_composite, 2),
            })

            candidate_name = candidate.get("name", "")
            candidate_email = candidate.get("email", "")
            job_title = job.get("title", "Position") if job else "Position"

            if candidate_email:
                await asyncio.to_thread(send_rejection_email, candidate_name, candidate_email, job_title)

            logger.info(
                f"Candidate {candidate_id} FAILED screening: "
                f"score={screening_score:.1f} < threshold={screening_threshold}"
            )

        return candidate_id

    except Exception as exc:
        await _handle_task_failure("screening_decision_task", exc, candidate_id)
        raise exc


# ---------------------------------------------------------------------------
# Task 3: Send Assessment Email
# ---------------------------------------------------------------------------

async def send_assessment_email_task(candidate_id: str) -> str:
    """
    If candidate passed screening, generate an assessment and send the email.
    If candidate failed, skip (return early).
    Returns candidate_id.
    """
    try:
        candidate = await get_candidate(candidate_id)
        if not candidate:
            raise ValueError(f"Candidate {candidate_id} not found")

        if candidate.get("status") != "AI_SCREENING_PASSED":
            logger.info(f"Candidate {candidate_id} did not pass screening, skipping assessment.")
            return candidate_id

        job_id = candidate.get("jobId", "")
        job = await get_job(job_id) if job_id else None
        job_title = job.get("title", "Position") if job else "Position"

        assessment_token = str(uuid.uuid4())

        questions = _generate_assessment_questions(candidate, job)

        time_limit = 120
        assessment_data = {
            "token": assessment_token,
            "candidateId": candidate_id,
            "jobId": job_id,
            "questions": questions,
            "answers": [],
            "score": 0,
            "passed": False,
            "scoreBreakdown": [],
            "timeLimitMinutes": time_limit,
        }

        await create_assessment(assessment_token, assessment_data)

        now = datetime.utcnow()
        await update_candidate(candidate_id, {
            "assessmentToken": assessment_token,
            "assessmentSentAt": now,
            "status": "ASSESSMENT_SENT",
        })
        await append_state_history(candidate_id, "ASSESSMENT_SENT", {
            "assessmentToken": assessment_token,
            "sentAt": now.isoformat(),
        })

        candidate_name = candidate.get("name", "")
        candidate_email = candidate.get("email", "")

        if candidate_email:
            await asyncio.to_thread(
                send_assessment_email,
                candidate_name=candidate_name,
                candidate_email=candidate_email,
                assessment_token=assessment_token,
                job_title=job_title,
                time_limit_minutes=time_limit,
            )

        logger.info(f"Assessment sent to {candidate_id} with token {assessment_token}")
        return candidate_id

    except Exception as exc:
        await _handle_task_failure("send_assessment_email_task", exc, candidate_id)
        raise exc


def _generate_assessment_questions(
    candidate: dict,
    job: dict | None,
) -> list[dict]:
    """
    Generate assessment questions based on candidate's parsed CV and job requirements.
    Returns a list of question dicts ready for Firestore.
    """
    parsed = candidate.get("parsedJson", {})
    skills = parsed.get("skills", []) + parsed.get("inferredTechnologies", [])
    job_skills = job.get("requiredSkills", []) if job else []

    primary_skill = job_skills[0] if job_skills else (skills[0] if skills else "Python")

    questions = [
        {
            "id": "q1_mcq_1",
            "type": "mcq",
            "prompt": f"Which of the following is NOT a valid data structure in {primary_skill}?",
            "options": ["Array/List", "HashMap/Dictionary", "Binary Tree", "Quantum Array"],
            "correctAnswer": "Quantum Array",
            "testCases": [],
            "rubric": "",
            "maxScore": 100,
            "weight": 0.5,
            "timeLimitMinutes": 5,
        },
        {
            "id": "q2_mcq_2",
            "type": "mcq",
            "prompt": "What is the time complexity of binary search on a sorted array?",
            "options": ["O(n)", "O(log n)", "O(n²)", "O(1)"],
            "correctAnswer": "O(log n)",
            "testCases": [],
            "rubric": "",
            "maxScore": 100,
            "weight": 0.5,
            "timeLimitMinutes": 5,
        },
        {
            "id": "q3_coding_1",
            "type": "coding",
            "prompt": "Write a function `find_duplicates(arr)` that takes a list of integers and returns a list of integers that appear more than once, in the order they first appear as duplicates. For example: find_duplicates([1,2,3,2,4,3,5]) should return [2,3].",
            "options": [],
            "correctAnswer": "",
            "testCases": [
                {
                    "input": "print(find_duplicates([1,2,3,2,4,3,5]))",
                    "expected_output": "[2, 3]",
                },
                {
                    "input": "print(find_duplicates([1,1,1,2,2,3]))",
                    "expected_output": "[1, 2]",
                },
                {
                    "input": "print(find_duplicates([1,2,3,4,5]))",
                    "expected_output": "[]",
                },
            ],
            "rubric": "",
            "maxScore": 100,
            "weight": 2.0,
            "timeLimitMinutes": 20,
        },
        {
            "id": "q4_coding_2",
            "type": "coding",
            "prompt": "Write a function `flatten_dict(d, parent_key='', sep='.')` that flattens a nested dictionary. For example: flatten_dict({'a': 1, 'b': {'c': 2, 'd': {'e': 3}}}) should return {'a': 1, 'b.c': 2, 'b.d.e': 3}.",
            "options": [],
            "correctAnswer": "",
            "testCases": [
                {
                    "input": "print(flatten_dict({'a': 1, 'b': {'c': 2, 'd': {'e': 3}}}))",
                    "expected_output": "{'a': 1, 'b.c': 2, 'b.d.e': 3}",
                },
                {
                    "input": "print(flatten_dict({'x': {'y': {'z': 1}}}))",
                    "expected_output": "{'x.y.z': 1}",
                },
            ],
            "rubric": "",
            "maxScore": 100,
            "weight": 2.0,
            "timeLimitMinutes": 25,
        },
        {
            "id": "q5_open_1",
            "type": "open_ended",
            "prompt": f"Describe how you would design a scalable microservices architecture for a high-traffic e-commerce platform. Include considerations for data consistency, service communication, and fault tolerance. Reference any relevant experience from your background.",
            "options": [],
            "correctAnswer": "",
            "testCases": [],
            "rubric": "Evaluate for: 1) System design depth (microservice decomposition, API gateway, service mesh), 2) Data patterns (CQRS, event sourcing, saga pattern), 3) Communication patterns (sync vs async, message queues), 4) Fault tolerance (circuit breaker, retries, graceful degradation), 5) Practical experience references",
            "maxScore": 100,
            "weight": 2.0,
            "timeLimitMinutes": 30,
        },
        {
            "id": "q6_open_2",
            "type": "open_ended",
            "prompt": "Tell us about a technically challenging project you've worked on. What was the problem, your approach, the obstacles you faced, and the outcome? What would you do differently today?",
            "options": [],
            "correctAnswer": "",
            "testCases": [],
            "rubric": "Evaluate for: 1) Problem complexity and clarity of explanation, 2) Technical approach and decision rationale, 3) Obstacle handling and problem-solving, 4) Self-awareness and growth mindset in retrospective, 5) Communication quality and structure",
            "maxScore": 100,
            "weight": 1.5,
            "timeLimitMinutes": 25,
        },
    ]

    return questions


# ---------------------------------------------------------------------------
# Task 4: Notify HR
# ---------------------------------------------------------------------------

async def notify_hr_task(candidate_id: str) -> str:
    """
    Send notification to HR about the candidate's pipeline status.
    Returns candidate_id.
    """
    try:
        candidate = await get_candidate(candidate_id)
        if not candidate:
            raise ValueError(f"Candidate {candidate_id} not found")

        job_id = candidate.get("jobId", "")
        job = await get_job(job_id) if job_id else None
        job_title = job.get("title", "Position") if job else "Position"

        candidate_name = candidate.get("name", "Unknown")
        status = candidate.get("status", "UNKNOWN")
        composite_score = candidate.get("compositeScore", 0)

        hr_email = settings.email_user if settings.email_user else "hr@example.com"

        await asyncio.to_thread(
            send_hr_notification,
            hr_email=hr_email,
            candidate_name=candidate_name,
            job_title=job_title,
            status=status,
            composite_score=composite_score,
        )

        logger.info(f"HR notified about candidate {candidate_id} (status={status})")
        return candidate_id

    except Exception as exc:
        await _handle_task_failure("notify_hr_task", exc, candidate_id)
        raise exc


# ---------------------------------------------------------------------------
# Task 5: Evaluate Assessment
# ---------------------------------------------------------------------------

async def evaluate_assessment_task(token: str) -> str:
    """
    Evaluate a submitted assessment.
    Computes Dimensions 3, 5, 6 and the full composite score.
    Triggers interview scheduling or rejection.
    Returns candidate_id.
    """
    candidate_id = ""
    try:
        # Resolve candidate_id preemptively
        assessment = await get_assessment(token)
        if assessment:
            candidate_id = assessment.get("candidateId", "")

        from backend.agents.evaluator import evaluate_assessment
        candidate_id = await asyncio.to_thread(evaluate_assessment, token)
        return candidate_id
    except Exception as exc:
        if candidate_id:
            await _handle_task_failure("evaluate_assessment_task", exc, candidate_id)
        raise exc


# ---------------------------------------------------------------------------
# Task 6: Check Engagement Deadlines
# ---------------------------------------------------------------------------

async def check_engagement_deadline_task() -> int:
    """
    Check for candidates who haven't submitted their assessment
    within the configurable deadline. Auto-reject them (Dimension 6).
    Returns count of auto-rejected candidates.
    """
    candidates = await list_candidates(status="ASSESSMENT_SENT")
    rejected_count = 0
    now = datetime.utcnow()

    for candidate in candidates:
        sent_at = candidate.get("assessmentSentAt")
        if not sent_at:
            continue

        if isinstance(sent_at, str):
            sent_at = datetime.fromisoformat(sent_at)

        job_id = candidate.get("jobId", "")
        job = await get_job(job_id) if job_id else None
        deadline_hours = 72
        if job:
            deadline_hours = job.get("autoRejectDeadlineHours", 72)

        hours_elapsed = (now - sent_at).total_seconds() / 3600

        if hours_elapsed > deadline_hours:
            candidate_id = candidate.get("id", "")
            await update_candidate(candidate_id, {"status": "REJECTED"})
            await append_state_history(candidate_id, "REJECTED", {
                "reason": f"Auto-rejected: no assessment submission after {deadline_hours} hours",
                "hoursElapsed": round(hours_elapsed, 1),
            })

            candidate_name = candidate.get("name", "")
            candidate_email = candidate.get("email", "")
            job_title = job.get("title", "Position") if job else "Position"

            if candidate_email:
                await asyncio.to_thread(
                    send_rejection_email,
                    candidate_name=candidate_name,
                    candidate_email=candidate_email,
                    job_title=job_title,
                    reason="due to assessment submission deadline expiry",
                )

            logger.info(
                f"Auto-rejected candidate {candidate_id}: "
                f"{hours_elapsed:.1f}h > {deadline_hours}h deadline"
            )
            rejected_count += 1

    logger.info(f"Engagement deadline check: {rejected_count} candidates auto-rejected")
    return rejected_count


# ---------------------------------------------------------------------------
# Pipeline Chain Builder (Deprecated fallback)
# ---------------------------------------------------------------------------

def build_pipeline_chain(candidate_id: str):
    """
    Deprecated: use task_queue_service instead.
    Provided for backwards compatibility.
    """
    class DeprecatedChain:
        def apply_async(self):
            import asyncio
            from backend.services import task_queue_service
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(task_queue_service.enqueue("process-cv", {"candidate_id": candidate_id}))
            except RuntimeError:
                pass
    return DeprecatedChain()
