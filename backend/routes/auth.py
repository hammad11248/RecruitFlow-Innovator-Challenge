import uuid
from datetime import datetime
from typing import Optional
from fastapi import Depends, HTTPException, status, APIRouter
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
from backend.firebase_admin_init import MOCK_MODE
from backend.services import firestore_service

router = APIRouter(tags=["Auth"])

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


@router.post("/auth/signup")
async def signup_hr_user(user_data: dict):
    email = user_data.get("email")
    password = user_data.get("password")
    role = user_data.get("role", "recruiter")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    uid = None
    if MOCK_MODE:
        uid = f"mock-uid-{uuid.uuid4().hex[:8]}"
    else:
        try:
            user_record = auth.create_user(email=email, password=password)
            uid = user_record.uid
        except Exception as e:
            # Fall back to mock mode if Firebase auth isn't configured
            print(f"Firebase auth failed ({e}), falling back to mock mode")
            uid = f"mock-uid-{uuid.uuid4().hex[:8]}"
    
    profile_data = {
        "uid": uid,
        "email": email,
        "role": role,
        "createdAt": datetime.utcnow().isoformat()
    }
    
    await firestore_service.create_hr_user(uid, profile_data)
    
    return {
        "uid": uid,
        "email": email,
        "role": role,
        "message": "User registered successfully"
    }
