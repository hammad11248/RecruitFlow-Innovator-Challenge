import os
import sys
import json
import firebase_admin
from firebase_admin import credentials, initialize_app, firestore, storage
from backend.config import settings

# Global mock mode indicators
MOCK_MODE = False
db = None
bucket = None

def _initialize_firebase():
    global db, bucket, MOCK_MODE
    
    # Check if JSON credential env var is provided
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    
    if service_account_json:
        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate(json.loads(service_account_json))
                initialize_app(cred, {
                    "storageBucket": settings.firebase_storage_bucket,
                })
            db = firestore.client()
            bucket = storage.bucket()
            print("Successfully initialized Firebase Admin SDK from environment JSON.")
        except Exception as e:
            print(f"Failed to initialize Firebase Admin SDK from environment JSON: {e}. Falling back to mock.")
            MOCK_MODE = True
    else:
        # Fallback to local file path
        key_path = settings.firebase_service_account_path
        
        # Resolve relative key_path to project_root to ensure robustness
        if key_path.startswith("./") or not os.path.isabs(key_path):
            from backend.config import project_root
            resolved_key_path = os.path.abspath(os.path.join(project_root, key_path))
            
            # Secondary fallback: check inside the backend/ folder if not found in root
            if not os.path.exists(resolved_key_path):
                backend_key = key_path[2:] if key_path.startswith("./") else key_path
                backend_key_path = os.path.abspath(os.path.join(project_root, "backend", backend_key))
                if os.path.exists(backend_key_path):
                    resolved_key_path = backend_key_path
        else:
            resolved_key_path = key_path

        if not resolved_key_path or not os.path.exists(resolved_key_path):
            # Check for direct serviceAccountKey.json in current directory or project root
            fallback_key = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../serviceAccountKey.json"))
            if os.path.exists(fallback_key):
                resolved_key_path = fallback_key
            else:
                fallback_key_local = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "serviceAccountKey.json"))
                if os.path.exists(fallback_key_local):
                    resolved_key_path = fallback_key_local
                else:
                    resolved_key_path = None

        if not resolved_key_path:
            MOCK_MODE = True
        else:
            try:
                if not firebase_admin._apps:
                    cred = credentials.Certificate(resolved_key_path)
                    initialize_app(cred, {
                        "storageBucket": settings.firebase_storage_bucket,
                    })
                db = firestore.client()
                bucket = storage.bucket()
                print("Successfully initialized Firebase Admin SDK from file.")
            except Exception as e:
                print(f"Failed to initialize Firebase Admin SDK: {e}. Falling back to MOCK mode.")
                MOCK_MODE = True

# Execute initialization
_initialize_firebase()

# Fallback configuration
if MOCK_MODE:
    print("\n" + "="*85)
    print("[WARNING] serviceAccountKey.json not found! Launching RecruitFlow in LOCAL MOCK ENGINE MODE.")
    print("Backend is running in MOCK/DEMO mode using local mock_db.json.")
    print("="*85 + "\n")
    
    from backend.firebase_admin_init_mock import mock_db, mock_bucket, mock_firestore_module
    sys.modules['firebase_admin.firestore'] = mock_firestore_module
    db = mock_db
    bucket = mock_bucket
