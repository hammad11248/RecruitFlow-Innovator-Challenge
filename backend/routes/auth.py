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
    Decodes and validates token if provided, extracting the role parameter.
    """
    if not credentials:
        return None

    token = credentials.credentials
    
    # Check for Mock Mode or mock-prefixed tokens
    if MOCK_MODE or token == "mock-token" or token.startswith("mock-"):
        mock_email = "hr@company.com"
        if token.startswith("mock-token:"):
            mock_email = token.split(":", 1)[1]

        # 1. Check if HR user exists
        hr_user = await firestore_service.get_hr_user_by_email(mock_email)
        if hr_user:
            role = hr_user.get("role")
            if role in ("recruiter", "interviewer", "hr_manager", "hr"):
                role = "hr"
            return {
                "uid": hr_user.get("uid"),
                "email": mock_email,
                "role": role
            }

        # 2. Check if Candidate exists
        candidate = await firestore_service.get_candidate_by_email(mock_email)
        if candidate:
            return {
                "uid": candidate.get("id"),
                "email": mock_email,
                "role": "candidate"
            }

        # Fallback default
        return {
            "uid": "mock-hr-uid",
            "email": mock_email,
            "role": "hr"
        }

    try:
        decoded_token = auth.verify_id_token(token)
        
        # Ensure role claim exists in decoded token, fallback to Firestore if needed
        if decoded_token and not decoded_token.get("role"):
            uid = decoded_token.get("uid")
            email = decoded_token.get("email")
            if uid:
                user_doc = await firestore_service.get_hr_user(uid)
                if user_doc:
                    role = user_doc.get("role")
                    if role in ("recruiter", "interviewer", "hr_manager", "hr"):
                        decoded_token["role"] = "hr"
                    else:
                        decoded_token["role"] = role
                elif email:
                    candidate = await firestore_service.get_candidate_by_email(email)
                    if candidate:
                        decoded_token["role"] = "candidate"
                        
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
    Dependency that requires the user to be authenticated as an HR user (hr).
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    role = user.get("role")
    if role not in ("hr", "recruiter", "interviewer", "hr_manager"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Role '{role}' does not have HR administrative privileges.",
        )
    return user


@router.post("/auth/signup")
async def signup_hr_user(user_data: dict):
    email = user_data.get("email")
    password = user_data.get("password")
    role = user_data.get("role", "hr")
    
    # Restrict roles strictly to 'candidate' or 'hr'
    if role not in ("candidate", "hr"):
        role = "hr"
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    uid = None
    if MOCK_MODE:
        uid = f"mock-uid-{uuid.uuid4().hex[:8]}"
    else:
        try:
            user_record = auth.create_user(email=email, password=password)
            uid = user_record.uid
            # Set custom role claim in Firebase ID token
            auth.set_custom_user_claims(uid, {"role": role})
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


@router.get("/auth/me")
async def get_me(user: dict = Depends(verify_firebase_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "uid": user.get("uid"),
        "email": user.get("email"),
        "role": user.get("role")
    }
