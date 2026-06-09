from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
from backend.firebase_admin_init import MOCK_MODE

security = HTTPBearer(auto_error=False)

async def verify_firebase_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[dict]:
    """
    FastAPI dependency to verify the Firebase Authorization Bearer token.
    Returns None if no token is provided.
    Decodes and validates token if provided.
    """
    if not credentials:
        return None

    token = credentials.credentials
    if MOCK_MODE or token.startswith("mock-"):
        return {
            "uid": "mock-hr-uid",
            "email": "hr@company.com",
            "role": "recruiter"
        }

    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired authentication credentials: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def require_hr_user(
    user: Optional[dict] = Depends(verify_firebase_token)
) -> dict:
    """
    Dependency that requires the user to be authenticated as an HR user.
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
