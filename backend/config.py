import os
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional

config_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(config_dir)
env_path = os.path.join(project_root, ".env")


class Settings(BaseSettings):
    """Central configuration for the HR Recruitment Funnel application."""

    # --- Firebase Admin SDK ---
    firebase_service_account_path: str = Field(
        default="./serviceAccountKey.json",
        description="Path to Firebase service account JSON key file"
    )
    firebase_storage_bucket: str = Field(
        default="your-project.appspot.com",
        description="Firebase Storage bucket name"
    )

    # --- Frontend Firebase Config (passed through for reference) ---
    vite_firebase_api_key: Optional[str] = None
    vite_firebase_auth_domain: Optional[str] = None
    vite_firebase_project_id: Optional[str] = None
    vite_firebase_storage_bucket: Optional[str] = None
    vite_firebase_messaging_sender_id: Optional[str] = None
    vite_firebase_app_id: Optional[str] = None

    # --- Google Gemini API ---
    gemini_api_key: str = Field(
        default="",
        description="Google Gemini API key"
    )
    gemini_model: str = Field(
        default="gemini-2.5-flash",
        description="Google Gemini model identifier"
    )

    # --- Gmail SMTP Email ---
    email_user: str = Field(
        default="",
        description="Gmail address for SMTP"
    )
    email_pass: str = Field(
        default="",
        description="Gmail App Password for SMTP"
    )


    # --- Google Calendar API ---
    google_calendar_credentials_path: str = Field(
        default="./calendar_credentials.json",
        description="Path to Google Calendar OAuth2 credentials JSON"
    )
    google_calendar_id: str = Field(
        default="primary",
        description="Google Calendar ID for interview scheduling"
    )


    # --- Application URLs ---
    frontend_url: str = Field(
        default="http://localhost:5173",
        description="Frontend application URL"
    )
    assessment_base_url: str = Field(
        default="http://localhost:5173/assessment",
        description="Base URL for assessment links sent to candidates"
    )

    # --- JWT Settings ---
    jwt_secret_key: str = Field(
        default="change-this-to-a-secure-secret-key",
        description="Secret key for signing assessment JWT tokens"
    )
    jwt_algorithm: str = Field(
        default="HS256",
        description="JWT signing algorithm"
    )
    assessment_token_expiry_hours: int = Field(
        default=72,
        description="Hours before an assessment token expires"
    )

    # --- Scoring Defaults ---
    default_scoring_weights: dict = Field(
        default={
            "technical_skills": 0.30,
            "experience_seniority": 0.20,
            "assessment_performance": 0.25,
            "cv_quality": 0.10,
            "cultural_fit": 0.10,
            "engagement": 0.05,
        },
        description="Default 6-dimension scoring weights"
    )
    default_auto_reject_deadline_hours: int = Field(
        default=72,
        description="Default hours before auto-rejecting non-responsive candidates"
    )
    critical_skill_penalty: float = Field(
        default=15.0,
        description="Default penalty points per missing critical skill"
    )

    @property
    def is_gemini_configured(self) -> bool:
        # Guard against FieldInfo typing at analysis time by coercing to str
        key = str(self.gemini_api_key or "")
        return bool(key and key.strip() and "your-key" not in key and "gemini-api-key" not in key)

    @property
    def is_email_configured(self) -> bool:
        # Coerce to str to avoid FieldInfo type during static analysis
        user = str(self.email_user or "")
        passw = str(self.email_pass or "")
        return bool(user and user.strip() and "your-email" not in user and passw and passw.strip() and "your-gmail" not in passw)


    model_config = {
        "env_file": env_path,
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
        "extra": "ignore",
    }


# Singleton settings instance
settings = Settings()
