"""
Candidate Pydantic v2 models — covers the full candidate lifecycle,
parsed CV data, 6-dimension scoring, and state history tracking.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class CandidateStatus(str, Enum):
    """Pipeline status enum for candidate lifecycle tracking."""
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    PROCESSING_FAILED = "PROCESSING_FAILED"
    AI_SCREENING_PASSED = "AI_SCREENING_PASSED"
    AI_SCREENING_FAILED = "AI_SCREENING_FAILED"
    ASSESSMENT_SENT = "ASSESSMENT_SENT"
    ASSESSMENT_SUBMITTED = "ASSESSMENT_SUBMITTED"
    SCORED = "SCORED"
    INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED"
    REJECTED = "REJECTED"


class ExperienceEntry(BaseModel):
    """Single work experience entry from parsed CV."""
    company: str = ""
    role: str = ""
    duration: str = ""
    description: str = ""


class ParsedCVJson(BaseModel):
    """Structured CV data extracted by Claude AI agent."""
    skills: list[str] = Field(default_factory=list)
    experience: list[ExperienceEntry] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)
    inferred_technologies: list[str] = Field(
        default_factory=list,
        alias="inferredTechnologies",
        serialization_alias="inferredTechnologies",
    )
    seniority_level: str = Field(
        default="Mid",
        alias="seniorityLevel",
        serialization_alias="seniorityLevel",
    )
    total_years_experience: float = Field(
        default=0.0,
        alias="totalYearsExperience",
        serialization_alias="totalYearsExperience",
    )
    leadership_signals: list[str] = Field(
        default_factory=list,
        alias="leadershipSignals",
        serialization_alias="leadershipSignals",
    )
    domain_experience: list[str] = Field(
        default_factory=list,
        alias="domainExperience",
        serialization_alias="domainExperience",
    )
    screening_score: float = Field(
        default=0.0,
        alias="screeningScore",
        serialization_alias="screeningScore",
    )
    screening_rationale: str = Field(
        default="",
        alias="screeningRationale",
        serialization_alias="screeningRationale",
    )

    model_config = {"populate_by_name": True}


class DimensionScore(BaseModel):
    """Score for a single dimension of the 6-dimension rubric."""
    dimension: str
    label: str
    weight: float
    raw_score: float = Field(
        default=0.0,
        ge=0.0,
        le=100.0,
        alias="rawScore",
        serialization_alias="rawScore",
    )
    weighted_score: float = Field(
        default=0.0,
        alias="weightedScore",
        serialization_alias="weightedScore",
    )
    rationale: str = ""

    model_config = {"populate_by_name": True}


class ScoreDimensions(BaseModel):
    """Full 6-dimension scoring breakdown for a candidate."""
    technical_skills: DimensionScore = Field(
        default_factory=lambda: DimensionScore(
            dimension="D1",
            label="Technical Skills Match",
            weight=0.30,
        ),
        alias="technicalSkills",
        serialization_alias="technicalSkills",
    )
    experience_seniority: DimensionScore = Field(
        default_factory=lambda: DimensionScore(
            dimension="D2",
            label="Experience & Seniority",
            weight=0.20,
        ),
        alias="experienceSeniority",
        serialization_alias="experienceSeniority",
    )
    assessment_performance: DimensionScore = Field(
        default_factory=lambda: DimensionScore(
            dimension="D3",
            label="Assessment Performance",
            weight=0.25,
        ),
        alias="assessmentPerformance",
        serialization_alias="assessmentPerformance",
    )
    cv_quality: DimensionScore = Field(
        default_factory=lambda: DimensionScore(
            dimension="D4",
            label="CV Quality & Communication",
            weight=0.10,
        ),
        alias="cvQuality",
        serialization_alias="cvQuality",
    )
    cultural_fit: DimensionScore = Field(
        default_factory=lambda: DimensionScore(
            dimension="D5",
            label="Cultural & Role Fit",
            weight=0.10,
        ),
        alias="culturalFit",
        serialization_alias="culturalFit",
    )
    engagement: DimensionScore = Field(
        default_factory=lambda: DimensionScore(
            dimension="D6",
            label="Response Time & Engagement",
            weight=0.05,
        ),
    )

    model_config = {"populate_by_name": True}


class StateHistoryEntry(BaseModel):
    """Single entry in the candidate's state transition history."""
    state: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    meta: dict[str, Any] = Field(default_factory=dict)


