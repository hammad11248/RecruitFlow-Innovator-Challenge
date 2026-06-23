"""
Scoring Engine — Core 6-dimension scoring orchestrator.
Computes individual dimension scores and the final composite score.
Each function returns a score (0-100) with optional rationale.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Optional

import google.generativeai as genai

from backend.config import settings

logger = logging.getLogger(__name__)

_gemini_configured = False


def _configure_gemini():
    """Configure Gemini client."""
    global _gemini_configured
    if not _gemini_configured:
        api_key = settings.gemini_api_key if settings.is_gemini_configured else "mock-key"
        genai.configure(api_key=api_key)
        _gemini_configured = True


def _safe_diff_seconds(dt1: Any, dt2: Any) -> float:
    """Safely subtract dt2 from dt1 and return difference in seconds, handling naive/aware datetimes and strings."""
    if not dt1 or not dt2:
        return 0.0
    if isinstance(dt1, str):
        dt1 = datetime.fromisoformat(dt1.replace("Z", "+00:00"))
    if isinstance(dt2, str):
        dt2 = datetime.fromisoformat(dt2.replace("Z", "+00:00"))
    
    # Make both naive UTC
    if getattr(dt1, "tzinfo", None) is not None:
        from datetime import timezone
        dt1 = dt1.astimezone(timezone.utc).replace(tzinfo=None)
    if getattr(dt2, "tzinfo", None) is not None:
        from datetime import timezone
        dt2 = dt2.astimezone(timezone.utc).replace(tzinfo=None)
        
    return (dt1 - dt2).total_seconds()


# ---------------------------------------------------------------------------
# Dimension 1 — Technical Skills Match (30%)
# ---------------------------------------------------------------------------

SEMANTIC_MATCH_PROMPT = """You are a technical skills matching expert. Given two lists of skills, determine which required skills are matched by the candidate's skills.

For each required skill, classify the best match as:
- "exact": candidate has the exact same skill (e.g., "React" matches "React")
- "semantic": candidate has a semantically equivalent skill (e.g., "ReactJS" matches "React", "PostgreSQL" matches "Postgres")
- "inferred": candidate's experience implies this skill (e.g., "built REST APIs with Flask" implies "Python")
- "none": no match found

