"""
Firebase Storage service — handles CV file uploads, downloads, and URL generation.
Uses firebase-admin Storage bucket for server-side operations.
"""

from __future__ import annotations

import asyncio
from functools import partial
from typing import Optional

from backend.firebase_admin_init import bucket, db


async def _run_sync(func, *args, **kwargs):
    """Run a synchronous Firebase Storage call in a thread executor."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(func, *args, **kwargs))


def _upload_cv_sync(
    file_bytes: bytes,
    candidate_id: str,
    filename: str,
    content_type: str = "application/pdf",
) -> tuple[str, str]:
    """
    Upload CV file bytes to Firebase Storage, or fallback to Firestore if Storage is unavailable/disabled.
    Returns (storage_path, download_url).
    """
    import base64
    import logging
    
    # Store base64 data to candidates document in Firestore as backup/fallback.
    # This ensures everything works on the free Spark plan without upgrading to Blaze.
    try:
        cv_base64 = base64.b64encode(file_bytes).decode("utf-8")
        ref = db.collection("candidates").document(candidate_id)
        ref.set({
            "cvBase64": cv_base64,
            "cvFilename": filename,
            "cvContentType": content_type
        }, merge=True)
    except Exception as e:
        logging.getLogger(__name__).warning(f"Failed to write fallback CV base64 to Firestore: {e}")

    # Try uploading to Firebase Storage if bucket is configured
    if bucket is not None:
        try:
            storage_path = f"cvs/{candidate_id}/{filename}"
            blob = bucket.blob(storage_path)
            blob.upload_from_string(file_bytes, content_type=content_type)
            try:
                blob.make_public()
                download_url = blob.public_url
            except Exception:
                import datetime as dt
                try:
                    download_url = blob.generate_signed_url(
                        expiration=dt.timedelta(days=365),
                        method="GET",
                    )
                except Exception:
                    download_url = blob.public_url
            return storage_path, download_url
        except Exception as e:
            logging.getLogger(__name__).warning(f"Firebase Storage upload failed: {e}. Falling back to Firestore storage.")

    # Return database fallback URLs including the filename to preserve the file extension
    storage_path = f"db://candidates/{candidate_id}/{filename}"
    download_url = f"/api/candidates/{candidate_id}/cv"
    return storage_path, download_url


async def upload_cv(
    file_bytes: bytes,
    candidate_id: str,
    filename: str,
    content_type: str = "application/pdf",
) -> tuple[str, str]:
    """
    Async wrapper: Upload CV to Firebase Storage or database fallback.
    Returns (storage_path, download_url).
    """
    return await _run_sync(
        _upload_cv_sync, file_bytes, candidate_id, filename, content_type
    )


def _get_download_url_sync(storage_path: str) -> str:
    """Generate a signed download URL or return database route if using fallback."""
    if storage_path.startswith("db://"):
        parts = storage_path.split("/")
        candidate_id = parts[3] if len(parts) >= 4 else parts[-1]
        return f"/api/candidates/{candidate_id}/cv"
        
    import datetime as dt
    blob = bucket.blob(storage_path)
    try:
        url = blob.generate_signed_url(
            expiration=dt.timedelta(hours=24),
            method="GET",
        )
        return url
    except Exception:
        return blob.public_url


async def get_download_url(storage_path: str) -> str:
    """Async wrapper: Generate signed download URL."""
    return await _run_sync(_get_download_url_sync, storage_path)


def _download_cv_sync(storage_path: str) -> bytes:
    """Download a file from Firebase Storage or database fallback as bytes."""
    if storage_path.startswith("db://"):
        parts = storage_path.split("/")
        candidate_id = parts[3] if len(parts) >= 4 else parts[-1]
        doc_ref = db.collection("candidates").document(candidate_id)
        doc = doc_ref.get()
        if doc.exists:
            data = doc.to_dict() or {}
            if "cvBase64" in data:
                import base64
                return base64.b64decode(data["cvBase64"])
        raise ValueError(f"CV file not found in database for candidate {candidate_id}")
        
    blob = bucket.blob(storage_path)
    return blob.download_as_bytes()


async def download_cv(storage_path: str) -> bytes:
    """Async wrapper: Download CV file bytes."""
    return await _run_sync(_download_cv_sync, storage_path)


def sync_download_cv(storage_path: str) -> bytes:
    """Synchronous download for Celery tasks."""
    return _download_cv_sync(storage_path)


def sync_upload_cv(
    file_bytes: bytes,
    candidate_id: str,
    filename: str,
    content_type: str = "application/pdf",
) -> tuple[str, str]:
    """Synchronous upload for Celery tasks."""
    return _upload_cv_sync(file_bytes, candidate_id, filename, content_type)


def sync_get_download_url(storage_path: str) -> str:
    """Synchronous URL generation for Celery tasks."""
    return _get_download_url_sync(storage_path)



def get_file_extension(filename: str) -> str:
    """Extract file extension from filename."""
    if "." in filename:
        return filename.rsplit(".", 1)[1].lower()
    return ""


def validate_cv_file(filename: str, file_size: int) -> Optional[str]:
    """
    Validate CV file type and size.
    Returns error message string if invalid, None if valid.
    """
    allowed_extensions = {"pdf", "docx"}
    max_size_mb = 50

    ext = get_file_extension(filename)
    if ext not in allowed_extensions:
        return f"Invalid file type '.{ext}'. Only PDF and DOCX files are accepted."

    if file_size > max_size_mb * 1024 * 1024:
        return f"File size exceeds {max_size_mb}MB limit."

    return None
