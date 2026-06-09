import sys
import os

# Add workspace directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import settings
print("Configured path in .env:", settings.firebase_service_account_path)

# Import init to see if it initializes Firebase Admin SDK
from backend.firebase_admin_init import MOCK_MODE, db, bucket

print("MOCK_MODE active:", MOCK_MODE)
if MOCK_MODE:
    print("WARNING: Backend started in Mock Mode. Please verify serviceAccountKey.json is placed in the correct path.")
else:
    print("SUCCESS: Successfully initialized Firebase Admin SDK in live mode.")
    try:
        # Try checking connection status by fetching a dummy document from candidates collection
        print("Testing Firestore connection...")
        doc_ref = db.collection("candidates").document("test-conn-dummy")
        doc_ref.get()
        print("Firestore connection verified successfully!")
        
        print("Testing Storage connection...")
        print("Bucket name:", bucket.name)
        print("Storage connection verified successfully!")
    except Exception as e:
        print("ERROR: Firebase connection test failed with exception:")
        import traceback
        traceback.print_exc()
