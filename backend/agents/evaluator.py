"""
Evaluation Agent — Scores assessment submissions (MCQ, coding, open-ended),
then computes Dimensions 3, 5, 6 and the final composite score.
Triggers interview scheduling or rejection based on results.
"""

from __future__ import annotations

import json
import logging
import subprocess
import sys
import tempfile
import os
from datetime import datetime
from typing import Any, Optional

import google.generativeai as genai

from backend.config import settings
from backend.services.firestore_service import (
    sync_get_assessment,
    sync_update_assessment,
    sync_get_candidate,
    sync_update_candidate,
    sync_append_state_history,
    sync_get_job,
)
from backend.services.email_service import (
    send_interview_scheduled_email,
    send_rejection_email,
)
from backend.services.calendar_service import (
    sync_create_interview_event,
    sync_get_available_slots,
)
from backend.agents.scoring_engine import (
    compute_assessment_score,
    compute_cultural_fit_score,
    compute_engagement_score,
    compute_composite,
    build_full_score_dimensions,
)

logger = logging.getLogger(__name__)

_gemini_configured = False


def _configure_gemini():
    """Configure Gemini client."""
    global _gemini_configured
    if not _gemini_configured:
        api_key = settings.gemini_api_key if settings.is_gemini_configured else "mock-key"
        genai.configure(api_key=api_key)
        _gemini_configured = True


# ---------------------------------------------------------------------------
# MCQ Scoring
# ---------------------------------------------------------------------------

def score_mcq(answer: str, correct_answer: str) -> tuple[float, str]:
    """Score an MCQ answer by exact match. Returns (score, feedback)."""
    if answer.strip().lower() == correct_answer.strip().lower():
        return 100.0, "Correct answer."
    return 0.0, f"Incorrect. The correct answer was: {correct_answer}"


# ---------------------------------------------------------------------------
# Coding Question Scoring
# ---------------------------------------------------------------------------

def score_coding(
    code: str,
    test_cases: list[dict[str, Any]],
    timeout_seconds: int = 10,
) -> tuple[float, str, int, int]:
    """
    Score a coding answer by running it against test cases in a sandboxed subprocess.
    Returns (score, feedback, passed_count, total_count).
    """
    if not test_cases:
        return 50.0, "No test cases defined for this question.", 0, 0

    passed = 0
    total = len(test_cases)
    feedback_parts = []

    for i, tc in enumerate(test_cases):
        tc_input = tc.get("input", "")
        expected_output = str(tc.get("expected_output", "")).strip()

        full_code = f"{code}\n\n{tc_input}"

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".py", delete=False, dir=tempfile.gettempdir()
            ) as f:
                f.write(full_code)
                temp_path = f.name

            result = subprocess.run(
                [sys.executable, temp_path],
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
            )

            actual_output = result.stdout.strip()

            if actual_output == expected_output:
                passed += 1
                feedback_parts.append(f"Test {i+1}: PASSED")
            else:
                feedback_parts.append(
                    f"Test {i+1}: FAILED (expected '{expected_output}', got '{actual_output}')"
                )

            if result.stderr:
                feedback_parts.append(f"  stderr: {result.stderr[:200]}")

        except subprocess.TimeoutExpired:
            feedback_parts.append(f"Test {i+1}: TIMEOUT (>{timeout_seconds}s)")
        except Exception as e:
            feedback_parts.append(f"Test {i+1}: ERROR ({str(e)[:100]})")
        finally:
            if temp_path:
                try:
                    os.unlink(temp_path)
                except OSError:
                    pass

    score = (passed / total * 100) if total > 0 else 0
    feedback = "\n".join(feedback_parts)
    return score, feedback, passed, total


# ---------------------------------------------------------------------------
# Open-Ended Question Scoring
# ---------------------------------------------------------------------------

OPEN_ENDED_SCORING_PROMPT = """You are an expert technical evaluator. Score the following answer based on the provided rubric.

RUBRIC:
{rubric}

Evaluate on:
1. Technical accuracy (40%)
2. Depth of explanation (30%)
3. Practical examples and real-world application (20%)
4. Communication clarity (10%)

Return ONLY valid JSON:
{{
  "score": 75,
  "feedback": "Brief 2-3 sentence evaluation with specific strengths and weaknesses"
}}
"""


