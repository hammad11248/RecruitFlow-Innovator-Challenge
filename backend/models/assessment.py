"""
Assessment Pydantic v2 models — covers question types (MCQ, coding, open-ended),
answer submission, per-question scoring breakdown, and full assessment response.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class QuestionType(str, Enum):
    """Type of assessment question."""
    MCQ = "mcq"
    CODING = "coding"
    OPEN_ENDED = "open_ended"


class AssessmentQuestion(BaseModel):
    """Single assessment question definition."""
    id: str
    type: QuestionType
    prompt: str
    options: list[str] = Field(
        default_factory=list,
        description="MCQ answer options (only for MCQ type)"
    )
    correct_answer: Optional[str] = Field(
        default=None,
        alias="correctAnswer",
        serialization_alias="correctAnswer",
        description="Correct answer for MCQ type"
    )
    test_cases: list[dict[str, Any]] = Field(
        default_factory=list,
        alias="testCases",
        serialization_alias="testCases",
        description="Test cases for coding questions: [{input, expected_output}]"
    )
    rubric: str = Field(
        default="",
        description="Scoring rubric for open-ended questions (sent to Claude)"
    )
    max_score: float = Field(
        default=100.0,
        alias="maxScore",
        serialization_alias="maxScore",
    )
    weight: float = Field(
        default=1.0,
        description="Weight of this question in overall assessment score"
    )
    time_limit_minutes: int = Field(
        default=30,
        alias="timeLimitMinutes",
        serialization_alias="timeLimitMinutes",
    )

    model_config = {"populate_by_name": True}


class AnswerSubmission(BaseModel):
    """Single answer from a candidate."""
    question_id: str = Field(alias="questionId", serialization_alias="questionId")
    answer: str
    code_submissions_count: int = Field(
        default=1,
        alias="codeSubmissionsCount",
        serialization_alias="codeSubmissionsCount",
        description="Number of code submission attempts (for penalty calculation)"
    )
    submitted_at: datetime = Field(
        default_factory=datetime.utcnow,
        alias="submittedAt",
        serialization_alias="submittedAt",
    )

    model_config = {"populate_by_name": True}


class ScoreBreakdownEntry(BaseModel):
    """Per-question scoring result."""
    question_id: str = Field(alias="questionId", serialization_alias="questionId")
    score: float
    max_score: float = Field(
        default=100.0,
        alias="maxScore",
        serialization_alias="maxScore",
    )
    feedback: str = ""
    passed_test_cases: Optional[int] = Field(
        default=None,
        alias="passedTestCases",
        serialization_alias="passedTestCases",
    )
    total_test_cases: Optional[int] = Field(
        default=None,
        alias="totalTestCases",
        serialization_alias="totalTestCases",
    )

    model_config = {"populate_by_name": True}


class AssessmentSubmission(BaseModel):
    """Request body for submitting assessment answers."""
    token: str
    answers: list[AnswerSubmission]


class AssessmentCreate(BaseModel):
    """Data needed to create a new assessment in Firestore."""
    token: str
    candidate_id: str = Field(alias="candidateId", serialization_alias="candidateId")
    job_id: str = Field(alias="jobId", serialization_alias="jobId")
    questions: list[AssessmentQuestion]
    time_limit_minutes: int = Field(
        default=120,
        alias="timeLimitMinutes",
        serialization_alias="timeLimitMinutes",
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        alias="createdAt",
        serialization_alias="createdAt",
    )

    model_config = {"populate_by_name": True}


class AssessmentResponse(BaseModel):
    """Full assessment document response."""
    token: str
    candidate_id: str = Field(alias="candidateId", serialization_alias="candidateId")
    job_id: str = Field(default="", alias="jobId", serialization_alias="jobId")
    questions: list[AssessmentQuestion] = Field(default_factory=list)
    answers: list[AnswerSubmission] = Field(default_factory=list)
    score: float = 0.0
    passed: bool = False
    score_breakdown: list[ScoreBreakdownEntry] = Field(
        default_factory=list,
        alias="scoreBreakdown",
        serialization_alias="scoreBreakdown",
    )
    time_limit_minutes: int = Field(
        default=120,
        alias="timeLimitMinutes",
        serialization_alias="timeLimitMinutes",
    )
    evaluated_at: Optional[datetime] = Field(
        default=None,
        alias="evaluatedAt",
        serialization_alias="evaluatedAt",
    )
    created_at: Optional[datetime] = Field(
        default=None,
        alias="createdAt",
        serialization_alias="createdAt",
    )

    model_config = {"populate_by_name": True}


class AssessmentTemplate(BaseModel):
    """Reusable assessment template tied to a job."""
    id: str
    title: str
    description: str = ""
    questions: list[AssessmentQuestion]
    time_limit_minutes: int = Field(
        default=120,
        alias="timeLimitMinutes",
        serialization_alias="timeLimitMinutes",
    )
    section_weights: dict[str, float] = Field(
        default_factory=lambda: {
            "mcq": 0.30,
            "coding": 0.50,
            "open_ended": 0.20,
        },
        alias="sectionWeights",
        serialization_alias="sectionWeights",
        description="Weight per question type section for Dimension 3 scoring"
    )

    model_config = {"populate_by_name": True}
