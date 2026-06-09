import os
import sys

# Ensure parent directory is in sys.path to allow absolute imports of 'backend' 
# regardless of whether the server is started from root or from the backend folder
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Initialize Firebase Admin SDK on import (singleton)
import backend.firebase_admin_init  # noqa: F401


from backend.routes.candidates import router as candidates_router
from backend.routes.assessments import router as assessments_router
from backend.routes.schedule import router as schedule_router

app = FastAPI(
    title="HR Recruitment Funnel API",
    description="Enterprise-grade automated HR recruitment pipeline with 6-dimension AI scoring",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

from backend.config import settings

# CORS configuration — allow frontend at localhost:5173 and configured URL
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]
if settings.frontend_url:
    normalized_origin = settings.frontend_url.rstrip("/")
    if normalized_origin not in origins:
        origins.append(normalized_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import os
from fastapi import HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

# Include route modules
app.include_router(candidates_router, prefix="/api")
app.include_router(assessments_router, prefix="/api")
app.include_router(schedule_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "HR Recruitment Funnel API",
        "version": "1.0.0",
    }


# ===========================================================================
# Serve React Frontend Static Files (Single Link Unified Hosting)
# ===========================================================================

possible_paths = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend/dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "dist")),
    "/app/frontend/dist",
    "./frontend/dist",
]

frontend_dist = None
for path in possible_paths:
    if os.path.exists(path) and os.path.exists(os.path.join(path, "index.html")):
        frontend_dist = path
        break

if frontend_dist:
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        # Prevent catching API endpoints
        if catchall.startswith("api/") or catchall.startswith("api"):
            raise HTTPException(status_code=404, detail="API route not found")
        
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            with open(index_file, "r", encoding="utf-8") as f:
                return HTMLResponse(content=f.read())
        raise HTTPException(status_code=404, detail="index.html not found")
else:
    @app.get("/{catchall:path}")
    async def fallback_frontend(catchall: str):
        if catchall.startswith("api/") or catchall.startswith("api"):
            raise HTTPException(status_code=404, detail="API route not found")
        return HTMLResponse(
            content="""
            <div style="font-family: sans-serif; text-align: center; margin-top: 100px;">
                <h2>TalentFlow Frontend dist folder not found</h2>
                <p>Please run <code>npm run build</code> (or <code>npx vite build</code>) in the <code>frontend/</code> directory first to generate the production files.</p>
            </div>
            """,
            status_code=404
        )