class CandidateCreate(BaseModel):
    """Request body for creating a new candidate (after CV upload)."""
    name: str
    email: str
    phone: str = ""
    job_id: str = Field(alias="jobId", serialization_alias="jobId")

    model_config = {"populate_by_name": True}


class CandidateResponse(BaseModel):
    """Full candidate document response."""
    id: str
    name: str
    email: str
    phone: str = ""
    cv_storage_path: str = Field(
        default="",
        alias="cvStoragePath",
        serialization_alias="cvStoragePath",
    )
    cv_download_url: str = Field(
        default="",
        alias="cvDownloadUrl",
        serialization_alias="cvDownloadUrl",
    )
    parsed_json: Optional[ParsedCVJson] = Field(
        default=None,
        alias="parsedJson",
        serialization_alias="parsedJson",
    )
    status: CandidateStatus = CandidateStatus.UPLOADED
    screening_score: float = Field(
        default=0.0,
        alias="screeningScore",
        serialization_alias="screeningScore",
    )
    composite_score: float = Field(
        default=0.0,
        alias="compositeScore",
        serialization_alias="compositeScore",
    )
    score_dimensions: Optional[ScoreDimensions] = Field(
        default=None,
        alias="scoreDimensions",
        serialization_alias="scoreDimensions",
    )
    assessment_token: str = Field(
        default="",
        alias="assessmentToken",
        serialization_alias="assessmentToken",
    )
    assessment_score: float = Field(
        default=0.0,
        alias="assessmentScore",
        serialization_alias="assessmentScore",
    )
    assessment_sent_at: Optional[datetime] = Field(
        default=None,
        alias="assessmentSentAt",
        serialization_alias="assessmentSentAt",
    )
    assessment_submitted_at: Optional[datetime] = Field(
        default=None,
        alias="assessmentSubmittedAt",
        serialization_alias="assessmentSubmittedAt",
    )
    interview_scheduled_at: Optional[datetime] = Field(
        default=None,
        alias="interviewScheduledAt",
        serialization_alias="interviewScheduledAt",
    )
    state_history: list[StateHistoryEntry] = Field(
        default_factory=list,
        alias="stateHistory",
        serialization_alias="stateHistory",
    )
    created_at: Optional[datetime] = Field(
        default=None,
        alias="createdAt",
        serialization_alias="createdAt",
    )
    job_id: str = Field(
        default="",
        alias="jobId",
        serialization_alias="jobId",
    )

    model_config = {"populate_by_name": True}


class CandidateUpdate(BaseModel):
    """Partial update for a candidate document."""
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[CandidateStatus] = None
    screening_score: Optional[float] = Field(default=None, alias="screeningScore")
    composite_score: Optional[float] = Field(default=None, alias="compositeScore")
    score_dimensions: Optional[dict] = Field(default=None, alias="scoreDimensions")
    parsed_json: Optional[dict] = Field(default=None, alias="parsedJson")
    assessment_token: Optional[str] = Field(default=None, alias="assessmentToken")
    assessment_score: Optional[float] = Field(default=None, alias="assessmentScore")
    assessment_sent_at: Optional[datetime] = Field(default=None, alias="assessmentSentAt")
    assessment_submitted_at: Optional[datetime] = Field(default=None, alias="assessmentSubmittedAt")
    interview_scheduled_at: Optional[datetime] = Field(default=None, alias="interviewScheduledAt")
    cv_storage_path: Optional[str] = Field(default=None, alias="cvStoragePath")
    cv_download_url: Optional[str] = Field(default=None, alias="cvDownloadUrl")

    model_config = {"populate_by_name": True}


class CandidateListParams(BaseModel):
    """Query parameters for listing candidates with filters."""
    status: Optional[CandidateStatus] = None
    min_score: Optional[float] = Field(default=None, alias="minScore")
    max_score: Optional[float] = Field(default=None, alias="maxScore")
    job_id: Optional[str] = Field(default=None, alias="jobId")
    date_from: Optional[datetime] = Field(default=None, alias="dateFrom")
    date_to: Optional[datetime] = Field(default=None, alias="dateTo")
    limit: int = 50
    order_by: str = Field(default="createdAt", alias="orderBy")

    model_config = {"populate_by_name": True}