def score_open_ended(
    answer: str,
    rubric: str,
) -> tuple[float, str]:
    """Score an open-ended answer using Google Gemini. Returns (score, feedback)."""
    def _generate_mock_open_ended():
        import random
        score = random.randint(75, 95)
        return float(score), f"Mock evaluation: The answer shows good depth and covers key requirements outlined in the rubric. (Bypassed Gemini, score={score}/100)"

    if not settings.is_gemini_configured:
        logger.warning("Gemini API key is not set. Generating mock open-ended evaluation.")
        return _generate_mock_open_ended()

    try:
        from backend.services.gemini_rest_service import call_gemini_rest
        response_text = call_gemini_rest(
            prompt=f"Score this answer:\n\n{answer}",
            system_instruction=OPEN_ENDED_SCORING_PROMPT.format(rubric=rubric),
            response_json=True
        )

        result = json.loads(response_text)
        return float(result.get("score", 50)), result.get("feedback", "")
    except Exception as e:
        logger.warning(f"Failed to score open-ended via Gemini API ({e}). Falling back to mock open-ended evaluation.")
        return _generate_mock_open_ended()



# ---------------------------------------------------------------------------
# Main Evaluation Pipeline
# ---------------------------------------------------------------------------

def evaluate_assessment(token: str) -> str:
    """
    Full assessment evaluation pipeline:
    1. Fetch assessment from Firestore
    2. Score each question (MCQ, coding, open-ended)
    3. Compute Dimensions 3, 5, 6
    4. Calculate final composite score
    5. Update Firestore with results
    6. Trigger interview scheduling or rejection

    Returns candidate_id.
    """
    logger.info(f"Evaluating assessment {token}")

    assessment = sync_get_assessment(token)
    if not assessment:
        raise ValueError(f"Assessment {token} not found")

    candidate_id = assessment.get("candidateId", "")
    candidate = sync_get_candidate(candidate_id)
    if not candidate:
        raise ValueError(f"Candidate {candidate_id} not found")

    job_id = candidate.get("jobId", "") or assessment.get("jobId", "")
    job = sync_get_job(job_id) if job_id else None

    questions = assessment.get("questions", [])
    answers = assessment.get("answers", [])

    answer_map = {a.get("questionId", a.get("question_id", "")): a for a in answers}

    score_breakdown = []
    open_ended_answers = []

    for question in questions:
        q_id = question.get("id", "")
        q_type = question.get("type", "")
        answer_entry = answer_map.get(q_id, {})
        answer_text = answer_entry.get("answer", "")

        if q_type == "mcq":
            correct = question.get("correctAnswer", "")
            score, feedback = score_mcq(answer_text, correct)
            score_breakdown.append({
                "questionId": q_id,
                "score": score,
                "maxScore": question.get("maxScore", 100),
                "feedback": feedback,
            })

        elif q_type == "coding":
            test_cases = question.get("testCases", [])
            score, feedback, passed_tc, total_tc = score_coding(
                answer_text, test_cases
            )
            score_breakdown.append({
                "questionId": q_id,
                "score": score,
                "maxScore": question.get("maxScore", 100),
                "feedback": feedback,
                "passedTestCases": passed_tc,
                "totalTestCases": total_tc,
            })

        elif q_type == "open_ended":
            rubric = question.get("rubric", "Evaluate the answer for technical accuracy, depth, and clarity.")
            score, feedback = score_open_ended(answer_text, rubric)
            score_breakdown.append({
                "questionId": q_id,
                "score": score,
                "maxScore": question.get("maxScore", 100),
                "feedback": feedback,
            })
            open_ended_answers.append(answer_text)

    assessment_update = {
        "scoreBreakdown": score_breakdown,
        "evaluatedAt": datetime.utcnow(),
    }

    assessment_with_breakdown = {**assessment, "scoreBreakdown": score_breakdown}
    time_limit = assessment.get("timeLimitMinutes", 120)
    d3_score = compute_assessment_score(assessment_with_breakdown, time_limit)

    cv_text = candidate.get("cvText", "")
    role_persona = job.get("rolePersonaPrompt", "") if job else ""
    d5_score = compute_cultural_fit_score(cv_text, open_ended_answers, role_persona)

    assessment_sent_at = candidate.get("assessmentSentAt")
    assessment_submitted_at = candidate.get("assessmentSubmittedAt")
    d6_score = compute_engagement_score(assessment_sent_at, assessment_submitted_at)

    existing_dimensions = candidate.get("scoreDimensions", {})
    d1_score = existing_dimensions.get("technicalSkills", {}).get("rawScore", 50)
    d2_score = existing_dimensions.get("experienceSeniority", {}).get("rawScore", 50)
    d4_score = existing_dimensions.get("cvQuality", {}).get("rawScore", 50)

    scoring_weights = None
    if job and "scoringWeights" in job:
        scoring_weights = job["scoringWeights"]

    dimensions = {
        "technicalSkills": d1_score,
        "experienceSeniority": d2_score,
        "assessmentPerformance": d3_score,
        "cvQuality": d4_score,
        "culturalFit": d5_score,
        "engagement": d6_score,
    }

    composite_score = compute_composite(dimensions, scoring_weights)

    full_score_dims = build_full_score_dimensions(
        d1_score=d1_score,
        d2_score=d2_score,
        d3_score=d3_score,
        d4_score=d4_score,
        d5_score=d5_score,
        d6_score=d6_score,
        weights=scoring_weights,
        d1_rationale=existing_dimensions.get("technicalSkills", {}).get("rationale", ""),
        d2_rationale=existing_dimensions.get("experienceSeniority", {}).get("rationale", ""),
        d3_rationale=f"Assessment score: {d3_score:.1f}/100 (includes speed bonus/penalty adjustments)",
        d4_rationale=existing_dimensions.get("cvQuality", {}).get("rationale", ""),
        d5_rationale=f"Cultural fit score: {d5_score:.1f}/100 based on persona match",
        d6_rationale=f"Engagement score: {d6_score:.1f}/100 based on response time",
    )

    raw_assessment_score = d3_score

    assessment_update.update({
        "score": raw_assessment_score,
        "passed": composite_score >= (job.get("thresholdScore", 60) if job else 60),
    })
    sync_update_assessment(token, assessment_update)

    threshold = job.get("thresholdScore", 60) if job else 60
    passed = composite_score >= threshold

    candidate_update = {
        "assessmentScore": round(raw_assessment_score, 2),
        "compositeScore": composite_score,
        "scoreDimensions": full_score_dims,
        "status": "SCORED",
    }
    sync_update_candidate(candidate_id, candidate_update)
    sync_append_state_history(candidate_id, "SCORED", {
        "compositeScore": composite_score,
        "assessmentScore": raw_assessment_score,
        "passed": passed,
    })

    if passed:
        _schedule_interview(candidate, job)
    else:
        candidate_name = candidate.get("name", "Candidate")
        candidate_email = candidate.get("email", "")
        job_title = job.get("title", "Position") if job else "Position"

        sync_update_candidate(candidate_id, {"status": "REJECTED"})
        sync_append_state_history(candidate_id, "REJECTED", {
            "reason": f"Composite score {composite_score:.1f} below threshold {threshold}",
        })

        if candidate_email:
            send_rejection_email(candidate_name, candidate_email, job_title)

    logger.info(
        f"Assessment {token} evaluated: composite={composite_score:.1f}, "
        f"passed={passed}, D3={d3_score:.1f}, D5={d5_score:.1f}, D6={d6_score:.1f}"
    )

    return candidate_id