Return ONLY valid JSON array:
[
  {"required": "skill_name", "match_type": "exact|semantic|inferred|none", "matched_with": "candidate_skill_or_experience", "confidence": 0.0-1.0}
]
"""


def compute_technical_skills_score(
    parsed_cv: dict[str, Any],
    job: Optional[dict[str, Any]],
) -> float:
    """
    Dimension 1: Compare parsed CV technologies against job requirements.
    Uses Gemini for semantic and inferred matching.
    Returns score 0-100.
    """
    if not job:
        return 50.0

    required_skills = job.get("requiredSkills", [])
    if not required_skills:
        return 80.0

    candidate_skills = parsed_cv.get("skills", []) + parsed_cv.get("inferredTechnologies", [])
    experience_descriptions = " | ".join(
        exp.get("description", "") for exp in parsed_cv.get("experience", [])
    )

    def _run_local_keyword_matching():
        # Perform manual exact/substring match
        total_weight = len(required_skills)
        matched_weight = 0.0
        matches = []
        for req in required_skills:
            req_l = req.lower()
            found = False
            for cand in candidate_skills:
                cand_l = cand.lower()
                if req_l == cand_l:
                    matches.append({"required": req, "match_type": "exact", "confidence": 1.0})
                    matched_weight += 1.0
                    found = True
                    break
                elif req_l in cand_l or cand_l in req_l:
                    matches.append({"required": req, "match_type": "semantic", "confidence": 0.8})
                    matched_weight += 0.8
                    found = True
                    break
            if not found:
                # check experience description
                if req_l in experience_descriptions.lower():
                    matches.append({"required": req, "match_type": "inferred", "confidence": 0.6})
                    matched_weight += 0.6
                else:
                    matches.append({"required": req, "match_type": "none", "confidence": 0.0})
        
        base_score = (matched_weight / total_weight) * 100 if total_weight > 0 else 0
        
        # Apply critical skills penalty
        critical_skills = job.get("criticalSkills", [])
        penalty = 0.0
        for cs in critical_skills:
            skill_name = cs.get("name", "") if isinstance(cs, dict) else cs
            skill_penalty = cs.get("penalty", settings.critical_skill_penalty) if isinstance(cs, dict) else settings.critical_skill_penalty

            found = False
            for match in matches:
                if match.get("required", "").lower() == skill_name.lower() and match.get("match_type") != "none":
                    found = True
                    break
            if not found:
                penalty += skill_penalty

        final_score = max(0, min(100, base_score - penalty))
        return round(final_score, 2)

    from backend.firebase_admin_init import MOCK_MODE
    if MOCK_MODE or not settings.is_gemini_configured:
        logger.warning("Gemini API key is not set or mock mode. Falling back to local keyword skills matching.")
        return _run_local_keyword_matching()

    try:
        from backend.services.gemini_rest_service import call_gemini_rest
        response_text = call_gemini_rest(
            prompt=(
                f"Required skills: {json.dumps(required_skills)}\n\n"
                f"Candidate skills: {json.dumps(candidate_skills)}\n\n"
                f"Candidate experience: {experience_descriptions}"
            ),
            system_instruction=SEMANTIC_MATCH_PROMPT,
            response_json=True
        )

        matches = json.loads(response_text)
        match_weights = {"exact": 1.0, "semantic": 0.8, "inferred": 0.6, "none": 0.0}

        total_weight = len(required_skills)
        matched_weight = 0.0

        for match in matches:
            match_type = match.get("match_type", "none")
            weight = match_weights.get(match_type, 0.0)
            confidence = match.get("confidence", 1.0)
            matched_weight += weight * confidence

        base_score = (matched_weight / total_weight) * 100 if total_weight > 0 else 0

        critical_skills = job.get("criticalSkills", [])
        penalty = 0.0
        for cs in critical_skills:
            skill_name = cs.get("name", "") if isinstance(cs, dict) else cs
            skill_penalty = cs.get("penalty", settings.critical_skill_penalty) if isinstance(cs, dict) else settings.critical_skill_penalty

            found = False
            for match in matches:
                if match.get("required", "").lower() == skill_name.lower() and match.get("match_type") != "none":
                    found = True
                    break
            if not found:
                penalty += skill_penalty

        final_score = max(0, min(100, base_score - penalty))
        return round(final_score, 2)
    except Exception as e:
        logger.warning(f"Failed to perform semantic matching via Gemini API ({e}). Falling back to keyword skills matching.")
        return _run_local_keyword_matching()



# ---------------------------------------------------------------------------
# Dimension 2 — Experience & Seniority (20%)
# ---------------------------------------------------------------------------

SENIORITY_MAP = {
    "Junior": 1,
    "Mid": 2,
    "Senior": 3,
    "Lead": 4,
    "Principal": 5,
    "Staff": 4,
}


def compute_experience_score(
    parsed_cv: dict[str, Any],
    job: Optional[dict[str, Any]],
) -> float:
    """
    Dimension 2: Evaluate experience years, seniority match, domain fit, and leadership.
    Returns score 0-100.
    """
    if not job:
        return 50.0

    score = 0.0

    # Sub-score 1: Years of experience (40% of dimension)
    candidate_years = parsed_cv.get("totalYearsExperience", 0)
    required_years = job.get("requiredYears", 0)

    if required_years > 0:
        years_ratio = candidate_years / required_years
        if years_ratio >= 1.0:
            years_score = min(100, 80 + (years_ratio - 1.0) * 20)
        else:
            years_score = max(0, years_ratio * 80)
    else:
        years_score = 70 + min(30, candidate_years * 5)

    score += years_score * 0.40

    # Sub-score 2: Seniority level match (25% of dimension)
    candidate_seniority = parsed_cv.get("seniorityLevel", "Mid")
    required_seniority = job.get("requiredSeniority", "Mid")

    candidate_level = SENIORITY_MAP.get(candidate_seniority, 2)
    required_level = SENIORITY_MAP.get(required_seniority, 2)

    level_diff = abs(candidate_level - required_level)
    if level_diff == 0:
        seniority_score = 100
    elif level_diff == 1:
        seniority_score = 70
    elif level_diff == 2:
        seniority_score = 40
    else:
        seniority_score = 15

    score += seniority_score * 0.25

    # Sub-score 3: Domain experience (20% of dimension)
    preferred_domains = [d.lower() for d in job.get("preferredDomains", [])]
    candidate_domains = [d.lower() for d in parsed_cv.get("domainExperience", [])]

    if preferred_domains:
        domain_matches = sum(1 for d in preferred_domains if d in candidate_domains)
        domain_score = (domain_matches / len(preferred_domains)) * 100
    else:
        domain_score = 70

    score += domain_score * 0.20

    # Sub-score 4: Leadership signals (15% of dimension)
    leadership_signals = parsed_cv.get("leadershipSignals", [])
    leadership_count = len(leadership_signals)

    if leadership_count >= 5:
        leadership_score = 100
    elif leadership_count >= 3:
        leadership_score = 80
    elif leadership_count >= 1:
        leadership_score = 60
    else:
        leadership_score = 30

    score += leadership_score * 0.15

    return round(min(100, score), 2)


# ---------------------------------------------------------------------------
# Dimension 3 — Assessment Performance (25%)
# ---------------------------------------------------------------------------

def compute_assessment_score(
    assessment: dict[str, Any],
    time_limit_minutes: int = 120,
) -> float:
    """
    Dimension 3: Compute assessment performance score.
    Raw score + speed bonus - resubmission penalty.
    Returns score 0-100.
    """
    score_breakdown = assessment.get("scoreBreakdown", [])
    if not score_breakdown:
        return 0.0

    total_weight = 0.0
    weighted_score = 0.0

    questions = {q["id"]: q for q in assessment.get("questions", [])}

    for entry in score_breakdown:
        q_id = entry.get("questionId", "")
        question = questions.get(q_id, {})
        weight = question.get("weight", 1.0)
        max_score = entry.get("maxScore", 100)
        score = entry.get("score", 0)

        normalized = (score / max_score * 100) if max_score > 0 else 0
        weighted_score += normalized * weight
        total_weight += weight

    raw_score = weighted_score / total_weight if total_weight > 0 else 0

    # Speed bonus: +5 if completed under 50% of allotted time
    created_at = assessment.get("createdAt")
    submitted_at = assessment.get("submittedAt")
    speed_bonus = 0
    if created_at and submitted_at:
        elapsed_minutes = _safe_diff_seconds(submitted_at, created_at) / 60
        if elapsed_minutes < (time_limit_minutes * 0.5):
            speed_bonus = 5

    # Resubmission penalty: -3 per extra coding submission
    answers = assessment.get("answers", [])
    resubmission_penalty = 0
    for answer in answers:
        submissions = answer.get("codeSubmissionsCount", 1)
        if submissions > 1:
            resubmission_penalty += (submissions - 1) * 3

    final_score = max(0, min(100, raw_score + speed_bonus - resubmission_penalty))
    return round(final_score, 2)


# ---------------------------------------------------------------------------
# Dimension 4 — CV Quality & Communication (10%)
# ---------------------------------------------------------------------------

CV_QUALITY_PROMPT = """You are an expert HR recruiter evaluating CV quality and communication.

