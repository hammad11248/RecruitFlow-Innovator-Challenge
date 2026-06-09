"""
Job Pydantic v2 models — job postings with required skills, critical skills,
domain preferences, role persona, and configurable 6-dimension scoring weights.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ScoringWeights(BaseModel):
    """Configurable weights for the 6-dimension scoring rubric per job."""
    technical_skills: float = Field(
        default=0.30,
        alias="technicalSkills",
        serialization_alias="technicalSkills",
    )
    experience_seniority: float = Field(
        default=0.20,
        alias="experienceSeniority",
        serialization_alias="experienceSeniority",
    )
    assessment_performance: float = Field(
        default=0.25,
        alias="assessmentPerformance",
        serialization_alias="assessmentPerformance",
    )
    cv_quality: float = Field(
        default=0.10,
        alias="cvQuality",
        serialization_alias="cvQuality",
    )
    cultural_fit: float = Field(
        default=0.10,
        alias="culturalFit",
        serialization_alias="culturalFit",
    )
    engagement: float = Field(default=0.05)

    model_config = {"populate_by_name": True}


class CriticalSkill(BaseModel):
    """A critical skill with a configurable penalty for missing it."""
    name: str
    penalty: float = Field(
        default=15.0,
        description="Points deducted from Dimension 1 if this skill is missing"
    )


class JobCreate(BaseModel):
    """Request body for creating a new job posting."""
    title: str
    description: str
    required_skills: list[str] = Field(
        default_factory=list,
        alias="requiredSkills",
        serialization_alias="requiredSkills",
    )
    critical_skills: list[CriticalSkill] = Field(
        default_factory=list,
        alias="criticalSkills",
        serialization_alias="criticalSkills",
        description="Skills with heavy penalties if missing (Dimension 1)"
    )
    required_years: float = Field(
        default=0.0,
        alias="requiredYears",
        serialization_alias="requiredYears",
        description="Minimum years of experience (Dimension 2)"
    )
    required_seniority: str = Field(
        default="Mid",
        alias="requiredSeniority",
        serialization_alias="requiredSeniority",
        description="Expected seniority level: Junior/Mid/Senior/Lead"
    )
    preferred_domains: list[str] = Field(
        default_factory=list,
        alias="preferredDomains",
        serialization_alias="preferredDomains",
        description="Preferred industry domains (Dimension 2)"
    )
    role_persona_prompt: str = Field(
        default="",
        alias="rolePersonaPrompt",
        serialization_alias="rolePersonaPrompt",
        description="Free-text role persona for cultural fit scoring (Dimension 5)"
    )
    threshold_score: float = Field(
        default=60.0,
        alias="thresholdScore",
        serialization_alias="thresholdScore",
        description="Minimum composite score to pass and get an interview"
    )
    screening_threshold: float = Field(
        default=40.0,
        alias="screeningThreshold",
        serialization_alias="screeningThreshold",
        description="Minimum partial score (D1+D2+D4) to proceed to assessment"
    )
    assessment_template_id: str = Field(
        default="",
        alias="assessmentTemplateId",
        serialization_alias="assessmentTemplateId",
    )
    scoring_weights: ScoringWeights = Field(
        default_factory=ScoringWeights,
        alias="scoringWeights",
        serialization_alias="scoringWeights",
    )
    auto_reject_deadline_hours: int = Field(
        default=72,
        alias="autoRejectDeadlineHours",
        serialization_alias="autoRejectDeadlineHours",
        description="Hours before auto-rejecting non-responsive candidates (Dimension 6)"
    )
    is_active: bool = Field(
        default=True,
        alias="isActive",
        serialization_alias="isActive",
    )

    model_config = {"populate_by_name": True}


class JobResponse(BaseModel):
    """Full job document response."""
    id: str
    title: str
    description: str
    required_skills: list[str] = Field(
        default_factory=list,
        alias="requiredSkills",
        serialization_alias="requiredSkills",
    )
    critical_skills: list[CriticalSkill] = Field(
        default_factory=list,
        alias="criticalSkills",
        serialization_alias="criticalSkills",
    )
    required_years: float = Field(
        default=0.0,
        alias="requiredYears",
        serialization_alias="requiredYears",
    )
    required_seniority: str = Field(
        default="Mid",
        alias="requiredSeniority",
        serialization_alias="requiredSeniority",
    )
    preferred_domains: list[str] = Field(
        default_factory=list,
        alias="preferredDomains",
        serialization_alias="preferredDomains",
    )
    role_persona_prompt: str = Field(
        default="",
        alias="rolePersonaPrompt",
        serialization_alias="rolePersonaPrompt",
    )
    threshold_score: float = Field(
        default=60.0,
        alias="thresholdScore",
        serialization_alias="thresholdScore",
    )
    screening_threshold: float = Field(
        default=40.0,
        alias="screeningThreshold",
        serialization_alias="screeningThreshold",
    )
    assessment_template_id: str = Field(
        default="",
        alias="assessmentTemplateId",
        serialization_alias="assessmentTemplateId",
    )
    scoring_weights: ScoringWeights = Field(
        default_factory=ScoringWeights,
        alias="scoringWeights",
        serialization_alias="scoringWeights",
    )
    auto_reject_deadline_hours: int = Field(
        default=72,
        alias="autoRejectDeadlineHours",
        serialization_alias="autoRejectDeadlineHours",
    )
    is_active: bool = Field(
        default=True,
        alias="isActive",
        serialization_alias="isActive",
    )
    created_at: Optional[datetime] = Field(
        default=None,
        alias="createdAt",
        serialization_alias="createdAt",
    )

    model_config = {"populate_by_name": True}
