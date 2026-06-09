from pydantic import BaseModel, Field
from typing import Optional

class ScoreRubric(BaseModel):
    """Pydantic model representing candidate evaluation scores across 6 dimensions."""
    technical_skills: Optional[float] = Field(default=0.0)
    experience: Optional[float] = Field(default=0.0)
    assessment: Optional[float] = Field(default=0.0)
    communication: Optional[float] = Field(default=0.0)
    cultural_fit: Optional[float] = Field(default=0.0)
    engagement: Optional[float] = Field(default=0.0)

class CandidateApplication(BaseModel):
    """Pydantic model representing candidate profile and ingestion state."""
    id: str
    job_id: str
    email: str
    full_name: str
    funnel_status: str = "SCREENING_PENDING"
    cv_text: Optional[str] = None
    scores: Optional[ScoreRubric] = Field(default_factory=ScoreRubric)