Score the CV on a scale of 0-100 based on:
1. CLARITY (25%): Is the CV well-organized with clear sections? Are job descriptions specific?
2. STRUCTURE (25%): Proper formatting, consistent dates, logical flow?
3. QUANTIFIED ACHIEVEMENTS (30%): Does the candidate quantify results? ("increased revenue by 30%", "reduced latency by 50ms")
4. GRAMMAR & PROFESSIONALISM (20%): Proper grammar, professional tone, no typos?

PENALTIES:
- Generic objective statement: -10 points
- Unexplained employment gaps > 12 months: -15 points per gap
- No measurable outcomes anywhere: -20 points

Return ONLY valid JSON:
{
  "score": 75,
  "rationale": "Brief 2-3 sentence explanation",
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"]
}
"""


def compute_cv_quality_score(cv_text: str) -> float:
    """
    Dimension 4: Claude evaluates CV quality holistically.
    Returns score 0-100.
    """
    def _generate_mock_cv_quality():
        # Calculate structured properties to make it deterministic
        text_len = len(cv_text)
        if text_len > 4000:
            return 88.0
        elif text_len > 2000:
            return 78.0
        elif text_len > 500:
            return 68.0
        else:
            return 45.0

    from backend.firebase_admin_init import MOCK_MODE
    if MOCK_MODE or not settings.is_gemini_configured:
        logger.warning("Gemini API key is not set or mock mode. Generating mock CV quality score.")
        return _generate_mock_cv_quality()

    try:
        from backend.services.gemini_rest_service import call_gemini_rest
        response_text = call_gemini_rest(
            prompt=f"Evaluate this CV:\n\n---\n{cv_text[:6000]}\n---",
            system_instruction=CV_QUALITY_PROMPT,
            response_json=True
        )

        result = json.loads(response_text)
        return float(result.get("score", 50))
    except Exception as e:
        logger.warning(f"Failed to score CV quality via Gemini API ({e}). Falling back to mock CV quality score.")
        return _generate_mock_cv_quality()



# ---------------------------------------------------------------------------
# Dimension 5 — Cultural & Role Fit (10%)
# ---------------------------------------------------------------------------

CULTURAL_FIT_PROMPT = """You are an expert at evaluating cultural and role fit for candidates.

