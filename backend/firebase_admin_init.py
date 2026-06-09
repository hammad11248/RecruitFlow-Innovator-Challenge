import os
import sys
import firebase_admin
from firebase_admin import credentials, firestore, storage
from backend.config import settings

# Global mock mode indicators
MOCK_MODE = False
db = None
bucket = None

def _initialize_firebase():
    """Initialize Firebase Admin SDK or fallback to mock mode."""
    global db, bucket, MOCK_MODE
    key_path = settings.firebase_service_account_path
    
    if not key_path or not os.path.exists(key_path):
        MOCK_MODE = True
    else:
        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate(key_path)
                firebase_admin.initialize_app(cred, {
                    "storageBucket": settings.firebase_storage_bucket,
                })
            db = firestore.client()
            bucket = storage.bucket()
            print("Successfully initialized Firebase Admin SDK.")
        except Exception as e:
            print(f"Failed to initialize Firebase Admin SDK: {e}. Falling back to MOCK mode.")
            MOCK_MODE = True

# Execute initialization
_initialize_firebase()

# Fallback configuration
if MOCK_MODE:
    print("\n" + "="*80)
    print("WARNING: Firebase service account key not found or failed to load.")
    print("Backend is running in MOCK/DEMO mode using local mock_db.json.")
    print("="*80 + "\n")
    
    from backend.firebase_admin_init_mock import mock_db, mock_bucket, mock_firestore_module
    sys.modules['firebase_admin.firestore'] = mock_firestore_module
    db = mock_db
    bucket = mock_bucket

