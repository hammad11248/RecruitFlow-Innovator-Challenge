import os
import sys

# Ensure project root is in sys.path to allow absolute imports of 'backend'
api_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(api_dir)
root_dir = os.path.dirname(backend_dir)

if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.main import app

# Vercel requires the app variable to be exposed for ASGI serverless execution