You are given:
1. A role persona description written by the hiring manager
2. Relevant excerpts from the candidate's CV
3. Open-ended assessment answers (if available)

Evaluate how well the candidate matches the role persona. Consider:
- Communication style and tone
- Self-motivation indicators
- Teamwork vs independence signals
- Growth mindset indicators
- Domain passion signals

Return ONLY valid JSON:
{
  "score": 75,
  "rationale": "2-3 sentence explanation",
  "fit_signals": ["signal1", "signal2"],
  "concerns": ["concern1"]
}
"""


def compute_cultural_fit_score(
    cv_text: str,
    open_ended_answers: list[str],
    role_persona_prompt: str,
) -> float:
    """
    Dimension 5: Claude compares candidate against the job's role persona.
    Returns score 0-100.
    """
    def _generate_mock_cultural_fit():
        import random
        return float(random.randint(75, 92))

    from backend.firebase_admin_init import MOCK_MODE
    if MOCK_MODE or not settings.is_gemini_configured:
        logger.warning("Gemini API key is not set or mock mode. Generating mock cultural fit score.")
        return _generate_mock_cultural_fit()

    if not role_persona_prompt:
        return 65.0

    try:
        from backend.services.gemini_rest_service import call_gemini_rest
        answers_text = "\n".join(f"Answer {i+1}: {a}" for i, a in enumerate(open_ended_answers)) if open_ended_answers else "No open-ended answers available."

        response_text = call_gemini_rest(
            prompt=(
                f"ROLE PERSONA:\n{role_persona_prompt}\n\n"
                f"CANDIDATE CV EXCERPT:\n{cv_text[:3000]}\n\n"
                f"OPEN-ENDED ANSWERS:\n{answers_text}"
            ),
            system_instruction=CULTURAL_FIT_PROMPT,
            response_json=True
        )

        result = json.loads(response_text)
        return float(result.get("score", 50))
    except Exception as e:
        logger.warning(f"Failed to score cultural fit via Gemini API ({e}). Falling back to mock cultural fit score.")
        return _generate_mock_cultural_fit()



# ---------------------------------------------------------------------------
# Dimension 6 — Response Time & Engagement (5%)
# ---------------------------------------------------------------------------

def compute_engagement_score(
    sent_at: Optional[datetime],
    submitted_at: Optional[datetime],
) -> float:
    """
    Dimension 6: Score based on response time.
    < 24h = 100, 24-48h = 75, 48-72h = 50, >72h = 25, not submitted = 0
    """
    if not sent_at or not submitted_at:
        return 0.0

    hours_elapsed = _safe_diff_seconds(submitted_at, sent_at) / 3600

    if hours_elapsed < 24:
        return 100.0
    elif hours_elapsed < 48:
        return 75.0
    elif hours_elapsed < 72:
        return 50.0
    else:
        return 25.0


# ---------------------------------------------------------------------------
# Composite Score Calculator
# ---------------------------------------------------------------------------

DEFAULT_WEIGHTS = {
    "technicalSkills": 0.30,
    "experienceSeniority": 0.20,
    "assessmentPerformance": 0.25,
    "cvQuality": 0.10,
    "culturalFit": 0.10,
    "engagement": 0.05,
}


def compute_composite(
    dimensions: dict[str, float],
    weights: Optional[dict[str, float]] = None,
) -> float:
    """
    Compute final composite score from all 6 dimensions.

    dimensions: {
        "technicalSkills": 85.0,
        "experienceSeniority": 70.0,
        "assessmentPerformance": 90.0,
        "cvQuality": 75.0,
        "culturalFit": 60.0,
        "engagement": 100.0,
    }

    Returns composite score 0-100.
    """
    w = weights or DEFAULT_WEIGHTS

    composite = (
        dimensions.get("technicalSkills", 0) * w.get("technicalSkills", 0.30) +
        dimensions.get("experienceSeniority", 0) * w.get("experienceSeniority", 0.20) +
        dimensions.get("assessmentPerformance", 0) * w.get("assessmentPerformance", 0.25) +
        dimensions.get("cvQuality", 0) * w.get("cvQuality", 0.10) +
        dimensions.get("culturalFit", 0) * w.get("culturalFit", 0.10) +
        dimensions.get("engagement", 0) * w.get("engagement", 0.05)
    )

    return round(max(0, min(100, composite)), 2)


def build_full_score_dimensions(
    d1_score: float,
    d2_score: float,
    d3_score: float,
    d4_score: float,
    d5_score: float,
    d6_score: float,
    weights: Optional[dict[str, float]] = None,
    d1_rationale: str = "",
    d2_rationale: str = "",
    d3_rationale: str = "",
    d4_rationale: str = "",
    d5_rationale: str = "",
    d6_rationale: str = "",
) -> dict:
    """Build the full scoreDimensions object for Firestore storage."""
    w = weights or DEFAULT_WEIGHTS

    return {
        "technicalSkills": {
            "dimension": "D1",
            "label": "Technical Skills Match",
            "weight": w.get("technicalSkills", 0.30),
            "rawScore": round(d1_score, 2),
            "weightedScore": round(d1_score * w.get("technicalSkills", 0.30), 2),
            "rationale": d1_rationale,
        },
        "experienceSeniority": {
            "dimension": "D2",
            "label": "Experience & Seniority",
            "weight": w.get("experienceSeniority", 0.20),
            "rawScore": round(d2_score, 2),
            "weightedScore": round(d2_score * w.get("experienceSeniority", 0.20), 2),
            "rationale": d2_rationale,
        },
        "assessmentPerformance": {
            "dimension": "D3",
            "label": "Assessment Performance",
            "weight": w.get("assessmentPerformance", 0.25),
            "rawScore": round(d3_score, 2),
            "weightedScore": round(d3_score * w.get("assessmentPerformance", 0.25), 2),
            "rationale": d3_rationale,
        },
        "cvQuality": {
            "dimension": "D4",
            "label": "CV Quality & Communication",
            "weight": w.get("cvQuality", 0.10),
            "rawScore": round(d4_score, 2),
            "weightedScore": round(d4_score * w.get("cvQuality", 0.10), 2),
            "rationale": d4_rationale,
        },
        "culturalFit": {
            "dimension": "D5",
            "label": "Cultural & Role Fit",
            "weight": w.get("culturalFit", 0.10),
            "rawScore": round(d5_score, 2),
            "weightedScore": round(d5_score * w.get("culturalFit", 0.10), 2),
            "rationale": d5_rationale,
        },
        "engagement": {
            "dimension": "D6",
            "label": "Response Time & Engagement",
            "weight": w.get("engagement", 0.05),
            "rawScore": round(d6_score, 2),
            "weightedScore": round(d6_score * w.get("engagement", 0.05), 2),
            "rationale": d6_rationale,
        },
    }