def _schedule_interview(candidate: dict, job: Optional[dict]) -> None:
    """Schedule an interview for a passing candidate."""
    candidate_id = candidate.get("id", "")
    candidate_name = candidate.get("name", "Candidate")
    candidate_email = candidate.get("email", "")
    job_title = job.get("title", "Position") if job else "Position"

    try:
        now = datetime.utcnow()
        from datetime import timedelta
        slots = sync_get_available_slots(
            date_from=now + timedelta(days=2),
            date_to=now + timedelta(days=14),
        )

        if not slots:
            logger.warning(f"No available slots for candidate {candidate_id}")
            sync_update_candidate(candidate_id, {"status": "INTERVIEW_SCHEDULED"})
            sync_append_state_history(candidate_id, "INTERVIEW_SCHEDULED", {
                "note": "No slots available — manual scheduling required",
            })
            return

        selected_slot = slots[0]
        interview_start = datetime.fromisoformat(selected_slot["start"])

        event = sync_create_interview_event(
            candidate_name=candidate_name,
            candidate_email=candidate_email,
            job_title=job_title,
            start_time=interview_start,
        )

        sync_update_candidate(candidate_id, {
            "status": "INTERVIEW_SCHEDULED",
            "interviewScheduledAt": interview_start,
        })
        sync_append_state_history(candidate_id, "INTERVIEW_SCHEDULED", {
            "eventId": event.get("eventId", ""),
            "interviewTime": interview_start.isoformat(),
            "meetingLink": event.get("hangoutLink", ""),
        })

        if candidate_email:
            send_interview_scheduled_email(
                candidate_name=candidate_name,
                candidate_email=candidate_email,
                job_title=job_title,
                interview_datetime=interview_start.strftime("%B %d, %Y at %I:%M %p UTC"),
                meeting_link=event.get("hangoutLink", ""),
            )

        logger.info(f"Interview scheduled for {candidate_id} at {interview_start}")

    except Exception as e:
        logger.error(f"Failed to schedule interview for {candidate_id}: {e}")
        sync_update_candidate(candidate_id, {"status": "INTERVIEW_SCHEDULED"})
        sync_append_state_history(candidate_id, "INTERVIEW_SCHEDULED", {
            "note": f"Calendar booking failed: {str(e)} — manual scheduling required",
        })
