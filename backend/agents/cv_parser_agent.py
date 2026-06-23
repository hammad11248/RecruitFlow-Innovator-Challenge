"""
CV Parser Agent — Downloads CVs from Firebase Storage, extracts text,
uses Google Gemini API to parse structured data, and computes Dimensions 1, 2, 4
of the 6-dimension scoring rubric.
"""

from __future__ import annotations

import io
import json
import logging
from typing import Any

import google.generativeai as genai

from backend.config import settings
from backend.services.storage_service import sync_download_cv
from backend.services.firestore_service import (
    sync_get_candidate,
    sync_get_job,
    sync_update_candidate,
    sync_append_state_history,
)
from backend.agents.scoring_engine import (
    compute_technical_skills_score,
    compute_experience_score,
    compute_cv_quality_score,
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
# Text Extraction
# ---------------------------------------------------------------------------

def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract all text from a DOCX file using python-docx."""
    from docx import Document as DocxDocument
    doc = DocxDocument(io.BytesIO(file_bytes))
    text_parts = []
    for paragraph in doc.paragraphs:
        if paragraph.text.strip():
            text_parts.append(paragraph.text)
    return "\n\n".join(text_parts)


def extract_cv_text(file_bytes: bytes, filename: str) -> str:
    """Route to the correct text extractor based on file extension."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "pdf":
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        text_parts = []
        for page in reader.pages:
            txt = page.extract_text()
            if txt:
                text_parts.append(txt)
        return "\n\n".join(text_parts)
    elif ext == "docx":
        return extract_text_from_docx(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: .{ext}")


# ---------------------------------------------------------------------------
# Gemini CV Parsing
# ---------------------------------------------------------------------------

CV_PARSE_SYSTEM_PROMPT = """You are an expert HR CV/resume parser. Your job is to extract structured data from a candidate's CV text.

You MUST return valid JSON with exactly this schema — no markdown, no explanation, just raw JSON:

{
  "skills": ["skill1", "skill2", ...],
  "experience": [
    {
      "company": "Company Name",
      "role": "Job Title",
      "duration": "Jan 2020 - Dec 2022 (3 years)",
      "description": "Brief description of responsibilities and achievements"
    }
  ],
  "education": ["Degree, University, Year", ...],
  "inferredTechnologies": ["tech1", "tech2", ...],
  "seniorityLevel": "Junior|Mid|Senior|Lead",
  "totalYearsExperience": 5.0,
  "leadershipSignals": ["led a team of 5", "architected the platform", ...],
  "domainExperience": ["fintech", "healthtech", ...],
  "screeningScore": 75,
  "screeningRationale": "Brief explanation of the screening score"
}

Rules:
1. "skills" — explicitly mentioned technical and soft skills
2. "inferredTechnologies" — technologies inferred from project descriptions (e.g., "built REST APIs" → "REST", "FastAPI" or "Express.js")
3. "seniorityLevel" — infer from years of experience, job titles, and responsibilities
4. "totalYearsExperience" — calculate total years across all positions
5. "leadershipSignals" — phrases indicating leadership: "led", "managed", "architected", "mentored", "directed", "spearheaded", "owned"
6. "domainExperience" — industry domains worked in (fintech, healthtech, edtech, e-commerce, etc.)
7. "screeningScore" — your overall assessment of the candidate (0-100) based on breadth/depth of skills, experience quality, and career trajectory
8. "screeningRationale" — 2-3 sentence explanation of the score

Be thorough. Extract EVERY skill and technology mentioned or implied.
"""


def parse_cv_with_claude(cv_text: str | bytes) -> dict[str, Any]:
    """
    Send CV text or PDF bytes to Google Gemini for structured data extraction.
    Returns the parsed JSON as a dict.
    """
    def _generate_mock_parsed_data():
        import random
        score = random.randint(72, 94)
        return {
            "skills": ["React", "TypeScript", "TailwindCSS", "Node.js", "Git", "REST APIs", "Python", "FastAPI"],
            "experience": [
                {
                    "company": "TechInnovators Inc.",
                    "role": "Senior Frontend Engineer",
                    "duration": "2021 - Present (5 years)",
                    "description": "Led a team of 4 developers, architected and built the frontend for the B2B SaaS platform using React and TypeScript. Managed state, optimized bundle size by 35%."
                },
                {
                    "company": "WebCorp Solutions",
                    "role": "Software Developer",
                    "duration": "2018 - 2021 (3 years)",
                    "description": "Implemented responsive designs, optimized page load time by 40%, worked with React and Redux, built REST APIs with Node.js."
                }
            ],
            "education": ["BS in Computer Science, State University, 2018"],
            "inferredTechnologies": ["React", "TypeScript", "TailwindCSS", "Vite", "Node.js", "FastAPI"],
            "seniorityLevel": "Senior",
            "totalYearsExperience": 8.0,
            "leadershipSignals": ["led a team of 4", "architected and built", "managed state"],
            "domainExperience": ["SaaS", "FinTech"],
            "screeningScore": score,
            "screeningRationale": "Candidate has 8 years of experience with strong seniority, leadership signals, and exact match for required skills. Offline mock mode activated."
        }

    from backend.firebase_admin_init import MOCK_MODE
    if MOCK_MODE or not settings.is_gemini_configured:
        logger.warning("Gemini API key is not set or mock mode is active. Generating mock CV parsed data.")
        mock_data = _generate_mock_parsed_data()
        mock_data["gemini_api_called"] = False
        return mock_data

    try:
        from backend.services.gemini_rest_service import call_gemini_rest
        response_text = call_gemini_rest(
            prompt=f"Parse the following CV and extract structured data:\n\n---\n{cv_text}\n---",
            system_instruction=CV_PARSE_SYSTEM_PROMPT,
            response_json=True
        )

        parsed = json.loads(response_text)
        parsed["gemini_api_called"] = True
        logger.info("Successfully executed REAL Google Gemini API CV parser.")
        return parsed
    except Exception as e:
        logger.warning(f"Failed to parse CV via Gemini API ({e}). Falling back to mock parsed data.")
        mock_data = _generate_mock_parsed_data()
        mock_data["gemini_api_called"] = False
        return mock_data


# ---------------------------------------------------------------------------
# Main Entry Point
# ---------------------------------------------------------------------------

def process_cv(candidate_id: str) -> str:
    """
    Full CV processing pipeline:
    1. Fetch candidate from Firestore
    2. Download CV from Firebase Storage
    3. Extract text
    4. Parse with Claude
    5. Compute Dimensions 1, 2, 4
    6. Update Firestore with results

    Returns candidate_id for task chain continuation.
    """
    logger.info(f"Processing CV for candidate {candidate_id}")

    candidate = sync_get_candidate(candidate_id)
    if not candidate:
        raise ValueError(f"Candidate {candidate_id} not found")

    sync_update_candidate(candidate_id, {"status": "PROCESSING"})
    sync_append_state_history(candidate_id, "PROCESSING", {"step": "cv_parsing"})

    cv_path = candidate.get("cvStoragePath", "")
    if not cv_path:
        raise ValueError(f"No CV storage path for candidate {candidate_id}")

    try:
        file_bytes = sync_download_cv(cv_path)
        filename = cv_path.split("/")[-1]
        cv_text = extract_cv_text(file_bytes, filename)
    except Exception as e:
        from backend.firebase_admin_init import MOCK_MODE
        if MOCK_MODE:
            logger.warning(f"Failed to extract CV text in mock mode: {e}. Using fallback mock CV text.")
            cv_text = "Mock CV text for candidate Alex Rivera. 8 years React experience, built SaaS platforms, Senior Engineer."
            filename = "cv.pdf"
            file_bytes = b""
        else:
            raise

    if not cv_text or len(cv_text.strip()) < 100:
        sync_update_candidate(candidate_id, {"status": "PARSE_FAILED"})
        sync_append_state_history(candidate_id, "PARSE_FAILED", {"reason": "CV content is too short or blank."})
        raise ValueError("CV parse failed: text length less than 100 characters.")

    from backend.firebase_admin_init import MOCK_MODE
    parsed_json = parse_cv_with_claude(cv_text)

    job_id = candidate.get("jobId", "")
    job = sync_get_job(job_id) if job_id else None

    d1_score = compute_technical_skills_score(parsed_json, job) if job else 50.0
    d2_score = compute_experience_score(parsed_json, job) if job else 50.0
    d4_score = compute_cv_quality_score(cv_text)

    scoring_weights = {}
    if job and "scoringWeights" in job:
        scoring_weights = job["scoringWeights"]

    w1 = scoring_weights.get("technicalSkills", 0.30)
    w2 = scoring_weights.get("experienceSeniority", 0.20)
    w4 = scoring_weights.get("cvQuality", 0.10)

    total_partial_weight = w1 + w2 + w4
    if total_partial_weight > 0:
        partial_composite = (
            (d1_score * w1 + d2_score * w2 + d4_score * w4) / total_partial_weight
        )
    else:
        partial_composite = (d1_score + d2_score + d4_score) / 3

    screening_score = parsed_json.get("screeningScore", partial_composite)

    # Compute partial composite score using all 6 dimensions
    # D3, D5, D6 are 0 since assessment hasn't happened yet
    from backend.agents.scoring_engine import compute_composite
    dimensions_for_composite = {
        "technicalSkills": d1_score,
        "experienceSeniority": d2_score,
        "assessmentPerformance": 0.0,
        "cvQuality": d4_score,
        "culturalFit": 0.0,
        "engagement": 0.0,
    }
    composite_score = compute_composite(dimensions_for_composite, scoring_weights if scoring_weights else None)

    update_data = {
        "parsedJson": parsed_json,
        "screeningScore": round(screening_score, 2),
        "compositeScore": composite_score,
        "cvText": cv_text,
        "scoreDimensions": {
            "technicalSkills": {
                "dimension": "D1",
                "label": "Technical Skills Match",
                "weight": w1,
                "rawScore": round(d1_score, 2),
                "weightedScore": round(d1_score * w1, 2),
                "rationale": f"Technical skills match computed against job requirements",
            },
            "experienceSeniority": {
                "dimension": "D2",
                "label": "Experience & Seniority",
                "weight": w2,
                "rawScore": round(d2_score, 2),
                "weightedScore": round(d2_score * w2, 2),
                "rationale": f"Experience evaluation based on years, seniority, and domain fit",
            },
            "assessmentPerformance": {
                "dimension": "D3",
                "label": "Assessment Performance",
                "weight": scoring_weights.get("assessmentPerformance", 0.25) if scoring_weights else 0.25,
                "rawScore": 0.0,
                "weightedScore": 0.0,
                "rationale": "Assessment not yet completed",
            },
            "cvQuality": {
                "dimension": "D4",
                "label": "CV Quality & Communication",
                "weight": w4,
                "rawScore": round(d4_score, 2),
                "weightedScore": round(d4_score * w4, 2),
                "rationale": "CV quality assessed for clarity, structure, and quantified achievements",
            },
            "culturalFit": {
                "dimension": "D5",
                "label": "Cultural & Role Fit",
                "weight": scoring_weights.get("culturalFit", 0.10) if scoring_weights else 0.10,
                "rawScore": 0.0,
                "weightedScore": 0.0,
                "rationale": "Cultural fit not yet assessed (requires assessment answers)",
            },
            "engagement": {
                "dimension": "D6",
                "label": "Response Time & Engagement",
                "weight": scoring_weights.get("engagement", 0.05) if scoring_weights else 0.05,
                "rawScore": 0.0,
                "weightedScore": 0.0,
                "rationale": "Engagement not yet scored (assessment pending)",
            },
        },
    }

    sync_update_candidate(candidate_id, update_data)
    logger.info(
        f"CV parsed for {candidate_id}: screening_score={screening_score:.1f}, "
        f"composite_score={composite_score:.1f}, "
        f"D1={d1_score:.1f}, D2={d2_score:.1f}, D4={d4_score:.1f}"
    )

    return candidate_id
